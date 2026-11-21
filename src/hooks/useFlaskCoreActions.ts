import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import {
  ELEMENT_SYMBOL_TO_SOLID_SPECIES_ID,
  type CanvasAtomNode,
  type CanvasFlaskNode,
  type CanvasMoleculeNode,
  type CanvasNode,
} from '../../shared/chemistry.ts'
import { api } from '@/lib/api'
import { createEmptySolution, formatCapacityMl } from '@/lib/chemistry-ui'
import { getSelectedFlaskReaction } from '@/lib/flask-reaction-ui'
import { getPendingReactionCommit } from '@/lib/workbench-helpers'
import type { CanvasNotice } from '@/components/LabCanvas'

interface UseFlaskCoreActionsParams {
  nodesRef: MutableRefObject<CanvasNode[]>
  setNodes: Dispatch<SetStateAction<CanvasNode[]>>
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>
  showNotice: (tone: CanvasNotice['tone'], text: string) => void
  triggerShake: (ids: string[]) => void
  triggerFlaskPulse: (flaskId: string) => void
}

export function useFlaskCoreActions({
  nodesRef,
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
      if (flask.stoppered) {
        triggerShake(consumedId ? [flaskId, consumedId] : [flaskId])
        showNotice('warning', 'Verrerie bouchée : retirez le bouchon avant tout ajout.')
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
      const solidSpeciesId = ELEMENT_SYMBOL_TO_SOLID_SPECIES_ID[atom.symbol]
      if (!solidSpeciesId) {
        triggerShake([atomNodeId, flaskId])
        showNotice('warning', `${atom.symbol} n’est pas un corps simple solide immergeable.`)
        return
      }
      void addSpeciesToFlask(flaskId, solidSpeciesId, {
        consumedMoleculeNodeId: atomNodeId,
      })
    },
    [addSpeciesToFlask, nodesRef, showNotice, triggerShake],
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
      const cleanCap = Math.min(5000, Math.max(5, Math.round(newCapacityMl)))
      const flask = nodesRef.current.find(
        (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === flaskId,
      )
      if (!flask) return
      if (cleanCap < flask.solution.totalVolumeMl - 0.05) {
        triggerShake([flaskId])
        showNotice('warning', 'Le volume présent dépasse la capacité demandée.')
        return
      }
      setNodes((prev) =>
        prev.map((n) =>
          n.id === flaskId && n.kind === 'flask'
            ? { ...n, vessel: { ...n.vessel, capacityMl: cleanCap } }
            : n,
        ),
      )
      showNotice('neutral', `${flask.vessel.nameFr} · ${formatCapacityMl(cleanCap)}.`)
    },
    [nodesRef, setNodes, showNotice, triggerShake],
  )

  const handleSetFlaskTemperature = useCallback(
    (flaskId: string, temperatureC: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(temperatureC)))
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

  const handleToggleFlaskStopper = useCallback(
    (flaskId: string) => {
      const flask = nodesRef.current.find(
        (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === flaskId,
      )
      if (!flask || !flask.vessel.stopperable) return
      const next = !flask.stoppered
      setNodes((prev) =>
        prev.map((n) =>
          n.id === flaskId && n.kind === 'flask' ? { ...n, stoppered: next } : n,
        ),
      )
      showNotice('neutral', next ? 'Bouchon posé.' : 'Bouchon retiré.')
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
      if (flask.stoppered) {
        triggerShake([flaskId])
        showNotice('warning', 'Retirez le bouchon avant d’évaporer le solvant.')
        return
      }
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
        showNotice(res.effect === 'saturated' ? 'warning' : 'success', res.messageFr)
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
      if (flask.stoppered) {
        triggerShake([flaskId])
        showNotice('warning', 'Verrerie bouchée : retirez le bouchon pour modifier le contenu.')
        return
      }
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
      if (flask.stoppered) {
        triggerShake([flaskId])
        showNotice('warning', 'Verrerie bouchée : retirez le bouchon pour modifier le volume.')
        return
      }
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
    handleDropMoleculeOnFlask,
    handleResizeFlask,
    handleSetFlaskTemperature,
    handleToggleFlaskStopper,
    handleSetFlaskLabel,
    handleSetFlaskPourStep,
    handleEvaporateFlaskWater,
    handleSetFlaskSoluteAmount,
    handleSetFlaskWaterVolume,
    handleEmptyFlask,
  }
}
