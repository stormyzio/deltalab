import {
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  ELEMENT_SYMBOL_TO_SOLID_SPECIES_ID,
  type CanvasNode,
} from '../../shared/chemistry.ts'
import type { ActiveExternalDrag, ExternalDragItem } from '@/types/drag'
import { getDefaultSpeciesAmountMol } from '@/lib/chemistry-ui'
import { getFlaskHitTest } from '@/lib/canvas-geometry'
import { getDefaultWaterStepMl } from '@/lib/workbench-helpers'
import type { CanvasNotice, ViewportTransform } from '@/components/LabCanvas'

interface UseExternalDockDragParams {
  canvasRef: RefObject<HTMLDivElement | null>
  nodesRef: MutableRefObject<CanvasNode[]>
  viewport: ViewportTransform
  getSpawnWorldPoint: (clientX?: number, clientY?: number) => { x: number; y: number }
  spawnItem: (item: ExternalDragItem, worldX: number, worldY: number) => void
  addSpeciesToFlask: (
    flaskId: string,
    speciesId: string,
    options?: { amountMol?: number },
  ) => Promise<void>
  showNotice: (tone: CanvasNotice['tone'], text: string) => void
  triggerShake: (ids: string[]) => void
  onCloseMobilePanel: () => void
}

export function useExternalDockDrag({
  canvasRef,
  nodesRef,
  viewport,
  getSpawnWorldPoint,
  spawnItem,
  addSpeciesToFlask,
  showNotice,
  triggerShake,
  onCloseMobilePanel,
}: UseExternalDockDragParams) {
  const [externalDrag, setExternalDrag] = useState<ActiveExternalDrag | null>(null)
  const externalDragGhostRef = useRef<HTMLDivElement | null>(null)
  const externalDragMetaRef = useRef<{
    item: ExternalDragItem
    originX: number
    originY: number
    clientX: number
    clientY: number
    started: boolean
    hoveredKey: string | null
    rafId: number | null
  } | null>(null)
  const [externalHoveredFlaskId, setExternalHoveredFlaskId] = useState<string | null>(null)
  const [externalHoverHint, setExternalHoverHint] = useState<{
    text: string
    valid: boolean
  } | null>(null)

  const handleStartExternalDrag = useCallback(
    (item: ExternalDragItem, e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return
      e.preventDefault()
      externalDragMetaRef.current = {
        item,
        originX: e.clientX,
        originY: e.clientY,
        clientX: e.clientX,
        clientY: e.clientY,
        started: false,
        hoveredKey: null,
        rafId: null,
      }
      setExternalDrag({
        item,
        clientX: e.clientX,
        clientY: e.clientY,
        originX: e.clientX,
        originY: e.clientY,
        started: false,
      })
    },
    [],
  )

  const isExternalDragging = externalDrag !== null

  useEffect(() => {
    if (!isExternalDragging) return

    const onPointerMove = (e: PointerEvent) => {
      const meta = externalDragMetaRef.current
      if (!meta) return
      meta.clientX = e.clientX
      meta.clientY = e.clientY

      const moved =
        meta.started ||
        Math.hypot(e.clientX - meta.originX, e.clientY - meta.originY) > 5

      if (moved && !meta.started) {
        meta.started = true
        setExternalDrag({
          item: meta.item,
          clientX: e.clientX,
          clientY: e.clientY,
          originX: meta.originX,
          originY: meta.originY,
          started: true,
        })
      }

      if (moved && meta.rafId === null) {
        meta.rafId = requestAnimationFrame(() => {
          meta.rafId = null
          if (externalDragGhostRef.current) {
            externalDragGhostRef.current.style.transform = `translate3d(${meta.clientX}px, ${meta.clientY}px, 0) translate(-50%, -50%)`
          }
        })
      }

      if (moved && (meta.item.kind === 'molecule' || meta.item.kind === 'atom')) {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (
          rect &&
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          const worldPt = {
            x: (e.clientX - rect.left - viewport.x) / viewport.zoom,
            y: (e.clientY - rect.top - viewport.y) / viewport.zoom,
          }
          const flask = getFlaskHitTest(nodesRef.current, worldPt.x, worldPt.y)
          if (flask) {
            let nextHint: { text: string; valid: boolean }
            if (meta.item.kind === 'atom') {
              const el = meta.item.element
              const solidId = ELEMENT_SYMBOL_TO_SOLID_SPECIES_ID[el.symbol]
              if (!solidId) {
                nextHint = { text: `${el.symbol} non solide`, valid: false }
              } else {
                nextHint = {
                  text: flask.solution.hasWater
                    ? `Immerger ${el.symbol}(s)`
                    : `Ajouter ${el.symbol}(s)`,
                  valid: true,
                }
              }
            } else {
              const sp = meta.item.species
              if (sp.isSolvent) {
                const stepMl = getDefaultWaterStepMl(flask.vessel.capacityMl)
                nextHint = {
                  text: flask.solution.hasWater
                    ? `Diluer (+${stepMl} mL H₂O)`
                    : `Ajouter ${stepMl} mL H₂O`,
                  valid: flask.solution.totalVolumeMl < flask.vessel.capacityMl,
                }
              } else if (!flask.solution.hasWater) {
                const stateTag =
                  sp.standardState === 'solid'
                    ? '(s)'
                    : sp.standardState === 'gas'
                      ? '(g)'
                      : '(l)'
                nextHint = {
                  text: `Ajouter ${sp.displayFormula}${stateTag}`,
                  valid: true,
                }
              } else if (!sp.canDissolveInWater) {
                nextHint = {
                  text:
                    sp.standardState === 'solid'
                      ? `Immerger ${sp.displayFormula}(s)`
                      : `Introduire ${sp.displayFormula}`,
                  valid: true,
                }
              } else {
                nextHint = { text: `Dissoudre ${sp.displayFormula}`, valid: true }
              }
            }
            const nextKey = `${flask.id}|${nextHint.text}|${nextHint.valid}`
            if (meta.hoveredKey !== nextKey) {
              meta.hoveredKey = nextKey
              setExternalHoveredFlaskId(flask.id)
              setExternalHoverHint(nextHint)
            }
            return
          }
        }
      }
      if (meta.hoveredKey !== null) {
        meta.hoveredKey = null
        setExternalHoveredFlaskId(null)
        setExternalHoverHint(null)
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      const meta = externalDragMetaRef.current
      externalDragMetaRef.current = null
      if (meta?.rafId != null) cancelAnimationFrame(meta.rafId)

      if (meta) {
        const rect = canvasRef.current?.getBoundingClientRect()
        const wasDragged =
          meta.started ||
          Math.hypot(e.clientX - meta.originX, e.clientY - meta.originY) > 5

        if (!wasDragged) {
          const pt = getSpawnWorldPoint()
          spawnItem(meta.item, pt.x, pt.y)
          onCloseMobilePanel()
        } else if (
          rect &&
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          const pt = getSpawnWorldPoint(e.clientX, e.clientY)
          if (meta.item.kind === 'molecule') {
            const targetFlask = getFlaskHitTest(nodesRef.current, pt.x, pt.y)
            if (targetFlask) {
              void addSpeciesToFlask(targetFlask.id, meta.item.species.id, {
                amountMol: getDefaultSpeciesAmountMol(meta.item.species),
              })
            } else {
              spawnItem(meta.item, pt.x, pt.y)
            }
          } else if (meta.item.kind === 'atom') {
            const targetFlask = getFlaskHitTest(nodesRef.current, pt.x, pt.y)
            if (targetFlask) {
              const el = meta.item.element
              const solidId = ELEMENT_SYMBOL_TO_SOLID_SPECIES_ID[el.symbol]
              if (solidId) {
                void addSpeciesToFlask(targetFlask.id, solidId)
              } else {
                triggerShake([targetFlask.id])
                showNotice(
                  'warning',
                  `${el.symbol} n’est pas un corps simple solide immergeable.`,
                )
              }
            } else {
              spawnItem(meta.item, pt.x, pt.y)
            }
          } else {
            spawnItem(meta.item, pt.x, pt.y)
          }
          onCloseMobilePanel()
        }
      }

      setExternalDrag(null)
      setExternalHoveredFlaskId(null)
      setExternalHoverHint(null)
    }

    const onPointerCancel = () => {
      const meta = externalDragMetaRef.current
      externalDragMetaRef.current = null
      if (meta?.rafId != null) cancelAnimationFrame(meta.rafId)
      setExternalDrag(null)
      setExternalHoveredFlaskId(null)
      setExternalHoverHint(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [
    addSpeciesToFlask,
    canvasRef,
    getSpawnWorldPoint,
    isExternalDragging,
    nodesRef,
    onCloseMobilePanel,
    showNotice,
    spawnItem,
    triggerShake,
    viewport,
  ])

  return {
    externalDrag,
    externalDragGhostRef,
    externalHoveredFlaskId,
    externalHoverHint,
    handleStartExternalDrag,
  }
}
