import {
  type PointerEvent as ReactPointerEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  ElementRecord,
  FullCatalogResponse,
  LewisAtom,
  LewisBond,
  LewisStructure,
  SpeciesRecord,
} from '../../shared/chemistry.ts'
import { api } from '@/lib/api'
import { formatFormulaFromComposition } from '@/lib/chemistry-calc'
import {
  CLIENT_VALENCE_ELECTRONS,
  applyExpectedLewisToDrawing,
  extractComponents,
  formatLewisCharge,
  getAtomBondOrderSum,
  getLewisAtomColor,
} from '@/lib/lewis-geometry'
import { Molecule3DViewer } from '@/components/Molecule3DViewer'
import {
  COMMON_PALETTE_SYMBOLS,
  GRID_STEP,
  QUICK_TEMPLATE_IDS,
  type BuilderTool,
  type LewisViewport,
  type Snapshot,
  clampLewisViewport,
  computeFitLewisViewport,
  computeOpenSproutPosition,
  makeAtomId,
  normalizeBondKey,
  snapToGrid,
  speciesToCanvasState,
} from '@/components/lewis/lewis-editor-utils'
import { validateLewisDrawing } from '@/components/lewis/lewis-validation'
import { LewisElementPalette } from '@/components/lewis/LewisElementPalette'
import { LewisInspectorSidebar } from '@/components/lewis/LewisInspectorSidebar'
import { LewisSvgStage } from '@/components/lewis/LewisSvgStage'
import { LewisToolbar } from '@/components/lewis/LewisToolbar'
import { useLewisPointerHandlers } from '@/components/lewis/useLewisPointerHandlers'
import { useLewisRecognition } from '@/components/lewis/useLewisRecognition'

interface LewisBuilderPageProps {
  catalog: FullCatalogResponse | null
  initialSpecies: SpeciesRecord | null
  active?: boolean
  onAddSpeciesToWorkbench: (species: SpeciesRecord, switchToWorkbench: boolean) => void
  onOpenSpeciesInCatalog: (speciesId: string) => void
  onSpeciesDiscovered: (species: SpeciesRecord) => void
}

