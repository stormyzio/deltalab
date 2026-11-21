import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  CanvasFlaskNode,
  CanvasNode,
  PhIndicatorId,
  SpeciesRecord,
} from '../../shared/chemistry.ts'
import { NODE_HALF_SIZE, getFlaskHitTest } from '@/lib/canvas-geometry'
import { findTitrationPairs } from '@/lib/titration-engine'
import type { LabPresetDefinition, SavedWorkbenchRecord } from '@/lib/lab-presets'
import { cn } from '@/lib/utils'
import { computeCanvasDropHint } from '@/components/canvas/canvas-drop-hints'
import { AtomTile, FlaskTile, MoleculeTile } from '@/components/canvas/CanvasTiles'
import {
  IsomerPickerDialog,
  type PendingMergeIsomers,
} from '@/components/canvas/IsomerPickerDialog'
import {
  type CanvasNotice,
  CanvasNoticeBanner,
  CanvasSelectionBar,
  CanvasViewportHud,
} from '@/components/canvas/CanvasOverlayChrome'
import { LabPresetsPopover } from '@/components/canvas/LabPresetsPopover'
import {
  TitrationDrawer,
  type TitrationSessionState,
} from '@/components/canvas/TitrationDrawer'

export type { CanvasNotice, PendingMergeIsomers }

export interface ViewportTransform {
  x: number
  y: number
  zoom: number
}

interface LabCanvasProps {
  canvasRef: RefObject<HTMLDivElement | null>
  active?: boolean
  hydrated: boolean
  nodes: CanvasNode[]
  selectedIds: Set<string>
  viewport: ViewportTransform
  onViewportChange: (next: ViewportTransform) => void
  onSelectIds: (ids: Set<string>) => void
  onMoveNodes: (deltas: Array<{ id: string; x: number; y: number }>) => void
  onDuplicateNodesForDrag: (
    sourceIds: string[],
    dx: number,
    dy: number,
  ) => Map<string, string>
  onMergeSelected: () => void
  onIonizeSelected: (direction: 1 | -1) => void
  canIonizeMinus?: boolean
  canIonizePlus?: boolean
  onDuplicateSelected: () => void
  onDeleteIds: (ids: string[]) => void
  onEmptyFlask: (flaskId: string) => void
  onDropAtomOnFlask: (atomNodeId: string, flaskId: string) => void
  onDropMoleculeOnFlask: (moleculeNodeId: string, flaskId: string) => void
  onPourBetweenFlasks: (
    sourceFlaskId: string,
    targetFlaskId: string,
    volumeMl: number,
  ) => void
  onChangeFlaskReactionExtent: (flaskId: string, xMol: number) => void
  onSelectFlaskReaction: (flaskId: string, reactionId: string) => void
  onCommitFlaskReaction: (flaskId: string) => void
  onBalanceFlaskStoichiometry?: (flaskId: string) => void
  onResetView: () => void
  onClearCanvas: () => void
  savedWorkbenches: SavedWorkbenchRecord[]
  onLoadPreset: (preset: LabPresetDefinition) => void
  onSaveCurrentWorkbench: (name: string) => void
  onLoadSavedWorkbench: (record: SavedWorkbenchRecord) => void
  onDeleteSavedWorkbench: (id: string) => void
  externalHoveredFlaskId: string | null
  externalHoverHint: { text: string; valid: boolean } | null
  pulsingFlaskIds: Set<string>
  shakingNodeIds: Set<string>
  freshNodeIds: Set<string>
  notice: CanvasNotice | null
  pendingMergeIsomers: PendingMergeIsomers | null
  onPickMergeIsomer: (species: SpeciesRecord) => void
  onCancelMergeIsomer: () => void
  titrationSession: TitrationSessionState | null
  onOpenTitration: (buretteId?: string, analyteId?: string) => void
  onDispenseTitrationMl: (volumeMl: number) => void
  onToggleTitrationRunning: () => void
  onCycleTitrationSpeed: () => void
  onResetTitrationSession: () => void
  onCloseTitration: () => void
  onSetFlaskIndicator: (flaskId: string, indicatorId: PhIndicatorId | null) => void
}

interface MarqueeState {
  pointerId: number
  startX: number
  startY: number
  currentX: number
  currentY: number
  rafId: number | null
  lastSelectedIds: Set<string>
}

interface PourDragState {
  pointerId: number
  sourceFlaskId: string
  startX: number
  startY: number
  currentX: number
  currentY: number
  hoveredTargetId: string | null
  hoveredHint: { text: string; valid: boolean } | null
  hoveredKey: string | null
  rafId: number | null
}

