import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import type {
  CanvasFlaskNode,
  CanvasNode,
  FlaskProbeType,
  PhIndicatorId,
  VesselRecord,
} from '../../shared/chemistry.ts'
import { api } from '@/lib/api'
import { createEmptySolution } from '@/lib/chemistry-ui'
import {
  type LabPresetDefinition,
  type SavedWorkbenchRecord,
  loadSavedWorkbenches,
  persistSavedWorkbenches,
} from '@/lib/lab-presets'
import {
  estimateTitrationPointMetrics,
  findTitrationPairs,
} from '@/lib/titration-engine'
import { createNodeId } from '@/lib/workbench-helpers'
import type { CanvasNotice } from '@/components/LabCanvas'
import type { TitrationSessionState } from '@/components/canvas/TitrationDrawer'

interface UseLabSimulationParams {
  active: boolean
  nodesRef: MutableRefObject<CanvasNode[]>
  vessels: VesselRecord[]
  discoveredSpeciesIds: string[]
  setNodes: Dispatch<SetStateAction<CanvasNode[]>>
  setNodesSilent: Dispatch<SetStateAction<CanvasNode[]>>
  setDiscoveredSpeciesIds: Dispatch<SetStateAction<string[]>>
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>
  onResetView: () => void
  showNotice: (tone: CanvasNotice['tone'], text: string) => void
  triggerFlaskPulse: (flaskId: string) => void
}

function buildInitialTitrationSession(
  burette: CanvasFlaskNode,
  analyte: CanvasFlaskNode,
): TitrationSessionState {
  const buretteVol = Math.max(0.01, burette.solution.totalVolumeMl)
  const titrantPerMl: Record<string, number> = {}
  for (const [k, v] of Object.entries(burette.solution.solutesMol)) {
    if (v > 1e-12) titrantPerMl[k] = v / buretteVol
  }
  const initialPoint = estimateTitrationPointMetrics(
    analyte.solution.solutesMol,
    analyte.solution.waterVolumeMl,
    titrantPerMl,
    0,
    analyte.temperatureC ?? 20,
    analyte.indicatorId,
  )

  return {
    buretteId: burette.id,
    analyteId: analyte.id,
    initialAnalyteVolumeMl: analyte.solution.waterVolumeMl,
    initialAnalyteSolutesMol: { ...analyte.solution.solutesMol },
    initialBuretteVolumeMl: burette.solution.waterVolumeMl,
    initialBuretteSolutesMol: { ...burette.solution.solutesMol },
    volumeAddedMl: 0,
    running: false,
    speedMultiplier: 1,
    points: [{ volumeAddedMl: 0, ...initialPoint }],
  }
}

