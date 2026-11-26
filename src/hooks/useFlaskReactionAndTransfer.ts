import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
} from 'react'
import type {
  CanvasFlaskNode,
  CanvasMoleculeNode,
  CanvasNode,
  CanvasThermalChamberNode,
  FilteredSolidItem,
  SpeciesRecord,
  ThermalChamberSample,
  VesselRecord,
} from '../../shared/chemistry.ts'
import { api } from '@/lib/api'
import { createEmptySolution } from '@/lib/chemistry-ui'
import { getSelectedFlaskReaction } from '@/lib/flask-reaction-ui'
import {
  getSpeciesPhaseAtTemperature,
  mergeGasIntoCollector,
} from '@/lib/phase-changes'
import { createNodeId, getPendingReactionCommit } from '@/lib/workbench-helpers'
import type { CanvasNotice } from '@/components/LabCanvas'

function mergeFilteredSolids(
  existing: FilteredSolidItem[] | undefined,
  incoming: FilteredSolidItem[] | undefined,
): FilteredSolidItem[] | undefined {
  if ((!existing || existing.length === 0) && (!incoming || incoming.length === 0)) {
    return existing
  }
  const map = new Map<string, FilteredSolidItem>()
  for (const item of existing ?? []) {
    map.set(item.speciesId, { ...item })
  }
  for (const item of incoming ?? []) {
    const prev = map.get(item.speciesId)
    if (prev) {
      prev.amountMol = Math.round((prev.amountMol + item.amountMol) * 1e6) / 1e6
      prev.massG = Math.round((prev.massG + item.massG) * 1e4) / 1e4
    } else {
      map.set(item.speciesId, { ...item })
    }
  }
  return [...map.values()]
}

interface UseFlaskReactionAndTransferParams {
  nodesRef: MutableRefObject<CanvasNode[]>
  speciesMap: Map<string, SpeciesRecord>
  setNodes: Dispatch<SetStateAction<CanvasNode[]>>
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>
  showNotice: (tone: CanvasNotice['tone'], text: string) => void
  triggerShake: (ids: string[]) => void
  triggerFresh: (id: string) => void
  triggerFlaskPulse: (flaskId: string) => void
}

