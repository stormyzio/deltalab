import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
} from 'react'
import type {
  AlloyRecord,
  CanvasAtomNode,
  CanvasFlaskNode,
  CanvasMoleculeNode,
  CanvasNode,
  CanvasSolidNode,
  CatalogSolutionRecord,
  CatalogSpeciesRecord,
  ElementRecord,
  SpeciesRecord,
  VesselRecord,
} from '../../shared/chemistry.ts'
import type { ExternalDragItem } from '@/types/drag'
import { api } from '@/lib/api'
import { createEmptySolution, getDefaultSpeciesAmountMol } from '@/lib/chemistry-ui'
import {
  createGasCollectorNode,
  createThermalChamberNode,
} from '@/lib/phase-changes'
import {
  createSolidNodeFromAlloy,
  createSolidNodeFromElement,
  forgeAlloyFromNodes,
  reproportionSolidToAlloy,
  rescaleSolidMass,
  rescaleSolidVolume,
  updateSolidComponentMass,
} from '@/lib/solid-alloys'
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
  alloys: AlloyRecord[]
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
  alloys,
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
      } else if (item.kind === 'gas_collector') {
        newNode = createGasCollectorNode(worldX, worldY)
      } else if (item.kind === 'thermal_chamber') {
        newNode = createThermalChamberNode(worldX, worldY, item.initialTargetC ?? -20)
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
          if (singleEl.defaultState === 'solid') {
            newNode = createSolidNodeFromElement(singleEl, worldX, worldY, 1)
          } else {
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
          }
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

  const handleConvertAtomToSolid = useCallback(
    (atomId: string) => {
      const atom = nodesRef.current.find(
        (n): n is CanvasAtomNode => n.kind === 'atom' && n.id === atomId,
      )
      if (!atom) return
      const el = elementsBySymbol.get(atom.symbol)
      if (!el || el.defaultState !== 'solid') {
        triggerShake([atomId])
        showNotice('warning', `${atom.symbol} n’est pas solide à température ambiante.`)
        return
      }
      const solidNode = createSolidNodeFromElement(el, atom.x, atom.y, 1)
      setNodes((prev) => prev.map((n) => (n.id === atomId ? solidNode : n)))
      setSelectedIds(new Set([solidNode.id]))
      triggerFresh(solidNode.id)
      showNotice('success', `Bloc solide : ${solidNode.nameFr}`)
    },
    [elementsBySymbol, nodesRef, setNodes, setSelectedIds, showNotice, triggerFresh, triggerShake],
  )

  const handleConvertSelectedAtomsToSolid = useCallback(() => {
    const selectedAtoms = nodesRef.current.filter(
      (n): n is CanvasAtomNode => n.kind === 'atom' && selectedIds.has(n.id),
    )
    if (selectedAtoms.length === 0) return
    if (selectedAtoms.length === 1) {
      handleConvertAtomToSolid(selectedAtoms[0].id)
      return
    }
    const replacements = new Map<string, CanvasSolidNode>()
    const rejectedIds: string[] = []
    for (const atom of selectedAtoms) {
      const el = elementsBySymbol.get(atom.symbol)
      if (!el || el.defaultState !== 'solid') {
        rejectedIds.push(atom.id)
        continue
      }
      replacements.set(atom.id, createSolidNodeFromElement(el, atom.x, atom.y, 1))
    }
    if (replacements.size === 0) {
      triggerShake(rejectedIds)
      showNotice('warning', 'Aucun atome sélectionné n’est solide à température ambiante.')
      return
    }
    setNodes((prev) => prev.map((n) => replacements.get(n.id) ?? n))
    const newIds = [...replacements.values()].map((s) => s.id)
    setSelectedIds(new Set(newIds))
    for (const id of newIds) triggerFresh(id)
    showNotice(
      'success',
      `${newIds.length} bloc${newIds.length > 1 ? 's' : ''} solide${newIds.length > 1 ? 's' : ''} créé${newIds.length > 1 ? 's' : ''}`,
    )
  }, [
    elementsBySymbol,
    handleConvertAtomToSolid,
    nodesRef,
    selectedIds,
    setNodes,
    setSelectedIds,
    showNotice,
    triggerFresh,
    triggerShake,
  ])

  const handleSetSolidMass = useCallback(
    (nodeId: string, nextMassG: number) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId && n.kind === 'solid' ? rescaleSolidMass(n, nextMassG) : n,
        ),
      )
    },
    [setNodes],
  )

  const handleSetSolidVolume = useCallback(
    (nodeId: string, nextVolumeCm3: number) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId && n.kind === 'solid'
            ? rescaleSolidVolume(n, nextVolumeCm3)
            : n,
        ),
      )
    },
    [setNodes],
  )

  const handleSetSolidComponentMass = useCallback(
    (nodeId: string, symbol: string, nextMassG: number) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId && n.kind === 'solid'
            ? updateSolidComponentMass(n, symbol, nextMassG, alloys, elementsBySymbol)
            : n,
        ),
      )
    },
    [alloys, elementsBySymbol, setNodes],
  )

  const handleReproportionSolidToAlloy = useCallback(
    (nodeId: string, alloy: AlloyRecord) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId && n.kind === 'solid'
            ? reproportionSolidToAlloy(n, alloy)
            : n,
        ),
      )
      showNotice('success', `Proportions ajustées : ${alloy.nameFr}`)
    },
    [setNodes, showNotice],
  )

  const handleDropSolidOnSolid = useCallback(
    (draggedId: string, targetSolidId: string) => {
      const dragged = nodesRef.current.find((n) => n.id === draggedId)
      const target = nodesRef.current.find(
        (n): n is CanvasSolidNode => n.kind === 'solid' && n.id === targetSolidId,
      )
      if (!dragged || !target || dragged.id === target.id) return
      if (dragged.kind === 'atom') {
        const el = elementsBySymbol.get(dragged.symbol)
        if (!el || el.defaultState !== 'solid') {
          triggerShake([draggedId, targetSolidId])
          showNotice('warning', `${dragged.symbol} n’est pas un élément solide.`)
          return
        }
      } else if (dragged.kind !== 'solid') {
        return
      }

      const forged = forgeAlloyFromNodes(
        [target, dragged],
        alloys,
        elementsBySymbol,
        target.x,
        target.y,
      )
      const removeSet = new Set([dragged.id, target.id])
      setNodes((prev) => [...prev.filter((n) => !removeSet.has(n.id)), forged])
      setSelectedIds(new Set([forged.id]))
      triggerFresh(forged.id)
      showNotice(
        'success',
        forged.isAlloy
          ? `Alliage formé : ${forged.nameFr}`
          : `${forged.nameFr} fusionné`,
      )
    },
    [alloys, elementsBySymbol, nodesRef, setNodes, setSelectedIds, showNotice, triggerFresh, triggerShake],
  )

  const handleSpawnAlloy = useCallback(
    (alloy: AlloyRecord) => {
      handleViewChange('workbench')
      requestAnimationFrame(() => {
        const pt = getSpawnWorldPoint()
        const solidNode = createSolidNodeFromAlloy(alloy, pt.x, pt.y, 10)
        setNodes((prev) => [...prev, solidNode])
        setSelectedIds(new Set([solidNode.id]))
        triggerFresh(solidNode.id)
        showNotice('success', `${alloy.nameFr} ajouté sur la paillasse`)
      })
    },
    [getSpawnWorldPoint, handleViewChange, setNodes, setSelectedIds, showNotice, triggerFresh],
  )

  const handleSpawnSolidElement = useCallback(
    (element: ElementRecord) => {
      handleViewChange('workbench')
      requestAnimationFrame(() => {
        const pt = getSpawnWorldPoint()
        const solidNode = createSolidNodeFromElement(element, pt.x, pt.y, 1)
        setNodes((prev) => [...prev, solidNode])
        setSelectedIds(new Set([solidNode.id]))
        triggerFresh(solidNode.id)
        showNotice('success', `${solidNode.nameFr} ajouté sur la paillasse`)
      })
    },
    [getSpawnWorldPoint, handleViewChange, setNodes, setSelectedIds, showNotice, triggerFresh],
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
    const selectedNodesList = nodesRef.current.filter((n) => selectedIds.has(n.id))
    if (selectedNodesList.length < 2) return

    // Solid blocks (+ optional solid atoms) -> forge alloy / fuse solid block
    const hasSolidBlock = selectedNodesList.some((n) => n.kind === 'solid')
    if (hasSolidBlock) {
      const allForgeable = selectedNodesList.every(
        (n): n is CanvasSolidNode | CanvasAtomNode =>
          n.kind === 'solid' ||
          (n.kind === 'atom' &&
            elementsBySymbol.get(n.symbol)?.defaultState === 'solid'),
      )
      if (!allForgeable) {
        triggerShake(selectedNodesList.map((n) => n.id))
        showNotice(
          'warning',
          'Seuls des blocs solides ou éléments solides peuvent être alliés ensemble.',
        )
        return
      }
      const avgX =
        selectedNodesList.reduce((acc, n) => acc + n.x, 0) / selectedNodesList.length
      const avgY =
        selectedNodesList.reduce((acc, n) => acc + n.y, 0) / selectedNodesList.length
      const forged = forgeAlloyFromNodes(
        selectedNodesList as Array<CanvasSolidNode | CanvasAtomNode>,
        alloys,
        elementsBySymbol,
        avgX,
        avgY,
      )
      const removeSet = new Set(selectedNodesList.map((n) => n.id))
      setNodes((prev) => [...prev.filter((n) => !removeSet.has(n.id)), forged])
      setSelectedIds(new Set([forged.id]))
      triggerFresh(forged.id)
      showNotice(
        'success',
        forged.isAlloy
          ? `Alliage formé : ${forged.nameFr}`
          : `${forged.nameFr} fusionné`,
      )
      return
    }

    const selectedChemical = selectedNodesList.filter(
      (n): n is CanvasAtomNode | CanvasMoleculeNode =>
        n.kind === 'atom' || n.kind === 'molecule',
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
  }, [
    alloys,
    completeMergeWithSpecies,
    elementsBySymbol,
    nodesRef,
    selectedIds,
    setNodes,
    setPendingMerge,
    setSelectedIds,
    showNotice,
    triggerFresh,
    triggerShake,
  ])

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
      setNodes((prev) =>
        prev
          .filter((n) => !remove.has(n.id))
          .map((n) => {
            if (n.kind === 'gas_collector' && n.sourceFlaskId && remove.has(n.sourceFlaskId)) {
              return { ...n, sourceFlaskId: null }
            }
            return n
          }),
      )
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
      } else if ((e.key === 's' || e.key === 'S') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (selectedIds.size > 0) {
          e.preventDefault()
          handleConvertSelectedAtomsToSolid()
        }
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
    handleConvertSelectedAtomsToSolid,
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

  const handleSpawnSolution = useCallback(
    async (solution: CatalogSolutionRecord) => {
      const defaultVessel =
        vessels.find((v) => v.id === 'erlenmeyer_250') ??
        vessels.find((v) => v.vesselType === 'erlenmeyer') ??
        vessels[0]
      if (!defaultVessel) return

      const targetSolutes: Record<string, number> = {}
      for (const soluteId of solution.soluteIds) {
        if (soluteId === 'h2o') continue
        targetSolutes[soluteId] = 0.01
      }

      try {
        const res = await api.evaluateFlaskAddition({
          vesselId: defaultVessel.id,
          vesselCapacityMl: defaultVessel.capacityMl,
          temperatureC: 20,
          currentWaterVolumeMl: 0,
          currentSolutesMol: {},
          setWaterVolumeMl: 100,
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
            pourStepMl: defaultVessel.defaultPourStepMl,
            customLabel: solution.nameFr.slice(0, 32),
            solution: res.solution,
            reactionExtentMol: 0,
          }
          setNodes((prev) => [...prev, newFlask])
          setSelectedIds(new Set([newFlask.id]))
          triggerFresh(newFlask.id)
          triggerFlaskPulse(newFlask.id)
          showNotice('success', `Solution préparée : ${solution.nameFr}`)
        })
      } catch {
        showNotice('warning', 'Erreur lors de la préparation de la solution.')
      }
    },
    [
      getSpawnWorldPoint,
      handleViewChange,
      setNodes,
      setSelectedIds,
      showNotice,
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
    handleConvertAtomToSolid,
    handleSetSolidMass,
    handleSetSolidVolume,
    handleSetSolidComponentMass,
    handleReproportionSolidToAlloy,
    handleDropSolidOnSolid,
    handleSpawnAlloy,
    handleSpawnSolidElement,
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
    handleSpawnSolution,
    handleAddFromLewisBuilder,
  }
}
