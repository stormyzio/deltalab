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
import {
  buildWorkbenchExportPayload,
  cloneNodesWithFreshIds,
  downloadWorkbenchFile,
  parseWorkbenchFile,
} from '@/lib/workbench-io'
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
  const [activeWorkbenchId, setActiveWorkbenchId] = useState<string | null>(null)

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
                  targetC === null ? null : Math.max(0, Math.min(200, Math.round(targetC))),
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
        setActiveWorkbenchId(null)
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
      const trimmed = name.trim()
      if (!trimmed) return
      const nowIso = new Date().toISOString()
      const record: SavedWorkbenchRecord = {
        id: createNodeId('bench'),
        name: trimmed,
        savedAt: nowIso,
        updatedAt: nowIso,
        nodeCount: currentNodes.length,
        nodes: JSON.parse(JSON.stringify(currentNodes)) as CanvasNode[],
        discoveredSpeciesIds: [...discoveredSpeciesIds],
      }
      setSavedWorkbenches((prev) => {
        const next = [record, ...prev].slice(0, 50)
        persistSavedWorkbenches(next)
        return next
      })
      setActiveWorkbenchId(record.id)
      showNotice('success', `Paillasse « ${trimmed} » sauvegardée.`)
    },
    [discoveredSpeciesIds, nodesRef, showNotice],
  )

  const handleUpdateSavedWorkbench = useCallback(
    (id: string) => {
      const currentNodes = nodesRef.current
      if (currentNodes.length === 0) {
        showNotice('warning', 'Impossible d’écraser avec une paillasse vide.')
        return
      }
      const nowIso = new Date().toISOString()
      let updatedName = ''
      setSavedWorkbenches((prev) => {
        const next = prev.map((item) => {
          if (item.id !== id) return item
          updatedName = item.name
          return {
            ...item,
            updatedAt: nowIso,
            nodeCount: currentNodes.length,
            nodes: JSON.parse(JSON.stringify(currentNodes)) as CanvasNode[],
            discoveredSpeciesIds: [...discoveredSpeciesIds],
          }
        })
        persistSavedWorkbenches(next)
        return next
      })
      setActiveWorkbenchId(id)
      if (updatedName) {
        showNotice('success', `Paillasse « ${updatedName} » mise à jour.`)
      }
    },
    [discoveredSpeciesIds, nodesRef, showNotice],
  )

  const handleRenameSavedWorkbench = useCallback(
    (id: string, nextName: string) => {
      const trimmed = nextName.trim().slice(0, 60)
      if (!trimmed) return
      setSavedWorkbenches((prev) => {
        const next = prev.map((item) =>
          item.id === id ? { ...item, name: trimmed } : item,
        )
        persistSavedWorkbenches(next)
        return next
      })
      showNotice('neutral', `Paillasse renommée en « ${trimmed} ».`)
    },
    [showNotice],
  )

  const handleDuplicateSavedWorkbench = useCallback(
    (id: string) => {
      const nowIso = new Date().toISOString()
      let copyName = ''
      setSavedWorkbenches((prev) => {
        const src = prev.find((item) => item.id === id)
        if (!src) return prev
        copyName = `${src.name} (copie)`.slice(0, 60)
        const clone: SavedWorkbenchRecord = {
          id: createNodeId('bench'),
          name: copyName,
          savedAt: nowIso,
          updatedAt: nowIso,
          nodeCount: src.nodes.length,
          nodes: JSON.parse(JSON.stringify(src.nodes)) as CanvasNode[],
          discoveredSpeciesIds: [...src.discoveredSpeciesIds],
        }
        const next = [clone, ...prev].slice(0, 50)
        persistSavedWorkbenches(next)
        return next
      })
      if (copyName) {
        showNotice('success', `Paillasse dupliquée : « ${copyName} ».`)
      }
    },
    [showNotice],
  )

  const handleNewWorkbench = useCallback(() => {
    setTitrationSession(null)
    setNodes([])
    setSelectedIds(new Set())
    setActiveWorkbenchId(null)
    onResetView()
    showNotice('neutral', 'Nouvelle paillasse vierge prête.')
  }, [onResetView, setNodes, setSelectedIds, showNotice])

  const handleLoadSavedWorkbench = useCallback(
    (record: SavedWorkbenchRecord) => {
      setTitrationSession(null)
      setNodes(JSON.parse(JSON.stringify(record.nodes)) as CanvasNode[])
      if (record.discoveredSpeciesIds.length > 0) {
        setDiscoveredSpeciesIds(record.discoveredSpeciesIds)
      }
      setSelectedIds(new Set())
      setActiveWorkbenchId(record.id)
      onResetView()
      showNotice('success', `Paillasse « ${record.name} » chargée.`)
    },
    [onResetView, setDiscoveredSpeciesIds, setNodes, setSelectedIds, showNotice],
  )

  const handleDeleteSavedWorkbench = useCallback(
    (id: string) => {
      setSavedWorkbenches((prev) => {
        const next = prev.filter((item) => item.id !== id)
        persistSavedWorkbenches(next)
        return next
      })
      setActiveWorkbenchId((curr) => (curr === id ? null : curr))
    },
    [],
  )

  const handleExportCurrentWorkbench = useCallback(
    (customName?: string) => {
      const currentNodes = nodesRef.current
      if (currentNodes.length === 0) {
        showNotice('warning', 'Ajoutez au moins un élément avant d’exporter la paillasse.')
        return
      }
      const activeBench = savedWorkbenches.find((b) => b.id === activeWorkbenchId)
      const exportName =
        customName?.trim() || activeBench?.name || 'Paillasse DeltaLab'
      const payload = buildWorkbenchExportPayload(
        exportName,
        currentNodes,
        discoveredSpeciesIds,
      )
      const filename = downloadWorkbenchFile(payload)
      showNotice('success', `Exporté : ${filename}`)
    },
    [activeWorkbenchId, discoveredSpeciesIds, nodesRef, savedWorkbenches, showNotice],
  )

  const handleExportSavedWorkbench = useCallback(
    (record: SavedWorkbenchRecord) => {
      const payload = buildWorkbenchExportPayload(
        record.name,
        record.nodes,
        record.discoveredSpeciesIds,
      )
      const filename = downloadWorkbenchFile(payload)
      showNotice('success', `Exporté : ${filename}`)
    },
    [showNotice],
  )

  const handleImportWorkbenchFile = useCallback(
    async (file: File, mode: 'replace' | 'merge' = 'replace') => {
      let text: string
      try {
        text = await file.text()
      } catch {
        showNotice('warning', 'Impossible de lire le fichier sélectionné.')
        return
      }

      const result = parseWorkbenchFile(text, file.name)
      if (!result.ok) {
        showNotice('warning', result.errorFr)
        return
      }

      const { name, nodes: importedNodes, discoveredSpeciesIds: importedDiscovered, skippedNodes } =
        result

      if (mode === 'merge' && nodesRef.current.length > 0) {
        // Place imported group neatly to the right of existing nodes
        const maxExistingX = Math.max(...nodesRef.current.map((n) => n.x))
        const minImportX = Math.min(...importedNodes.map((n) => n.x))
        const offsetX = maxExistingX - minImportX + 260
        const freshNodes = cloneNodesWithFreshIds(importedNodes, offsetX, 0)
        setNodes((prev) => [...prev, ...freshNodes])
        setSelectedIds(new Set(freshNodes.map((n) => n.id)))
        if (importedDiscovered.length > 0) {
          setDiscoveredSpeciesIds((prev) => {
            const merged = new Set([...prev, ...importedDiscovered])
            return [...merged]
          })
        }
        showNotice(
          'success',
          `« ${name} » fusionnée (+${freshNodes.length} élément${freshNodes.length > 1 ? 's' : ''}).`,
        )
        return
      }

      // Replace mode: load onto canvas AND store in Mes paillasses for quick reuse
      const nowIso = new Date().toISOString()
      const freshNodes = cloneNodesWithFreshIds(importedNodes)
      const savedRec: SavedWorkbenchRecord = {
        id: createNodeId('bench'),
        name,
        savedAt: nowIso,
        updatedAt: nowIso,
        nodeCount: freshNodes.length,
        nodes: JSON.parse(JSON.stringify(freshNodes)) as CanvasNode[],
        discoveredSpeciesIds: [...importedDiscovered],
      }

      setTitrationSession(null)
      setNodes(freshNodes)
      if (importedDiscovered.length > 0) {
        setDiscoveredSpeciesIds((prev) => {
          const merged = new Set([...prev, ...importedDiscovered])
          return [...merged]
        })
      }
      setSelectedIds(new Set())
      setSavedWorkbenches((prev) => {
        const next = [savedRec, ...prev].slice(0, 50)
        persistSavedWorkbenches(next)
        return next
      })
      setActiveWorkbenchId(savedRec.id)
      onResetView()
      showNotice(
        'success',
        skippedNodes > 0
          ? `Paillasse « ${name} » importée (${freshNodes.length} éléments, ${skippedNodes} ignoré${skippedNodes > 1 ? 's' : ''}).`
          : `Paillasse « ${name} » importée (${freshNodes.length} élément${freshNodes.length > 1 ? 's' : ''}).`,
      )
    },
    [onResetView, nodesRef, setDiscoveredSpeciesIds, setNodes, setSelectedIds, showNotice],
  )

  return {
    titrationSession,
    setTitrationSession,
    savedWorkbenches,
    activeWorkbenchId,
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
    handleUpdateSavedWorkbench,
    handleRenameSavedWorkbench,
    handleDuplicateSavedWorkbench,
    handleNewWorkbench,
    handleLoadSavedWorkbench,
    handleDeleteSavedWorkbench,
    handleExportCurrentWorkbench,
    handleExportSavedWorkbench,
    handleImportWorkbenchFile,
  }
}
