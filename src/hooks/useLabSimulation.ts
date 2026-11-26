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
  CanvasGasCollectorNode,
  CanvasMoleculeNode,
  CanvasNode,
  CanvasSolidNode,
  CanvasThermalChamberNode,
  CatalogSpeciesRecord,
  FlaskProbeType,
  PhIndicatorId,
  SpeciesRecord,
  ThermalChamberSample,
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
  MAX_CHAMBER_TEMP_C,
  MIN_CHAMBER_TEMP_C,
  buildSpeciesRecordFromSolid,
  describePhaseTransition,
  getMoleculeEffectivePhase,
  getMostVolatileBoilingTarget,
  getPhaseContextualNameFr,
  getSpeciesPhaseAtTemperature,
  mergeGasIntoCollector,
} from '@/lib/phase-changes'
import { getSolidTotalMassG } from '@/lib/solid-alloys'
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
  speciesMap: Map<string, CatalogSpeciesRecord>
  discoveredSpeciesIds: string[]
  setNodes: Dispatch<SetStateAction<CanvasNode[]>>
  setNodesSilent: Dispatch<SetStateAction<CanvasNode[]>>
  setDiscoveredSpeciesIds: Dispatch<SetStateAction<string[]>>
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>
  onResetView: () => void
  showNotice: (tone: CanvasNotice['tone'], text: string) => void
  triggerShake: (ids: string[]) => void
  triggerFresh: (id: string) => void
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
  speciesMap,
  discoveredSpeciesIds,
  setNodes,
  setNodesSilent,
  setDiscoveredSpeciesIds,
  setSelectedIds,
  onResetView,
  showNotice,
  triggerShake,
  triggerFresh,
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
  const boilingInFlightRef = useRef<Set<string>>(new Set())

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

  // --- Gas collectors & thermal chambers ---
  const handleLinkGasCollectorToFlask = useCallback(
    async (collectorId: string, flaskId: string | null) => {
      const flask = flaskId
        ? nodesRef.current.find(
            (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === flaskId,
          )
        : null

      // Check if the flask already has headspace gas bubbles waiting to be collected
      const headspaceGases: Array<{
        speciesId: string
        formula: string
        displayFormula: string
        nameFr: string
        amountMol: number
        molarMass: number
        colorHex: string | null
        meltingPointC: number | null
        boilingPointC: number | null
      }> = []
      const nextSolutesMol: Record<string, number> = flask
        ? { ...flask.solution.solutesMol }
        : {}

      if (flask) {
        for (const s of flask.solution.solutes) {
          const sp = speciesMap.get(s.speciesId)
          const isGas = (s.standardState ?? sp?.standardState) === 'gas'
          if (!isGas) continue
          const gasMol = flask.solution.hasWater ? s.undissolvedMol : s.addedMol
          if (gasMol <= 1e-7) continue

          headspaceGases.push({
            speciesId: s.speciesId,
            formula: sp?.formula ?? s.displayFormula,
            displayFormula: s.displayFormula,
            nameFr: s.nameFr,
            amountMol: Math.round(gasMol * 1e6) / 1e6,
            molarMass: s.molarMass || sp?.molarMass || 28,
            colorHex: s.colorHex ?? sp?.colorHex ?? null,
            meltingPointC: sp?.meltingPointC ?? null,
            boilingPointC: sp?.boilingPointC ?? null,
          })

          const remainingMol = flask.solution.hasWater ? s.dissolvedMol : 0
          if (remainingMol > 1e-7) {
            nextSolutesMol[s.speciesId] = Math.round(remainingMol * 1e6) / 1e6
          } else {
            delete nextSolutesMol[s.speciesId]
          }
        }
      }

      setNodes((prev) =>
        prev.map((n) => {
          if (n.id === collectorId && n.kind === 'gas_collector') {
            let nextGases = n.gases
            for (const g of headspaceGases) {
              nextGases = mergeGasIntoCollector(nextGases, g)
            }
            return { ...n, sourceFlaskId: flaskId, gases: nextGases }
          }
          // Ensure only one collector is attached to the same source flask at once
          if (
            flaskId &&
            n.kind === 'gas_collector' &&
            n.id !== collectorId &&
            n.sourceFlaskId === flaskId
          ) {
            return { ...n, sourceFlaskId: null }
          }
          return n
        }),
      )

      if (flask && headspaceGases.length > 0) {
        try {
          const res = await api.evaluateFlaskAddition({
            vesselId: flask.vessel.id,
            vesselCapacityMl: flask.vessel.capacityMl,
            temperatureC: flask.temperatureC ?? 20,
            currentWaterVolumeMl: flask.solution.waterVolumeMl,
            currentSolutesMol: nextSolutesMol,
            recomputeOnly: true,
          })
          if (res.ok) {
            setNodes((prev) =>
              prev.map((n) =>
                n.id === flask.id && n.kind === 'flask'
                  ? { ...n, solution: res.solution }
                  : n,
              ),
            )
          }
        } catch {
          // ignore network error
        }
        const names = headspaceGases.map((g) => g.displayFormula).join(', ')
        showNotice(
          'success',
          `Collecteur raccordé · ${names}(g) capturé depuis la verrerie.`,
        )
        return
      }

      if (flaskId) {
        showNotice('success', 'Collecteur de gaz raccordé à la verrerie.')
      } else {
        showNotice('neutral', 'Tuyau du collecteur débranché.')
      }
    },
    [nodesRef, setNodes, showNotice, speciesMap],
  )

  const handleDropNodeOnGasCollector = useCallback(
    (sourceNodeId: string, collectorId: string) => {
      const source = nodesRef.current.find((n) => n.id === sourceNodeId)
      const collector = nodesRef.current.find(
        (n): n is CanvasGasCollectorNode =>
          n.kind === 'gas_collector' && n.id === collectorId,
      )
      if (!source || !collector) return

      if (source.kind === 'flask') {
        handleLinkGasCollectorToFlask(collectorId, source.id)
        return
      }

      if (source.kind === 'molecule') {
        const phase = getMoleculeEffectivePhase(source)
        if (phase !== 'gas') {
          triggerShake([sourceNodeId, collectorId])
          showNotice(
            'warning',
            `${source.species.displayFormula} doit être à l’état gazeux pour entrer dans le collecteur.`,
          )
          return
        }
        setNodes((prev) =>
          prev
            .filter((n) => n.id !== sourceNodeId)
            .map((n) =>
              n.id === collectorId && n.kind === 'gas_collector'
                ? {
                    ...n,
                    gases: mergeGasIntoCollector(n.gases, {
                      speciesId: source.species.id,
                      formula: source.species.formula,
                      displayFormula: source.species.displayFormula,
                      nameFr: getPhaseContextualNameFr(source.species, 'gas'),
                      amountMol: source.amountMol,
                      molarMass: source.species.molarMass,
                      colorHex: source.species.colorHex ?? '#bae6fd',
                      meltingPointC: source.species.meltingPointC,
                      boilingPointC: source.species.boilingPointC,
                    }),
                  }
                : n,
            ),
        )
        setSelectedIds(new Set([collectorId]))
        triggerFresh(collectorId)
        showNotice('success', `${source.species.displayFormula}(g) stocké dans le collecteur.`)
      }
    },
    [
      handleLinkGasCollectorToFlask,
      nodesRef,
      setNodes,
      setSelectedIds,
      showNotice,
      triggerFresh,
      triggerShake,
    ],
  )

  const handleDropGasCollectorOnFlask = useCallback(
    (collectorId: string, flaskId: string) => {
      handleLinkGasCollectorToFlask(collectorId, flaskId)
    },
    [handleLinkGasCollectorToFlask],
  )

  const handleExtractGasFromCollector = useCallback(
    (collectorId: string, speciesId: string, dropPos?: { x: number; y: number }) => {
      const collector = nodesRef.current.find(
        (n): n is CanvasGasCollectorNode =>
          n.kind === 'gas_collector' && n.id === collectorId,
      )
      if (!collector) return
      const gas = collector.gases.find((g) => g.speciesId === speciesId)
      if (!gas) return

      const sp: SpeciesRecord = speciesMap.get(speciesId) ?? {
        id: gas.speciesId,
        formula: gas.displayFormula,
        displayFormula: gas.displayFormula,
        nameFr: gas.nameFr,
        iupacName: null,
        casNumber: null,
        kind: 'molecule',
        charge: 0,
        molarMass: 28,
        standardState: 'gas',
        meltingPointC: null,
        boilingPointC: null,
        thermalNote: null,
        densityGPerCm3: null,
        appearanceFr: 'Gaz capturé',
        colorHex: gas.colorHex,
        composition: {},
        compositionKey: null,
        isSolvent: speciesId === 'h2o',
        canDissolveInWater: false,
        solubilityGPerL: null,
        dissolutionType: 'none',
        solutionColorHex: null,
        phCharacter: 'neutral',
        pkaValues: [],
        ghsPictograms: [],
        ghsSignalWord: null,
        popularity: 0,
        pubchemCid: null,
        families: [],
        lewis: null,
        behaviors: {},
      }

      const newNode: CanvasMoleculeNode = {
        id: createNodeId('mol'),
        kind: 'molecule',
        x: dropPos ? dropPos.x : collector.x + 170,
        y: dropPos ? dropPos.y : collector.y - 24,
        species: sp,
        amountMol: Math.max(0.0001, gas.amountMol),
        phaseOverride: 'gas',
        temperatureC: Math.round(collector.temperatureC),
      }

      setNodes((prev) => [
        ...prev.map((n) =>
          n.id === collectorId && n.kind === 'gas_collector'
            ? { ...n, gases: n.gases.filter((g) => g.speciesId !== speciesId) }
            : n,
        ),
        newNode,
      ])
      setSelectedIds(new Set([newNode.id]))
      triggerFresh(newNode.id)
      showNotice(
        'success',
        `${getPhaseContextualNameFr(sp, 'gas')} extrait sur la paillasse.`,
      )
    },
    [nodesRef, setNodes, setSelectedIds, showNotice, speciesMap, triggerFresh],
  )

  const handleBubbleGasIntoFlask = useCallback(
    async (collectorId: string, speciesId: string, flaskId: string) => {
      const collector = nodesRef.current.find(
        (n): n is CanvasGasCollectorNode =>
          n.kind === 'gas_collector' && n.id === collectorId,
      )
      const flask = nodesRef.current.find(
        (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === flaskId,
      )
      if (!collector || !flask) return
      const gas = collector.gases.find((g) => g.speciesId === speciesId)
      if (!gas) return

      try {
        const res = await api.evaluateFlaskAddition({
          vesselId: flask.vessel.id,
          vesselCapacityMl: flask.vessel.capacityMl,
          temperatureC: flask.temperatureC ?? 20,
          currentWaterVolumeMl: flask.solution.waterVolumeMl,
          currentSolutesMol: flask.solution.solutesMol,
          incomingSpeciesId: gas.speciesId,
          incomingAmountMol: Math.max(0.0001, gas.amountMol),
          incomingWaterVolumeMl:
            gas.speciesId === 'h2o'
              ? Math.max(0.1, Math.round(gas.amountMol * 18.015 * 100) / 100)
              : undefined,
        })
        if (!res.ok) {
          triggerShake([collectorId, flaskId])
          showNotice('warning', res.messageFr)
          return
        }
        setNodes((prev) =>
          prev.map((n) => {
            if (n.id === collectorId && n.kind === 'gas_collector') {
              return { ...n, gases: n.gases.filter((g) => g.speciesId !== speciesId) }
            }
            if (n.id === flaskId && n.kind === 'flask') {
              return {
                ...n,
                solution: res.solution,
                reactionExtentMol: 0,
                selectedReactionId: undefined,
              }
            }
            return n
          }),
        )
        triggerFlaskPulse(flaskId)
        showNotice(
          'success',
          `${gas.displayFormula}(g) injecté dans ${flask.customLabel || flask.vessel.nameFr}.`,
        )
      } catch {
        showNotice('warning', 'Erreur lors de l’injection du gaz.')
      }
    },
    [nodesRef, setNodes, showNotice, triggerFlaskPulse, triggerShake],
  )

  const handleTransferGasBetweenCollectors = useCallback(
    (sourceCollectorId: string, speciesId: string, targetCollectorId: string) => {
      if (sourceCollectorId === targetCollectorId) return
      const src = nodesRef.current.find(
        (n): n is CanvasGasCollectorNode =>
          n.kind === 'gas_collector' && n.id === sourceCollectorId,
      )
      const tgt = nodesRef.current.find(
        (n): n is CanvasGasCollectorNode =>
          n.kind === 'gas_collector' && n.id === targetCollectorId,
      )
      if (!src || !tgt) return
      const gas = src.gases.find((g) => g.speciesId === speciesId)
      if (!gas) return

      setNodes((prev) =>
        prev.map((n) => {
          if (n.id === sourceCollectorId && n.kind === 'gas_collector') {
            return { ...n, gases: n.gases.filter((g) => g.speciesId !== speciesId) }
          }
          if (n.id === targetCollectorId && n.kind === 'gas_collector') {
            return { ...n, gases: mergeGasIntoCollector(n.gases, gas) }
          }
          return n
        }),
      )
      triggerFresh(targetCollectorId)
      showNotice('success', `${gas.displayFormula}(g) transvasé vers l’autre collecteur.`)
    },
    [nodesRef, setNodes, showNotice, triggerFresh],
  )

  const handleSendGasToChamber = useCallback(
    (collectorId: string, speciesId: string, chamberId: string) => {
      const collector = nodesRef.current.find(
        (n): n is CanvasGasCollectorNode =>
          n.kind === 'gas_collector' && n.id === collectorId,
      )
      const chamber = nodesRef.current.find(
        (n): n is CanvasThermalChamberNode =>
          n.kind === 'thermal_chamber' && n.id === chamberId,
      )
      if (!collector || !chamber) return
      const gas = collector.gases.find((g) => g.speciesId === speciesId)
      if (!gas) return
      const sp = speciesMap.get(speciesId)
      if (!sp) {
        showNotice('warning', 'Espèce gazeuse introuvable dans le catalogue.')
        return
      }

      const nextState = getSpeciesPhaseAtTemperature(sp, chamber.temperatureC)
      const sample: ThermalChamberSample = {
        species: sp,
        amountMol: Math.max(0.0001, gas.amountMol),
        currentState: nextState,
      }

      setNodes((prev) =>
        prev.map((n) => {
          if (n.id === collectorId && n.kind === 'gas_collector') {
            return { ...n, gases: n.gases.filter((g) => g.speciesId !== speciesId) }
          }
          if (n.id === chamberId && n.kind === 'thermal_chamber') {
            return { ...n, sample }
          }
          return n
        }),
      )
      setSelectedIds(new Set([chamberId]))
      triggerFresh(chamberId)
      showNotice('success', `${sp.displayFormula}(g) transféré dans la chambre thermique.`)
    },
    [nodesRef, setNodes, setSelectedIds, showNotice, speciesMap, triggerFresh],
  )

  const handleClearGasCollector = useCallback(
    (collectorId: string) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === collectorId && n.kind === 'gas_collector'
            ? { ...n, gases: [] }
            : n,
        ),
      )
      showNotice('neutral', 'Collecteur de gaz purgé.')
    },
    [setNodes, showNotice],
  )

  const handleLoadSampleIntoChamber = useCallback(
    (sourceNodeId: string, chamberId: string) => {
      const source = nodesRef.current.find((n) => n.id === sourceNodeId)
      const chamber = nodesRef.current.find(
        (n): n is CanvasThermalChamberNode =>
          n.kind === 'thermal_chamber' && n.id === chamberId,
      )
      if (!source || !chamber) return

      if (source.kind === 'gas_collector') {
        if (source.gases.length === 0) {
          triggerShake([sourceNodeId, chamberId])
          showNotice('warning', 'Le collecteur de gaz est vide.')
          return
        }
        handleSendGasToChamber(source.id, source.gases[0].speciesId, chamberId)
        return
      }

      if (source.kind === 'molecule') {
        if (source.species.kind === 'ion') {
          triggerShake([sourceNodeId, chamberId])
          showNotice('warning', 'Un ion isolé ne peut pas subir de changement d’état pur.')
          return
        }
        const sp = speciesMap.get(source.species.id) ?? source.species
        const initialPhase = getMoleculeEffectivePhase(source)
        const nextPhase = getSpeciesPhaseAtTemperature(sp, chamber.temperatureC)
        const sample: ThermalChamberSample = {
          species: sp,
          amountMol: source.amountMol,
          currentState: nextPhase,
        }
        setNodes((prev) =>
          prev
            .filter((n) => n.id !== sourceNodeId)
            .map((n) =>
              n.id === chamberId && n.kind === 'thermal_chamber'
                ? { ...n, sample }
                : n,
            ),
        )
        setSelectedIds(new Set([chamberId]))
        triggerFresh(chamberId)
        const trans = describePhaseTransition(initialPhase, nextPhase)
        showNotice(
          'success',
          trans
            ? `${trans} : ${getPhaseContextualNameFr(sp, nextPhase)}`
            : `${sp.displayFormula} placé dans la chambre thermique.`,
        )
        return
      }

      if (source.kind === 'solid') {
        const sp = buildSpeciesRecordFromSolid(source, speciesMap)
        if (!sp) return
        const massG = getSolidTotalMassG(source)
        const amountMol = Math.max(0.0001, massG / Math.max(1, sp.molarMass))
        const nextPhase = getSpeciesPhaseAtTemperature(sp, chamber.temperatureC)
        const sample: ThermalChamberSample = {
          species: sp,
          amountMol,
          currentState: nextPhase,
          solidBlock: {
            ...source,
            components: source.components.map((c) => ({ ...c })),
          },
        }
        setNodes((prev) =>
          prev
            .filter((n) => n.id !== sourceNodeId)
            .map((n) =>
              n.id === chamberId && n.kind === 'thermal_chamber'
                ? { ...n, sample }
                : n,
            ),
        )
        setSelectedIds(new Set([chamberId]))
        triggerFresh(chamberId)
        showNotice('success', `${source.nameFr} placé dans la chambre thermique.`)
      }
    },
    [
      handleSendGasToChamber,
      nodesRef,
      setNodes,
      setSelectedIds,
      showNotice,
      speciesMap,
      triggerFresh,
      triggerShake,
    ],
  )

  const handleSetChamberTargetTemp = useCallback(
    (chamberId: string, tempC: number) => {
      const clamped = Math.max(
        MIN_CHAMBER_TEMP_C,
        Math.min(MAX_CHAMBER_TEMP_C, Math.round(tempC)),
      )
      setNodes((prev) =>
        prev.map((n) =>
          n.id === chamberId && n.kind === 'thermal_chamber'
            ? { ...n, targetTemperatureC: clamped, powerOn: true }
            : n,
        ),
      )
    },
    [setNodes],
  )

  const handleToggleChamberPower = useCallback(
    (chamberId: string) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === chamberId && n.kind === 'thermal_chamber'
            ? { ...n, powerOn: !n.powerOn }
            : n,
        ),
      )
    },
    [setNodes],
  )

  const handleExtractSampleFromChamber = useCallback(
    (chamberId: string, dropPos?: { x: number; y: number }) => {
      const chamber = nodesRef.current.find(
        (n): n is CanvasThermalChamberNode =>
          n.kind === 'thermal_chamber' && n.id === chamberId,
      )
      if (!chamber || !chamber.sample) return
      const { sample } = chamber
      const spawnX = dropPos ? dropPos.x : chamber.x + 175
      const spawnY = dropPos ? dropPos.y : chamber.y

      let newNode: CanvasNode
      if (sample.currentState === 'solid' && sample.solidBlock) {
        newNode = {
          ...sample.solidBlock,
          kind: 'solid',
          id: createNodeId('solid'),
          x: spawnX,
          y: spawnY,
          components: sample.solidBlock.components.map((c) => ({ ...c })),
        } satisfies CanvasSolidNode
      } else {
        newNode = {
          id: createNodeId('mol'),
          kind: 'molecule',
          x: spawnX,
          y: spawnY,
          species: sample.species,
          amountMol: sample.amountMol,
          phaseOverride: sample.currentState,
          temperatureC: Math.round(chamber.temperatureC),
        } satisfies CanvasMoleculeNode
      }

      setNodes((prev) => [
        ...prev.map((n) =>
          n.id === chamberId && n.kind === 'thermal_chamber'
            ? { ...n, sample: null }
            : n,
        ),
        newNode,
      ])
      setSelectedIds(new Set([newNode.id]))
      triggerFresh(newNode.id)
      showNotice(
        'success',
        `${getPhaseContextualNameFr(sample.species, sample.currentState)} extrait sur la paillasse.`,
      )
    },
    [nodesRef, setNodes, setSelectedIds, showNotice, triggerFresh],
  )

  const handleTransferChamberSampleToFlask = useCallback(
    async (chamberId: string, flaskId: string) => {
      const chamber = nodesRef.current.find(
        (n): n is CanvasThermalChamberNode =>
          n.kind === 'thermal_chamber' && n.id === chamberId,
      )
      const flask = nodesRef.current.find(
        (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === flaskId,
      )
      if (!chamber || !chamber.sample || !flask) return
      const { sample } = chamber

      try {
        const res = await api.evaluateFlaskAddition({
          vesselId: flask.vessel.id,
          vesselCapacityMl: flask.vessel.capacityMl,
          temperatureC: flask.temperatureC ?? 20,
          currentWaterVolumeMl: flask.solution.waterVolumeMl,
          currentSolutesMol: flask.solution.solutesMol,
          incomingSpeciesId: sample.species.id,
          incomingAmountMol: Math.max(0.0001, sample.amountMol),
          incomingWaterVolumeMl:
            sample.species.id === 'h2o'
              ? Math.max(0.1, Math.round(sample.amountMol * 18.015 * 100) / 100)
              : undefined,
        })
        if (!res.ok) {
          triggerShake([chamberId, flaskId])
          showNotice('warning', res.messageFr)
          return
        }
        setNodes((prev) =>
          prev.map((n) => {
            if (n.id === chamberId && n.kind === 'thermal_chamber') {
              return { ...n, sample: null }
            }
            if (n.id === flaskId && n.kind === 'flask') {
              return {
                ...n,
                solution: res.solution,
                reactionExtentMol: 0,
                selectedReactionId: undefined,
              }
            }
            return n
          }),
        )
        triggerFlaskPulse(flaskId)
        showNotice(
          'success',
          `${getPhaseContextualNameFr(sample.species, sample.currentState)} transféré dans ${flask.customLabel || flask.vessel.nameFr}.`,
        )
      } catch {
        showNotice('warning', 'Erreur lors du transfert vers la verrerie.')
      }
    },
    [nodesRef, setNodes, showNotice, triggerFlaskPulse, triggerShake],
  )

  const handleTransferChamberSampleToCollector = useCallback(
    (chamberId: string, collectorId: string) => {
      const chamber = nodesRef.current.find(
        (n): n is CanvasThermalChamberNode =>
          n.kind === 'thermal_chamber' && n.id === chamberId,
      )
      const collector = nodesRef.current.find(
        (n): n is CanvasGasCollectorNode =>
          n.kind === 'gas_collector' && n.id === collectorId,
      )
      if (!chamber || !chamber.sample || !collector) return
      const { sample } = chamber
      if (sample.currentState !== 'gas') {
        triggerShake([chamberId, collectorId])
        showNotice(
          'warning',
          `${sample.species.displayFormula} doit être gazeux pour entrer dans le collecteur.`,
        )
        return
      }
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id === chamberId && n.kind === 'thermal_chamber') {
            return { ...n, sample: null }
          }
          if (n.id === collectorId && n.kind === 'gas_collector') {
            return {
              ...n,
              gases: mergeGasIntoCollector(n.gases, {
                speciesId: sample.species.id,
                formula: sample.species.formula,
                displayFormula: sample.species.displayFormula,
                nameFr: getPhaseContextualNameFr(sample.species, 'gas'),
                amountMol: sample.amountMol,
                molarMass: sample.species.molarMass,
                colorHex: sample.species.colorHex ?? '#bae6fd',
                meltingPointC: sample.species.meltingPointC,
                boilingPointC: sample.species.boilingPointC,
              }),
            }
          }
          return n
        }),
      )
      triggerFresh(collectorId)
      showNotice('success', `${sample.species.displayFormula}(g) transféré dans le collecteur.`)
    },
    [nodesRef, setNodes, showNotice, triggerFresh, triggerShake],
  )

  const handleTransferChamberSampleToChamber = useCallback(
    (sourceChamberId: string, targetChamberId: string) => {
      if (sourceChamberId === targetChamberId) return
      const src = nodesRef.current.find(
        (n): n is CanvasThermalChamberNode =>
          n.kind === 'thermal_chamber' && n.id === sourceChamberId,
      )
      const tgt = nodesRef.current.find(
        (n): n is CanvasThermalChamberNode =>
          n.kind === 'thermal_chamber' && n.id === targetChamberId,
      )
      if (!src || !src.sample || !tgt) return
      const sample = src.sample
      const nextState = getSpeciesPhaseAtTemperature(sample.species, tgt.temperatureC)
      const moved: ThermalChamberSample = { ...sample, currentState: nextState }
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id === sourceChamberId && n.kind === 'thermal_chamber') {
            return { ...n, sample: null }
          }
          if (n.id === targetChamberId && n.kind === 'thermal_chamber') {
            return { ...n, sample: moved }
          }
          return n
        }),
      )
      setSelectedIds(new Set([targetChamberId]))
      triggerFresh(targetChamberId)
      const trans = describePhaseTransition(sample.currentState, nextState)
      showNotice(
        'success',
        trans
          ? `${trans} : ${getPhaseContextualNameFr(sample.species, nextState)}`
          : `${sample.species.displayFormula} transféré dans l’autre chambre.`,
      )
    },
    [nodesRef, setNodes, setSelectedIds, showNotice, triggerFresh],
  )

  const handleTransferFlaskLiquidToChamber = useCallback(
    async (flaskId: string, chamberId: string) => {
      const flask = nodesRef.current.find(
        (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === flaskId,
      )
      const chamber = nodesRef.current.find(
        (n): n is CanvasThermalChamberNode =>
          n.kind === 'thermal_chamber' && n.id === chamberId,
      )
      if (!flask || !chamber) return

      // Pick primary liquid: non-water liquid solute if no water, otherwise water (up to 25 mL sample)
      const liquidSoluteEntry = Object.entries(flask.solution.solutesMol).find(([id, mol]) => {
        if (mol <= 1e-5 || id === 'h2o') return false
        const sp = speciesMap.get(id)
        return sp?.standardState === 'liquid'
      })

      if (flask.solution.hasWater && flask.solution.waterVolumeMl > 0.2) {
        const h2o = speciesMap.get('h2o')
        if (!h2o) return
        const sampleMl = Math.min(25, flask.solution.waterVolumeMl)
        const sampleMol = Math.round((sampleMl / 18.015) * 1e6) / 1e6
        const remainingWater = Math.max(
          0,
          Math.round((flask.solution.waterVolumeMl - sampleMl) * 100) / 100,
        )
        try {
          const res = await api.evaluateFlaskAddition({
            vesselId: flask.vessel.id,
            vesselCapacityMl: flask.vessel.capacityMl,
            temperatureC: flask.temperatureC ?? 20,
            currentWaterVolumeMl: flask.solution.waterVolumeMl,
            currentSolutesMol: flask.solution.solutesMol,
            setWaterVolumeMl: remainingWater,
            setSolutesMol: flask.solution.solutesMol,
          })
          if (!res.ok) return
          const nextState = getSpeciesPhaseAtTemperature(h2o, chamber.temperatureC)
          const sample: ThermalChamberSample = {
            species: h2o,
            amountMol: Math.max(0.0001, sampleMol),
            currentState: nextState,
          }
          setNodes((prev) =>
            prev.map((n) => {
              if (n.id === flaskId && n.kind === 'flask') {
                return { ...n, solution: res.solution }
              }
              if (n.id === chamberId && n.kind === 'thermal_chamber') {
                return { ...n, sample }
              }
              return n
            }),
          )
          setSelectedIds(new Set([chamberId]))
          triggerFresh(chamberId)
          const trans = describePhaseTransition('liquid', nextState)
          showNotice(
            'success',
            trans
              ? `${Math.round(sampleMl)} mL d’eau prélevés · ${trans} : ${getPhaseContextualNameFr(h2o, nextState)}`
              : `${Math.round(sampleMl)} mL d’eau transférés dans la chambre thermique.`,
          )
        } catch {
          showNotice('warning', 'Erreur lors du prélèvement vers la chambre.')
        }
        return
      }

      if (liquidSoluteEntry) {
        const [spId, mol] = liquidSoluteEntry
        const sp = speciesMap.get(spId)
        if (!sp) return
        const takeMol = Math.round(Math.min(mol, 0.25) * 1e6) / 1e6
        const nextSolutes = { ...flask.solution.solutesMol }
        const rem = Math.round((mol - takeMol) * 1e6) / 1e6
        if (rem <= 1e-6) delete nextSolutes[spId]
        else nextSolutes[spId] = rem
        try {
          const res = await api.evaluateFlaskAddition({
            vesselId: flask.vessel.id,
            vesselCapacityMl: flask.vessel.capacityMl,
            temperatureC: flask.temperatureC ?? 20,
            currentWaterVolumeMl: flask.solution.waterVolumeMl,
            currentSolutesMol: flask.solution.solutesMol,
            setWaterVolumeMl: flask.solution.waterVolumeMl,
            setSolutesMol: nextSolutes,
          })
          if (!res.ok) return
          const nextState = getSpeciesPhaseAtTemperature(sp, chamber.temperatureC)
          const sample: ThermalChamberSample = {
            species: sp,
            amountMol: takeMol,
            currentState: nextState,
          }
          setNodes((prev) =>
            prev.map((n) => {
              if (n.id === flaskId && n.kind === 'flask') {
                return { ...n, solution: res.solution }
              }
              if (n.id === chamberId && n.kind === 'thermal_chamber') {
                return { ...n, sample }
              }
              return n
            }),
          )
          setSelectedIds(new Set([chamberId]))
          triggerFresh(chamberId)
          showNotice('success', `${sp.displayFormula}(l) prélevé vers la chambre thermique.`)
        } catch {
          showNotice('warning', 'Erreur lors du prélèvement vers la chambre.')
        }
        return
      }

      triggerShake([flaskId, chamberId])
      showNotice('warning', 'Aucun liquide prélevable dans cette verrerie.')
    },
    [nodesRef, setNodes, setSelectedIds, showNotice, speciesMap, triggerFresh, triggerShake],
  )

  const handleClearChamberSample = useCallback(
    (chamberId: string) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === chamberId && n.kind === 'thermal_chamber'
            ? { ...n, sample: null }
            : n,
        ),
      )
      showNotice('neutral', 'Chambre thermique vidée.')
    },
    [setNodes, showNotice],
  )

  // --- Smooth thermal simulation, phase transitions & gas capture ---
  useEffect(() => {
    if (!active) return
    let boilTick = 0
    const timer = window.setInterval(() => {
      const curNodes = nodesRef.current
      const flasks = curNodes.filter(
        (n): n is CanvasFlaskNode =>
          n.kind === 'flask' &&
          n.vessel.supportsHeating &&
          typeof n.heaterTargetC === 'number',
      )
      const activeChambers = curNodes.filter(
        (n): n is CanvasThermalChamberNode =>
          n.kind === 'thermal_chamber' &&
          n.powerOn &&
          Math.abs(n.targetTemperatureC - n.temperatureC) >= 0.4,
      )
      if (flasks.length === 0 && activeChambers.length === 0) return

      boilTick += 1
      const toRecompute: Array<{ flask: CanvasFlaskNode; nextTemp: number }> = []
      const toBoil: Array<{
        flask: CanvasFlaskNode
        target: NonNullable<ReturnType<typeof getMostVolatileBoilingTarget>>
        collectorId: string | null
      }> = []
      const phaseChanges: Array<{ chamberId: string; message: string }> = []

      const collectorsByFlask = new Map<string, CanvasGasCollectorNode>()
      for (const n of curNodes) {
        if (n.kind === 'gas_collector' && n.sourceFlaskId) {
          collectorsByFlask.set(n.sourceFlaskId, n)
        }
      }

      setNodesSilent((prev) => {
        let changed = false
        const nextNodes = prev.map((n) => {
          if (n.kind === 'thermal_chamber' && n.powerOn) {
            const diff = n.targetTemperatureC - n.temperatureC
            if (Math.abs(diff) >= 0.4) {
              changed = true
              const stepMag = Math.min(Math.abs(diff), Math.max(4, Math.abs(diff) * 0.28))
              const nextT = Math.round((n.temperatureC + Math.sign(diff) * stepMag) * 10) / 10
              if (n.sample) {
                const prevState = n.sample.currentState
                const nextState = getSpeciesPhaseAtTemperature(n.sample.species, nextT)
                if (nextState !== prevState) {
                  const trans = describePhaseTransition(prevState, nextState)
                  const name = getPhaseContextualNameFr(n.sample.species, nextState)
                  phaseChanges.push({
                    chamberId: n.id,
                    message: trans ? `${trans} : ${name}` : `Nouvel état : ${name}`,
                  })
                  return {
                    ...n,
                    temperatureC: nextT,
                    sample: { ...n.sample, currentState: nextState },
                  }
                }
              }
              return { ...n, temperatureC: nextT }
            }
            return n
          }

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
            const step = Math.sign(diff) * Math.min(Math.abs(diff), 3.5)
            const nextT = Math.round((curT + step) * 10) / 10
            const lastEval = lastEvalTempRef.current.get(n.id) ?? curT
            if (Math.abs(nextT - lastEval) >= 10 || Math.abs(targetT - nextT) < 0.4) {
              lastEvalTempRef.current.set(n.id, nextT)
              toRecompute.push({ flask: n, nextTemp: nextT })
            }
            return { ...n, temperatureC: nextT }
          }

          // Check boiling of most volatile component
          const boilTarget = getMostVolatileBoilingTarget(n, speciesMap)
          if (
            boilTarget &&
            curT >= boilTarget.boilingPointC - 1.5 &&
            targetT >= boilTarget.boilingPointC - 1.5 &&
            !boilingInFlightRef.current.has(n.id)
          ) {
            const linkedCol = collectorsByFlask.get(n.id) ?? null
            const cadence = linkedCol ? 2 : 4
            if (boilTick % cadence === 0) {
              if (linkedCol || (boilTarget.isWater && n.solution.waterVolumeMl > 6)) {
                toBoil.push({
                  flask: n,
                  target: boilTarget,
                  collectorId: linkedCol?.id ?? null,
                })
              }
            }
          }
          return n
        })
        return changed ? nextNodes : prev
      })

      for (const pc of phaseChanges) {
        triggerFresh(pc.chamberId)
        showNotice('success', pc.message)
      }

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

      for (const item of toBoil) {
        const { flask, target, collectorId } = item
        boilingInFlightRef.current.add(flask.id)

        if (target.isWater) {
          const evapMl = collectorId ? 1.2 : 0.6
          api
            .evaluateFlaskAddition({
              vesselId: flask.vessel.id,
              vesselCapacityMl: flask.vessel.capacityMl,
              temperatureC: flask.temperatureC ?? 100,
              currentWaterVolumeMl: flask.solution.waterVolumeMl,
              currentSolutesMol: flask.solution.solutesMol,
              evaporateWaterMl: evapMl,
            })
            .then((res) => {
              if (!res.ok) return
              const actualMl = Math.max(
                0,
                flask.solution.waterVolumeMl - res.solution.waterVolumeMl,
              )
              const evapMol = Math.round((actualMl / 18.015) * 1e6) / 1e6

              setNodesSilent((prev) =>
                prev.map((n) => {
                  if (n.id === flask.id && n.kind === 'flask') {
                    return { ...n, solution: res.solution }
                  }
                  if (
                    collectorId &&
                    n.id === collectorId &&
                    n.kind === 'gas_collector' &&
                    evapMol > 1e-6
                  ) {
                    return {
                      ...n,
                      gases: mergeGasIntoCollector(n.gases, {
                        speciesId: 'h2o',
                        formula: 'H2O',
                        displayFormula: 'H₂O',
                        nameFr: 'Vapeur d’eau',
                        amountMol: evapMol,
                        molarMass: 18.015,
                        colorHex: '#bae6fd',
                        meltingPointC: 0,
                        boilingPointC: 100,
                      }),
                    }
                  }
                  return n
                }),
              )
            })
            .catch(() => {})
            .finally(() => {
              boilingInFlightRef.current.delete(flask.id)
            })
        } else {
          // Volatile non-water liquid (e.g., ethanol 78 °C, acetone 56 °C)
          const stepMol = Math.round(Math.min(target.availableMol, 0.02) * 1e6) / 1e6
          const nextSolutes = { ...flask.solution.solutesMol }
          const remaining = Math.round((target.availableMol - stepMol) * 1e6) / 1e6
          if (remaining <= 1e-6) delete nextSolutes[target.speciesId]
          else nextSolutes[target.speciesId] = remaining

          api
            .evaluateFlaskAddition({
              vesselId: flask.vessel.id,
              vesselCapacityMl: flask.vessel.capacityMl,
              temperatureC: flask.temperatureC ?? target.boilingPointC,
              currentWaterVolumeMl: flask.solution.waterVolumeMl,
              currentSolutesMol: flask.solution.solutesMol,
              setWaterVolumeMl: flask.solution.waterVolumeMl,
              setSolutesMol: nextSolutes,
            })
            .then((res) => {
              if (!res.ok) return
              setNodesSilent((prev) =>
                prev.map((n) => {
                  if (n.id === flask.id && n.kind === 'flask') {
                    return { ...n, solution: res.solution }
                  }
                  if (
                    collectorId &&
                    n.id === collectorId &&
                    n.kind === 'gas_collector' &&
                    stepMol > 1e-6
                  ) {
                    return {
                      ...n,
                      gases: mergeGasIntoCollector(n.gases, {
                        speciesId: target.speciesId,
                        formula: target.species.formula,
                        displayFormula: target.species.displayFormula,
                        nameFr: getPhaseContextualNameFr(target.species, 'gas'),
                        amountMol: stepMol,
                        molarMass: target.species.molarMass,
                        colorHex: target.species.colorHex ?? '#cbd5e1',
                        meltingPointC: target.species.meltingPointC,
                        boilingPointC: target.species.boilingPointC,
                      }),
                    }
                  }
                  return n
                }),
              )
            })
            .catch(() => {})
            .finally(() => {
              boilingInFlightRef.current.delete(flask.id)
            })
        }
      }
    }, 650)

    return () => window.clearInterval(timer)
  }, [active, nodesRef, setNodesSilent, showNotice, speciesMap, triggerFresh])

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
    handleLinkGasCollectorToFlask,
    handleDropNodeOnGasCollector,
    handleDropGasCollectorOnFlask,
    handleExtractGasFromCollector,
    handleBubbleGasIntoFlask,
    handleTransferGasBetweenCollectors,
    handleSendGasToChamber,
    handleClearGasCollector,
    handleLoadSampleIntoChamber,
    handleSetChamberTargetTemp,
    handleToggleChamberPower,
    handleExtractSampleFromChamber,
    handleTransferChamberSampleToFlask,
    handleTransferChamberSampleToCollector,
    handleTransferChamberSampleToChamber,
    handleTransferFlaskLiquidToChamber,
    handleClearChamberSample,
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
