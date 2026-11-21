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
  viewportRef: MutableRefObject<LewisViewport>
  setViewport: Dispatch<SetStateAction<LewisViewport>>
  onResetViewport: () => void
  tool: BuilderTool
  activeSymbol: string
  selectedAtomId: string | null
  selectedBondKey: string | null
  pendingBondFromId: string | null
  setTool: Dispatch<SetStateAction<BuilderTool>>
  setActiveSymbol: Dispatch<SetStateAction<string>>
  setAtoms: Dispatch<SetStateAction<LewisAtom[]>>
  setSelectedAtomId: Dispatch<SetStateAction<string | null>>
  setSelectedBondKey: Dispatch<SetStateAction<string | null>>
  setPendingBondFromId: Dispatch<SetStateAction<string | null>>
  setPaletteQuery: Dispatch<SetStateAction<string>>
  pushHistory: () => void
  undo: () => void
  addAtomAt: (symbol: string, x?: number, y?: number) => void
  sproutAtomFrom: (fromAtom: LewisAtom, symbol: string, targetX?: number, targetY?: number) => void
  cycleBondOrderWithoutDelete: (fromId: string, toId: string) => void
  toggleOrCycleBond: (fromId: string, toId: string) => void
  updateAtom: (atomId: string, updater: (a: LewisAtom) => LewisAtom) => void
  deleteAtomById: (atomId: string) => void
  deleteBondByKey: (key: string) => void
  handleAutoCompleteLonePairs: () => void
}