export function useFlaskReactionAndTransfer({
  nodesRef,
  speciesMap,
  setNodes,
  setSelectedIds,
  showNotice,
  triggerShake,
  triggerFresh,
  triggerFlaskPulse,
}: UseFlaskReactionAndTransferParams) {
  const handleChangeFlaskReactionExtent = useCallback(
    (flaskId: string, xMol: number) => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== flaskId || n.kind !== 'flask') return n
          const rxn = getSelectedFlaskReaction(n.solution, n.selectedReactionId)
          const max = rxn ? rxn.xMaxMol : 0
          const clamped = Math.max(0, Math.min(max, xMol))
          return { ...n, reactionExtentMol: clamped }
        }),
      )
    },
    [setNodes],
  )

  const handleSelectFlaskReaction = useCallback(
    (flaskId: string, reactionId: string) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === flaskId && n.kind === 'flask'
            ? { ...n, selectedReactionId: reactionId, reactionExtentMol: 0 }
            : n,
        ),
      )
    },
    [setNodes],
  )

  const handleCommitFlaskReaction = useCallback(
    async (flaskId: string) => {
      const flask = nodesRef.current.find(
        (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === flaskId,
      )
      if (!flask) return
      const commit = getPendingReactionCommit(flask)
      if (!commit) return
      const rxn = getSelectedFlaskReaction(flask.solution, flask.selectedReactionId)
      const evolvedGases =
        rxn && commit.xMol > 1e-8
          ? rxn.products
              .filter((p) => p.state === 'gas' && p.stoichiometry > 0)
              .map((p) => {
                const sp = speciesMap.get(p.speciesId)
                return {
                  speciesId: p.speciesId,
                  formula: sp?.formula ?? p.displayFormula,
                  displayFormula: p.displayFormula,
                  nameFr: p.nameFr,
                  amountMol: Math.round(commit.xMol * p.stoichiometry * 1e6) / 1e6,
                  molarMass: p.molarMass || sp?.molarMass || 28,
                  colorHex: p.colorHex ?? sp?.colorHex ?? null,
                  meltingPointC: sp?.meltingPointC ?? null,
                  boilingPointC: sp?.boilingPointC ?? null,
                }
              })
              .filter((g) => g.amountMol > 1e-8)
          : []

      const hasLinkedCollector = nodesRef.current.some(
        (n) => n.kind === 'gas_collector' && n.sourceFlaskId === flaskId,
      )

      try {
        const res = await api.evaluateFlaskAddition({
          vesselId: flask.vessel.id,
          vesselCapacityMl: flask.vessel.capacityMl,
          temperatureC: flask.temperatureC ?? 20,
          currentWaterVolumeMl: flask.solution.waterVolumeMl,
          currentSolutesMol: flask.solution.solutesMol,
          commitReaction: {
            ...commit,
            gasCapturedByCollector: hasLinkedCollector,
          },
        })
        if (!res.ok) {
          triggerShake([flaskId])
          showNotice('warning', res.messageFr)
          return
        }
        let capturedByCollector = false
        setNodes((prev) =>
          prev.map((n) => {
            if (n.id === flaskId && n.kind === 'flask') {
              return {
                ...n,
                solution: res.solution,
                reactionExtentMol: 0,
                selectedReactionId: undefined,
              }
            }
            if (
              n.kind === 'gas_collector' &&
              n.sourceFlaskId === flaskId &&
              evolvedGases.length > 0
            ) {
              capturedByCollector = true
              let nextGases = n.gases
              for (const g of evolvedGases) {
                nextGases = mergeGasIntoCollector(nextGases, g)
              }
              return { ...n, gases: nextGases }
            }
            return n
          }),
        )
        triggerFlaskPulse(flaskId)
        showNotice(
          'success',
          capturedByCollector
            ? `${res.messageFr} · Gaz capturé dans le collecteur.`
            : res.messageFr,
        )
      } catch {
        showNotice('warning', 'Erreur lors de la validation de la réaction.')
      }
    },
    [nodesRef, setNodes, showNotice, speciesMap, triggerFlaskPulse, triggerShake],
  )

  const handleBalanceFlaskStoichiometry = useCallback(
    async (flaskId: string) => {
      const flask = nodesRef.current.find(
        (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === flaskId,
      )
      if (!flask) return
      const rxn = getSelectedFlaskReaction(flask.solution, flask.selectedReactionId)
      if (!rxn) return

      const nonWaterReactants = rxn.reactants.filter((r) => r.speciesId !== 'h2o')
      if (nonWaterReactants.length < 2) return

      let targetXMol = 0.01
      for (const r of nonWaterReactants) {
        const ratio = r.initialMol / r.stoichiometry
        if (ratio > targetXMol) targetXMol = ratio
      }
      targetXMol = Math.round(targetXMol * 10000) / 10000

      const nextSolutes: Record<string, number> = {}
      for (const d of flask.solution.dissolvedSpecies) {
        if (d.amountMol > 1e-8) {
          nextSolutes[d.speciesId] = (nextSolutes[d.speciesId] ?? 0) + d.amountMol
        }
      }
      for (const s of flask.solution.solutes) {
        if (s.undissolvedMol > 1e-8) {
          nextSolutes[s.speciesId] = (nextSolutes[s.speciesId] ?? 0) + s.undissolvedMol
        }
      }
      for (const r of nonWaterReactants) {
        nextSolutes[r.speciesId] = Math.round(targetXMol * r.stoichiometry * 1e6) / 1e6
      }

      try {
        const res = await api.evaluateFlaskAddition({
          vesselId: flask.vessel.id,
          vesselCapacityMl: flask.vessel.capacityMl,
          temperatureC: flask.temperatureC ?? 20,
          currentWaterVolumeMl: flask.solution.waterVolumeMl,
          currentSolutesMol: flask.solution.solutesMol,
          setSolutesMol: nextSolutes,
        })
        if (!res.ok) return
        setNodes((prev) =>
          prev.map((n) =>
            n.id === flaskId && n.kind === 'flask'
              ? {
                  ...n,
                  solution: res.solution,
                  reactionExtentMol: 0,
                  selectedReactionId: rxn.id,
                }
              : n,
          ),
        )
        triggerFlaskPulse(flaskId)
        showNotice('success', 'Réactifs ajustés aux proportions stœchiométriques.')
      } catch {
        showNotice('warning', 'Erreur lors de l’ajustement stœchiométrique.')
      }
    },
    [nodesRef, setNodes, showNotice, triggerFlaskPulse],
  )

  const handlePourBetweenFlasks = useCallback(
    async (sourceFlaskId: string, targetFlaskId: string, explicitVolumeMl?: number) => {
      if (sourceFlaskId === targetFlaskId) return
      const src = nodesRef.current.find(
        (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === sourceFlaskId,
      )
      const target = nodesRef.current.find(
        (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === targetFlaskId,
      )
      if (!src || !target) return

      const transferVolumeMl =
        typeof explicitVolumeMl === 'number' && explicitVolumeMl > 0
          ? explicitVolumeMl
          : (src.pourStepMl ?? undefined)

      try {
        let srcWaterMl = src.solution.waterVolumeMl
        let srcSolutesMol = src.solution.solutesMol
        const srcCommit = getPendingReactionCommit(src)
        if (srcCommit) {
          const committedSrc = await api.evaluateFlaskAddition({
            vesselId: src.vessel.id,
            vesselCapacityMl: src.vessel.capacityMl,
            temperatureC: src.temperatureC ?? 20,
            currentWaterVolumeMl: src.solution.waterVolumeMl,
            currentSolutesMol: src.solution.solutesMol,
            commitReaction: srcCommit,
          })
          if (committedSrc.ok) {
            srcWaterMl = committedSrc.solution.waterVolumeMl
            srcSolutesMol = committedSrc.solution.solutesMol
          }
        }

        const res = await api.evaluateFlaskAddition({
          vesselId: target.vessel.id,
          vesselCapacityMl: target.vessel.capacityMl,
          temperatureC: target.temperatureC ?? 20,
          currentWaterVolumeMl: target.solution.waterVolumeMl,
          currentSolutesMol: target.solution.solutesMol,
          commitReaction: getPendingReactionCommit(target),
          incomingFlask: {
            waterVolumeMl: srcWaterMl,
            solutesMol: srcSolutesMol,
            transferVolumeMl,
            sourceTemperatureC: src.temperatureC ?? 20,
            filterSolids: Boolean(target.hasFilter),
          },
        })

        if (!res.ok) {
          triggerShake([sourceFlaskId, targetFlaskId])
          showNotice('warning', res.messageFr)
          return
        }

        setNodes((prev) =>
          prev.map((n) => {
            if (n.id === targetFlaskId && n.kind === 'flask') {
              return {
                ...n,
                solution: res.solution,
                filteredSolids: mergeFilteredSolids(n.filteredSolids, res.filteredSolids),
                reactionExtentMol: 0,
                selectedReactionId: undefined,
              }
            }
            if (n.id === sourceFlaskId && n.kind === 'flask') {
              return {
                ...n,
                solution: res.remainingSourceFlask?.solution ?? createEmptySolution(),
                reactionExtentMol: 0,
                selectedReactionId: undefined,
              }
            }
            return n
          }),
        )
        triggerFlaskPulse(targetFlaskId)
        showNotice('success', res.messageFr)
      } catch {
        showNotice('warning', 'Erreur lors du transfert de solution.')
      }
    },
    [nodesRef, setNodes, showNotice, triggerFlaskPulse, triggerShake],
  )

  const handleExtractAliquot = useCallback(
    async (sourceFlaskId: string, targetVessel: VesselRecord, volumeMl: number) => {
      const src = nodesRef.current.find(
        (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === sourceFlaskId,
      )
      if (!src) return
      if (!src.solution.hasWater) {
        triggerShake([sourceFlaskId])
        showNotice('warning', 'La verrerie source est vide.')
        return
      }

      try {
        let srcWaterMl = src.solution.waterVolumeMl
        let srcSolutesMol = src.solution.solutesMol
        const srcCommit = getPendingReactionCommit(src)
        if (srcCommit) {
          const committedSrc = await api.evaluateFlaskAddition({
            vesselId: src.vessel.id,
            vesselCapacityMl: src.vessel.capacityMl,
            temperatureC: src.temperatureC ?? 20,
            currentWaterVolumeMl: src.solution.waterVolumeMl,
            currentSolutesMol: src.solution.solutesMol,
            commitReaction: srcCommit,
          })
          if (committedSrc.ok) {
            srcWaterMl = committedSrc.solution.waterVolumeMl
            srcSolutesMol = committedSrc.solution.solutesMol
          }
        }

        const res = await api.evaluateFlaskAddition({
          vesselId: targetVessel.id,
          vesselCapacityMl: targetVessel.capacityMl,
          temperatureC: 20,
          currentWaterVolumeMl: 0,
          currentSolutesMol: {},
          incomingFlask: {
            waterVolumeMl: srcWaterMl,
            solutesMol: srcSolutesMol,
            transferVolumeMl: volumeMl,
            sourceTemperatureC: src.temperatureC ?? 20,
          },
        })
        if (!res.ok) {
          triggerShake([sourceFlaskId])
          showNotice('warning', res.messageFr)
          return
        }

        const candidateOffsets: Array<[number, number]> = [
          [210, 0],
          [0, 220],
          [210, 220],
          [-210, 0],
          [-210, 220],
          [0, -220],
          [210, -220],
          [420, 0],
          [420, 220],
        ]
        let spawnX = src.x + 210
        let spawnY = src.y + 40
        for (const [dx, dy] of candidateOffsets) {
          const cx = src.x + dx
          const cy = src.y + dy
          const overlaps = nodesRef.current.some(
            (n) =>
              n.kind === 'flask' &&
              Math.abs(n.x - cx) < 195 &&
              Math.abs(n.y - cy) < 195,
          )
          if (!overlaps) {
            spawnX = cx
            spawnY = cy
            break
          }
        }

        const newFlask: CanvasFlaskNode = {
          id: createNodeId('flask'),
          kind: 'flask',
          x: spawnX,
          y: spawnY,
          vessel: { ...targetVessel },
          temperatureC: 20,
          stoppered: false,
          pourStepMl: targetVessel.defaultPourStepMl,
          solution: res.solution,
        }

        setNodes((prev) => [
          ...prev.map((n) =>
            n.id === sourceFlaskId && n.kind === 'flask'
              ? {
                  ...n,
                  solution: res.remainingSourceFlask?.solution ?? createEmptySolution(),
                  reactionExtentMol: 0,
                  selectedReactionId: undefined,
                }
              : n,
          ),
          newFlask,
        ])
        setSelectedIds(new Set([newFlask.id]))
        triggerFresh(newFlask.id)
        triggerFlaskPulse(newFlask.id)
        showNotice('success', `Aliquote prélevée : ${res.messageFr}`)
      } catch {
        showNotice('warning', 'Erreur lors du prélèvement d’aliquote.')
      }
    },
    [nodesRef, setNodes, setSelectedIds, showNotice, triggerFlaskPulse, triggerFresh, triggerShake],
  )

  const handleExtractFilteredSolid = useCallback(
    (flaskId: string, speciesId: string, dropPos?: { x: number; y: number }) => {
      const flask = nodesRef.current.find(
        (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === flaskId,
      )
      if (!flask || !flask.filteredSolids) return
      const targetItem = flask.filteredSolids.find((s) => s.speciesId === speciesId)
      if (!targetItem) return

      const catalogSp = speciesMap.get(speciesId)
      const molarMass =
        targetItem.amountMol > 1e-8
          ? Math.round((targetItem.massG / targetItem.amountMol) * 100) / 100
          : (catalogSp?.molarMass ?? 100)
      const speciesRecord: SpeciesRecord = catalogSp ?? {
        id: targetItem.speciesId,
        formula: targetItem.displayFormula,
        displayFormula: targetItem.displayFormula,
        nameFr: targetItem.nameFr,
        iupacName: null,
        casNumber: null,
        kind: 'ionic_compound',
        charge: 0,
        molarMass,
        standardState: 'solid',
        meltingPointC: null,
        boilingPointC: null,
        thermalNote: null,
        densityGPerCm3: 3.5,
        appearanceFr: 'Précipité isolé par filtration',
        colorHex: targetItem.colorHex,
        composition: {},
        compositionKey: null,
        isSolvent: false,
        canDissolveInWater: false,
        solubilityGPerL: 0,
        dissolutionType: 'none',
        solutionColorHex: null,
        phCharacter: 'neutral',
        pkaValues: [],
        ghsPictograms: [],
        ghsSignalWord: null,
        popularity: 0,
        pubchemCid: null,
        families: ['Précipité'],
        lewis: null,
        behaviors: {},
      }

      const newNode: CanvasMoleculeNode = {
        id: createNodeId('mol'),
        kind: 'molecule',
        x: dropPos ? dropPos.x : flask.x + 170,
        y: dropPos ? dropPos.y : flask.y - 36,
        species: speciesRecord,
        amountMol: Math.max(0.0001, targetItem.amountMol),
      }

      setNodes((prev) => [
        ...prev.map((n) =>
          n.id === flaskId && n.kind === 'flask'
            ? {
                ...n,
                filteredSolids: (n.filteredSolids ?? []).filter(
                  (s) => s.speciesId !== speciesId,
                ),
              }
            : n,
        ),
        newNode,
      ])
      setSelectedIds(new Set([newNode.id]))
      triggerFresh(newNode.id)
      showNotice('success', `${targetItem.displayFormula}(s) récupéré sur la paillasse.`)
    },
    [nodesRef, setNodes, setSelectedIds, showNotice, speciesMap, triggerFresh],
  )

  const handleTransferFilteredSolidToFlask = useCallback(
    async (sourceFlaskId: string, speciesId: string, targetFlaskId: string) => {
      const src = nodesRef.current.find(
        (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === sourceFlaskId,
      )
      const tgt = nodesRef.current.find(
        (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === targetFlaskId,
      )
      if (!src || !tgt || !src.filteredSolids) return
      const item = src.filteredSolids.find((s) => s.speciesId === speciesId)
      if (!item) return

      try {
        const res = await api.evaluateFlaskAddition({
          vesselId: tgt.vessel.id,
          vesselCapacityMl: tgt.vessel.capacityMl,
          temperatureC: tgt.temperatureC ?? 20,
          currentWaterVolumeMl: tgt.solution.waterVolumeMl,
          currentSolutesMol: tgt.solution.solutesMol,
          commitReaction: getPendingReactionCommit(tgt),
          incomingSpeciesId: item.speciesId,
          incomingAmountMol: Math.max(0.0001, item.amountMol),
        })
        if (!res.ok) {
          triggerShake([sourceFlaskId, targetFlaskId])
          showNotice('warning', res.messageFr)
          return
        }
        setNodes((prev) =>
          prev.map((n) => {
            if (n.id === sourceFlaskId && n.kind === 'flask') {
              const remaining = (n.filteredSolids ?? []).filter(
                (s) => s.speciesId !== speciesId,
              )
              return n.id === targetFlaskId
                ? {
                    ...n,
                    filteredSolids: remaining,
                    solution: res.solution,
                    reactionExtentMol: 0,
                    selectedReactionId: undefined,
                  }
                : { ...n, filteredSolids: remaining }
            }
            if (n.id === targetFlaskId && n.kind === 'flask') {
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
        triggerFlaskPulse(targetFlaskId)
        showNotice(
          'success',
          `${item.displayFormula}(s) transféré du filtre vers ${tgt.customLabel || tgt.vessel.nameFr}.`,
        )
      } catch {
        showNotice('warning', 'Erreur lors du transfert du solide filtré.')
      }
    },
    [nodesRef, setNodes, showNotice, triggerFlaskPulse, triggerShake],
  )

  const handleTransferFilteredSolidToChamber = useCallback(
    (sourceFlaskId: string, speciesId: string, chamberId: string) => {
      const src = nodesRef.current.find(
        (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === sourceFlaskId,
      )
      const chamber = nodesRef.current.find(
        (n): n is CanvasThermalChamberNode =>
          n.kind === 'thermal_chamber' && n.id === chamberId,
      )
      if (!src || !chamber || !src.filteredSolids) return
      const item = src.filteredSolids.find((s) => s.speciesId === speciesId)
      if (!item) return

      const catalogSp = speciesMap.get(speciesId)
      const molarMass =
        item.amountMol > 1e-8
          ? Math.round((item.massG / item.amountMol) * 100) / 100
          : (catalogSp?.molarMass ?? 100)
      const sp: SpeciesRecord = catalogSp ?? {
        id: item.speciesId,
        formula: item.displayFormula,
        displayFormula: item.displayFormula,
        nameFr: item.nameFr,
        iupacName: null,
        casNumber: null,
        kind: 'ionic_compound',
        charge: 0,
        molarMass,
        standardState: 'solid',
        meltingPointC: null,
        boilingPointC: null,
        thermalNote: null,
        densityGPerCm3: 3.5,
        appearanceFr: 'Précipité isolé par filtration',
        colorHex: item.colorHex,
        composition: {},
        compositionKey: null,
        isSolvent: false,
        canDissolveInWater: false,
        solubilityGPerL: 0,
        dissolutionType: 'none',
        solutionColorHex: null,
        phCharacter: 'neutral',
        pkaValues: [],
        ghsPictograms: [],
        ghsSignalWord: null,
        popularity: 0,
        pubchemCid: null,
        families: ['Précipité'],
        lewis: null,
        behaviors: {},
      }
      const sample: ThermalChamberSample = {
        species: sp,
        amountMol: Math.max(0.0001, item.amountMol),
        currentState: getSpeciesPhaseAtTemperature(sp, chamber.temperatureC),
      }
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id === sourceFlaskId && n.kind === 'flask') {
            return {
              ...n,
              filteredSolids: (n.filteredSolids ?? []).filter(
                (s) => s.speciesId !== speciesId,
              ),
            }
          }
          if (n.id === chamberId && n.kind === 'thermal_chamber') {
            return { ...n, sample }
          }
          return n
        }),
      )
      setSelectedIds(new Set([chamberId]))
      triggerFresh(chamberId)
      showNotice('success', `${item.displayFormula}(s) transféré dans la chambre thermique.`)
    },
    [nodesRef, setNodes, setSelectedIds, showNotice, speciesMap, triggerFresh],
  )

  const handleClearFilterCake = useCallback(
    (flaskId: string) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === flaskId && n.kind === 'flask'
            ? { ...n, filteredSolids: [] }
            : n,
        ),
      )
      showNotice('neutral', 'Papier filtre nettoyé.')
    },
    [setNodes, showNotice],
  )

  return {
    handleChangeFlaskReactionExtent,
    handleSelectFlaskReaction,
    handleCommitFlaskReaction,
    handleBalanceFlaskStoichiometry,
    handlePourBetweenFlasks,
    handleExtractAliquot,
    handleExtractFilteredSolid,
    handleTransferFilteredSolidToFlask,
    handleTransferFilteredSolidToChamber,
    handleClearFilterCake,
  }
}