export function useLabSimulation({
  active,
  nodesRef,
  vessels,
  discoveredSpeciesIds,
  setNodes,
  setNodesSilent,
  setDiscoveredSpeciesIds,
  setSelectedIds,
  onResetView,
  showNotice,
  triggerFlaskPulse,
}: UseLabSimulationParams) {
  const [titrationSession, setTitrationSession] =
    useState<TitrationSessionState | null>(null)
  const [savedWorkbenches, setSavedWorkbenches] = useState<SavedWorkbenchRecord[]>(
    () => loadSavedWorkbenches(),
  )

  const titrationSessionRef = useRef<TitrationSessionState | null>(titrationSession)
  useEffect(() => {
    titrationSessionRef.current = titrationSession
  }, [titrationSession])

  const dispensingRef = useRef(false)
  const lastEvalTempRef = useRef<Map<string, number>>(new Map())

  // --- Instrumentation controls ---
  const handleSetFlaskIndicator = useCallback(
    (flaskId: string, indicatorId: PhIndicatorId | null) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === flaskId && n.kind === 'flask' ? { ...n, indicatorId } : n,
        ),
      )
      triggerFlaskPulse(flaskId)
    },
    [setNodes, triggerFlaskPulse],
  )

  const handleToggleFlaskProbe = useCallback(
    (flaskId: string, probe: FlaskProbeType) => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== flaskId || n.kind !== 'flask') return n
          const cur = n.probes ?? []
          const next = cur.includes(probe)
            ? cur.filter((p) => p !== probe)
            : [...cur, probe]
          return { ...n, probes: next }
        }),
      )
    },
    [setNodes],
  )

  const handleToggleFlaskStirrer = useCallback(
    (flaskId: string) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === flaskId && n.kind === 'flask'
            ? { ...n, stirrerOn: !n.stirrerOn }
            : n,
        ),
      )
    },
    [setNodes],
  )

  const handleSetFlaskHeaterTarget = useCallback(
    (flaskId: string, targetC: number | null) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === flaskId && n.kind === 'flask'
            ? {
                ...n,
                heaterTargetC:
                  targetC === null ? null : Math.max(0, Math.min(100, Math.round(targetC))),
              }
            : n,
        ),
      )
    },
    [setNodes],
  )

  // --- Smooth thermal simulation & gentle boiling loop ---
  useEffect(() => {
    if (!active) return
    let boilTick = 0
    const timer = window.setInterval(() => {
      const flasks = nodesRef.current.filter(
        (n): n is CanvasFlaskNode =>
          n.kind === 'flask' &&
          n.vessel.supportsHeating &&
          typeof n.heaterTargetC === 'number',
      )
      if (flasks.length === 0) return

      boilTick += 1
      const toRecompute: Array<{ flask: CanvasFlaskNode; nextTemp: number }> = []
      const toEvaporate: CanvasFlaskNode[] = []

      setNodesSilent((prev) => {
        let changed = false
        const nextNodes = prev.map((n) => {
          if (
            n.kind !== 'flask' ||
            !n.vessel.supportsHeating ||
            typeof n.heaterTargetC !== 'number'
          ) {
            return n
          }
          const curT = n.temperatureC ?? 20
          const targetT = n.heaterTargetC
          const diff = targetT - curT
          if (Math.abs(diff) >= 0.4) {
            changed = true
            const step = Math.sign(diff) * Math.min(Math.abs(diff), 3)
            const nextT = Math.round((curT + step) * 10) / 10
            const lastEval = lastEvalTempRef.current.get(n.id) ?? curT
            if (Math.abs(nextT - lastEval) >= 10 || Math.abs(targetT - nextT) < 0.4) {
              lastEvalTempRef.current.set(n.id, nextT)
              toRecompute.push({ flask: n, nextTemp: nextT })
            }
            return { ...n, temperatureC: nextT }
          }
          if (
            curT >= 98 &&
            targetT >= 98 &&
            !n.stoppered &&
            n.solution.hasWater &&
            n.solution.waterVolumeMl > 6 &&
            boilTick % 4 === 0
          ) {
            toEvaporate.push(n)
          }
          return n
        })
        return changed ? nextNodes : prev
      })

      for (const { flask, nextTemp } of toRecompute) {
        api
          .evaluateFlaskAddition({
            vesselId: flask.vessel.id,
            vesselCapacityMl: flask.vessel.capacityMl,
            temperatureC: nextTemp,
            currentWaterVolumeMl: flask.solution.waterVolumeMl,
            currentSolutesMol: flask.solution.solutesMol,
            recomputeOnly: true,
          })
          .then((res) => {
            if (!res.ok) return
            setNodesSilent((prev) =>
              prev.map((n) =>
                n.id === flask.id && n.kind === 'flask'
                  ? { ...n, solution: res.solution }
                  : n,
              ),
            )
          })
          .catch(() => {})
      }

      for (const flask of toEvaporate) {
        api
          .evaluateFlaskAddition({
            vesselId: flask.vessel.id,
            vesselCapacityMl: flask.vessel.capacityMl,
            temperatureC: flask.temperatureC ?? 100,
            currentWaterVolumeMl: flask.solution.waterVolumeMl,
            currentSolutesMol: flask.solution.solutesMol,
            evaporateWaterMl: 0.6,
          })
          .then((res) => {
            if (!res.ok) return
            setNodesSilent((prev) =>
              prev.map((n) =>
                n.id === flask.id && n.kind === 'flask'
                  ? { ...n, solution: res.solution }
                  : n,
              ),
            )
          })
          .catch(() => {})
      }
    }, 650)

    return () => window.clearInterval(timer)
  }, [active, nodesRef, setNodesSilent])

  // --- Titration workflow ---
  const handleOpenTitration = useCallback(
    (preferredBuretteId?: string, preferredAnalyteId?: string) => {
      const flasks = nodesRef.current.filter(
        (n): n is CanvasFlaskNode => n.kind === 'flask',
      )
      const { burettes, analytes } = findTitrationPairs(flasks)
      const burette =
        (preferredBuretteId
          ? burettes.find((b) => b.id === preferredBuretteId)
          : null) ?? burettes[0]
      const analyte =
        (preferredAnalyteId
          ? analytes.find((a) => a.id === preferredAnalyteId)
          : null) ?? analytes[0]

      if (!burette || !analyte) {
        showNotice(
          'warning',
          'Placez une burette (titrant) et un bécher ou erlenmeyer (titré) pour démarrer un titrage.',
        )
        return
      }
      setTitrationSession(buildInitialTitrationSession(burette, analyte))
    },
    [nodesRef, showNotice],
  )

  const handleDispenseTitrationMl = useCallback(
    async (requestedMl: number) => {
      const sess = titrationSessionRef.current
      if (!sess || dispensingRef.current) return
      const flasks = nodesRef.current.filter(
        (n): n is CanvasFlaskNode => n.kind === 'flask',
      )
      const burette = flasks.find((f) => f.id === sess.buretteId)
      const analyte = flasks.find((f) => f.id === sess.analyteId)
      if (!burette || !analyte) {
        setTitrationSession((prev) => (prev ? { ...prev, running: false } : null))
        return
      }
      if (burette.stoppered || analyte.stoppered) {
        setTitrationSession((prev) => (prev ? { ...prev, running: false } : null))
        showNotice('warning', 'Retirez le bouchon avant de verser depuis la burette.')
        return
      }

      const availableMl = Math.min(
        burette.solution.totalVolumeMl,
        Math.max(0, analyte.vessel.capacityMl - analyte.solution.totalVolumeMl),
      )
      const stepMl = Math.round(Math.min(requestedMl, availableMl) * 100) / 100
      if (stepMl < 0.05) {
        setTitrationSession((prev) => (prev ? { ...prev, running: false } : null))
        return
      }

      dispensingRef.current = true
      try {
        const res = await api.evaluateFlaskAddition({
          vesselId: analyte.vessel.id,
          vesselCapacityMl: analyte.vessel.capacityMl,
          temperatureC: analyte.temperatureC ?? 20,
          currentWaterVolumeMl: analyte.solution.waterVolumeMl,
          currentSolutesMol: analyte.solution.solutesMol,
          incomingFlask: {
            waterVolumeMl: burette.solution.waterVolumeMl,
            solutesMol: burette.solution.solutesMol,
            transferVolumeMl: stepMl,
            sourceTemperatureC: burette.temperatureC ?? 20,
          },
        })
        if (!res.ok) {
          setTitrationSession((prev) => (prev ? { ...prev, running: false } : null))
          showNotice('warning', res.messageFr)
          return
        }

        const nextBuretteSol = res.remainingSourceFlask?.solution ?? createEmptySolution()

        setNodes((prev) =>
          prev.map((n) => {
            if (n.id === analyte.id && n.kind === 'flask') {
              return {
                ...n,
                solution: res.solution,
                reactionExtentMol: 0,
                selectedReactionId: undefined,
              }
            }
            if (n.id === burette.id && n.kind === 'flask') {
              return {
                ...n,
                solution: nextBuretteSol,
                reactionExtentMol: 0,
                selectedReactionId: undefined,
              }
            }
            return n
          }),
        )

        const initBuretteVol = Math.max(0.01, sess.initialBuretteVolumeMl)
        const titrantPerMl: Record<string, number> = {}
        for (const [k, v] of Object.entries(sess.initialBuretteSolutesMol)) {
          if (v > 1e-12) titrantPerMl[k] = v / initBuretteVol
        }

        setTitrationSession((prev) => {
          if (!prev) return null
          const nextVol = Math.round((prev.volumeAddedMl + stepMl) * 100) / 100
          const metrics = estimateTitrationPointMetrics(
            prev.initialAnalyteSolutesMol,
            prev.initialAnalyteVolumeMl,
            titrantPerMl,
            nextVol,
            analyte.temperatureC ?? 20,
            analyte.indicatorId,
          )
          const stopNow = nextBuretteSol.totalVolumeMl < 0.08
          return {
            ...prev,
            volumeAddedMl: nextVol,
            running: stopNow ? false : prev.running,
            points: [...prev.points, { volumeAddedMl: nextVol, ...metrics }],
          }
        })
      } finally {
        dispensingRef.current = false
      }
    },
    [nodesRef, setNodes, showNotice],
  )

  // Continuous stopcock timer
  useEffect(() => {
    if (!active || !titrationSession?.running) return
    const stepMl = 0.25 * titrationSession.speedMultiplier
    const timer = window.setInterval(() => {
      void handleDispenseTitrationMl(stepMl)
    }, 360)
    return () => window.clearInterval(timer)
  }, [
    active,
    titrationSession?.running,
    titrationSession?.speedMultiplier,
    handleDispenseTitrationMl,
  ])

  const handleToggleTitrationRunning = useCallback(() => {
    setTitrationSession((prev) => (prev ? { ...prev, running: !prev.running } : null))
  }, [])

  const handleCycleTitrationSpeed = useCallback(() => {
    setTitrationSession((prev) => {
      if (!prev) return null
      const next: 1 | 2 | 4 =
        prev.speedMultiplier === 1 ? 2 : prev.speedMultiplier === 2 ? 4 : 1
      return { ...prev, speedMultiplier: next }
    })
  }, [])

  const handleResetTitrationSession = useCallback(async () => {
    const sess = titrationSessionRef.current
    if (!sess) return
    const flasks = nodesRef.current.filter(
      (n): n is CanvasFlaskNode => n.kind === 'flask',
    )
    const burette = flasks.find((f) => f.id === sess.buretteId)
    const analyte = flasks.find((f) => f.id === sess.analyteId)
    if (!burette || !analyte) return

    setTitrationSession((prev) => (prev ? { ...prev, running: false } : null))

    try {
      const [bRes, aRes] = await Promise.all([
        api.evaluateFlaskAddition({
          vesselId: burette.vessel.id,
          vesselCapacityMl: burette.vessel.capacityMl,
          temperatureC: burette.temperatureC ?? 20,
          currentWaterVolumeMl: 0,
          currentSolutesMol: {},
          setWaterVolumeMl: sess.initialBuretteVolumeMl,
          setSolutesMol: sess.initialBuretteSolutesMol,
        }),
        api.evaluateFlaskAddition({
          vesselId: analyte.vessel.id,
          vesselCapacityMl: analyte.vessel.capacityMl,
          temperatureC: analyte.temperatureC ?? 20,
          currentWaterVolumeMl: 0,
          currentSolutesMol: {},
          setWaterVolumeMl: sess.initialAnalyteVolumeMl,
          setSolutesMol: sess.initialAnalyteSolutesMol,
        }),
      ])
      if (!bRes.ok || !aRes.ok) return

      const restoredBurette: CanvasFlaskNode = {
        ...burette,
        solution: bRes.solution,
        reactionExtentMol: 0,
        selectedReactionId: undefined,
      }
      const restoredAnalyte: CanvasFlaskNode = {
        ...analyte,
        solution: aRes.solution,
        reactionExtentMol: 0,
        selectedReactionId: undefined,
      }

      setNodes((prev) =>
        prev.map((n) => {
          if (n.id === burette.id) return restoredBurette
          if (n.id === analyte.id) return restoredAnalyte
          return n
        }),
      )
      setTitrationSession(buildInitialTitrationSession(restoredBurette, restoredAnalyte))
    } catch {
      showNotice('warning', 'Impossible de réinitialiser le titrage.')
    }
  }, [nodesRef, setNodes, showNotice])

  // --- TP Presets & Saved Workbenches ---
  const handleLoadPreset = useCallback(
    async (preset: LabPresetDefinition) => {
      if (vessels.length === 0) return
      const createdByKey = new Map<string, CanvasFlaskNode>()
      const createdFlasks: CanvasFlaskNode[] = []

      try {
        await Promise.all(
          preset.flasks.map(async (spec) => {
            const baseVessel =
              vessels.find((v) => v.vesselType === spec.vesselType) ?? vessels[0]
            if (!baseVessel) return
            const vessel: VesselRecord = spec.capacityMl
              ? { ...baseVessel, capacityMl: spec.capacityMl }
              : { ...baseVessel }
            const res = await api.evaluateFlaskAddition({
              vesselId: vessel.id,
              vesselCapacityMl: vessel.capacityMl,
              temperatureC: spec.temperatureC ?? 20,
              currentWaterVolumeMl: 0,
              currentSolutesMol: {},
              setWaterVolumeMl: spec.waterVolumeMl,
              setSolutesMol: spec.solutesMol,
            })
            if (!res.ok) return
            const flask: CanvasFlaskNode = {
              id: createNodeId('flask'),
              kind: 'flask',
              x: Math.round(spec.dx),
              y: Math.round(spec.dy),
              vessel,
              solution: res.solution,
              temperatureC: spec.temperatureC ?? 20,
              stoppered: false,
              pourStepMl: spec.pourStepMl ?? vessel.defaultPourStepMl,
              customLabel: spec.customLabel,
              indicatorId: spec.indicatorId ?? null,
              probes: spec.probes ?? [],
              stirrerOn: Boolean(spec.stirrerOn),
              heaterTargetC: spec.heaterTargetC ?? null,
            }
            createdByKey.set(spec.key, flask)
          }),
        )

        // Preserve preset declaration order
        for (const spec of preset.flasks) {
          const fl = createdByKey.get(spec.key)
          if (fl) createdFlasks.push(fl)
        }
        if (createdFlasks.length === 0) return

        setNodes(createdFlasks)
        setSelectedIds(new Set([createdFlasks[createdFlasks.length - 1].id]))
        onResetView()

        if (preset.autoTitration) {
          const b = createdByKey.get(preset.autoTitration.buretteKey)
          const a = createdByKey.get(preset.autoTitration.analyteKey)
          if (b && a) {
            setTitrationSession(buildInitialTitrationSession(b, a))
          }
        } else {
          setTitrationSession(null)
        }
        showNotice('success', `TP chargé : ${preset.titleFr}`)
      } catch {
        showNotice('warning', 'Erreur lors du chargement du TP.')
      }
    },
    [onResetView, setNodes, setSelectedIds, showNotice, vessels],
  )

  const handleSaveCurrentWorkbench = useCallback(
    (name: string) => {
      const currentNodes = nodesRef.current
      if (currentNodes.length === 0) return
      const record: SavedWorkbenchRecord = {
        id: createNodeId('bench'),
        name,
        savedAt: new Date().toISOString(),
        nodeCount: currentNodes.length,
        nodes: JSON.parse(JSON.stringify(currentNodes)) as CanvasNode[],
        discoveredSpeciesIds: [...discoveredSpeciesIds],
      }
      setSavedWorkbenches((prev) => {
        const next = [record, ...prev].slice(0, 16)
        persistSavedWorkbenches(next)
        return next
      })
      showNotice('success', `Paillasse « ${name} » sauvegardée.`)
    },
    [discoveredSpeciesIds, nodesRef, showNotice],
  )

  const handleLoadSavedWorkbench = useCallback(
    (record: SavedWorkbenchRecord) => {
      setTitrationSession(null)
      setNodes(JSON.parse(JSON.stringify(record.nodes)) as CanvasNode[])
      if (record.discoveredSpeciesIds.length > 0) {
        setDiscoveredSpeciesIds(record.discoveredSpeciesIds)
      }
      setSelectedIds(new Set())
      onResetView()
      showNotice('success', `Paillasse « ${record.name} » rechargée.`)
    },
    [onResetView, setDiscoveredSpeciesIds, setNodes, setSelectedIds, showNotice],
  )

  const handleDeleteSavedWorkbench = useCallback((id: string) => {
    setSavedWorkbenches((prev) => {
      const next = prev.filter((item) => item.id !== id)
      persistSavedWorkbenches(next)
      return next
    })
  }, [])

  return {
    titrationSession,
    setTitrationSession,
    savedWorkbenches,
    handleSetFlaskIndicator,
    handleToggleFlaskProbe,
    handleToggleFlaskStirrer,
    handleSetFlaskHeaterTarget,
    handleOpenTitration,
    handleDispenseTitrationMl,
    handleToggleTitrationRunning,
    handleCycleTitrationSpeed,
    handleResetTitrationSession,
    handleLoadPreset,
    handleSaveCurrentWorkbench,
    handleLoadSavedWorkbench,
    handleDeleteSavedWorkbench,
  }
}
