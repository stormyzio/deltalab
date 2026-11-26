import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import {
  type CanvasAtomNode,
  type CanvasFlaskNode,
  type CanvasMoleculeNode,
  type CanvasNode,
  type CanvasSolidNode,
  type ElementRecord,
  getSolidSpeciesIdForElement,
} from '../../shared/chemistry.ts'
import { api } from '@/lib/api'
import { createEmptySolution, formatMassG } from '@/lib/chemistry-ui'
import { getSelectedFlaskReaction } from '@/lib/flask-reaction-ui'
import { mergeGasIntoCollector } from '@/lib/phase-changes'
import { getSolidTotalMassG } from '@/lib/solid-alloys'
import { getPendingReactionCommit } from '@/lib/workbench-helpers'
import type { CanvasNotice } from '@/components/LabCanvas'

interface UseFlaskCoreActionsParams {
  nodesRef: MutableRefObject<CanvasNode[]>
  elementsBySymbol: Map<string, ElementRecord>
  setNodes: Dispatch<SetStateAction<CanvasNode[]>>
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>
  showNotice: (tone: CanvasNotice['tone'], text: string) => void
  triggerShake: (ids: string[]) => void
  triggerFlaskPulse: (flaskId: string) => void
}

export function useFlaskCoreActions({
  nodesRef,
  elementsBySymbol,
  setNodes,
  setSelectedIds,
  showNotice,
  triggerShake,
  triggerFlaskPulse,
}: UseFlaskCoreActionsParams) {
  const tempTimersRef = useRef<Map<string, number>>(new Map())
  const tempSeqRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const timers = tempTimersRef.current
    return () => {
      for (const id of timers.values()) window.clearTimeout(id)
      timers.clear()
    }
  }, [])

  const addSpeciesToFlask = useCallback(
    async (
      flaskId: string,
      speciesId: string,
      options?: {
        amountMol?: number
        waterVolumeMl?: number
        consumedMoleculeNodeId?: string
      },
    ) => {
      const flask = nodesRef.current.find(
        (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === flaskId,
      )
      if (!flask) return

      const consumedId = options?.consumedMoleculeNodeId

      try {
        const res = await api.evaluateFlaskAddition({
          vesselId: flask.vessel.id,
          vesselCapacityMl: flask.vessel.capacityMl,
          temperatureC: flask.temperatureC ?? 20,
          currentWaterVolumeMl: flask.solution.waterVolumeMl,
          currentSolutesMol: flask.solution.solutesMol,
          commitReaction: getPendingReactionCommit(flask),
          incomingSpeciesId: speciesId,
          incomingAmountMol: options?.amountMol,
          incomingWaterVolumeMl: options?.waterVolumeMl,
        })

        if (!res.ok) {
          triggerShake(consumedId ? [flaskId, consumedId] : [flaskId])
          showNotice('warning', res.messageFr)
          return
        }

        setNodes((prev) =>
          prev
            .filter((n) => n.id !== consumedId)
            .map((n) =>
              n.id === flaskId && n.kind === 'flask'
                ? {
                    ...n,
                    solution: res.solution,
                    reactionExtentMol: 0,
                    selectedReactionId: undefined,
                  }
                : n,
            ),
        )
        if (consumedId) setSelectedIds(new Set([flaskId]))
        triggerFlaskPulse(flaskId)
        showNotice(res.effect === 'saturated' ? 'warning' : 'success', res.messageFr)
      } catch {
        showNotice('warning', 'Erreur lors de l’évaluation chimique.')
      }
    },
    [nodesRef, setNodes, setSelectedIds, showNotice, triggerFlaskPulse, triggerShake],
  )

  const handleAddWaterToFlask = useCallback(
    (flaskId: string, volumeMl: number) => {
      void addSpeciesToFlask(flaskId, 'h2o', { waterVolumeMl: volumeMl })
    },
    [addSpeciesToFlask],
  )

  const handleDropAtomOnFlask = useCallback(
    (atomNodeId: string, flaskId: string) => {
      const atom = nodesRef.current.find(
        (n): n is CanvasAtomNode => n.kind === 'atom' && n.id === atomNodeId,
      )
      if (!atom) return
      const el = elementsBySymbol.get(atom.symbol)
      if (el && el.defaultState !== 'solid') {
        triggerShake([atomNodeId, flaskId])
        showNotice('warning', `${atom.symbol} n’est pas un corps simple solide immergeable.`)
        return
      }
      const solidSpeciesId = getSolidSpeciesIdForElement(atom.symbol)
      void addSpeciesToFlask(flaskId, solidSpeciesId, {
        consumedMoleculeNodeId: atomNodeId,
      })
    },
    [addSpeciesToFlask, elementsBySymbol, nodesRef, showNotice, triggerShake],
  )

  const handleDropSolidOnFlask = useCallback(
    async (solidNodeId: string, flaskId: string) => {
      const solid = nodesRef.current.find(
        (n): n is CanvasSolidNode => n.kind === 'solid' && n.id === solidNodeId,
      )
      const flask = nodesRef.current.find(
        (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === flaskId,
      )
      if (!solid || !flask) return

      const validComponents = solid.components.filter((c) => c.massG > 1e-6)
      if (validComponents.length === 0) return

      if (validComponents.length === 1) {
        const comp = validComponents[0]
        const atomicMass = elementsBySymbol.get(comp.symbol)?.atomicMass ?? 56
        const amountMol = Math.max(1e-5, comp.massG / atomicMass)
        void addSpeciesToFlask(flaskId, comp.speciesId, {
          amountMol,
          consumedMoleculeNodeId: solidNodeId,
        })
        return
      }

      // Multi-component alloy: evaluate each constituent metal sequentially so exact masses enter the flask
      try {
        let currentWater = flask.solution.waterVolumeMl
        let currentSolutes = { ...flask.solution.solutesMol }
        let pendingCommit = getPendingReactionCommit(flask)
        let latestSolution = flask.solution

        for (const comp of validComponents) {
          const atomicMass = elementsBySymbol.get(comp.symbol)?.atomicMass ?? 56
          const amountMol = Math.max(1e-5, comp.massG / atomicMass)
          const res = await api.evaluateFlaskAddition({
            vesselId: flask.vessel.id,
            vesselCapacityMl: flask.vessel.capacityMl,
            temperatureC: flask.temperatureC ?? 20,
            currentWaterVolumeMl: currentWater,
            currentSolutesMol: currentSolutes,
            commitReaction: pendingCommit,
            incomingSpeciesId: comp.speciesId,
            incomingAmountMol: amountMol,
          })
          if (!res.ok) {
            triggerShake([flaskId, solidNodeId])
            showNotice('warning', res.messageFr)
            return
          }
          latestSolution = res.solution
          currentWater = res.solution.waterVolumeMl
          currentSolutes = { ...res.solution.solutesMol }
          pendingCommit = undefined
        }

        setNodes((prev) =>
          prev
            .filter((n) => n.id !== solidNodeId)
            .map((n) =>
              n.id === flaskId && n.kind === 'flask'
                ? {
                    ...n,
                    solution: latestSolution,
                    reactionExtentMol: 0,
                    selectedReactionId: undefined,
                  }
                : n,
            ),
        )
        setSelectedIds(new Set([flaskId]))
        triggerFlaskPulse(flaskId)
        showNotice(
          'success',
          `${solid.nameFr} (${formatMassG(getSolidTotalMassG(solid))}) ajouté dans la verrerie.`,
        )
      } catch {
        showNotice('warning', 'Erreur lors de l’ajout de l’alliage.')
      }
    },
    [
      addSpeciesToFlask,
      elementsBySymbol,
      nodesRef,
      setNodes,
      setSelectedIds,
      showNotice,
      triggerFlaskPulse,
      triggerShake,
    ],
  )

  const handleDropMoleculeOnFlask = useCallback(
    (moleculeNodeId: string, flaskId: string) => {
      const mol = nodesRef.current.find(
        (n): n is CanvasMoleculeNode => n.kind === 'molecule' && n.id === moleculeNodeId,
      )
      if (!mol) return
      void addSpeciesToFlask(flaskId, mol.species.id, {
        amountMol: mol.amountMol,
        consumedMoleculeNodeId: moleculeNodeId,
      })
    },
    [addSpeciesToFlask, nodesRef],
  )

  const handleResizeFlask = useCallback(
    (flaskId: string, newCapacityMl: number) => {
      const flask = nodesRef.current.find(
        (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === flaskId,
      )
      if (!flask) return
      const caps = flask.vessel.availableCapacitiesMl
      const minCap = caps[0] ?? 5
      const maxCap = caps[caps.length - 1] ?? 5000
      const floorCap = Math.max(minCap, Math.ceil(flask.solution.totalVolumeMl))
      const cleanCap = Math.min(maxCap, Math.max(floorCap, Math.round(newCapacityMl)))
      if (Math.abs(cleanCap - flask.vessel.capacityMl) < 0.05) return
      setNodes((prev) =>
        prev.map((n) =>
          n.id === flaskId && n.kind === 'flask'
            ? { ...n, vessel: { ...n.vessel, capacityMl: cleanCap } }
            : n,
        ),
      )
    },
    [nodesRef, setNodes],
  )

  const handleSetFlaskTemperature = useCallback(
    (flaskId: string, temperatureC: number) => {
      const clamped = Math.max(0, Math.min(200, Math.round(temperatureC)))
      const current = nodesRef.current.find(
        (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === flaskId,
      )
      if (!current) return

      const prevHadDeposit = current.solution.hasUndissolvedSolid
      setNodes((prev) =>
        prev.map((n) =>
          n.id === flaskId && n.kind === 'flask' ? { ...n, temperatureC: clamped } : n,
        ),
      )

      if (!current.solution.hasWater) return

      const prevTimer = tempTimersRef.current.get(flaskId)
      if (prevTimer !== undefined) window.clearTimeout(prevTimer)
      const seq = (tempSeqRef.current.get(flaskId) ?? 0) + 1
      tempSeqRef.current.set(flaskId, seq)

      const timer = window.setTimeout(() => {
        tempTimersRef.current.delete(flaskId)
        const latest = nodesRef.current.find(
          (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === flaskId,
        )
        if (!latest || !latest.solution.hasWater) return

        void api
          .evaluateFlaskAddition({
            vesselId: latest.vessel.id,
            vesselCapacityMl: latest.vessel.capacityMl,
            temperatureC: clamped,
            currentWaterVolumeMl: latest.solution.waterVolumeMl,
            currentSolutesMol: latest.solution.solutesMol,
            recomputeOnly: true,
          })
          .then((res) => {
            if (!res.ok) return
            if (tempSeqRef.current.get(flaskId) !== seq) return
            setNodes((prev) =>
              prev.map((n) => {
                if (n.id !== flaskId || n.kind !== 'flask') return n
                const rxn = getSelectedFlaskReaction(res.solution, n.selectedReactionId)
                const nextExtent = rxn
                  ? Math.min(rxn.xMaxMol, n.reactionExtentMol ?? 0)
                  : 0
                return {
                  ...n,
                  solution: res.solution,
                  reactionExtentMol: nextExtent,
                  selectedReactionId: rxn ? rxn.id : undefined,
                }
              }),
            )
            if (prevHadDeposit && !res.solution.hasUndissolvedSolid) {
              triggerFlaskPulse(flaskId)
              showNotice('success', `${clamped} °C · dépôt entièrement dissous par chauffage.`)
            } else if (!prevHadDeposit && res.solution.hasUndissolvedSolid) {
              triggerFlaskPulse(flaskId)
              showNotice('warning', `${clamped} °C · cristallisation : la solubilité diminue.`)
            }
          })
          .catch(() => {})
      }, 75)

      tempTimersRef.current.set(flaskId, timer)
    },
    [nodesRef, setNodes, showNotice, triggerFlaskPulse],
  )

  const handleToggleFlaskFilter = useCallback(
    (flaskId: string) => {
      const flask = nodesRef.current.find(
        (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === flaskId,
      )
      if (!flask) return
      const next = !flask.hasFilter
      setNodes((prev) =>
        prev.map((n) =>
          n.id === flaskId && n.kind === 'flask' ? { ...n, hasFilter: next } : n,
        ),
      )
      showNotice('neutral', next ? 'Filtre posé au-dessus de la verrerie.' : 'Filtre retiré.')
    },
    [nodesRef, setNodes, showNotice],
  )

  const handleSetFlaskLabel = useCallback(
    (flaskId: string, label: string) => {
      const cleaned = label.trimStart()
      setNodes((prev) =>
        prev.map((n) =>
          n.id === flaskId && n.kind === 'flask'
            ? { ...n, customLabel: cleaned.length > 0 ? cleaned : undefined }
            : n,
        ),
      )
    },
    [setNodes],
  )

  const handleSetFlaskPourStep = useCallback(
    (flaskId: string, stepMl: number | null) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === flaskId && n.kind === 'flask' ? { ...n, pourStepMl: stepMl } : n,
        ),
      )
    },
    [setNodes],
  )

  const handleEvaporateFlaskWater = useCallback(
    async (flaskId: string, volumeMl: number) => {
      const flask = nodesRef.current.find(
        (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === flaskId,
      )
      if (!flask) return
      if ((flask.temperatureC ?? 20) < 45) {
        triggerShake([flaskId])
        showNotice('warning', 'Chauffez à au moins 45 °C pour évaporer l’eau.')
        return
      }

      try {
        const res = await api.evaluateFlaskAddition({
          vesselId: flask.vessel.id,
          vesselCapacityMl: flask.vessel.capacityMl,
          temperatureC: flask.temperatureC ?? 20,
          currentWaterVolumeMl: flask.solution.waterVolumeMl,
          currentSolutesMol: flask.solution.solutesMol,
          commitReaction: getPendingReactionCommit(flask),
          evaporateWaterMl: volumeMl,
        })
        if (!res.ok) {
          triggerShake([flaskId])
          showNotice('warning', res.messageFr)
          return
        }
        const actualEvapMl = Math.max(
          0,
          flask.solution.waterVolumeMl - res.solution.waterVolumeMl,
        )
        const evapMol = Math.round((actualEvapMl / 18.015) * 1e6) / 1e6
        const linkedCollector = nodesRef.current.find(
          (n) => n.kind === 'gas_collector' && n.sourceFlaskId === flaskId,
        )

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
              linkedCollector &&
              n.id === linkedCollector.id &&
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

        triggerFlaskPulse(flaskId)
        showNotice(
          res.effect === 'saturated' ? 'warning' : 'success',
          linkedCollector && evapMol > 1e-6
            ? `${res.messageFr} · Vapeur capturée dans le collecteur.`
            : res.messageFr,
        )
      } catch {
        showNotice('warning', 'Erreur lors de l’évaporation.')
      }
    },
    [nodesRef, setNodes, showNotice, triggerFlaskPulse, triggerShake],
  )

  const handleSetFlaskSoluteAmount = useCallback(
    async (flaskId: string, speciesId: string, newAmountMol: number) => {
      const flask = nodesRef.current.find(
        (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === flaskId,
      )
      if (!flask) return
      const nextSolutes: Record<string, number> = { ...flask.solution.solutesMol }
      const cleanMol = Number.isFinite(newAmountMol) ? Math.max(0, newAmountMol) : 0
      if (cleanMol <= 1e-8) {
        delete nextSolutes[speciesId]
      } else {
        nextSolutes[speciesId] = Math.round(cleanMol * 1e6) / 1e6
      }

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
        if (!res.ok) {
          triggerShake([flaskId])
          showNotice('warning', res.messageFr)
          return
        }
        setNodes((prev) =>
          prev.map((n) =>
            n.id === flaskId && n.kind === 'flask'
              ? {
                  ...n,
                  solution: res.solution,
                  reactionExtentMol: 0,
                  selectedReactionId: undefined,
                }
              : n,
          ),
        )
        triggerFlaskPulse(flaskId)
      } catch {
        showNotice('warning', 'Erreur lors de la mise à jour de la quantité.')
      }
    },
    [nodesRef, setNodes, showNotice, triggerFlaskPulse, triggerShake],
  )

  const handleSetFlaskWaterVolume = useCallback(
    async (flaskId: string, newWaterVolumeMl: number) => {
      const flask = nodesRef.current.find(
        (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === flaskId,
      )
      if (!flask) return
      const clamped = Math.max(
        0,
        Math.min(
          flask.vessel.capacityMl,
          Math.round((Number.isFinite(newWaterVolumeMl) ? newWaterVolumeMl : 0) * 100) /
            100,
        ),
      )

      try {
        const res = await api.evaluateFlaskAddition({
          vesselId: flask.vessel.id,
          vesselCapacityMl: flask.vessel.capacityMl,
          temperatureC: flask.temperatureC ?? 20,
          currentWaterVolumeMl: flask.solution.waterVolumeMl,
          currentSolutesMol: flask.solution.solutesMol,
          setWaterVolumeMl: clamped,
          setSolutesMol: flask.solution.solutesMol,
        })
        if (!res.ok) {
          triggerShake([flaskId])
          showNotice('warning', res.messageFr)
          return
        }
        setNodes((prev) =>
          prev.map((n) =>
            n.id === flaskId && n.kind === 'flask'
              ? {
                  ...n,
                  solution: res.solution,
                  reactionExtentMol: 0,
                  selectedReactionId: undefined,
                }
              : n,
          ),
        )
        triggerFlaskPulse(flaskId)
      } catch {
        showNotice('warning', 'Erreur lors de la mise à jour du volume d’eau.')
      }
    },
    [nodesRef, setNodes, showNotice, triggerFlaskPulse, triggerShake],
  )

  const handleEmptyFlask = useCallback(
    (flaskId: string) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === flaskId && n.kind === 'flask'
            ? {
                ...n,
                solution: createEmptySolution(),
                filteredSolids: [],
                reactionExtentMol: 0,
                selectedReactionId: undefined,
              }
            : n,
        ),
      )
      showNotice('neutral', 'Verrerie vidée.')
    },
    [setNodes, showNotice],
  )

  return {
    addSpeciesToFlask,
    handleAddWaterToFlask,
    handleDropAtomOnFlask,
    handleDropSolidOnFlask,
    handleDropMoleculeOnFlask,
    handleResizeFlask,
    handleSetFlaskTemperature,
    handleToggleFlaskFilter,
    handleSetFlaskLabel,
    handleSetFlaskPourStep,
    handleEvaporateFlaskWater,
    handleSetFlaskSoluteAmount,
    handleSetFlaskWaterVolume,
    handleEmptyFlask,
  }
}
