import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
} from 'react'
import type {
  CanvasAtomNode,
  CanvasFlaskNode,
  CanvasMoleculeNode,
  CanvasNode,
  CatalogSpeciesRecord,
  ElementRecord,
  SpeciesRecord,
  VesselRecord,
} from '../../shared/chemistry.ts'
import type { ExternalDragItem } from '@/types/drag'
import { api } from '@/lib/api'
import { createEmptySolution, getDefaultSpeciesAmountMol } from '@/lib/chemistry-ui'
import {
  type PendingMergeState,
  cloneCanvasNode,
  createNodeId,
} from '@/lib/workbench-helpers'
import type { AppView } from '@/components/Header'
import type { CanvasNotice } from '@/components/LabCanvas'
import type { ReactionSpawnSetup } from '@/components/catalog/CatalogShared'

interface UseWorkbenchSelectionActionsParams {
  activeView: AppView
  nodesRef: MutableRefObject<CanvasNode[]>
  selectedIds: Set<string>
  pendingMerge: PendingMergeState | null
  elementsBySymbol: Map<string, ElementRecord>
  speciesMap: Map<string, CatalogSpeciesRecord>
  vessels: VesselRecord[]
  setNodes: Dispatch<SetStateAction<CanvasNode[]>>
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>
  setPendingMerge: Dispatch<SetStateAction<PendingMergeState | null>>
  setDiscoveredSpeciesIds: Dispatch<SetStateAction<string[]>>
  getSpawnWorldPoint: (clientX?: number, clientY?: number) => { x: number; y: number }
  handleViewChange: (next: AppView) => void
  showNotice: (tone: CanvasNotice['tone'], text: string) => void
  triggerShake: (ids: string[]) => void
  triggerFresh: (id: string) => void
  triggerFlaskPulse: (flaskId: string) => void
}