export function useLewisPointerHandlers({
  active,
  svgRef,
  paletteSearchRef,
  atomsRef,
  viewportRef,
  setViewport,
  onResetViewport,
  tool,
  activeSymbol,
  selectedAtomId,
  selectedBondKey,
  pendingBondFromId,
  setTool,
  setActiveSymbol,
  setAtoms,
  setSelectedAtomId,
  setSelectedBondKey,
  setPendingBondFromId,
  setPaletteQuery,
  pushHistory,
  undo,
  addAtomAt,
  sproutAtomFrom,
  cycleBondOrderWithoutDelete,
  toggleOrCycleBond,
  updateAtom,
  deleteAtomById,
  deleteBondByKey,
  handleAutoCompleteLonePairs,
}: UseLewisPointerHandlersParams) {
  const [paletteDrag, setPaletteDrag] = useState<PaletteDragState | null>(null)
  const [bondPreview, setBondPreview] = useState<BondPreviewState | null>(null)
  const [spacePressed, setSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)

  const panDragRef = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    origX: number
    origY: number
  } | null>(null)

  const dragAtomRef = useRef<{
    atomId: string
    pointerId: number
    startSvgX: number
    startSvgY: number
    origX: number
    origY: number
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
      if (tool === 'lonepair' || tool === 'charge') setTool('build')

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
          setPendingBondFromId(null)
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
      setPendingBondFromId,
      setTool,
      sproutAtomFrom,
      svgRef,
      tool,
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
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === ' ' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setSpacePressed(true)
        return
      }
      if (e.key === '0' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        onResetViewport()
        return
      }
      if (e.key === '1') {
        setTool('build')
        setPendingBondFromId(null)
      } else if (e.key === '2') {
        setTool('move')
        setPendingBondFromId(null)
      } else if (e.key === '3') {
        setTool('bond')
      } else if (e.key === '4') {
        setTool('lonepair')
        setPendingBondFromId(null)
      } else if (e.key === '5') {
        setTool('charge')
        setPendingBondFromId(null)
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        handleAutoCompleteLonePairs()
      } else if (e.key === 'Escape') {
        setSelectedAtomId(null)
        setSelectedBondKey(null)
        setPendingBondFromId(null)
      } else if (
        e.key === 'Backspace' ||
        e.key === 'Delete' ||
        e.key === 'x' ||
        e.key === 'X'
      ) {
        if (selectedAtomId) {
          e.preventDefault()
          deleteAtomById(selectedAtomId)
        } else if (selectedBondKey) {
          e.preventDefault()
          deleteBondByKey(selectedBondKey)
        }
      } else if ((e.key === '+' || e.key === '=') && selectedAtomId) {
        e.preventDefault()
        updateAtom(selectedAtomId, (a) => ({ ...a, charge: Math.min(4, a.charge + 1) }))
      } else if (e.key === '-' && selectedAtomId) {
        e.preventDefault()
        updateAtom(selectedAtomId, (a) => ({ ...a, charge: Math.max(-3, a.charge - 1) }))
      } else if ((e.key === 'l' || e.key === 'L') && selectedAtomId) {
        e.preventDefault()
        updateAtom(selectedAtomId, (a) => ({ ...a, lonePairs: (a.lonePairs + 1) % 5 }))
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
    deleteAtomById,
    deleteBondByKey,
    handleAutoCompleteLonePairs,
    onResetViewport,
    paletteSearchRef,
    selectedAtomId,
    selectedBondKey,
    setActiveSymbol,
    setPaletteQuery,
    setPendingBondFromId,
    setSelectedAtomId,
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
      if (tool === 'lonepair') {
        updateAtom(atom.id, (a) => ({ ...a, lonePairs: Math.max(0, a.lonePairs - 1) }))
      } else if (tool === 'charge') {
        updateAtom(atom.id, (a) => ({ ...a, charge: Math.max(-3, a.charge - 1) }))
      } else {
        setSelectedAtomId(atom.id)
        setSelectedBondKey(null)
      }
      return
    }
    if (e.button !== 0) return

    const pt = clientToSvg(e.clientX, e.clientY)

    if (tool === 'lonepair') {
      setSelectedAtomId(atom.id)
      setSelectedBondKey(null)
      updateAtom(atom.id, (a) => ({
        ...a,
        lonePairs: e.shiftKey ? Math.max(0, a.lonePairs - 1) : (a.lonePairs + 1) % 5,
      }))
      return
    }

    if (tool === 'charge') {
      setSelectedAtomId(atom.id)
      setSelectedBondKey(null)
      updateAtom(atom.id, (a) => ({
        ...a,
        charge: e.shiftKey ? Math.max(-3, a.charge - 1) : a.charge >= 3 ? -3 : a.charge + 1,
      }))
      return
    }

    if (tool === 'build' && !e.altKey) {
      setSelectedAtomId(atom.id)
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

    if (tool === 'bond' || (tool === 'move' && e.shiftKey)) {
      svgRef.current?.setPointerCapture(e.pointerId)
      bondDragRef.current = {
        fromId: atom.id,
        pointerId: e.pointerId,
        startSvgX: pt.x,
        startSvgY: pt.y,
        moved: false,
        sproutSymbol: null,
      }
      setBondPreview({
        fromId: atom.id,
        toX: atom.x,
        toY: atom.y,
        hoverAtomId: null,
        sproutSymbol: null,
      })
      return
    }

    setSelectedAtomId(atom.id)
    setSelectedBondKey(null)
    setPendingBondFromId(null)

    let targetId = atom.id
    let snapshotSaved = false
    if (tool === 'move' && e.altKey) {
      pushHistory()
      snapshotSaved = true
      const clone: LewisAtom = { ...atom, id: makeAtomId() }
      setAtoms((prev) => [...prev, clone])
      setSelectedAtomId(clone.id)
      targetId = clone.id
    }

    svgRef.current?.setPointerCapture(e.pointerId)
    dragAtomRef.current = {
      atomId: targetId,
      pointerId: e.pointerId,
      startSvgX: pt.x,
      startSvgY: pt.y,
      origX: atom.x,
      origY: atom.y,
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
    } else if (tool === 'bond') {
      toggleOrCycleBond(bond.from, bond.to)
    } else {
      setSelectedBondKey(bondKey)
      setSelectedAtomId(null)
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
        setSelectedAtomId(firstAtom.id)
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
      const nx = e.shiftKey ? Math.round(drag.origX + dx) : snapToGrid(drag.origX + dx)
      const ny = e.shiftKey ? Math.round(drag.origY + dy) : snapToGrid(drag.origY + dy)
      setAtoms((prev) =>
        prev.map((a) => (a.id === drag.atomId ? { ...a, x: nx, y: ny } : a)),
      )
    }
  }

  const handleSvgPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (panDragRef.current) {
      panDragRef.current = null
      setIsPanning(false)
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
        if (tool === 'build') {
          cycleBondOrderWithoutDelete(drag.fromId, target.id)
        } else {
          toggleOrCycleBond(drag.fromId, target.id)
        }
        setPendingBondFromId(null)
      } else if (drag.moved && drag.sproutSymbol && fromAtom) {
        const endpoint = computeSproutEndpoint(fromAtom, pt.x, pt.y, e.shiftKey)
        sproutAtomFrom(fromAtom, drag.sproutSymbol, endpoint.x, endpoint.y)
        setPendingBondFromId(null)
      } else if (!drag.moved && drag.sproutSymbol && fromAtom) {
        sproutAtomFrom(fromAtom, drag.sproutSymbol)
        setPendingBondFromId(null)
      } else if (!drag.moved && tool === 'bond') {
        if (pendingBondFromId && pendingBondFromId !== drag.fromId) {
          toggleOrCycleBond(pendingBondFromId, drag.fromId)
          setPendingBondFromId(null)
        } else if (pendingBondFromId === drag.fromId) {
          setPendingBondFromId(null)
        } else {
          setPendingBondFromId(drag.fromId)
          setSelectedAtomId(drag.fromId)
          setSelectedBondKey(null)
        }
      }
      return
    }

    if (dragAtomRef.current) dragAtomRef.current = null
  }

  const handleSvgPointerCancel = () => {
    panDragRef.current = null
    setIsPanning(false)
    bgDownRef.current = null
    bondDragRef.current = null
    dragAtomRef.current = null
    setBondPreview(null)
  }

  const handleSvgBackgroundDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button === 1 || spacePressed || (e.button === 0 && tool === 'move')) {
      e.preventDefault()
      if (e.button === 0) {
        setSelectedAtomId(null)
        setSelectedBondKey(null)
        setPendingBondFromId(null)
      }
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
    setSelectedAtomId(null)
    setSelectedBondKey(null)
    setPendingBondFromId(null)

    if (tool === 'build') {
      const pt = clientToSvg(e.clientX, e.clientY)
      svgRef.current?.setPointerCapture(e.pointerId)
      bgDownRef.current = { pointerId: e.pointerId, startSvgX: pt.x, startSvgY: pt.y }
    }
  }

  return {
    paletteDrag,
    bondPreview,
    spacePressed,
    isPanning,
    startPaletteDrag,
    handleAtomPointerDown,
    handleBondPointerDown,
    handleSvgPointerMove,
    handleSvgPointerUp,
    handleSvgPointerCancel,
    handleSvgBackgroundDown,
  }
}
