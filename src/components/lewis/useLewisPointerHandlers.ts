import {
  type Dispatch,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import type {
  ElementRecord,
  LewisAtom,
  LewisBond,
} from '../../../shared/chemistry.ts'
import {
  type BuilderTool,
  type LewisViewport,
  clampLewisViewport,
  computeSproutEndpoint,
  makeAtomId,
  snapToGrid,
} from '@/components/lewis/lewis-editor-utils'
import type { BondPreviewState } from '@/components/lewis/LewisSvgStage'

export interface PaletteDragState {
  symbol: string
  nameFr: string
  clientX: number
  clientY: number
  originX: number
  originY: number
  started: boolean
}

interface UseLewisPointerHandlersParams {
  active: boolean
  svgRef: RefObject<SVGSVGElement | null>
  paletteSearchRef: RefObject<HTMLInputElement | null>
  atomsRef: MutableRefObject<LewisAtom[]>
  bondsRef: MutableRefObject<LewisBond[]>
  viewportRef: MutableRefObject<LewisViewport>
  setViewport: Dispatch<SetStateAction<LewisViewport>>
  onResetViewport: () => void
  tool: BuilderTool
  activeSymbol: string
  selectedAtomIdsRef: MutableRefObject<Set<string>>
  selectedBondKey: string | null
  setTool: Dispatch<SetStateAction<BuilderTool>>
  setActiveSymbol: Dispatch<SetStateAction<string>>
  setAtoms: Dispatch<SetStateAction<LewisAtom[]>>
  setBonds: Dispatch<SetStateAction<LewisBond[]>>
  setSelectedAtomIds: Dispatch<SetStateAction<Set<string>>>
  setSelectedBondKey: Dispatch<SetStateAction<string | null>>
  setPaletteQuery: Dispatch<SetStateAction<string>>
  pushHistory: () => void
  undo: () => void
  addAtomAt: (symbol: string, x?: number, y?: number) => void
  sproutAtomFrom: (fromAtom: LewisAtom, symbol: string, targetX?: number, targetY?: number) => void
  cycleBondOrderWithoutDelete: (fromId: string, toId: string) => void
  updateAtom: (atomId: string, updater: (a: LewisAtom) => LewisAtom) => void
  deleteAtomsByIds: (ids: Iterable<string>) => void
  deleteBondByKey: (key: string) => void
  handleAutoCompleteLonePairs: () => void
}

export function useLewisPointerHandlers({
  active,
  svgRef,
  paletteSearchRef,
  atomsRef,
  bondsRef,
  viewportRef,
  setViewport,
  onResetViewport,
  tool,
  activeSymbol,
  selectedAtomIdsRef,
  selectedBondKey,
  setTool,
  setActiveSymbol,
  setAtoms,
  setBonds,
  setSelectedAtomIds,
  setSelectedBondKey,
  setPaletteQuery,
  pushHistory,
  undo,
  addAtomAt,
  sproutAtomFrom,
  cycleBondOrderWithoutDelete,
  updateAtom,
  deleteAtomsByIds,
  deleteBondByKey,
  handleAutoCompleteLonePairs,
}: UseLewisPointerHandlersParams) {
  const [paletteDrag, setPaletteDrag] = useState<PaletteDragState | null>(null)
  const [bondPreview, setBondPreview] = useState<BondPreviewState | null>(null)
  const [spacePressed, setSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [marqueeActive, setMarqueeActive] = useState(false)
  const marqueeElRef = useRef<HTMLDivElement | null>(null)

  const panDragRef = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    origX: number
    origY: number
  } | null>(null)

  const marqueeRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    currentX: number
    currentY: number
    baseIds: Set<string>
    lastSelectedIds: Set<string>
    rafId: number | null
  } | null>(null)

  const dragAtomRef = useRef<{
    primaryId: string
    collapseToPrimaryOnClick: boolean
    items: Array<{ id: string; origX: number; origY: number }>
    pointerId: number
    startSvgX: number
    startSvgY: number
    moved: boolean
    snapshotSaved: boolean
  } | null>(null)

  const bondDragRef = useRef<{
    fromId: string
    pointerId: number
    startSvgX: number
    startSvgY: number
    moved: boolean
    sproutSymbol: string | null
    createdOnBgDown?: boolean
  } | null>(null)

  const bgDownRef = useRef<{
    pointerId: number
    startSvgX: number
    startSvgY: number
  } | null>(null)

  useEffect(() => {
    return () => {
      if (marqueeRef.current?.rafId != null) {
        cancelAnimationFrame(marqueeRef.current.rafId)
      }
    }
  }, [])

  const clientToSvg = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      const vp = viewportRef.current
      return {
        x: (clientX - rect.left - vp.x) / vp.zoom,
        y: (clientY - rect.top - vp.y) / vp.zoom,
      }
    },
    [svgRef, viewportRef],
  )

  const findAtomNear = useCallback(
    (x: number, y: number, excludeId?: string) => {
      let best: LewisAtom | null = null
      let bestDist = 28
      for (const a of atomsRef.current) {
        if (a.id === excludeId) continue
        const d = Math.hypot(a.x - x, a.y - y)
        if (d < bestDist) {
          bestDist = d
          best = a
        }
      }
      return best
    },
    [atomsRef],
  )

  const startPaletteDrag = useCallback(
    (el: ElementRecord, e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return
      e.preventDefault()

      setActiveSymbol(el.symbol)

      const originX = e.clientX
      const originY = e.clientY
      let started = false

      setPaletteDrag({
        symbol: el.symbol,
        nameFr: el.nameFr,
        clientX: originX,
        clientY: originY,
        originX,
        originY,
        started: false,
      })

      const cleanup = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onCancel)
      }

      const onMove = (ev: PointerEvent) => {
        if (!started && Math.hypot(ev.clientX - originX, ev.clientY - originY) > 5) {
          started = true
        }
        setPaletteDrag((prev) =>
          prev ? { ...prev, clientX: ev.clientX, clientY: ev.clientY, started } : null,
        )
      }

      const onUp = (ev: PointerEvent) => {
        cleanup()
        const rect = svgRef.current?.getBoundingClientRect()
        const wasDragged =
          started || Math.hypot(ev.clientX - originX, ev.clientY - originY) > 5

        if (!wasDragged) {
          setActiveSymbol(el.symbol)
          setTool('build')
        } else if (
          rect &&
          ev.clientX >= rect.left &&
          ev.clientX <= rect.right &&
          ev.clientY >= rect.top &&
          ev.clientY <= rect.bottom
        ) {
          const vp = viewportRef.current
          const dropX = (ev.clientX - rect.left - vp.x) / vp.zoom
          const dropY = (ev.clientY - rect.top - vp.y) / vp.zoom
          const targetAtom = findAtomNear(dropX, dropY)
          if (targetAtom) {
            sproutAtomFrom(targetAtom, el.symbol)
          } else {
            addAtomAt(el.symbol, dropX, dropY)
          }
          setTool('build')
        }
        setPaletteDrag(null)
      }

      const onCancel = () => {
        cleanup()
        setPaletteDrag(null)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onCancel)
    },
    [
      addAtomAt,
      findAtomNear,
      setActiveSymbol,
      setTool,
      sproutAtomFrom,
      svgRef,
      viewportRef,
    ],
  )

  // Non-passive wheel zoom around cursor (clamped to dynamic bounds)
  useEffect(() => {
    const svgEl = svgRef.current
    if (!active || !svgEl) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = svgEl.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const vp = viewportRef.current
      const factor = Math.exp(-e.deltaY * 0.0014)
      const nextZoom = vp.zoom * factor
      const ratio = nextZoom / vp.zoom
      const rawNext: LewisViewport = {
        x: px - (px - vp.x) * ratio,
        y: py - (py - vp.y) * ratio,
        zoom: nextZoom,
      }
      const clamped = clampLewisViewport(rawNext, atomsRef.current, rect.width, rect.height)
      viewportRef.current = clamped
      setViewport(clamped)
    }
    svgEl.addEventListener('wheel', onWheel, { passive: false })
    return () => svgEl.removeEventListener('wheel', onWheel)
  }, [active, atomsRef, setViewport, svgRef, viewportRef])

  useEffect(() => {
    if (!active) return
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        paletteSearchRef.current?.focus()
        paletteSearchRef.current?.select()
        return
      }
      if (e.key === 'Escape' && document.activeElement === paletteSearchRef.current) {
        setPaletteQuery('')
        paletteSearchRef.current?.blur()
        return
      }
      const tag = (document.activeElement as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        paletteSearchRef.current?.focus()
        paletteSearchRef.current?.select()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setSelectedAtomIds(new Set(atomsRef.current.map((a) => a.id)))
        setSelectedBondKey(null)
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === ' ') {
        e.preventDefault()
        setSpacePressed(true)
        return
      }
      if (e.key === '0' || e.key === 'à' || e.code === 'Digit0') {
        e.preventDefault()
        onResetViewport()
        return
      }
      if (e.key === '1' || e.key === '&' || e.code === 'Digit1') {
        e.preventDefault()
        setTool('build')
      } else if (e.key === '2' || e.key === 'é' || e.key === 'É' || e.code === 'Digit2') {
        e.preventDefault()
        setTool('move')
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        handleAutoCompleteLonePairs()
      } else if (e.key === 'Escape') {
        setSelectedAtomIds(new Set())
        setSelectedBondKey(null)
      } else if (
        e.key === 'Backspace' ||
        e.key === 'Delete' ||
        e.key === 'x' ||
        e.key === 'X'
      ) {
        const sel = selectedAtomIdsRef.current
        if (sel.size > 0) {
          e.preventDefault()
          deleteAtomsByIds(sel)
        } else if (selectedBondKey) {
          e.preventDefault()
          deleteBondByKey(selectedBondKey)
        }
      } else if (
        selectedAtomIdsRef.current.size === 1 &&
        (e.key === '+' || e.key === '=' || e.key === '-' || e.key === 'l' || e.key === 'L')
      ) {
        const singleId = [...selectedAtomIdsRef.current][0]
        if (e.key === '+' || e.key === '=') {
          e.preventDefault()
          updateAtom(singleId, (a) => ({ ...a, charge: Math.min(4, a.charge + 1) }))
        } else if (e.key === '-') {
          e.preventDefault()
          updateAtom(singleId, (a) => ({ ...a, charge: Math.max(-3, a.charge - 1) }))
        } else {
          e.preventDefault()
          updateAtom(singleId, (a) => ({ ...a, lonePairs: (a.lonePairs + 1) % 5 }))
        }
      } else {
        const upper = e.key.toUpperCase()
        if (['H', 'C', 'N', 'O', 'F', 'P', 'S', 'I', 'K', 'B'].includes(upper)) {
          setActiveSymbol(upper)
          setTool('build')
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') setSpacePressed(false)
    }
    const onBlur = () => setSpacePressed(false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [
    active,
    atomsRef,
    deleteAtomsByIds,
    deleteBondByKey,
    handleAutoCompleteLonePairs,
    onResetViewport,
    paletteSearchRef,
    selectedAtomIdsRef,
    selectedBondKey,
    setActiveSymbol,
    setPaletteQuery,
    setSelectedAtomIds,
    setSelectedBondKey,
    setTool,
    undo,
    updateAtom,
  ])

  const handleAtomPointerDown = (
    e: ReactPointerEvent<SVGGElement>,
    atom: LewisAtom,
  ) => {
    if (e.button === 1 || spacePressed) return
    e.stopPropagation()
    if (e.button === 2) {
      setSelectedAtomIds(new Set([atom.id]))
      setSelectedBondKey(null)
      return
    }
    if (e.button !== 0) return

    const pt = clientToSvg(e.clientX, e.clientY)

    if (tool === 'build' && !e.altKey) {
      setSelectedAtomIds(new Set([atom.id]))
      setSelectedBondKey(null)
      svgRef.current?.setPointerCapture(e.pointerId)
      bondDragRef.current = {
        fromId: atom.id,
        pointerId: e.pointerId,
        startSvgX: pt.x,
        startSvgY: pt.y,
        moved: false,
        sproutSymbol: activeSymbol,
      }
      return
    }

    if (tool === 'move' && e.shiftKey) {
      setSelectedAtomIds((prev) => {
        const next = new Set(prev)
        if (next.has(atom.id)) next.delete(atom.id)
        else next.add(atom.id)
        return next
      })
      setSelectedBondKey(null)
      return
    }

    const currentSel = selectedAtomIdsRef.current
    const alreadySelected = currentSel.has(atom.id)
    let movingIds = alreadySelected ? [...currentSel] : [atom.id]
    if (!alreadySelected) {
      setSelectedAtomIds(new Set([atom.id]))
    }
    setSelectedBondKey(null)

    let primaryId = atom.id
    let snapshotSaved = false
    let resolvedItems: Array<{ id: string; origX: number; origY: number }> | null = null
    if (tool === 'move' && e.altKey) {
      pushHistory()
      snapshotSaved = true
      const idMap = new Map<string, string>()
      const clonedAtoms: LewisAtom[] = []
      for (const id of movingIds) {
        const src = atomsRef.current.find((a) => a.id === id)
        if (!src) continue
        const newId = makeAtomId()
        idMap.set(id, newId)
        clonedAtoms.push({ ...src, id: newId })
      }
      const clonedBonds: LewisBond[] = []
      for (const b of bondsRef.current) {
        const from = idMap.get(b.from)
        const to = idMap.get(b.to)
        if (from && to) clonedBonds.push({ from, to, order: b.order })
      }
      if (clonedAtoms.length > 0) {
        setAtoms((prev) => [...prev, ...clonedAtoms])
        if (clonedBonds.length > 0) {
          setBonds((prev) => [...prev, ...clonedBonds])
        }
        movingIds = clonedAtoms.map((a) => a.id)
        primaryId = idMap.get(atom.id) ?? movingIds[0]
        resolvedItems = clonedAtoms.map((a) => ({ id: a.id, origX: a.x, origY: a.y }))
        setSelectedAtomIds(new Set(movingIds))
      }
    }

    if (!resolvedItems) {
      const movingIdSet = new Set(movingIds)
      resolvedItems = atomsRef.current
        .filter((a) => movingIdSet.has(a.id))
        .map((a) => ({ id: a.id, origX: a.x, origY: a.y }))
    }

    svgRef.current?.setPointerCapture(e.pointerId)
    dragAtomRef.current = {
      primaryId,
      collapseToPrimaryOnClick: alreadySelected && movingIds.length > 1 && !e.altKey,
      items: resolvedItems,
      pointerId: e.pointerId,
      startSvgX: pt.x,
      startSvgY: pt.y,
      moved: false,
      snapshotSaved,
    }
  }

  const handleBondPointerDown = (
    e: ReactPointerEvent<SVGGElement>,
    bond: LewisBond,
    bondKey: string,
  ) => {
    if (e.button === 1 || spacePressed) return
    e.stopPropagation()
    if (e.button !== 0) return
    if (tool === 'build') {
      cycleBondOrderWithoutDelete(bond.from, bond.to)
    } else {
      setSelectedBondKey(bondKey)
      setSelectedAtomIds(new Set())
    }
  }

  const handleSvgPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (panDragRef.current) {
      const pan = panDragRef.current
      const rect = svgRef.current?.getBoundingClientRect()
      const dx = e.clientX - pan.startClientX
      const dy = e.clientY - pan.startClientY
      const rawNext: LewisViewport = {
        x: pan.origX + dx,
        y: pan.origY + dy,
        zoom: viewportRef.current.zoom,
      }
      const next = rect
        ? clampLewisViewport(rawNext, atomsRef.current, rect.width, rect.height)
        : rawNext
      viewportRef.current = next
      setViewport(next)
      return
    }

    if (marqueeRef.current) {
      const mq = marqueeRef.current
      if (mq.pointerId !== e.pointerId) return
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return
      mq.currentX = e.clientX - rect.left
      mq.currentY = e.clientY - rect.top

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

          const nextSelected = new Set(mq.baseIds)
          for (const a of atomsRef.current) {
            if (a.x + 16 >= minX && a.x - 16 <= maxX && a.y + 16 >= minY && a.y - 16 <= maxY) {
              nextSelected.add(a.id)
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
            setSelectedAtomIds(nextSelected)
          }
        })
      }
      return
    }

    const pt = clientToSvg(e.clientX, e.clientY)

    if (bgDownRef.current) {
      const bg = bgDownRef.current
      if (Math.hypot(pt.x - bg.startSvgX, pt.y - bg.startSvgY) > 10) {
        bgDownRef.current = null
        pushHistory()
        const firstAtom: LewisAtom = {
          id: makeAtomId(),
          symbol: activeSymbol,
          x: snapToGrid(bg.startSvgX),
          y: snapToGrid(bg.startSvgY),
          lonePairs: 0,
          charge: 0,
        }
        setAtoms((prev) => [...prev, firstAtom])
        setSelectedAtomIds(new Set([firstAtom.id]))
        setSelectedBondKey(null)
        bondDragRef.current = {
          fromId: firstAtom.id,
          pointerId: bg.pointerId,
          startSvgX: firstAtom.x,
          startSvgY: firstAtom.y,
          moved: true,
          sproutSymbol: activeSymbol,
          createdOnBgDown: true,
        }
        const endpoint = computeSproutEndpoint(firstAtom, pt.x, pt.y, e.shiftKey)
        setBondPreview({
          fromId: firstAtom.id,
          toX: endpoint.x,
          toY: endpoint.y,
          hoverAtomId: null,
          sproutSymbol: activeSymbol,
        })
      }
      return
    }

    if (bondDragRef.current) {
      const drag = bondDragRef.current
      if (!drag.moved && Math.hypot(pt.x - drag.startSvgX, pt.y - drag.startSvgY) > 6) {
        drag.moved = true
      }
      if (!drag.moved) return

      const hover = findAtomNear(pt.x, pt.y, drag.fromId)
      if (hover) {
        setBondPreview({
          fromId: drag.fromId,
          toX: hover.x,
          toY: hover.y,
          hoverAtomId: hover.id,
          sproutSymbol: null,
        })
      } else if (drag.sproutSymbol) {
        const fromAtom = atomsRef.current.find((a) => a.id === drag.fromId)
        const endpoint = fromAtom
          ? computeSproutEndpoint(fromAtom, pt.x, pt.y, e.shiftKey)
          : { x: pt.x, y: pt.y }
        setBondPreview({
          fromId: drag.fromId,
          toX: endpoint.x,
          toY: endpoint.y,
          hoverAtomId: null,
          sproutSymbol: drag.sproutSymbol,
        })
      } else {
        setBondPreview({
          fromId: drag.fromId,
          toX: pt.x,
          toY: pt.y,
          hoverAtomId: null,
          sproutSymbol: null,
        })
      }
      return
    }

    if (dragAtomRef.current) {
      const drag = dragAtomRef.current
      const dx = pt.x - drag.startSvgX
      const dy = pt.y - drag.startSvgY
      if (!drag.moved && Math.hypot(dx, dy) < 3) return
      if (!drag.snapshotSaved) {
        pushHistory()
        drag.snapshotSaved = true
      }
      drag.moved = true
      const primary = drag.items.find((it) => it.id === drag.primaryId) ?? drag.items[0]
      if (!primary) return
      const targetX = e.shiftKey ? Math.round(primary.origX + dx) : snapToGrid(primary.origX + dx)
      const targetY = e.shiftKey ? Math.round(primary.origY + dy) : snapToGrid(primary.origY + dy)
      const deltaX = targetX - primary.origX
      const deltaY = targetY - primary.origY
      const origById = new Map(drag.items.map((it) => [it.id, it]))
      setAtoms((prev) =>
        prev.map((a) => {
          const orig = origById.get(a.id)
          return orig ? { ...a, x: orig.origX + deltaX, y: orig.origY + deltaY } : a
        }),
      )
    }
  }

  const handleSvgPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (panDragRef.current) {
      panDragRef.current = null
      setIsPanning(false)
      return
    }

    if (marqueeRef.current) {
      const mq = marqueeRef.current
      marqueeRef.current = null
      if (mq.rafId !== null) cancelAnimationFrame(mq.rafId)
      setMarqueeActive(false)
      return
    }

    if (bgDownRef.current) {
      const bg = bgDownRef.current
      bgDownRef.current = null
      addAtomAt(activeSymbol, bg.startSvgX, bg.startSvgY)
      return
    }

    if (bondDragRef.current) {
      const drag = bondDragRef.current
      bondDragRef.current = null
      const pt = clientToSvg(e.clientX, e.clientY)
      const target = findAtomNear(pt.x, pt.y, drag.fromId)
      const fromAtom = atomsRef.current.find((a) => a.id === drag.fromId)
      setBondPreview(null)

      if (drag.moved && target) {
        cycleBondOrderWithoutDelete(drag.fromId, target.id)
      } else if (drag.moved && drag.sproutSymbol && fromAtom) {
        const endpoint = computeSproutEndpoint(fromAtom, pt.x, pt.y, e.shiftKey)
        sproutAtomFrom(fromAtom, drag.sproutSymbol, endpoint.x, endpoint.y)
      } else if (!drag.moved && drag.sproutSymbol && fromAtom) {
        sproutAtomFrom(fromAtom, drag.sproutSymbol)
      }
      return
    }

    if (dragAtomRef.current) {
      const drag = dragAtomRef.current
      dragAtomRef.current = null
      if (!drag.moved && drag.collapseToPrimaryOnClick) {
        setSelectedAtomIds(new Set([drag.primaryId]))
      }
    }
  }

  const handleSvgPointerCancel = () => {
    panDragRef.current = null
    setIsPanning(false)
    if (marqueeRef.current) {
      if (marqueeRef.current.rafId !== null) cancelAnimationFrame(marqueeRef.current.rafId)
      marqueeRef.current = null
      setMarqueeActive(false)
    }
    bgDownRef.current = null
    bondDragRef.current = null
    dragAtomRef.current = null
    setBondPreview(null)
  }

  const handleSvgBackgroundDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button === 1 || spacePressed) {
      e.preventDefault()
      svgRef.current?.setPointerCapture(e.pointerId)
      panDragRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        origX: viewportRef.current.x,
        origY: viewportRef.current.y,
      }
      setIsPanning(true)
      return
    }

    if (e.button !== 0) return

    if (tool === 'build') {
      setSelectedAtomIds(new Set())
      setSelectedBondKey(null)
      const pt = clientToSvg(e.clientX, e.clientY)
      svgRef.current?.setPointerCapture(e.pointerId)
      bgDownRef.current = { pointerId: e.pointerId, startSvgX: pt.x, startSvgY: pt.y }
      return
    }

    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    setSelectedBondKey(null)
    const baseIds = e.shiftKey ? new Set(selectedAtomIdsRef.current) : new Set<string>()
    if (!e.shiftKey && selectedAtomIdsRef.current.size > 0) {
      setSelectedAtomIds(new Set())
    }
    svgRef.current?.setPointerCapture(e.pointerId)
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    marqueeRef.current = {
      pointerId: e.pointerId,
      startX: sx,
      startY: sy,
      currentX: sx,
      currentY: sy,
      baseIds,
      lastSelectedIds: new Set(baseIds),
      rafId: null,
    }
    setMarqueeActive(true)
  }

  return {
    paletteDrag,
    bondPreview,
    spacePressed,
    isPanning,
    marqueeActive,
    marqueeElRef,
    startPaletteDrag,
    handleAtomPointerDown,
    handleBondPointerDown,
    handleSvgPointerMove,
    handleSvgPointerUp,
    handleSvgPointerCancel,
    handleSvgBackgroundDown,
  }
}
