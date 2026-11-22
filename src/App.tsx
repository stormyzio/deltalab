import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  CanvasFlaskNode,
  CanvasNode,
  CatalogSpeciesRecord,
  ElementRecord,
  FullCatalogResponse,
  SpeciesRecord,
} from '../shared/chemistry.ts'
import type { ExternalDragItem } from '@/types/drag'
import { api } from '@/lib/api'
import { buildCanonicalSignature } from '@/lib/chemistry-calc'
import {
  loadLocalCustomSpecies,
  loadLocalWorkspace,
  saveLocalCustomSpecies,
  saveLocalWorkspace,
  upsertLocalCustomSpecies,
} from '@/lib/local-store'
import { type PendingMergeState, parseViewFromHash } from '@/lib/workbench-helpers'
import { useExternalDockDrag } from '@/hooks/useExternalDockDrag'
import { useFlaskCoreActions } from '@/hooks/useFlaskCoreActions'
import { useFlaskReactionAndTransfer } from '@/hooks/useFlaskReactionAndTransfer'
import { useLabSimulation } from '@/hooks/useLabSimulation'
import { useWorkbenchSelectionActions } from '@/hooks/useWorkbenchSelectionActions'
import { TooltipProvider } from '@/components/ui/tooltip'
import { type CatalogJumpRequest, CatalogPage } from '@/components/CatalogPage'
import { ExternalDragGhost } from '@/components/ExternalDragGhost'
import { type AppView, Header } from '@/components/Header'
import {
  type CatalogJumpTarget,
  InspectorPanel,
} from '@/components/InspectorPanel'
import {
  type CanvasNotice,
  LabCanvas,
  type ViewportTransform,
} from '@/components/LabCanvas'
import { LewisBuilderPage } from '@/components/LewisBuilderPage'
import { EquationSolverPage } from '@/components/EquationSolverPage'
import { PeriodicTableDock } from '@/components/PeriodicTableDock'
import {
  type PeriodicJumpRequest,
  PeriodicTablePage,
} from '@/components/PeriodicTablePage'
import { ToolboxDock } from '@/components/ToolboxDock'
import type { CatalogSection, ReactionSpawnSetup } from '@/components/catalog/CatalogShared'

const CONTINUOUS_HISTORY_FIELDS = new Set([
  'temperatureC',
  'heaterTargetC',
  'reactionExtentMol',
  'amountMol',
  'solution',
  'label',
])

function computeCoalesceKey(prev: CanvasNode[], next: CanvasNode[]): string {
  if (prev.length !== next.length) return ''
  const parts: string[] = []
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i]
    const b = next[i]
    if (a === b) continue
    if (a.id !== b.id || a.kind !== b.kind) return ''
    const recA = a as unknown as Record<string, unknown>
    const recB = b as unknown as Record<string, unknown>
    const keys = new Set([...Object.keys(recA), ...Object.keys(recB)])
    const changed: string[] = []
    for (const k of keys) {
      if (recA[k] !== recB[k]) {
        if (!CONTINUOUS_HISTORY_FIELDS.has(k)) return ''
        changed.push(k)
      }
    }
    if (changed.length > 0) {
      changed.sort()
      parts.push(`${a.id}:${changed.join(',')}`)
    }
  }
  return parts.join('|')
}

function isCatalogSectionView(view: AppView): view is CatalogSection {
  return (
    view === 'species' ||
    view === 'solutions' ||
    view === 'reactions' ||
    view === 'vessels'
  )
}