export function useWorkbenchSelectionActions({
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
}: UseWorkbenchSelectionActionsParams) {
  const spawnItem = useCallback(
    (item: ExternalDragItem, worldX: number, worldY: number) => {
      let newNode: CanvasNode
      if (item.kind === 'atom') {
        const el = item.element
        newNode = {
          id: createNodeId('atom'),
          kind: 'atom',
          x: worldX,
          y: worldY,
          symbol: el.symbol,
          atomicNumber: el.atomicNumber,
          nameFr: el.nameFr,
          category: el.category,
          cpkColor: el.cpkColor,
        } satisfies CanvasAtomNode
      } else if (item.kind === 'vessel') {
        newNode = {
          id: createNodeId('flask'),
          kind: 'flask',
          x: worldX,
          y: worldY,
          vessel: { ...item.vessel },
          temperatureC: 20,
          stoppered: false,
          pourStepMl: item.vessel.defaultPourStepMl,
          solution: createEmptySolution(),
        } satisfies CanvasFlaskNode
      } else {
        const compEntries = Object.entries(item.species.composition)
        const singleEl =
          item.species.kind === 'element_substance' &&
          item.species.charge === 0 &&
          compEntries.length === 1 &&
          compEntries[0][1] === 1
            ? elementsBySymbol.get(compEntries[0][0])
            : undefined

        if (singleEl) {
          newNode = {
            id: createNodeId('atom'),
            kind: 'atom',
            x: worldX,
            y: worldY,
            symbol: singleEl.symbol,
            atomicNumber: singleEl.atomicNumber,
            nameFr: singleEl.nameFr,
            category: singleEl.category,
            cpkColor: singleEl.cpkColor,
          } satisfies CanvasAtomNode
        } else {
          newNode = {
            id: createNodeId('mol'),
            kind: 'molecule',
            x: worldX,
            y: worldY,
            species: item.species,
            amountMol: getDefaultSpeciesAmountMol(item.species),
          } satisfies CanvasMoleculeNode
        }
      }

      setNodes((prev) => [...prev, newNode])
      setSelectedIds(new Set([newNode.id]))
      triggerFresh(newNode.id)

      if (newNode.kind === 'molecule' && !newNode.species.lewis) {
        const nodeId = newNode.id
        const speciesId = newNode.species.id
        api
          .getSpeciesById(speciesId)
          .then(({ species }) => {
            setNodes((prev) =>
              prev.map((n) =>
                n.id === nodeId && n.kind === 'molecule' ? { ...n, species } : n,
              ),
            )
          })
          .catch(() => {})
      }
    },
    [elementsBySymbol, setNodes, setSelectedIds, triggerFresh],
  )

  const handleUpdateMoleculeAmount = useCallback(
    (nodeId: string, amountMol: number) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId && n.kind === 'molecule' ? { ...n, amountMol } : n,
        ),
      )
    },
    [setNodes],
  )

  const completeMergeWithSpecies = useCallback(
    (species: SpeciesRecord, sourceIds: string[], avgX: number, avgY: number) => {
      const mergedNode: CanvasMoleculeNode = {
        id: createNodeId('mol'),
        kind: 'molecule',
        x: avgX,
        y: avgY,
        species,
        amountMol: getDefaultSpeciesAmountMol(species),
      }
      const removeSet = new Set(sourceIds)
      setNodes((prev) => [...prev.filter((n) => !removeSet.has(n.id)), mergedNode])
      setSelectedIds(new Set([mergedNode.id]))
      setPendingMerge(null)
      triggerFresh(mergedNode.id)
      setDiscoveredSpeciesIds((prev) =>
        prev.includes(species.id) ? prev : [species.id, ...prev],
      )
      showNotice('success', `${species.displayFormula} · ${species.nameFr}`)
    },
    [setDiscoveredSpeciesIds, setNodes, setPendingMerge, setSelectedIds, showNotice, triggerFresh],
  )

  const handlePickMergeIsomer = useCallback(
    (species: SpeciesRecord) => {
      if (!pendingMerge) return
      completeMergeWithSpecies(
        species,
        pendingMerge.sourceIds,
        pendingMerge.avgX,
        pendingMerge.avgY,
      )
    },
    [completeMergeWithSpecies, pendingMerge],
  )

  const handleMergeSelected = useCallback(async () => {
    const selectedChemical = nodesRef.current.filter(
      (n): n is CanvasAtomNode | CanvasMoleculeNode =>
        (n.kind === 'atom' || n.kind === 'molecule') && selectedIds.has(n.id),
    )
    if (selectedChemical.length < 2 || selectedChemical.length !== selectedIds.size) {
      return
    }

    const composition: Record<string, number> = {}
    let totalCharge = 0
    for (const item of selectedChemical) {
      if (item.kind === 'atom') {
        composition[item.symbol] = (composition[item.symbol] ?? 0) + 1
      } else {
        totalCharge += item.species.charge
        for (const [sym, qty] of Object.entries(item.species.composition)) {
          composition[sym] = (composition[sym] ?? 0) + qty
        }
      }
    }

    try {
      const result = await api.mergeAtoms({ composition, totalCharge })
      if (!result.matched) {
        triggerShake(selectedChemical.map((a) => a.id))
        showNotice('warning', result.reasonFr)
        return
      }

      const avgX =
        selectedChemical.reduce((acc, a) => acc + a.x, 0) / selectedChemical.length
      const avgY =
        selectedChemical.reduce((acc, a) => acc + a.y, 0) / selectedChemical.length
      const sourceIds = selectedChemical.map((a) => a.id)

      if (result.candidates.length > 1) {
        setPendingMerge({
          sourceIds,
          avgX,
          avgY,
          compositionFormula: result.compositionFormula,
          candidates: result.candidates,
          totalCandidatesCount: result.totalCandidatesCount,
        })
        return
      }

      completeMergeWithSpecies(result.species, sourceIds, avgX, avgY)
    } catch {
      showNotice('warning', 'Erreur lors de la fusion.')
    }
  }, [completeMergeWithSpecies, nodesRef, selectedIds, setPendingMerge, showNotice, triggerShake])

  const handleIonizeSelected = useCallback(
    async (direction: 1 | -1) => {
      const selectedChemical = nodesRef.current.filter(
        (n): n is CanvasAtomNode | CanvasMoleculeNode =>
          (n.kind === 'atom' || n.kind === 'molecule') && selectedIds.has(n.id),
      )
      if (selectedChemical.length === 0 || selectedChemical.length !== selectedIds.size) {
        return
      }

      const composition: Record<string, number> = {}
      let currentCharge = 0
      for (const item of selectedChemical) {
        if (item.kind === 'atom') {
          composition[item.symbol] = (composition[item.symbol] ?? 0) + 1
        } else {
          currentCharge += item.species.charge
          for (const [sym, qty] of Object.entries(item.species.composition)) {
            composition[sym] = (composition[sym] ?? 0) + qty
          }
        }
      }

      try {
        const res = await api.ionizeSpecies({ composition, currentCharge, direction })
        if (!res.ok) {
          triggerShake(selectedChemical.map((n) => n.id))
          showNotice('warning', res.reasonFr)
          return
        }

        const avgX =
          selectedChemical.reduce((acc, a) => acc + a.x, 0) / selectedChemical.length
        const avgY =
          selectedChemical.reduce((acc, a) => acc + a.y, 0) / selectedChemical.length
        const removeSet = new Set(selectedChemical.map((n) => n.id))

        let nextNode: CanvasNode
        if (res.resultKind === 'neutral_atom') {
          const el = res.element
          nextNode = {
            id: createNodeId('atom'),
            kind: 'atom',
            x: avgX,
            y: avgY,
            symbol: el.symbol,
            atomicNumber: el.atomicNumber,
            nameFr: el.nameFr,
            category: el.category,
            cpkColor: el.cpkColor,
          } satisfies CanvasAtomNode
        } else {
          const inheritedMol =
            selectedChemical.length === 1 && selectedChemical[0].kind === 'molecule'
              ? selectedChemical[0].amountMol
              : getDefaultSpeciesAmountMol(res.species)
          nextNode = {
            id: createNodeId('mol'),
            kind: 'molecule',
            x: avgX,
            y: avgY,
            species: res.species,
            amountMol: inheritedMol,
          } satisfies CanvasMoleculeNode
          setDiscoveredSpeciesIds((prev) =>
            prev.includes(res.species.id) ? prev : [res.species.id, ...prev],
          )
        }

        setNodes((prev) => [...prev.filter((n) => !removeSet.has(n.id)), nextNode])
        setSelectedIds(new Set([nextNode.id]))
        triggerFresh(nextNode.id)
        showNotice('success', res.messageFr)
      } catch {
        showNotice('warning', 'Erreur lors de l’ionisation.')
      }
    },
    [nodesRef, selectedIds, setDiscoveredSpeciesIds, setNodes, setSelectedIds, showNotice, triggerFresh, triggerShake],
  )

  const handleDuplicateSelected = useCallback(() => {
    if (selectedIds.size === 0) return
    const clones: CanvasNode[] = []
    for (const node of nodesRef.current) {
      if (!selectedIds.has(node.id)) continue
      clones.push(cloneCanvasNode(node, 28, 28))
    }
    if (clones.length === 0) return
    setNodes((prev) => [...prev, ...clones])
    setSelectedIds(new Set(clones.map((c) => c.id)))
    for (const c of clones) triggerFresh(c.id)
  }, [nodesRef, selectedIds, setNodes, setSelectedIds, triggerFresh])

  const handleDuplicateNodesForDrag = useCallback(
    (sourceIds: string[], dx: number, dy: number): Map<string, string> => {
      const idSet = new Set(sourceIds)
      const idMap = new Map<string, string>()
      const clones: CanvasNode[] = []

      for (const node of nodesRef.current) {
        if (!idSet.has(node.id)) continue
        const clone = cloneCanvasNode(node, dx, dy)
        idMap.set(node.id, clone.id)
        clones.push(clone)
      }

      if (clones.length > 0) {
        setNodes((prev) => [...prev, ...clones])
        setSelectedIds(new Set(clones.map((c) => c.id)))
      }
      return idMap
    },
    [nodesRef, setNodes, setSelectedIds],
  )

  const handleDeleteIds = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return
      const remove = new Set(ids)
      setNodes((prev) => prev.filter((n) => !remove.has(n.id)))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      })
    },
    [setNodes, setSelectedIds],
  )

  const handleMoveNodes = useCallback(
    (updates: Array<{ id: string; x: number; y: number }>) => {
      const map = new Map(updates.map((u) => [u.id, u]))
      setNodes((prev) =>
        prev.map((n) => {
          const hit = map.get(n.id)
          return hit ? { ...n, x: hit.x, y: hit.y } : n
        }),
      )
    },
    [setNodes],
  )

  const handleClearCanvas = useCallback(() => {
    setNodes([])
    setSelectedIds(new Set())
    showNotice('neutral', 'Paillasse vidée.')
  }, [setNodes, setSelectedIds, showNotice])

  useEffect(() => {
    if (activeView !== 'workbench') return
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (pendingMerge) {
        if (e.key === 'Escape') {
          e.preventDefault()
          setPendingMerge(null)
          return
        }
        const digit = Number.parseInt(e.key, 10)
        if (
          Number.isFinite(digit) &&
          digit >= 1 &&
          digit <= pendingMerge.candidates.length
        ) {
          e.preventDefault()
          handlePickMergeIsomer(pendingMerge.candidates[digit - 1])
          return
        }
      }

      if ((e.key === 'v' || e.key === 'V') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        void handleMergeSelected()
      } else if (
        e.key === 'Backspace' ||
        e.key === 'Delete' ||
        ((e.key === 'x' || e.key === 'X') && !e.metaKey && !e.ctrlKey && !e.altKey)
      ) {
        if (selectedIds.size > 0) {
          e.preventDefault()
          handleDeleteIds([...selectedIds])
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        if (selectedIds.size > 0) {
          e.preventDefault()
          handleDuplicateSelected()
        }
      } else if ((e.key === '+' || e.key === '=') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (selectedIds.size > 0) {
          e.preventDefault()
          void handleIonizeSelected(1)
        }
      } else if (e.key === '-' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (selectedIds.size > 0) {
          e.preventDefault()
          void handleIonizeSelected(-1)
        }
      } else if (e.key === 'Escape') {
        setSelectedIds(new Set())
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    activeView,
    handleDeleteIds,
    handleDuplicateSelected,
    handleIonizeSelected,
    handleMergeSelected,
    handlePickMergeIsomer,
    pendingMerge,
    selectedIds,
    setPendingMerge,
    setSelectedIds,
  ])

  const handleSpawnFromCatalog = useCallback(
    async (item: ExternalDragItem) => {
      let hydratedItem = item
      if (item.kind === 'molecule' && !item.species.lewis) {
        try {
          const res = await api.getSpeciesById(item.species.id)
          hydratedItem = { kind: 'molecule', species: res.species }
        } catch {
          // proceed with item as-is
        }
      }
      handleViewChange('workbench')
      requestAnimationFrame(() => {
        const pt = getSpawnWorldPoint()
        spawnItem(hydratedItem, pt.x, pt.y)
      })
    },
    [getSpawnWorldPoint, handleViewChange, spawnItem],
  )

  const handleSpawnReactionSetup = useCallback(
    async (setup: ReactionSpawnSetup) => {
      const defaultVessel =
        vessels.find((v) => v.id === 'erlenmeyer_250') ??
        vessels.find((v) => v.vesselType === 'erlenmeyer') ??
        vessels[0]
      if (!defaultVessel) return

      const hasIonReactant = setup.reactants.some((r) => {
        const sp = speciesMap.get(r.speciesId)
        return sp?.kind === 'ion' || r.speciesId === 'h3o_plus' || r.speciesId === 'oh_minus'
      })
      const isAqueous =
        setup.medium === 'aqueous' ||
        hasIonReactant ||
        setup.reactants.some((r) => r.speciesId === 'h2o')

      const allLiquids =
        !isAqueous &&
        setup.reactants.every(
          (r) => speciesMap.get(r.speciesId)?.standardState === 'liquid',
        )
      const baseUnitMol = allLiquids ? 0.05 : 0.01

      const targetSolutes: Record<string, number> = {}
      for (const r of setup.reactants) {
        if (r.speciesId === 'h2o') continue
        targetSolutes[r.speciesId] =
          (targetSolutes[r.speciesId] ?? 0) +
          Math.round(baseUnitMol * r.stoichiometry * 1e6) / 1e6
      }

      try {
        const res = await api.evaluateFlaskAddition({
          vesselId: defaultVessel.id,
          vesselCapacityMl: defaultVessel.capacityMl,
          temperatureC: 20,
          currentWaterVolumeMl: 0,
          currentSolutesMol: {},
          setWaterVolumeMl: isAqueous ? 100 : 0,
          setSolutesMol: targetSolutes,
        })
        if (!res.ok) {
          showNotice('warning', res.messageFr)
          return
        }

        handleViewChange('workbench')
        requestAnimationFrame(() => {
          const pt = getSpawnWorldPoint()
          const newFlask: CanvasFlaskNode = {
            id: createNodeId('flask'),
            kind: 'flask',
            x: pt.x,
            y: pt.y - 36,
            vessel: { ...defaultVessel },
            temperatureC: 20,
            stoppered: setup.medium === 'gas',
            pourStepMl: defaultVessel.defaultPourStepMl,
            customLabel: setup.titleFr.slice(0, 32),
            solution: res.solution,
            reactionExtentMol: 0,
          }
          setNodes((prev) => [...prev, newFlask])
          setSelectedIds(new Set([newFlask.id]))
          triggerFresh(newFlask.id)
          triggerFlaskPulse(newFlask.id)
          showNotice('success', `Préparation prête : ${setup.titleFr}`)
        })
      } catch {
        showNotice('warning', 'Erreur lors de la préparation de la réaction.')
      }
    },
    [
      getSpawnWorldPoint,
      handleViewChange,
      setNodes,
      setSelectedIds,
      showNotice,
      speciesMap,
      triggerFlaskPulse,
      triggerFresh,
      vessels,
    ],
  )

  const handleAddFromLewisBuilder = useCallback(
    (species: SpeciesRecord, switchToWorkbench: boolean) => {
      setDiscoveredSpeciesIds((prev) =>
        prev.includes(species.id) ? prev : [species.id, ...prev],
      )
      if (switchToWorkbench) {
        handleViewChange('workbench')
        requestAnimationFrame(() => {
          const pt = getSpawnWorldPoint()
          spawnItem({ kind: 'molecule', species }, pt.x, pt.y)
          showNotice('success', `${species.displayFormula} · ${species.nameFr}`)
        })
      } else {
        const pt = getSpawnWorldPoint()
        spawnItem({ kind: 'molecule', species }, pt.x, pt.y)
      }
    },
    [getSpawnWorldPoint, handleViewChange, setDiscoveredSpeciesIds, showNotice, spawnItem],
  )

  return {
    spawnItem,
    handleUpdateMoleculeAmount,
    handlePickMergeIsomer,
    handleMergeSelected,
    handleIonizeSelected,
    handleDuplicateSelected,
    handleDuplicateNodesForDrag,
    handleDeleteIds,
    handleMoveNodes,
    handleClearCanvas,
    handleSpawnFromCatalog,
    handleSpawnReactionSetup,
    handleAddFromLewisBuilder,
  }
}