export const LewisBuilderPage = memo(function LewisBuilderPage({
  catalog,
  initialSpecies,
  active = true,
  onAddSpeciesToWorkbench,
  onOpenSpeciesInCatalog,
  onSpeciesDiscovered,
}: LewisBuilderPageProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const splitContainerRef = useRef<HTMLDivElement | null>(null)
  const paletteSearchRef = useRef<HTMLInputElement>(null)
  const spawnIndexRef = useRef(0)

  const [tool, setTool] = useState<BuilderTool>('build')
  const [activeSymbol, setActiveSymbol] = useState<string>(() =>
    initialSpecies?.lewis ? 'H' : 'C',
  )
  const [split3DOpen, setSplit3DOpen] = useState(true)
  const [split3DRatio, setSplit3DRatio] = useState(0.45)
  const [resizingSplit, setResizingSplit] = useState(false)
  const [strictMode, setStrictMode] = useState(false)
  const [viewport, setViewport] = useState<LewisViewport>({ x: 0, y: 0, zoom: 1 })
  const viewportRef = useRef<LewisViewport>(viewport)
  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])
  const [initialCanvas] = useState(() =>
    initialSpecies?.lewis
      ? speciesToCanvasState(initialSpecies, { x: 380, y: 260 })
      : { atoms: [] as LewisAtom[], bonds: [] as LewisBond[] },
  )
  const [atoms, setAtoms] = useState<LewisAtom[]>(initialCanvas.atoms)
  const [bonds, setBonds] = useState<LewisBond[]>(initialCanvas.bonds)
  const [history, setHistory] = useState<Snapshot[]>([])
  const [selectedAtomId, setSelectedAtomId] = useState<string | null>(null)
  const [selectedBondKey, setSelectedBondKey] = useState<string | null>(null)
  const [pendingBondFromId, setPendingBondFromId] = useState<string | null>(null)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [addedFeedback, setAddedFeedback] = useState<string | null>(null)

  const atomsRef = useRef(atoms)
  const bondsRef = useRef(bonds)
  useEffect(() => {
    atomsRef.current = atoms
    bondsRef.current = bonds
  }, [atoms, bonds])

  const getCanvasCenter = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width < 40 || rect.height < 40) return { x: 260, y: 260 }
    const vp = viewportRef.current
    return {
      x: snapToGrid((rect.width / 2 - vp.x) / vp.zoom),
      y: snapToGrid((rect.height / 2 - vp.y) / vp.zoom),
    }
  }, [])

  const resetViewport = useCallback((customAtoms?: LewisAtom[]) => {
    const rect = svgRef.current?.getBoundingClientRect()
    const targetAtoms = customAtoms ?? atomsRef.current
    if (!rect || rect.width < 40 || rect.height < 40) {
      const fallback = { x: 0, y: 0, zoom: 1 }
      viewportRef.current = fallback
      setViewport(fallback)
      return
    }
    const next = computeFitLewisViewport(targetAtoms, rect.width, rect.height)
    viewportRef.current = next
    setViewport(next)
  }, [])

  const handleZoomStep = useCallback((delta: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const vp = viewportRef.current
    const cx = rect.width / 2
    const cy = rect.height / 2
    const nextZoom = vp.zoom + delta
    const ratio = nextZoom / vp.zoom
    const raw: LewisViewport = {
      x: cx - (cx - vp.x) * ratio,
      y: cy - (cy - vp.y) * ratio,
      zoom: nextZoom,
    }
    const clamped = clampLewisViewport(raw, atomsRef.current, rect.width, rect.height)
    viewportRef.current = clamped
    setViewport(clamped)
  }, [])

  const handleSelectAndFocusAtom = useCallback((atomId: string) => {
    setSelectedAtomId(atomId)
    setSelectedBondKey(null)
    const atom = atomsRef.current.find((a) => a.id === atomId)
    const rect = svgRef.current?.getBoundingClientRect()
    if (!atom || !rect) return
    const vp = viewportRef.current
    const raw: LewisViewport = {
      x: rect.width / 2 - atom.x * vp.zoom,
      y: rect.height / 2 - atom.y * vp.zoom,
      zoom: vp.zoom,
    }
    const clamped = clampLewisViewport(raw, atomsRef.current, rect.width, rect.height)
    viewportRef.current = clamped
    setViewport(clamped)
  }, [])

  useEffect(() => {
    const raf = requestAnimationFrame(() => resetViewport())
    return () => cancelAnimationFrame(raf)
  }, [split3DOpen, resetViewport])

  const handleStartSplitResize = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    setResizingSplit(true)

    const onMove = (ev: PointerEvent) => {
      const rect = splitContainerRef.current?.getBoundingClientRect()
      if (!rect || rect.width < 200) return
      const rightWidth = rect.right - ev.clientX
      setSplit3DRatio(Math.max(0.28, Math.min(0.62, rightWidth / rect.width)))
    }
    const onUp = () => {
      setResizingSplit(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }, [])

  const pushHistory = useCallback(() => {
    setHistory((prev) => [
      ...prev.slice(-29),
      {
        atoms: atomsRef.current.map((a) => ({ ...a })),
        bonds: bondsRef.current.map((b) => ({ ...b })),
      },
    ])
  }, [])

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      setAtoms(last.atoms)
      setBonds(last.bonds)
      setSelectedAtomId(null)
      setSelectedBondKey(null)
      setPendingBondFromId(null)
      return prev.slice(0, -1)
    })
  }, [])

  const {
    activeMatch,
    matching,
    pubchemLoading,
    pubchemError,
    setPubchemError,
    clearRecognition,
    handleLookupPubChem,
  } = useLewisRecognition({ atoms, bonds, atomsRef, bondsRef, onSpeciesDiscovered })

  const elementsBySymbol = useMemo(() => {
    const map = new Map<string, ElementRecord>()
    for (const el of catalog?.elements ?? []) map.set(el.symbol, el)
    return map
  }, [catalog])

  const quickTemplates = useMemo(() => {
    if (!catalog) return []
    const byId = new Map(catalog.species.map((s) => [s.id, s]))
    return QUICK_TEMPLATE_IDS.map((id) => byId.get(id)).filter(
      (s): s is NonNullable<typeof s> => Boolean(s),
    )
  }, [catalog])

  const filteredPaletteElements = useMemo(() => {
    const all = catalog?.elements ?? []
    const q = paletteQuery.trim().toLowerCase()
    if (!q) {
      return COMMON_PALETTE_SYMBOLS.map((sym) => elementsBySymbol.get(sym)).filter(
        (el): el is ElementRecord => Boolean(el),
      )
    }
    return all
      .filter(
        (el) =>
          el.symbol.toLowerCase().includes(q) ||
          el.nameFr.toLowerCase().includes(q) ||
          String(el.atomicNumber) === q,
      )
      .slice(0, 36)
  }, [catalog, elementsBySymbol, paletteQuery])

  const addAtomAt = useCallback(
    (symbol: string, x?: number, y?: number) => {
      pushHistory()
      const center = getCanvasCenter()
      let px = x
      let py = y
      if (px === undefined || py === undefined) {
        const idx = spawnIndexRef.current++
        const ring = idx === 0 ? 0 : 64 + (idx % 3) * 20
        const angle = idx * 1.05
        px = snapToGrid(center.x + Math.cos(angle) * ring)
        py = snapToGrid(center.y + Math.sin(angle) * ring)
      } else {
        px = snapToGrid(px)
        py = snapToGrid(py)
      }
      const nextAtom: LewisAtom = {
        id: makeAtomId(),
        symbol,
        x: px,
        y: py,
        lonePairs: 0,
        charge: 0,
      }
      setAtoms((prev) => [...prev, nextAtom])
      setSelectedAtomId(nextAtom.id)
      setSelectedBondKey(null)
    },
    [getCanvasCenter, pushHistory],
  )

  const sproutAtomFrom = useCallback(
    (fromAtom: LewisAtom, symbol: string, targetX?: number, targetY?: number) => {
      pushHistory()
      const pos =
        targetX !== undefined && targetY !== undefined
          ? { x: Math.round(targetX), y: Math.round(targetY) }
          : computeOpenSproutPosition(fromAtom, atomsRef.current, bondsRef.current)
      const nextAtom: LewisAtom = {
        id: makeAtomId(),
        symbol,
        x: pos.x,
        y: pos.y,
        lonePairs: 0,
        charge: 0,
      }
      setAtoms((prev) => [...prev, nextAtom])
      setBonds((prev) => [...prev, { from: fromAtom.id, to: nextAtom.id, order: 1 }])
      setSelectedAtomId(fromAtom.id)
      setSelectedBondKey(null)
    },
    [pushHistory],
  )

  const cycleBondOrderWithoutDelete = useCallback(
    (fromId: string, toId: string) => {
      if (fromId === toId) return
      pushHistory()
      const key = normalizeBondKey(fromId, toId)
      setBonds((prev) => {
        const idx = prev.findIndex((b) => normalizeBondKey(b.from, b.to) === key)
        if (idx === -1) return [...prev, { from: fromId, to: toId, order: 1 }]
        const existing = prev[idx]
        const nextOrder = existing.order === 1 ? 2 : existing.order === 2 ? 3 : 1
        const next = [...prev]
        next[idx] = { ...existing, order: nextOrder }
        return next
      })
      setSelectedBondKey(key)
      setSelectedAtomId(null)
    },
    [pushHistory],
  )

  const toggleOrCycleBond = useCallback(
    (fromId: string, toId: string) => {
      if (fromId === toId) return
      pushHistory()
      const key = normalizeBondKey(fromId, toId)
      setBonds((prev) => {
        const idx = prev.findIndex((b) => normalizeBondKey(b.from, b.to) === key)
        if (idx === -1) return [...prev, { from: fromId, to: toId, order: 1 }]
        const existing = prev[idx]
        if (existing.order < 3) {
          const next = [...prev]
          next[idx] = { ...existing, order: (existing.order + 1) as 1 | 2 | 3 }
          return next
        }
        return prev.filter((_, i) => i !== idx)
      })
      setSelectedBondKey(key)
      setSelectedAtomId(null)
    },
    [pushHistory],
  )

  const setBondOrder = useCallback(
    (key: string, order: 1 | 2 | 3) => {
      pushHistory()
      setBonds((prev) =>
        prev.map((b) => (normalizeBondKey(b.from, b.to) === key ? { ...b, order } : b)),
      )
    },
    [pushHistory],
  )

  const deleteBondByKey = useCallback(
    (key: string) => {
      pushHistory()
      setBonds((prev) => prev.filter((b) => normalizeBondKey(b.from, b.to) !== key))
      setSelectedBondKey(null)
    },
    [pushHistory],
  )

  const deleteAtomById = useCallback(
    (atomId: string) => {
      pushHistory()
      setAtoms((prev) => prev.filter((a) => a.id !== atomId))
      setBonds((prev) => prev.filter((b) => b.from !== atomId && b.to !== atomId))
      if (selectedAtomId === atomId) setSelectedAtomId(null)
      if (pendingBondFromId === atomId) setPendingBondFromId(null)
    },
    [pendingBondFromId, pushHistory, selectedAtomId],
  )

  const updateAtom = useCallback(
    (atomId: string, updater: (a: LewisAtom) => LewisAtom) => {
      pushHistory()
      setAtoms((prev) => prev.map((a) => (a.id === atomId ? updater(a) : a)))
    },
    [pushHistory],
  )

  const clearCanvas = useCallback(() => {
    if (atomsRef.current.length === 0) return
    pushHistory()
    setAtoms([])
    setBonds([])
    setSelectedAtomId(null)
    setSelectedBondKey(null)
    setPendingBondFromId(null)
    clearRecognition()
    const resetVp = { x: 0, y: 0, zoom: 1 }
    viewportRef.current = resetVp
    setViewport(resetVp)
  }, [clearRecognition, pushHistory])

  const loadTemplate = useCallback(
    async (species: SpeciesRecord) => {
      let full = species
      if (!full.lewis) {
        try {
          const res = await api.getSpeciesById(species.id)
          full = res.species
        } catch {
          return
        }
      }
      if (!full.lewis) return
      pushHistory()
      const { atoms: nextAtoms, bonds: nextBonds } = speciesToCanvasState(
        full,
        { x: 0, y: 0 },
      )
      setAtoms(nextAtoms)
      setBonds(nextBonds)
      setSelectedAtomId(null)
      setSelectedBondKey(null)
      setPendingBondFromId(null)
      setPubchemError(null)
      resetViewport(nextAtoms)
    },
    [pushHistory, resetViewport, setPubchemError],
  )

  const handleCompleteElectrons = useCallback(() => {
    if (!activeMatch || !activeMatch.matched) return
    pushHistory()
    const next = applyExpectedLewisToDrawing(
      atomsRef.current,
      bondsRef.current,
      activeMatch.expectedLewis,
      getCanvasCenter(),
    )
    setAtoms(next.atoms)
    setBonds(next.bonds)
  }, [activeMatch, getCanvasCenter, pushHistory])

  const handleAutoCompleteLonePairs = useCallback(() => {
    if (atomsRef.current.length === 0) return
    if (activeMatch && activeMatch.matched && activeMatch.expectedLewis) {
      handleCompleteElectrons()
      return
    }
    pushHistory()
    const currentBonds = bondsRef.current
    setAtoms((prev) =>
      prev.map((a) => {
        const valence = CLIENT_VALENCE_ELECTRONS[a.symbol]
        if (valence === undefined) return a
        const bondSum = getAtomBondOrderSum(a.id, currentBonds)
        if (a.symbol === 'H' || a.symbol === 'He') {
          return {
            ...a,
            lonePairs:
              bondSum >= 1 ? 0 : Math.max(0, Math.floor((valence - a.charge) / 2)),
          }
        }
        const remaining = Math.max(0, valence - a.charge - bondSum)
        return { ...a, lonePairs: Math.max(0, Math.min(4, Math.floor(remaining / 2))) }
      }),
    )
  }, [activeMatch, handleCompleteElectrons, pushHistory])

  const pointer = useLewisPointerHandlers({
    active,
    svgRef,
    paletteSearchRef,
    atomsRef,
    viewportRef,
    setViewport,
    onResetViewport: resetViewport,
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
  })

  const atomById = useMemo(() => new Map(atoms.map((a) => [a.id, a])), [atoms])
  const strictValidation = useMemo(
    () => validateLewisDrawing(atoms, bonds, elementsBySymbol),
    [atoms, bonds, elementsBySymbol],
  )
  const selectedAtom = selectedAtomId ? atomById.get(selectedAtomId) ?? null : null
  const selectedBond = selectedBondKey
    ? bonds.find((b) => normalizeBondKey(b.from, b.to) === selectedBondKey) ?? null
    : null

  const compositionStats = useMemo(() => {
    const counts: Record<string, number> = {}
    let totalCharge = 0
    let totalLonePairs = 0
    for (const a of atoms) {
      counts[a.symbol] = (counts[a.symbol] ?? 0) + 1
      totalCharge += a.charge
      totalLonePairs += a.lonePairs
    }
    return {
      formula: formatFormulaFromComposition(counts),
      totalCharge,
      totalLonePairs,
      totalBondOrders: bonds.reduce((sum, b) => sum + b.order, 0),
    }
  }, [atoms, bonds])

  const liveIonBracket = useMemo(() => {
    if (atoms.length <= 1 || compositionStats.totalCharge === 0) return null
    const comps = extractComponents({ atoms, bonds })
    if (comps.length !== 1) return null
    const comp = comps[0]
    const pad = 33
    return {
      x1: comp.minX - pad,
      x2: comp.maxX + pad,
      y1: comp.minY - pad,
      y2: comp.maxY + pad,
      qText: formatLewisCharge(compositionStats.totalCharge),
      positive: compositionStats.totalCharge > 0,
    }
  }, [atoms, bonds, compositionStats.totalCharge])

  const live3DStructure = useMemo<LewisStructure>(() => {
    const hasDrawnLonePairs = atoms.some((a) => a.lonePairs > 0)
    if (
      !hasDrawnLonePairs &&
      activeMatch?.matched &&
      activeMatch.expectedLewis &&
      activeMatch.expectedLewis.atoms.length === atoms.length
    ) {
      return activeMatch.expectedLewis
    }
    return {
      atoms,
      bonds,
      totalCharge: compositionStats.totalCharge,
      ionic: Boolean(activeMatch?.matched && activeMatch.species.lewis?.ionic),
    }
  }, [atoms, bonds, activeMatch, compositionStats.totalCharge])

  const triggerAddToWorkbench = (species: SpeciesRecord, switchToWorkbench: boolean) => {
    onAddSpeciesToWorkbench(species, switchToWorkbench)
    if (!switchToWorkbench) {
      setAddedFeedback(`${species.displayFormula} ajouté sur la paillasse`)
      window.setTimeout(() => setAddedFeedback(null), 2600)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background select-none">
      <LewisElementPalette
        activeSymbol={activeSymbol}
        paletteQuery={paletteQuery}
        onPaletteQueryChange={setPaletteQuery}
        paletteSearchRef={paletteSearchRef}
        filteredElements={filteredPaletteElements}
        quickTemplates={quickTemplates}
        onSelectSymbol={(sym) => {
          setActiveSymbol(sym)
          setTool('build')
        }}
        onStartDrag={pointer.startPaletteDrag}
        onDoubleClickAdd={(sym) => addAtomAt(sym)}
        onLoadTemplate={(tpl) => void loadTemplate(tpl)}
      />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div
          ref={splitContainerRef}
          className="relative flex min-h-0 flex-1 overflow-hidden bg-background"
        >
          <div
            className="relative min-w-[260px] flex-1 overflow-hidden bg-background"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)',
              backgroundSize: `${Math.max(10, GRID_STEP * viewport.zoom)}px ${Math.max(10, GRID_STEP * viewport.zoom)}px`,
              backgroundPosition: `${viewport.x}px ${viewport.y}px`,
            }}
          >
            <LewisToolbar
              tool={tool}
              activeSymbol={activeSymbol}
              atomsCount={atoms.length}
              selectedAtom={selectedAtom}
              selectedBond={selectedBond}
              selectedBondKey={selectedBondKey}
              historyCount={history.length}
              split3DOpen={split3DOpen}
              strictMode={strictMode}
              strictErrorCount={strictValidation.errorCount}
              strictWarningCount={strictValidation.warningCount}
              onSelectTool={(nextTool) => {
                setTool(nextTool)
                setPendingBondFromId(null)
              }}
              onAutoCompleteLonePairs={handleAutoCompleteLonePairs}
              onUndo={undo}
              onClear={clearCanvas}
              onToggleStrictMode={() => setStrictMode((v) => !v)}
              onToggleSplit3D={() => setSplit3DOpen((v) => !v)}
              onUpdateAtom={updateAtom}
              onDeleteAtom={deleteAtomById}
              onSetBondOrder={setBondOrder}
              onDeleteBond={deleteBondByKey}
            />

            {addedFeedback && (
              <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-border bg-panel/95 px-3 py-1.5 text-xs text-foreground shadow-lg animate-dl-pop">
                <span>{addedFeedback}</span>
              </div>
            )}

            <LewisSvgStage
              svgRef={svgRef}
              viewport={viewport}
              spacePressed={pointer.spacePressed}
              isPanning={pointer.isPanning}
              strictMode={strictMode}
              diagnosticsByAtomId={strictValidation.byAtomId}
              tool={tool}
              activeSymbol={activeSymbol}
              atoms={atoms}
              bonds={bonds}
              atomById={atomById}
              selectedAtomId={selectedAtomId}
              selectedBondKey={selectedBondKey}
              pendingBondFromId={pendingBondFromId}
              bondPreview={pointer.bondPreview}
              liveIonBracket={liveIonBracket}
              onZoomStep={handleZoomStep}
              onResetViewport={() => resetViewport()}
              onSvgBackgroundDown={pointer.handleSvgBackgroundDown}
              onSvgPointerMove={pointer.handleSvgPointerMove}
              onSvgPointerUp={pointer.handleSvgPointerUp}
              onSvgPointerCancel={pointer.handleSvgPointerCancel}
              onAtomPointerDown={pointer.handleAtomPointerDown}
              onBondPointerDown={pointer.handleBondPointerDown}
            />
          </div>

          {split3DOpen && (
            <div
              style={{ width: `${Math.round(split3DRatio * 100)}%` }}
              className="relative flex min-w-[240px] max-w-[65%] shrink-0 flex-col border-l border-border bg-panel/35"
            >
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Redimensionner la vue 3D partagée"
                tabIndex={0}
                title="Glisser pour redimensionner (double-clic pour 45 %)"
                onPointerDown={handleStartSplitResize}
                onDoubleClick={() => setSplit3DRatio(0.45)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') {
                    e.preventDefault()
                    setSplit3DRatio((r) => Math.min(0.62, r + 0.04))
                  } else if (e.key === 'ArrowRight') {
                    e.preventDefault()
                    setSplit3DRatio((r) => Math.max(0.28, r - 0.04))
                  }
                }}
                className="group absolute bottom-0 left-[-4px] top-0 z-30 w-[7px] cursor-col-resize focus-visible:outline-none"
              >
                <span
                  className={
                    resizingSplit
                      ? 'pointer-events-none absolute inset-y-0 left-[3px] w-[2px] bg-zinc-300/80'
                      : 'pointer-events-none absolute inset-y-0 left-[3px] w-[2px] bg-transparent group-hover:bg-zinc-500/70 group-focus-visible:bg-zinc-300/80'
                  }
                />
              </div>

              <Molecule3DViewer
                structure={live3DStructure}
                title={activeMatch?.matched ? activeMatch.species.nameFr : undefined}
                formula={
                  activeMatch?.matched
                    ? activeMatch.species.displayFormula
                    : compositionStats.formula
                }
                allowExpand={false}
                className="h-full w-full flex-1 rounded-none bg-transparent"
                ariaLabel={
                  activeMatch?.matched
                    ? `Modèle 3D de ${activeMatch.species.nameFr}`
                    : 'Modèle 3D de la molécule'
                }
              />
            </div>
          )}
        </div>
      </main>

      <LewisInspectorSidebar
        atoms={atoms}
        matching={matching}
        activeMatch={activeMatch}
        compositionStats={compositionStats}
        strictMode={strictMode}
        strictValidation={strictValidation}
        selectedAtomId={selectedAtomId}
        pubchemLoading={pubchemLoading}
        pubchemError={pubchemError}
        onSelectAndFocusAtom={handleSelectAndFocusAtom}
        onCompleteElectrons={handleCompleteElectrons}
        onAddToWorkbench={triggerAddToWorkbench}
        onOpenSpeciesInCatalog={onOpenSpeciesInCatalog}
        onLookupPubChem={() => void handleLookupPubChem()}
      />

      {pointer.paletteDrag?.started && (
        <div
          className="pointer-events-none fixed left-0 top-0 z-50"
          style={{
            transform: `translate3d(${pointer.paletteDrag.clientX}px, ${pointer.paletteDrag.clientY}px, 0) translate(-50%, -50%)`,
          }}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-400 bg-card/95 shadow-xl">
            <span
              className="text-base font-semibold"
              style={{ color: getLewisAtomColor(pointer.paletteDrag.symbol) }}
            >
              {pointer.paletteDrag.symbol}
            </span>
          </div>
        </div>
      )}
    </div>
  )
})