export default function App() {
  const [serverCatalog, setServerCatalog] = useState<FullCatalogResponse | null>(null)
  const [customSpecies, setCustomSpecies] = useState<SpeciesRecord[]>(() =>
    loadLocalCustomSpecies(),
  )
  const [loadError, setLoadError] = useState<string | null>(null)
  const [catalogJumpTarget, setCatalogJumpTarget] =
    useState<CatalogJumpRequest | null>(null)
  const catalogJumpNonceRef = useRef(0)
  const [periodicJumpTarget, setPeriodicJumpTarget] =
    useState<PeriodicJumpRequest | null>(null)
  const periodicJumpNonceRef = useRef(0)

  const catalog = useMemo<FullCatalogResponse | null>(() => {
    if (!serverCatalog) return null
    if (customSpecies.length === 0) return serverCatalog
    const existingIds = new Set(serverCatalog.species.map((s) => s.id))
    const extras: CatalogSpeciesRecord[] = customSpecies
      .filter((sp) => !existingIds.has(sp.id))
      .map((sp) => ({
        ...sp,
        hasLewis: Boolean(sp.lewis),
        dissolutionProducts: [],
        namedSolutionId: null,
      }))
    if (extras.length === 0) return serverCatalog
    return {
      ...serverCatalog,
      species: [...extras, ...serverCatalog.species],
      summary: {
        ...serverCatalog.summary,
        speciesCount: serverCatalog.summary.speciesCount + extras.length,
      },
    }
  }, [serverCatalog, customSpecies])

  const [initialWorkspace] = useState(() => loadLocalWorkspace())
  const [history, setHistory] = useState<{
    past: CanvasNode[][]
    present: CanvasNode[]
    future: CanvasNode[][]
    lastPushAt: number
    lastCoalesceKey: string
  }>(() => ({
    past: [],
    present: initialWorkspace.nodes,
    future: [],
    lastPushAt: 0,
    lastCoalesceKey: '',
  }))
  const nodes = history.present
  const historyRef = useRef(history)
  useEffect(() => {
    historyRef.current = history
  }, [history])

  const [discoveredSpeciesIds, setDiscoveredSpeciesIds] = useState<string[]>(
    () => initialWorkspace.discoveredSpeciesIds,
  )
  const [hydrated, setHydrated] = useState(false)
  const hydratedRef = useRef(false)

  const setNodesSilent = useCallback(
    (updater: CanvasNode[] | ((prev: CanvasNode[]) => CanvasNode[])) => {
      setHistory((state) => {
        const next =
          typeof updater === 'function' ? updater(state.present) : updater
        if (next === state.present) return state
        return { ...state, present: next }
      })
    },
    [],
  )

  const setNodes = useCallback(
    (updater: CanvasNode[] | ((prev: CanvasNode[]) => CanvasNode[])) => {
      const now = Date.now()
      setHistory((state) => {
        const next =
          typeof updater === 'function' ? updater(state.present) : updater
        if (next === state.present) return state
        if (!hydratedRef.current) {
          return { ...state, present: next }
        }
        const coalesceKey = computeCoalesceKey(state.present, next)
        const shouldCoalesce =
          coalesceKey !== '' &&
          coalesceKey === state.lastCoalesceKey &&
          now - state.lastPushAt < 650
        if (shouldCoalesce) {
          return {
            ...state,
            present: next,
            lastPushAt: now,
          }
        }
        return {
          past: [...state.past.slice(-39), state.present],
          present: next,
          future: [],
          lastPushAt: now,
          lastCoalesceKey: coalesceKey,
        }
      })
    },
    [],
  )

  const [activeView, setActiveView] = useState<AppView>(() =>
    parseViewFromHash(window.location.hash),
  )
  const [visitedViews, setVisitedViews] = useState<Set<AppView>>(
    () => new Set([parseViewFromHash(window.location.hash), 'workbench']),
  )
  const [lewisBuilderSeed, setLewisBuilderSeed] = useState<{
    key: number
    species: SpeciesRecord | null
  }>({ key: 0, species: null })
  const [pendingMerge, setPendingMerge] = useState<PendingMergeState | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [bottomDockCollapsed, setBottomDockCollapsed] = useState(false)
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const [viewport, setViewport] = useState<ViewportTransform>({ x: 0, y: 0, zoom: 1 })

  const [pulsingFlaskIds, setPulsingFlaskIds] = useState<Set<string>>(() => new Set())
  const [shakingNodeIds, setShakingNodeIds] = useState<Set<string>>(() => new Set())
  const [freshNodeIds, setFreshNodeIds] = useState<Set<string>>(() => new Set())
  const [notice, setNotice] = useState<CanvasNotice | null>(null)
  const [inspectorWidth, setInspectorWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 404
    const saved = Number(window.localStorage.getItem('deltalab:inspector-width'))
    return Number.isFinite(saved) && saved >= 300 && saved <= 720
      ? Math.round(saved)
      : 404
  })
  const [resizingInspector, setResizingInspector] = useState(false)

  const canvasRef = useRef<HTMLDivElement | null>(null)
  const spawnCounterRef = useRef(0)
  const noticeTimerRef = useRef<number | null>(null)
  const nodesRef = useRef<CanvasNode[]>(nodes)
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  const handleStartInspectorResize = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      e.preventDefault()
      setResizingInspector(true)
      const prevCursor = document.body.style.cursor
      const prevSelect = document.body.style.userSelect
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      let latestWidth = inspectorWidth
      const clampWidth = (raw: number) => {
        const maxAllowed = Math.min(720, Math.max(360, window.innerWidth - 500))
        return Math.round(Math.max(300, Math.min(maxAllowed, raw)))
      }

      const onMove = (ev: PointerEvent) => {
        latestWidth = clampWidth(window.innerWidth - ev.clientX)
        setInspectorWidth(latestWidth)
      }

      const onEnd = () => {
        setResizingInspector(false)
        document.body.style.cursor = prevCursor
        document.body.style.userSelect = prevSelect
        try {
          window.localStorage.setItem('deltalab:inspector-width', String(latestWidth))
        } catch {
          // ignore storage quota errors
        }
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onEnd)
        window.removeEventListener('pointercancel', onEnd)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onEnd)
      window.addEventListener('pointercancel', onEnd)
    },
    [inspectorWidth],
  )

  const handleResetInspectorWidth = useCallback(() => {
    setInspectorWidth(404)
    try {
      window.localStorage.setItem('deltalab:inspector-width', '404')
    } catch {
      // ignore
    }
  }, [])

  const showNotice = useCallback((tone: CanvasNotice['tone'], text: string) => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current)
    setNotice({ id: Date.now(), tone, text })
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 3200)
  }, [])

  const triggerShake = useCallback((ids: string[]) => {
    setShakingNodeIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      return next
    })
    window.setTimeout(() => {
      setShakingNodeIds((prev) => {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      })
    }, 340)
  }, [])

  const triggerFresh = useCallback((id: string) => {
    setFreshNodeIds((prev) => new Set(prev).add(id))
    window.setTimeout(() => {
      setFreshNodeIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 280)
  }, [])

  const triggerFlaskPulse = useCallback((flaskId: string) => {
    setPulsingFlaskIds((prev) => new Set(prev).add(flaskId))
    window.setTimeout(() => {
      setPulsingFlaskIds((prev) => {
        const next = new Set(prev)
        next.delete(flaskId)
        return next
      })
    }, 850)
  }, [])

  // Initial catalog fetch from API + silent re-evaluation of cached localStorage flasks
  useEffect(() => {
    let cancelled = false
    api
      .getCatalog()
      .then(async (catRes) => {
        if (cancelled) return
        setServerCatalog(catRes)
        hydratedRef.current = true
        setHydrated(true)

        // Sync vessel metadata (min–max capacity ranges, descriptions) for already-placed flasks
        const vesselById = new Map(catRes.vessels.map((v) => [v.id, v]))
        setNodesSilent((prev) =>
          prev.map((n) => {
            if (n.kind !== 'flask') return n
            const freshVessel = vesselById.get(n.vessel.id)
            if (!freshVessel) return n
            const caps = freshVessel.availableCapacitiesMl
            const minCap = caps[0] ?? 1
            const maxCap = caps[caps.length - 1] ?? 10000
            const clampedCap = Math.min(
              maxCap,
              Math.max(minCap, n.vessel.capacityMl),
            )
            return {
              ...n,
              vessel: {
                ...freshVessel,
                capacityMl: clampedCap,
              },
            }
          }),
        )

        const cachedFlasks = nodesRef.current.filter(
          (n): n is CanvasFlaskNode =>
            n.kind === 'flask' &&
            (n.solution.hasWater || Object.keys(n.solution.solutesMol).length > 0),
        )
        if (cachedFlasks.length === 0) return

        const updates = new Map<string, CanvasFlaskNode['solution']>()
        await Promise.all(
          cachedFlasks.map(async (f) => {
            try {
              const res = await api.evaluateFlaskAddition({
                vesselId: f.vessel.id,
                vesselCapacityMl: f.vessel.capacityMl,
                temperatureC: f.temperatureC ?? 20,
                currentWaterVolumeMl: f.solution.waterVolumeMl,
                currentSolutesMol: f.solution.solutesMol,
                recomputeOnly: true,
              })
              if (res.ok) updates.set(f.id, res.solution)
            } catch {
              // keep cached solution on network error
            }
          }),
        )
        if (cancelled || updates.size === 0) return
        setNodesSilent((prev) =>
          prev.map((n) => {
            if (n.kind !== 'flask') return n
            const refreshed = updates.get(n.id)
            if (!refreshed) return n
            const stillHasSelectedRxn =
              n.selectedReactionId &&
              refreshed.availableReactions?.some((r) => r.id === n.selectedReactionId)
            return {
              ...n,
              solution: refreshed,
              reactionExtentMol: stillHasSelectedRxn ? n.reactionExtentMol : 0,
              selectedReactionId: stillHasSelectedRxn ? n.selectedReactionId : undefined,
            }
          }),
        )
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Impossible de joindre l’API DeltaLab.',
        )
      })
    return () => {
      cancelled = true
    }
  }, [setNodesSilent])

  const handleRegisterCustomSpecies = useCallback((species: SpeciesRecord) => {
    setCustomSpecies((prev) => {
      const next = upsertLocalCustomSpecies(prev, species)
      saveLocalCustomSpecies(next)
      return next
    })
    setDiscoveredSpeciesIds((prev) =>
      prev.includes(species.id) ? prev : [species.id, ...prev],
    )
  }, [])

  const resetView = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) {
      setViewport({ x: 0, y: 0, zoom: 1 })
      return
    }
    setViewport({
      x: Math.round(rect.width / 2),
      y: Math.round(rect.height / 2),
      zoom: 1,
    })
  }, [])

  const handleViewChange = useCallback((next: AppView) => {
    setActiveView(next)
    setVisitedViews((prev) => {
      if (prev.has(next)) return prev
      const copy = new Set(prev)
      copy.add(next)
      return copy
    })
    setPendingMerge(null)
    const targetHash =
      next === 'species'
        ? '#especes'
        : next === 'solutions'
          ? '#solutions'
          : next === 'reactions'
            ? '#reactions'
            : next === 'vessels'
              ? '#verrerie'
              : next === 'lewis'
                ? '#lewis'
                : next === 'equations'
                  ? '#equations'
                  : next === 'periodic'
                    ? '#tableau'
                    : ''
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', targetHash || window.location.pathname)
    }
  }, [])

  useEffect(() => {
    const onHashChange = () => {
      const next = parseViewFromHash(window.location.hash)
      setActiveView(next)
      setVisitedViews((prev) => {
        if (prev.has(next)) return prev
        const copy = new Set(prev)
        copy.add(next)
        return copy
      })
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (activeView === 'workbench' && viewport.x === 0 && viewport.y === 0) {
      resetView()
    }
  }, [activeView, resetView, viewport.x, viewport.y])

  // Debounced per-browser persistence in localStorage
  useEffect(() => {
    if (!hydrated) return
    const handle = window.setTimeout(() => {
      saveLocalWorkspace({ nodes, discoveredSpeciesIds })
    }, 350)
    return () => window.clearTimeout(handle)
  }, [hydrated, nodes, discoveredSpeciesIds])

  const elements = useMemo(() => catalog?.elements ?? [], [catalog])
  const vessels = useMemo(() => catalog?.vessels ?? [], [catalog])
  const summary = catalog?.summary ?? null

  const elementsBySymbol = useMemo(() => {
    const map = new Map<string, ElementRecord>()
    for (const el of elements) map.set(el.symbol, el)
    return map
  }, [elements])

  const speciesMap = useMemo(() => {
    const map = new Map<string, CatalogSpeciesRecord>()
    for (const sp of catalog?.species ?? []) map.set(sp.id, sp)
    return map
  }, [catalog])

  const discoveredSpecies = useMemo(() => {
    const list: SpeciesRecord[] = []
    for (const id of discoveredSpeciesIds) {
      const sp = speciesMap.get(id)
      if (!sp) continue
      const entries = Object.entries(sp.composition)
      if (
        sp.kind === 'element_substance' &&
        sp.charge === 0 &&
        entries.length === 1 &&
        entries[0][1] === 1
      ) {
        continue
      }
      list.push(sp)
    }
    return list
  }, [discoveredSpeciesIds, speciesMap])

  const selectedNodes = useMemo(
    () => nodes.filter((n) => selectedIds.has(n.id)),
    [nodes, selectedIds],
  )

  const speciesChargesBySignature = useMemo(() => {
    const map = new Map<string, Set<number>>()
    for (const sp of catalog?.species ?? []) {
      const sig = buildCanonicalSignature(sp.composition)
      if (!sig) continue
      let set = map.get(sig)
      if (!set) {
        set = new Set<number>()
        map.set(sig, set)
      }
      set.add(sp.charge)
    }
    return map
  }, [catalog])

  const ionizeAvailability = useMemo(() => {
    if (
      selectedNodes.length === 0 ||
      !selectedNodes.every((n) => n.kind === 'atom' || n.kind === 'molecule')
    ) {
      return { canMinus: false, canPlus: false }
    }
    const counts: Record<string, number> = {}
    let currentCharge = 0
    for (const n of selectedNodes) {
      if (n.kind === 'atom') {
        counts[n.symbol] = (counts[n.symbol] ?? 0) + 1
      } else if (n.kind === 'molecule') {
        currentCharge += n.species.charge
        for (const [sym, qty] of Object.entries(n.species.composition)) {
          if (qty > 0) counts[sym] = (counts[sym] ?? 0) + qty
        }
      }
    }
    const sig = buildCanonicalSignature(counts)
    if (!sig) return { canMinus: false, canPlus: false }

    const charges = new Set<number>(speciesChargesBySignature.get(sig) ?? [])
    const entries = Object.entries(counts)
    if (
      entries.length === 1 &&
      entries[0][1] === 1 &&
      elementsBySymbol.has(entries[0][0])
    ) {
      charges.add(0)
    }
    let canMinus = false
    let canPlus = false
    for (const c of charges) {
      if (c < currentCharge) canMinus = true
      if (c > currentCharge) canPlus = true
    }
    return { canMinus, canPlus }
  }, [selectedNodes, speciesChargesBySignature, elementsBySymbol])

  const allFlasks = useMemo(
    () => nodes.filter((n): n is CanvasFlaskNode => n.kind === 'flask'),
    [nodes],
  )

  const handleOpenElementInPeriodic = useCallback(
    (atomicNumber: number) => {
      periodicJumpNonceRef.current += 1
      setPeriodicJumpTarget({ atomicNumber, nonce: periodicJumpNonceRef.current })
      setMobilePanelOpen(false)
      handleViewChange('periodic')
    },
    [handleViewChange],
  )

  const handleOpenInCatalog = useCallback(
    (target: CatalogJumpTarget) => {
      if (target.section === 'elements') {
        const z = Number(target.id)
        if (Number.isFinite(z) && z >= 1 && z <= 118) {
          handleOpenElementInPeriodic(z)
          return
        }
      }
      catalogJumpNonceRef.current += 1
      setCatalogJumpTarget({ ...target, nonce: catalogJumpNonceRef.current })
      setMobilePanelOpen(false)
      handleViewChange(target.section === 'elements' ? 'periodic' : target.section)
    },
    [handleOpenElementInPeriodic, handleViewChange],
  )

  const handleOpenInLewisBuilder = useCallback(
    async (species?: SpeciesRecord) => {
      if (species) {
        let full = species
        if (!full.lewis) {
          try {
            const res = await api.getSpeciesById(species.id)
            full = res.species
          } catch {
            // proceed with base species
          }
        }
        setLewisBuilderSeed((prev) => ({ key: prev.key + 1, species: full }))
      }
      setMobilePanelOpen(false)
      handleViewChange('lewis')
    },
    [handleViewChange],
  )

  const getSpawnWorldPoint = useCallback(
    (clientX?: number, clientY?: number) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      if (typeof clientX === 'number' && typeof clientY === 'number') {
        return {
          x: (clientX - rect.left - viewport.x) / viewport.zoom,
          y: (clientY - rect.top - viewport.y) / viewport.zoom,
        }
      }
      const step = spawnCounterRef.current++
      const angle = step * 1.15
      const radius = step === 0 ? 0 : Math.min(110, 44 + (step % 5) * 16)
      const cx = (rect.width / 2 - viewport.x) / viewport.zoom
      const cy = (rect.height / 2 - viewport.y) / viewport.zoom
      return {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      }
    },
    [viewport],
  )

  const flaskCore = useFlaskCoreActions({
    nodesRef,
    setNodes,
    setSelectedIds,
    showNotice,
    triggerShake,
    triggerFlaskPulse,
  })

  const flaskRxn = useFlaskReactionAndTransfer({
    nodesRef,
    speciesMap,
    setNodes,
    setSelectedIds,
    showNotice,
    triggerShake,
    triggerFresh,
    triggerFlaskPulse,
  })

  const workbench = useWorkbenchSelectionActions({
    activeView,
    nodesRef,
    selectedIds,
    pendingMerge,
    elementsBySymbol,
    speciesMap,
    vessels,
    setNodes,
    setSelectedIds,
    setPendingMerge,
    setDiscoveredSpeciesIds,
    getSpawnWorldPoint,
    handleViewChange,
    showNotice,
    triggerShake,
    triggerFresh,
    triggerFlaskPulse,
  })

  const labSim = useLabSimulation({
    active: activeView === 'workbench',
    nodesRef,
    vessels,
    discoveredSpeciesIds,
    setNodes,
    setNodesSilent,
    setDiscoveredSpeciesIds,
    setSelectedIds,
    onResetView: resetView,
    showNotice,
    triggerFlaskPulse,
  })

  const handleUndoWorkbench = useCallback(() => {
    const cur = historyRef.current
    if (cur.past.length === 0) return
    const previous = cur.past[cur.past.length - 1]
    setHistory((state) => {
      if (state.past.length === 0) return state
      const target = state.past[state.past.length - 1]
      return {
        past: state.past.slice(0, -1),
        present: target,
        future: [...state.future.slice(-39), state.present],
        lastPushAt: 0,
        lastCoalesceKey: '',
      }
    })
    setPendingMerge(null)
    labSim.setTitrationSession(null)
    const validIds = new Set(previous.map((n) => n.id))
    setSelectedIds((prev) => {
      const filtered = new Set([...prev].filter((id) => validIds.has(id)))
      return filtered.size === prev.size ? prev : filtered
    })
    showNotice('neutral', 'Annulé (⌘Z)')
  }, [labSim, showNotice])

  const handleRedoWorkbench = useCallback(() => {
    const cur = historyRef.current
    if (cur.future.length === 0) return
    const next = cur.future[cur.future.length - 1]
    setHistory((state) => {
      if (state.future.length === 0) return state
      const target = state.future[state.future.length - 1]
      return {
        past: [...state.past.slice(-39), state.present],
        present: target,
        future: state.future.slice(0, -1),
        lastPushAt: 0,
        lastCoalesceKey: '',
      }
    })
    setPendingMerge(null)
    labSim.setTitrationSession(null)
    const validIds = new Set(next.map((n) => n.id))
    setSelectedIds((prev) => {
      const filtered = new Set([...prev].filter((id) => validIds.has(id)))
      return filtered.size === prev.size ? prev : filtered
    })
    showNotice('neutral', 'Rétabli (⇧⌘Z)')
  }, [labSim, showNotice])

  useEffect(() => {
    if (activeView !== 'workbench') return
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (!(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndoWorkbench()
      } else if ((key === 'z' && e.shiftKey) || (key === 'y' && !e.shiftKey)) {
        e.preventDefault()
        handleRedoWorkbench()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeView, handleUndoWorkbench, handleRedoWorkbench])

  const closeMobilePanel = useCallback(() => setMobilePanelOpen(false), [])

  const {
    externalDrag,
    externalDragGhostRef,
    externalHoveredFlaskId,
    externalHoverHint,
    handleStartExternalDrag,
  } = useExternalDockDrag({
    canvasRef,
    nodesRef,
    viewport,
    getSpawnWorldPoint,
    spawnItem: workbench.spawnItem,
    addSpeciesToFlask: flaskCore.addSpeciesToFlask,
    showNotice,
    triggerShake,
    onCloseMobilePanel: closeMobilePanel,
  })

  const handleKeyboardSpawn = useCallback(
    (item: ExternalDragItem) => {
      const pt = getSpawnWorldPoint()
      workbench.spawnItem(item, pt.x, pt.y)
      setMobilePanelOpen(false)
    },
    [getSpawnWorldPoint, workbench],
  )

  const handleToggleBottomDock = useCallback(() => {
    setBottomDockCollapsed((c) => !c)
  }, [])

  const handleOpenSpeciesInCatalog = useCallback(
    (id: string) => handleOpenInCatalog({ section: 'species', id }),
    [handleOpenInCatalog],
  )

  const handleCatalogSpawn = useCallback(
    (item: ExternalDragItem) => {
      void workbench.handleSpawnFromCatalog(item)
    },
    [workbench],
  )

  const handleCatalogSpawnReaction = useCallback(
    (setup: ReactionSpawnSetup) => {
      void workbench.handleSpawnReactionSetup(setup)
    },
    [workbench],
  )

  const handleCatalogOpenLewis = useCallback(
    (sp: SpeciesRecord) => {
      void handleOpenInLewisBuilder(sp)
    },
    [handleOpenInLewisBuilder],
  )

  const inspectorProps = {
    selectedNodes,
    allFlasks,
    totalNodeCount: nodes.length,
    catalog,
    elementsBySymbol,
    speciesById: speciesMap,
    onMergeSelected: () => void workbench.handleMergeSelected(),
    onIonizeSelected: (dir: 1 | -1) => void workbench.handleIonizeSelected(dir),
    canIonizeMinus: ionizeAvailability.canMinus,
    canIonizePlus: ionizeAvailability.canPlus,
    onUpdateMoleculeAmount: workbench.handleUpdateMoleculeAmount,
    onAddWaterToFlask: flaskCore.handleAddWaterToFlask,
    onResizeFlask: flaskCore.handleResizeFlask,
    onSetFlaskTemperature: flaskCore.handleSetFlaskTemperature,
    onToggleFlaskFilter: flaskCore.handleToggleFlaskFilter,
    onSetFlaskLabel: flaskCore.handleSetFlaskLabel,
    onEvaporateFlaskWater: (id: string, vol: number) =>
      void flaskCore.handleEvaporateFlaskWater(id, vol),
    onSetFlaskSoluteAmount: (id: string, spId: string, mol: number) =>
      void flaskCore.handleSetFlaskSoluteAmount(id, spId, mol),
    onSetFlaskWaterVolume: (id: string, ml: number) =>
      void flaskCore.handleSetFlaskWaterVolume(id, ml),
    onChangeFlaskReactionExtent: flaskRxn.handleChangeFlaskReactionExtent,
    onSelectFlaskReaction: flaskRxn.handleSelectFlaskReaction,
    onCommitFlaskReaction: (id: string) => void flaskRxn.handleCommitFlaskReaction(id),
    onBalanceFlaskStoichiometry: (id: string) =>
      void flaskRxn.handleBalanceFlaskStoichiometry(id),
    onExtractFilteredSolid: flaskRxn.handleExtractFilteredSolid,
    onClearFilterCake: flaskRxn.handleClearFilterCake,
    onSetFlaskIndicator: labSim.handleSetFlaskIndicator,
    onToggleFlaskProbe: labSim.handleToggleFlaskProbe,
    onToggleFlaskStirrer: labSim.handleToggleFlaskStirrer,
    onSetFlaskHeaterTarget: labSim.handleSetFlaskHeaterTarget,
    onOpenTitration: labSim.handleOpenTitration,
    onOpenInCatalog: handleOpenInCatalog,
    onOpenInLewisBuilder: (sp: SpeciesRecord) => void handleOpenInLewisBuilder(sp),
  }

  return (
    <TooltipProvider delayDuration={240} disableHoverableContent>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
        <Header
          activeView={activeView}
          onViewChange={handleViewChange}
          summary={summary}
          mobilePanelOpen={mobilePanelOpen}
          onToggleMobilePanel={() => setMobilePanelOpen((o) => !o)}
        />

        {loadError ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="max-w-sm rounded-lg border border-red-500/30 bg-card p-4 text-center">
              <p className="text-xs font-medium text-red-300">Base SQLite inaccessible</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{loadError}</p>
            </div>
          </div>
        ) : (
          <>
            {(visitedViews.has('species') ||
              visitedViews.has('solutions') ||
              visitedViews.has('reactions') ||
              visitedViews.has('vessels')) && (
              <div
                className={
                  isCatalogSectionView(activeView)
                    ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                    : 'hidden'
                }
              >
                <CatalogPage
                  catalog={catalog}
                  section={isCatalogSectionView(activeView) ? activeView : 'species'}
                  onSectionChange={handleViewChange}
                  jumpTarget={catalogJumpTarget}
                  active={isCatalogSectionView(activeView)}
                  onSpawnToWorkbench={handleCatalogSpawn}
                  onSpawnReactionSetup={handleCatalogSpawnReaction}
                  onOpenInLewisBuilder={handleCatalogOpenLewis}
                  onOpenElementInPeriodic={handleOpenElementInPeriodic}
                />
              </div>
            )}

            {visitedViews.has('periodic') && (
              <div
                className={
                  activeView === 'periodic'
                    ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                    : 'hidden'
                }
              >
                <PeriodicTablePage
                  catalog={catalog}
                  jumpTarget={periodicJumpTarget}
                  active={activeView === 'periodic'}
                  onSpawnToWorkbench={handleCatalogSpawn}
                  onJumpToSpecies={handleOpenSpeciesInCatalog}
                />
              </div>
            )}

            {visitedViews.has('equations') && (
              <div
                className={
                  activeView === 'equations'
                    ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                    : 'hidden'
                }
              >
                <EquationSolverPage
                  catalog={catalog}
                  active={activeView === 'equations'}
                  onSpawnReactionSetup={handleCatalogSpawnReaction}
                  onOpenSpeciesInCatalog={handleOpenSpeciesInCatalog}
                  onOpenInLewisBuilder={handleCatalogOpenLewis}
                />
              </div>
            )}

            {visitedViews.has('lewis') && (
              <div
                className={
                  activeView === 'lewis'
                    ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                    : 'hidden'
                }
              >
                <LewisBuilderPage
                  key={`lewis-${lewisBuilderSeed.key}`}
                  catalog={catalog}
                  initialSpecies={lewisBuilderSeed.species}
                  active={activeView === 'lewis'}
                  onAddSpeciesToWorkbench={workbench.handleAddFromLewisBuilder}
                  onOpenSpeciesInCatalog={handleOpenSpeciesInCatalog}
                  onSpeciesDiscovered={handleRegisterCustomSpecies}
                />
              </div>
            )}

            <div
              className={
                activeView === 'workbench'
                  ? 'relative flex min-h-0 flex-1 overflow-hidden'
                  : 'hidden'
              }
            >
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <LabCanvas
                    canvasRef={canvasRef}
                    active={activeView === 'workbench'}
                    hydrated={hydrated}
                    nodes={nodes}
                    selectedIds={selectedIds}
                    viewport={viewport}
                    onViewportChange={setViewport}
                    onSelectIds={(next) => {
                      setSelectedIds(next)
                      setPendingMerge(null)
                    }}
                    onMoveNodes={workbench.handleMoveNodes}
                    onDuplicateNodesForDrag={workbench.handleDuplicateNodesForDrag}
                    onMergeSelected={() => void workbench.handleMergeSelected()}
                    onIonizeSelected={(dir) => void workbench.handleIonizeSelected(dir)}
                    canIonizeMinus={ionizeAvailability.canMinus}
                    canIonizePlus={ionizeAvailability.canPlus}
                    onDuplicateSelected={workbench.handleDuplicateSelected}
                    onDeleteIds={workbench.handleDeleteIds}
                    onEmptyFlask={flaskCore.handleEmptyFlask}
                    onToggleFlaskFilter={flaskCore.handleToggleFlaskFilter}
                    onDropAtomOnFlask={flaskCore.handleDropAtomOnFlask}
                    onDropMoleculeOnFlask={flaskCore.handleDropMoleculeOnFlask}
                    onPourBetweenFlasks={(src, tgt, vol) =>
                      void flaskRxn.handlePourBetweenFlasks(src, tgt, vol)
                    }
                    onChangeFlaskReactionExtent={flaskRxn.handleChangeFlaskReactionExtent}
                    onSelectFlaskReaction={flaskRxn.handleSelectFlaskReaction}
                    onCommitFlaskReaction={(id) =>
                      void flaskRxn.handleCommitFlaskReaction(id)
                    }
                    onBalanceFlaskStoichiometry={(id) =>
                      void flaskRxn.handleBalanceFlaskStoichiometry(id)
                    }
                    onResetView={resetView}
                    onClearCanvas={() => {
                      labSim.setTitrationSession(null)
                      workbench.handleClearCanvas()
                    }}
                    savedWorkbenches={labSim.savedWorkbenches}
                    onLoadPreset={(preset) => void labSim.handleLoadPreset(preset)}
                    onSaveCurrentWorkbench={labSim.handleSaveCurrentWorkbench}
                    onLoadSavedWorkbench={labSim.handleLoadSavedWorkbench}
                    onDeleteSavedWorkbench={labSim.handleDeleteSavedWorkbench}
                    externalHoveredFlaskId={externalHoveredFlaskId}
                    externalHoverHint={externalHoverHint}
                    pulsingFlaskIds={pulsingFlaskIds}
                    shakingNodeIds={shakingNodeIds}
                    freshNodeIds={freshNodeIds}
                    notice={notice}
                    pendingMergeIsomers={pendingMerge}
                    onPickMergeIsomer={workbench.handlePickMergeIsomer}
                    onCancelMergeIsomer={() => setPendingMerge(null)}
                    titrationSession={labSim.titrationSession}
                    onOpenTitration={labSim.handleOpenTitration}
                    onDispenseTitrationMl={(ml) => void labSim.handleDispenseTitrationMl(ml)}
                    onToggleTitrationRunning={labSim.handleToggleTitrationRunning}
                    onCycleTitrationSpeed={labSim.handleCycleTitrationSpeed}
                    onResetTitrationSession={() => void labSim.handleResetTitrationSession()}
                    onCloseTitration={() => labSim.setTitrationSession(null)}
                    onSetFlaskIndicator={labSim.handleSetFlaskIndicator}
                  />
                </main>

                <div className="flex shrink-0 flex-col border-t border-border bg-panel xl:flex-row">
                  <PeriodicTableDock
                    elements={elements}
                    active={activeView === 'workbench'}
                    collapsed={bottomDockCollapsed}
                    onToggleCollapse={handleToggleBottomDock}
                    onStartExternalDrag={handleStartExternalDrag}
                    onKeyboardSpawn={handleKeyboardSpawn}
                  />
                  <ToolboxDock
                    vessels={vessels}
                    discoveredSpecies={discoveredSpecies}
                    collapsed={bottomDockCollapsed}
                    onToggleCollapse={handleToggleBottomDock}
                    onStartExternalDrag={handleStartExternalDrag}
                    onKeyboardSpawn={handleKeyboardSpawn}
                  />
                </div>
              </div>

              <div
                className="relative hidden h-full shrink-0 lg:block"
                style={{ width: `${inspectorWidth}px` }}
              >
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Redimensionner l’inspecteur"
                  aria-valuenow={inspectorWidth}
                  aria-valuemin={300}
                  aria-valuemax={720}
                  tabIndex={0}
                  title="Glisser pour redimensionner (double-clic pour réinitialiser)"
                  onPointerDown={handleStartInspectorResize}
                  onDoubleClick={handleResetInspectorWidth}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft') {
                      e.preventDefault()
                      setInspectorWidth((w) => Math.min(720, w + 24))
                    } else if (e.key === 'ArrowRight') {
                      e.preventDefault()
                      setInspectorWidth((w) => Math.max(300, w - 24))
                    }
                  }}
                  className="group absolute bottom-0 left-[-3px] top-0 z-30 w-[7px] cursor-col-resize focus-visible:outline-none"
                >
                  <span
                    className={
                      resizingInspector
                        ? 'pointer-events-none absolute inset-y-0 left-[3px] w-[2px] bg-zinc-300/80'
                        : 'pointer-events-none absolute inset-y-0 left-[3px] w-[2px] bg-transparent group-hover:bg-zinc-500/70 group-focus-visible:bg-zinc-300/80'
                    }
                  />
                </div>
                <InspectorPanel {...inspectorProps} />
              </div>

              {mobilePanelOpen && (
                <div className="fixed inset-0 top-11 z-40 flex justify-end bg-black/50 lg:hidden">
                  <div
                    className="flex-1"
                    onClick={closeMobilePanel}
                    aria-hidden="true"
                  />
                  <InspectorPanel
                    className="w-[360px] max-w-[90vw]"
                    {...inspectorProps}
                  />
                </div>
              )}
            </div>
          </>
        )}

        <ExternalDragGhost
          externalDrag={externalDrag}
          ghostRef={externalDragGhostRef}
        />
      </div>
    </TooltipProvider>
  )
}