export function LabCanvas({
  canvasRef,
  active = true,
  hydrated,
  nodes,
  selectedIds,
  viewport,
  onViewportChange,
  onSelectIds,
  onMoveNodes,
  onDuplicateNodesForDrag,
  onMergeSelected,
  onIonizeSelected,
  canIonizeMinus = true,
  canIonizePlus = true,
  onDuplicateSelected,
  onDeleteIds,
  onEmptyFlask,
  onDropAtomOnFlask,
  onDropMoleculeOnFlask,
  onPourBetweenFlasks,
  onChangeFlaskReactionExtent,
  onSelectFlaskReaction,
  onCommitFlaskReaction,
  onBalanceFlaskStoichiometry,
  onResetView,
  onClearCanvas,
  savedWorkbenches,
  onLoadPreset,
  onSaveCurrentWorkbench,
  onLoadSavedWorkbench,
  onDeleteSavedWorkbench,
  externalHoveredFlaskId,
  externalHoverHint,
  pulsingFlaskIds,
  shakingNodeIds,
  freshNodeIds,
  notice,
  pendingMergeIsomers,
  onPickMergeIsomer,
  onCancelMergeIsomer,
  titrationSession,
  onOpenTitration,
  onDispenseTitrationMl,
  onToggleTitrationRunning,
  onCycleTitrationSpeed,
  onResetTitrationSession,
  onCloseTitration,
  onSetFlaskIndicator,
}: LabCanvasProps) {
  const [toolMode, setToolMode] = useState<'select' | 'pan'>('select')
  const [spacePressed, setSpacePressed] = useState(false)
  const [altPressed, setAltPressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [marqueeActive, setMarqueeActive] = useState(false)
  const [internalHoveredFlaskId, setInternalHoveredFlaskId] = useState<string | null>(
    null,
  )
  const [internalHoverHint, setInternalHoverHint] = useState<{
    text: string
    valid: boolean
  } | null>(null)
  const [pourActive, setPourActive] = useState<{
    sourceFlaskId: string
    startX: number
    startY: number
    currentX: number
    currentY: number
    hoveredTargetId: string | null
    hoveredHint: { text: string; valid: boolean } | null
  } | null>(null)
  const [pendingPour, setPendingPour] = useState<{
    sourceFlaskId: string
    targetFlaskId: string
  } | null>(null)

  const worldLayerRef = useRef<HTMLDivElement | null>(null)
  const marqueeElRef = useRef<HTMLDivElement | null>(null)
  const marqueeStateRef = useRef<MarqueeState | null>(null)
  const pourDragRef = useRef<PourDragState | null>(null)
  const pourPathRef = useRef<SVGPathElement | null>(null)
  const pourTipRef = useRef<SVGCircleElement | null>(null)
  const nodeElMapRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const viewportRef = useRef<ViewportTransform>(viewport)
  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  const setNodeElRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      nodeElMapRef.current.set(id, el)
    } else {
      nodeElMapRef.current.delete(id)
    }
  }, [])

  const panStateRef = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    originX: number
    originY: number
    currentX: number
    currentY: number
    rafId: number | null
  } | null>(null)

  const wheelCommitTimerRef = useRef<number | null>(null)
  const pendingWheelViewportRef = useRef<ViewportTransform | null>(null)

  const hoveredFlaskKeyRef = useRef<string | null>(null)

  const dragNodesRef = useRef<{
    pointerId: number
    primaryNodeId: string
    sourcePrimaryNodeId: string
    primaryKind: CanvasNode['kind']
    startClientX: number
    startClientY: number
    origins: Map<string, { x: number; y: number }>
    lastUpdates: Array<{ id: string; x: number; y: number }>
    rafId: number | null
    moved: boolean
    duplicateOnDrag: boolean
    duplicated: boolean
  } | null>(null)

  useEffect(() => {
    return () => {
      if (wheelCommitTimerRef.current !== null) {
        window.clearTimeout(wheelCommitTimerRef.current)
      }
      if (panStateRef.current?.rafId != null) cancelAnimationFrame(panStateRef.current.rafId)
      if (dragNodesRef.current?.rafId != null) cancelAnimationFrame(dragNodesRef.current.rafId)
      if (marqueeStateRef.current?.rafId != null) {
        cancelAnimationFrame(marqueeStateRef.current.rafId)
      }
      if (pourDragRef.current?.rafId != null) cancelAnimationFrame(pourDragRef.current.rafId)
    }
  }, [])

  // Spacebar temporary pan mode & Alt duplicate-drag cursor hint
  useEffect(() => {
    if (!active) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAltPressed(true)
      }
      if (
        e.code === 'Space' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        setSpacePressed(true)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setAltPressed(false)
      if (e.code === 'Space') setSpacePressed(false)
    }
    const onBlur = () => {
      setAltPressed(false)
      setSpacePressed(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [active])

  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      const vp = viewportRef.current
      return {
        x: (clientX - rect.left - vp.x) / vp.zoom,
        y: (clientY - rect.top - vp.y) / vp.zoom,
      }
    },
    [canvasRef],
  )

  // Non-passive native wheel listener with direct GPU transform + rAF-coalesced React commit
  useEffect(() => {
    const el = canvasRef.current
    if (!el || !active) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const vp = pendingWheelViewportRef.current ?? viewportRef.current

      const pointerX = e.clientX - rect.left
      const pointerY = e.clientY - rect.top
      const factor = Math.exp(-e.deltaY * 0.0014)
      const nextZoom = Math.max(0.45, Math.min(2.2, vp.zoom * factor))
      const ratio = nextZoom / vp.zoom
      const nextVp: ViewportTransform = {
        zoom: nextZoom,
        x: pointerX - (pointerX - vp.x) * ratio,
        y: pointerY - (pointerY - vp.y) * ratio,
      }
      pendingWheelViewportRef.current = nextVp
      viewportRef.current = nextVp

      // Immediate GPU transform update without waiting for React
      if (worldLayerRef.current) {
        worldLayerRef.current.style.transform = `translate3d(${nextVp.x}px, ${nextVp.y}px, 0) scale(${nextVp.zoom})`
      }
      const nextDot = Math.max(14, 24 * nextVp.zoom)
      el.style.backgroundSize = `${nextDot}px ${nextDot}px`
      el.style.backgroundPosition = `${nextVp.x}px ${nextVp.y}px`

      if (wheelCommitTimerRef.current !== null) {
        window.clearTimeout(wheelCommitTimerRef.current)
      }
      wheelCommitTimerRef.current = window.setTimeout(() => {
        wheelCommitTimerRef.current = null
        const committed = pendingWheelViewportRef.current
        pendingWheelViewportRef.current = null
        if (committed) onViewportChange(committed)
      }, 90)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
    }
  }, [active, canvasRef, onViewportChange])

  const handleCanvasPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button === 1 || toolMode === 'pan' || spacePressed) {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      setIsPanning(true)
      const vp = viewportRef.current
      panStateRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        originX: vp.x,
        originY: vp.y,
        currentX: vp.x,
        currentY: vp.y,
        rafId: null,
      }
      return
    }

    if (e.button !== 0) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    setPendingPour(null)
    const initialSelected = e.shiftKey ? new Set(selectedIds) : new Set<string>()
    if (!e.shiftKey && selectedIds.size > 0) {
      onSelectIds(new Set())
    }

    e.currentTarget.setPointerCapture(e.pointerId)
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    marqueeStateRef.current = {
      pointerId: e.pointerId,
      startX: sx,
      startY: sy,
      currentX: sx,
      currentY: sy,
      rafId: null,
      lastSelectedIds: initialSelected,
    }
    setMarqueeActive(true)
  }

  const handleStartPourDrag = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>, sourceFlask: CanvasFlaskNode) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      setPendingPour(null)
      canvasRef.current?.setPointerCapture(e.pointerId)
      const worldPt = clientToWorld(e.clientX, e.clientY)
      pourDragRef.current = {
        pointerId: e.pointerId,
        sourceFlaskId: sourceFlask.id,
        startX: worldPt.x,
        startY: worldPt.y,
        currentX: worldPt.x,
        currentY: worldPt.y,
        hoveredTargetId: null,
        hoveredHint: null,
        hoveredKey: null,
        rafId: null,
      }
      setPourActive({
        sourceFlaskId: sourceFlask.id,
        startX: worldPt.x,
        startY: worldPt.y,
        currentX: worldPt.x,
        currentY: worldPt.y,
        hoveredTargetId: null,
        hoveredHint: null,
      })
    },
    [canvasRef, clientToWorld],
  )

  const handleCanvasPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pourDragRef.current) {
      const pd = pourDragRef.current
      if (pd.pointerId !== e.pointerId) return
      const worldPt = clientToWorld(e.clientX, e.clientY)
      pd.currentX = worldPt.x
      pd.currentY = worldPt.y

      // Direct 120fps DOM update of the live pour SVG arc without React re-renders
      if (pd.rafId === null) {
        pd.rafId = requestAnimationFrame(() => {
          pd.rafId = null
          const mx = (pd.startX + pd.currentX) * 0.5
          const arcLift = Math.min(
            64,
            Math.max(
              18,
              Math.hypot(pd.currentX - pd.startX, pd.currentY - pd.startY) * 0.22,
            ),
          )
          const my = Math.min(pd.startY, pd.currentY) - arcLift
          if (pourPathRef.current) {
            pourPathRef.current.setAttribute(
              'd',
              `M ${pd.startX} ${pd.startY} Q ${mx} ${my} ${pd.currentX} ${pd.currentY}`,
            )
          }
          if (pourTipRef.current) {
            pourTipRef.current.setAttribute('cx', String(pd.currentX))
            pourTipRef.current.setAttribute('cy', String(pd.currentY))
          }
        })
      }

      const targetFlask = getFlaskHitTest(nodes, worldPt.x, worldPt.y, pd.sourceFlaskId)
      let hoveredHint: { text: string; valid: boolean } | null = null
      if (targetFlask) {
        if (targetFlask.stoppered) {
          hoveredHint = { text: 'Verrerie bouchée', valid: false }
        } else if (targetFlask.vessel.capacityMl - targetFlask.solution.totalVolumeMl <= 0.1) {
          hoveredHint = { text: 'Verrerie pleine', valid: false }
        } else {
          const targetName = targetFlask.customLabel || targetFlask.vessel.nameFr
          hoveredHint = { text: `Verser dans ${targetName}`, valid: true }
        }
      }
      const nextKey = targetFlask
        ? `${targetFlask.id}|${hoveredHint?.text ?? ''}|${hoveredHint?.valid ?? ''}`
        : null
      if (pd.hoveredKey !== nextKey) {
        pd.hoveredKey = nextKey
        pd.hoveredTargetId = targetFlask?.id ?? null
        pd.hoveredHint = hoveredHint
        setPourActive({
          sourceFlaskId: pd.sourceFlaskId,
          startX: pd.startX,
          startY: pd.startY,
          currentX: pd.currentX,
          currentY: pd.currentY,
          hoveredTargetId: pd.hoveredTargetId,
          hoveredHint: pd.hoveredHint,
        })
      }
      return
    }
    if (panStateRef.current) {
      const pan = panStateRef.current
      pan.currentX = pan.originX + (e.clientX - pan.startClientX)
      pan.currentY = pan.originY + (e.clientY - pan.startClientY)
      if (pan.rafId === null) {
        pan.rafId = requestAnimationFrame(() => {
          pan.rafId = null
          const vp = viewportRef.current
          const nextVp = { ...vp, x: pan.currentX, y: pan.currentY }
          viewportRef.current = nextVp
          if (worldLayerRef.current) {
            worldLayerRef.current.style.transform = `translate3d(${nextVp.x}px, ${nextVp.y}px, 0) scale(${nextVp.zoom})`
          }
          if (canvasRef.current) {
            canvasRef.current.style.backgroundPosition = `${nextVp.x}px ${nextVp.y}px`
          }
        })
      }
      return
    }

    if (marqueeStateRef.current) {
      const mq = marqueeStateRef.current
      if (mq.pointerId !== e.pointerId) return
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      mq.currentX = e.clientX - rect.left
      mq.currentY = e.clientY - rect.top

      // Direct GPU marquee box update + selection diffing (zero React re-renders when selection is unchanged!)
      if (mq.rafId === null) {
        mq.rafId = requestAnimationFrame(() => {
          mq.rafId = null
          const left = Math.min(mq.startX, mq.currentX)
          const top = Math.min(mq.startY, mq.currentY)
          const width = Math.abs(mq.currentX - mq.startX)
          const height = Math.abs(mq.currentY - mq.startY)
          if (marqueeElRef.current) {
            marqueeElRef.current.style.transform = `translate3d(${left}px, ${top}px, 0)`
            marqueeElRef.current.style.width = `${width}px`
            marqueeElRef.current.style.height = `${height}px`
          }

          const vp = viewportRef.current
          const minX = (left - vp.x) / vp.zoom
          const maxX = (left + width - vp.x) / vp.zoom
          const minY = (top - vp.y) / vp.zoom
          const maxY = (top + height - vp.y) / vp.zoom

          const nextSelected = new Set<string>()
          for (const node of nodes) {
            const { hw, hh } = NODE_HALF_SIZE[node.kind]
            if (
              node.x + hw >= minX &&
              node.x - hw <= maxX &&
              node.y + hh >= minY &&
              node.y - hh <= maxY
            ) {
              nextSelected.add(node.id)
            }
          }

          const prev = mq.lastSelectedIds
          let changed = nextSelected.size !== prev.size
          if (!changed) {
            for (const id of nextSelected) {
              if (!prev.has(id)) {
                changed = true
                break
              }
            }
          }
          if (changed) {
            mq.lastSelectedIds = nextSelected
            onSelectIds(nextSelected)
          }
        })
      }
      return
    }

    if (dragNodesRef.current) {
      const drag = dragNodesRef.current
      const dxScreen = e.clientX - drag.startClientX
      const dyScreen = e.clientY - drag.startClientY
      if (!drag.moved && Math.hypot(dxScreen, dyScreen) < 3) return
      const isFirstMove = !drag.moved
      drag.moved = true

      const vp = viewportRef.current
      const dxWorld = dxScreen / vp.zoom
      const dyWorld = dyScreen / vp.zoom

      if (isFirstMove && (drag.duplicateOnDrag || e.altKey) && !drag.duplicated) {
        drag.duplicated = true
        const idMap = onDuplicateNodesForDrag([...drag.origins.keys()], dxWorld, dyWorld)
        if (idMap.size > 0) {
          const nextOrigins = new Map<string, { x: number; y: number }>()
          const initialUpdates: Array<{ id: string; x: number; y: number }> = []
          for (const [oldId, orig] of drag.origins.entries()) {
            const newId = idMap.get(oldId) ?? oldId
            nextOrigins.set(newId, orig)
            initialUpdates.push({ id: newId, x: orig.x + dxWorld, y: orig.y + dyWorld })
          }
          drag.origins = nextOrigins
          drag.lastUpdates = initialUpdates
          drag.primaryNodeId = idMap.get(drag.primaryNodeId) ?? drag.primaryNodeId
        }
      } else {
        const updates: Array<{ id: string; x: number; y: number }> = []
        for (const [id, orig] of drag.origins.entries()) {
          updates.push({ id, x: orig.x + dxWorld, y: orig.y + dyWorld })
        }
        drag.lastUpdates = updates

        // Zero-React-render GPU transform update via DOM refs
        if (drag.rafId === null) {
          drag.rafId = requestAnimationFrame(() => {
            drag.rafId = null
            for (const u of drag.lastUpdates) {
              const el = nodeElMapRef.current.get(u.id)
              if (el) {
                el.style.transform = `translate3d(${u.x}px, ${u.y}px, 0) translate(-50%, -50%)`
                el.style.zIndex = '15'
              }
            }
          })
        }
      }

      // Check flask drop target ONLY when dragging a single atom or molecule (flask-to-flask pouring uses the dedicated pour handle)
      if (
        drag.origins.size === 1 &&
        (drag.primaryKind === 'atom' || drag.primaryKind === 'molecule')
      ) {
        const worldPt = clientToWorld(e.clientX, e.clientY)
        const targetFlask = getFlaskHitTest(nodes, worldPt.x, worldPt.y, drag.primaryNodeId)
        if (targetFlask) {
          const draggedNode =
            nodes.find((n) => n.id === drag.primaryNodeId) ??
            nodes.find((n) => n.id === drag.sourcePrimaryNodeId)
          const nextHint = computeCanvasDropHint(draggedNode, targetFlask)

          const key = `${targetFlask.id}|${nextHint?.text ?? ''}|${nextHint?.valid ?? ''}`
          if (hoveredFlaskKeyRef.current !== key) {
            hoveredFlaskKeyRef.current = key
            setInternalHoveredFlaskId(targetFlask.id)
            setInternalHoverHint(nextHint)
          }
        } else if (hoveredFlaskKeyRef.current !== null) {
          hoveredFlaskKeyRef.current = null
          setInternalHoveredFlaskId(null)
          setInternalHoverHint(null)
        }
      }
    }
  }

  const handleCanvasPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pourDragRef.current) {
      const pd = pourDragRef.current
      pourDragRef.current = null
      if (pd.rafId !== null) cancelAnimationFrame(pd.rafId)
      setPourActive(null)
      if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
        canvasRef.current.releasePointerCapture(e.pointerId)
      }
      if (pd.hoveredTargetId && pd.hoveredHint?.valid) {
        setPendingPour({
          sourceFlaskId: pd.sourceFlaskId,
          targetFlaskId: pd.hoveredTargetId,
        })
      }
      return
    }
    if (panStateRef.current) {
      const pan = panStateRef.current
      panStateRef.current = null
      if (pan.rafId !== null) cancelAnimationFrame(pan.rafId)
      setIsPanning(false)
      const vp = viewportRef.current
      onViewportChange({ ...vp, x: pan.currentX, y: pan.currentY })
      return
    }
    if (marqueeStateRef.current) {
      const mq = marqueeStateRef.current
      marqueeStateRef.current = null
      if (mq.rafId !== null) cancelAnimationFrame(mq.rafId)
      setMarqueeActive(false)
      return
    }
    if (dragNodesRef.current) {
      const drag = dragNodesRef.current
      dragNodesRef.current = null
      if (drag.rafId !== null) cancelAnimationFrame(drag.rafId)

      for (const u of drag.lastUpdates) {
        const el = nodeElMapRef.current.get(u.id)
        if (el) el.style.zIndex = ''
      }

      let droppedOnFlask = false
      if (
        drag.moved &&
        drag.origins.size === 1 &&
        (drag.primaryKind === 'atom' || drag.primaryKind === 'molecule')
      ) {
        const worldPt = clientToWorld(e.clientX, e.clientY)
        const targetFlask = getFlaskHitTest(nodes, worldPt.x, worldPt.y, drag.primaryNodeId)
        if (targetFlask) {
          droppedOnFlask = true
          if (drag.lastUpdates.length > 0) {
            onMoveNodes(drag.lastUpdates)
          }
          if (drag.primaryKind === 'atom') {
            onDropAtomOnFlask(drag.primaryNodeId, targetFlask.id)
          } else if (drag.primaryKind === 'molecule') {
            onDropMoleculeOnFlask(drag.primaryNodeId, targetFlask.id)
          }
        }
      }

      if (drag.moved && !droppedOnFlask && drag.lastUpdates.length > 0) {
        onMoveNodes(drag.lastUpdates)
      }

      if (hoveredFlaskKeyRef.current !== null) {
        hoveredFlaskKeyRef.current = null
        setInternalHoveredFlaskId(null)
        setInternalHoverHint(null)
      }
    }
  }

  const handleNodePointerDown = (
    e: ReactPointerEvent<HTMLDivElement>,
    node: CanvasNode,
  ) => {
    if (e.button === 1 || toolMode === 'pan' || spacePressed) return
    e.stopPropagation()

    let nextSelection: Set<string>
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      nextSelection = new Set(selectedIds)
      if (nextSelection.has(node.id)) {
        nextSelection.delete(node.id)
      } else {
        nextSelection.add(node.id)
      }
      onSelectIds(nextSelection)
    } else if (!selectedIds.has(node.id)) {
      nextSelection = new Set([node.id])
      onSelectIds(nextSelection)
    } else {
      nextSelection = selectedIds
    }

    const origins = new Map<string, { x: number; y: number }>()
    const moveSet = nextSelection.has(node.id) ? nextSelection : new Set([node.id])
    for (const n of nodes) {
      if (moveSet.has(n.id)) {
        origins.set(n.id, { x: n.x, y: n.y })
      }
    }

    canvasRef.current?.setPointerCapture(e.pointerId)
    dragNodesRef.current = {
      pointerId: e.pointerId,
      primaryNodeId: node.id,
      sourcePrimaryNodeId: node.id,
      primaryKind: node.kind,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origins,
      lastUpdates: [],
      rafId: null,
      moved: false,
      duplicateOnDrag: e.altKey,
      duplicated: false,
    }
  }

  const selectedNodes = useMemo(
    () => nodes.filter((n) => selectedIds.has(n.id)),
    [nodes, selectedIds],
  )

  const canIonizeSelected =
    selectedNodes.length >= 1 &&
    selectedNodes.every((n) => n.kind === 'atom' || n.kind === 'molecule')

  const canMergeSelected =
    selectedNodes.length >= 2 &&
    selectedNodes.every((n) => n.kind === 'atom' || n.kind === 'molecule')

  const selectedChargeSum = useMemo(() => {
    let sum = 0
    for (const n of selectedNodes) {
      if (n.kind === 'molecule') sum += n.species.charge
    }
    return sum
  }, [selectedNodes])

  const zoomStep = (delta: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.width / 2
    const cy = rect.height / 2
    const nextZoom = Math.max(0.45, Math.min(2.2, Number((viewport.zoom + delta).toFixed(2))))
    const ratio = nextZoom / viewport.zoom
    onViewportChange({
      zoom: nextZoom,
      x: cx - (cx - viewport.x) * ratio,
      y: cy - (cy - viewport.y) * ratio,
    })
  }

  const dotSpacing = Math.max(14, 24 * viewport.zoom)
  const activeHoveredFlaskId = externalHoveredFlaskId ?? internalHoveredFlaskId
  const activeHoverHint = externalHoveredFlaskId ? externalHoverHint : internalHoverHint

  return (
    <div
      ref={canvasRef}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onPointerCancel={handleCanvasPointerUp}
      className={cn(
        'relative flex-1 overflow-hidden bg-background select-none touch-none',
        isPanning
          ? 'cursor-grabbing'
          : toolMode === 'pan' || spacePressed
            ? 'cursor-grab'
            : 'cursor-default',
      )}
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.085) 1px, transparent 1px)',
        backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }}
    >
      {/* Quiet onboarding empty state (disappears when first item lands) */}
      {hydrated && nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="flex max-w-xs flex-col items-center text-center">
            <p className="text-xs font-medium text-zinc-300">
              Paillasse prête
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Glissez des atomes depuis le tableau périodique, sélectionnez-les pour les fusionner, puis versez H₂O et vos solutés dans une fiole.
            </p>
          </div>
        </div>
      )}

      {/* World transform layer (GPU-accelerated) */}
      <div
        ref={worldLayerRef}
        className="pointer-events-none absolute inset-0 origin-top-left will-change-transform"
        style={{
          transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`,
        }}
      >
        {nodes.map((node) => {
          const isSelected = selectedIds.has(node.id)
          const isShaking = shakingNodeIds.has(node.id)
          const isFresh = freshNodeIds.has(node.id)

          if (node.kind === 'atom') {
            return (
              <AtomTile
                key={node.id}
                node={node}
                selected={isSelected}
                shaking={isShaking}
                fresh={isFresh}
                altCopy={altPressed && toolMode === 'select' && !spacePressed}
                setElRef={setNodeElRef}
                onPointerDown={(e) => handleNodePointerDown(e, node)}
              />
            )
          }

          if (node.kind === 'molecule') {
            return (
              <MoleculeTile
                key={node.id}
                node={node}
                selected={isSelected}
                shaking={isShaking}
                fresh={isFresh}
                altCopy={altPressed && toolMode === 'select' && !spacePressed}
                setElRef={setNodeElRef}
                onPointerDown={(e) => handleNodePointerDown(e, node)}
              />
            )
          }

          const pendingPourSource =
            pendingPour && pendingPour.targetFlaskId === node.id
              ? (nodes.find(
                  (n): n is CanvasFlaskNode =>
                    n.kind === 'flask' && n.id === pendingPour.sourceFlaskId,
                ) ?? null)
              : null
          const isPourHovered = pourActive?.hoveredTargetId === node.id
          const effectiveDropHovered = activeHoveredFlaskId === node.id || isPourHovered
          const effectiveDropHint = isPourHovered
            ? pourActive.hoveredHint
            : activeHoveredFlaskId === node.id
              ? activeHoverHint
              : null

          return (
            <FlaskTile
              key={node.id}
              node={node}
              selected={isSelected}
              shaking={isShaking}
              fresh={isFresh}
              altCopy={altPressed && toolMode === 'select' && !spacePressed}
              pulsing={pulsingFlaskIds.has(node.id)}
              dripping={Boolean(
                titrationSession?.running && titrationSession.buretteId === node.id,
              )}
              isPourSource={
                pourActive?.sourceFlaskId === node.id ||
                pendingPour?.sourceFlaskId === node.id
              }
              pendingPourSource={pendingPourSource}
              dropHovered={effectiveDropHovered}
              dropHint={effectiveDropHint}
              setElRef={setNodeElRef}
              onPointerDown={(e) => handleNodePointerDown(e, node)}
              onStartPourDrag={(e) => handleStartPourDrag(e, node)}
              onConfirmPour={(volumeMl) => {
                if (pendingPourSource) {
                  onPourBetweenFlasks(pendingPourSource.id, node.id, volumeMl)
                }
                setPendingPour(null)
              }}
              onCancelPour={() => setPendingPour(null)}
              onEmpty={() => onEmptyFlask(node.id)}
              onDelete={() => onDeleteIds([node.id])}
              onChangeReactionExtent={(xMol) =>
                onChangeFlaskReactionExtent(node.id, xMol)
              }
              onSelectReaction={(rxnId) => onSelectFlaskReaction(node.id, rxnId)}
              onCommitReaction={() => onCommitFlaskReaction(node.id)}
              onBalanceStoichiometry={
                onBalanceFlaskStoichiometry
                  ? () => onBalanceFlaskStoichiometry(node.id)
                  : undefined
              }
            />
          )
        })}

        {/* Live pour connector curve while dragging from a flask's pour handle (DOM-driven at 120fps) */}
        {pourActive && (
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 overflow-visible"
            width="1"
            height="1"
          >
            {(() => {
              const stroke =
                pourActive.hoveredHint && !pourActive.hoveredHint.valid
                  ? '#f59e0b'
                  : '#38bdf8'
              const sx = pourActive.startX
              const sy = pourActive.startY
              const cx = pourActive.currentX
              const cy = pourActive.currentY
              const mx = (sx + cx) * 0.5
              const arcLift = Math.min(
                64,
                Math.max(18, Math.hypot(cx - sx, cy - sy) * 0.22),
              )
              const my = Math.min(sy, cy) - arcLift
              return (
                <g>
                  <path
                    ref={pourPathRef}
                    d={`M ${sx} ${sy} Q ${mx} ${my} ${cx} ${cy}`}
                    fill="none"
                    stroke={stroke}
                    strokeWidth="2"
                    strokeDasharray="5 4"
                    strokeLinecap="round"
                  />
                  <circle cx={sx} cy={sy} r="3.5" fill={stroke} />
                  <circle ref={pourTipRef} cx={cx} cy={cy} r="4.5" fill={stroke} />
                </g>
              )
            })()}
          </svg>
        )}
      </div>

      {/* Marquee selection rectangle (DOM-driven at 120fps, zero React re-renders) */}
      {marqueeActive && (
        <div
          ref={marqueeElRef}
          className="pointer-events-none absolute left-0 top-0 rounded-sm border border-zinc-400/70 bg-zinc-400/10 will-change-transform"
          style={{ width: 0, height: 0 }}
        />
      )}

      {/* Contextual floating action bar for selected nodes */}
      {selectedNodes.length > 0 && (
        <CanvasSelectionBar
          selectedCount={selectedNodes.length}
          canMergeSelected={canMergeSelected}
          canIonizeSelected={canIonizeSelected}
          canIonizeMinus={canIonizeMinus}
          canIonizePlus={canIonizePlus}
          selectedChargeSum={selectedChargeSum}
          onMergeSelected={onMergeSelected}
          onIonizeSelected={onIonizeSelected}
          onDuplicateSelected={onDuplicateSelected}
          onDeleteSelected={() => onDeleteIds([...selectedIds])}
        />
      )}

      {/* Floating constitutional isomer picker on multi-match merge */}
      {pendingMergeIsomers && (
        <IsomerPickerDialog
          key={`${pendingMergeIsomers.compositionFormula}:${pendingMergeIsomers.candidates.length}`}
          pending={pendingMergeIsomers}
          onPick={onPickMergeIsomer}
          onCancel={onCancelMergeIsomer}
        />
      )}

      {/* Non-intrusive chemistry status feedback */}
      {notice && (
        <CanvasNoticeBanner
          notice={notice}
          offsetBelowSelectionBar={selectedNodes.length > 0}
        />
      )}

      {/* Floating top-right TP & Paillasses control */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="pointer-events-auto absolute right-3 top-3 z-20 rounded-lg border border-border bg-panel/95 p-0.5 shadow-lg"
      >
        <LabPresetsPopover
          savedWorkbenches={savedWorkbenches}
          currentNodeCount={nodes.length}
          onLoadPreset={onLoadPreset}
          onSaveCurrentWorkbench={onSaveCurrentWorkbench}
          onLoadSavedWorkbench={onLoadSavedWorkbench}
          onDeleteSavedWorkbench={onDeleteSavedWorkbench}
        />
      </div>

      {/* Minimalist floating bottom-left viewport toolbar */}
      <CanvasViewportHud
        toolMode={toolMode}
        spacePressed={spacePressed}
        zoom={viewport.zoom}
        nodeCount={nodes.length}
        onSetToolMode={setToolMode}
        onZoomStep={zoomStep}
        onResetView={onResetView}
        onClearCanvas={onClearCanvas}
      />

      {/* Interactive titration console or quick reopen button */}
      {(() => {
        const flasks = nodes.filter(
          (n): n is CanvasFlaskNode => n.kind === 'flask',
        )
        const { burettes, analytes } = findTitrationPairs(flasks)
        if (titrationSession) {
          const b = flasks.find((f) => f.id === titrationSession.buretteId) ?? null
          const a = flasks.find((f) => f.id === titrationSession.analyteId) ?? null
          if (!b || !a) return null
          return (
            <TitrationDrawer
              session={titrationSession}
              burettes={burettes}
              analytes={analytes}
              burette={b}
              analyte={a}
              onChangePair={(bId, aId) => onOpenTitration(bId, aId)}
              onDispenseMl={onDispenseTitrationMl}
              onToggleRunning={onToggleTitrationRunning}
              onCycleSpeed={onCycleTitrationSpeed}
              onResetSession={onResetTitrationSession}
              onSetAnalyteIndicator={(ind) => onSetFlaskIndicator(a.id, ind)}
              onClose={onCloseTitration}
            />
          )
        }
        if (burettes.length > 0 && analytes.length > 0) {
          return (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="pointer-events-auto absolute bottom-3 right-3 z-20"
            >
              <button
                type="button"
                onClick={() => onOpenTitration()}
                className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-panel/95 px-3 text-xs font-medium text-foreground shadow-lg hover:bg-accent"
              >
                <span>Suivi de titrage</span>
              </button>
            </div>
          )
        }
        return null
      })()}
    </div>
  )
}
