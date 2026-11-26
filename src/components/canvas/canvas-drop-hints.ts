import {
  type AlloyRecord,
  type CanvasFlaskNode,
  type CanvasGasCollectorNode,
  type CanvasNode,
  type CanvasSolidNode,
  type CanvasThermalChamberNode,
  type ElementRecord,
} from '../../../shared/chemistry.ts'
import {
  formatMassG,
  formatSpeciesQuantityBadge,
  formatVolumeMl,
} from '@/lib/chemistry-ui'
import { getMoleculeEffectivePhase } from '@/lib/phase-changes'
import { forgeAlloyFromNodes, getSolidTotalMassG } from '@/lib/solid-alloys'

export interface FlaskDropHint {
  text: string
  valid: boolean
}

export function computeCanvasDropHint(
  draggedNode: CanvasNode | undefined,
  targetFlask: CanvasFlaskNode,
  elementsBySymbol?: Map<string, ElementRecord>,
): FlaskDropHint | null {
  if (!draggedNode) return null

  if (draggedNode.kind === 'gas_collector') {
    return {
      text:
        draggedNode.sourceFlaskId === targetFlask.id
          ? 'Déjà raccordé à cette verrerie'
          : 'Raccorder le collecteur de gaz',
      valid: draggedNode.sourceFlaskId !== targetFlask.id,
    }
  }

  if (draggedNode.kind === 'atom') {
    const el = elementsBySymbol?.get(draggedNode.symbol)
    if (el && el.defaultState !== 'solid') {
      return { text: `${draggedNode.symbol} n’est pas solide`, valid: false }
    }
    return {
      text: targetFlask.solution.hasWater
        ? `Immerger ${draggedNode.symbol}(s)`
        : `Ajouter ${draggedNode.symbol}(s)`,
      valid: true,
    }
  }

  if (draggedNode.kind === 'solid') {
    const massLabel = formatMassG(getSolidTotalMassG(draggedNode))
    return {
      text: targetFlask.solution.hasWater
        ? `Immerger ${draggedNode.nameFr} (${massLabel})`
        : `Déposer ${draggedNode.nameFr} (${massLabel})`,
      valid: true,
    }
  }

  if (draggedNode.kind === 'molecule') {
    const sp = draggedNode.species
    const effectivePhase = getMoleculeEffectivePhase(draggedNode)
    const qtyBadge = formatSpeciesQuantityBadge(sp, draggedNode.amountMol)
    if (sp.isSolvent) {
      return {
        text: targetFlask.solution.hasWater
          ? `Diluer (+${qtyBadge})`
          : `Ajouter ${qtyBadge} H₂O`,
        valid: targetFlask.solution.totalVolumeMl < targetFlask.vessel.capacityMl,
      }
    }
    if (!targetFlask.solution.hasWater) {
      const stateTag =
        effectivePhase === 'solid'
          ? '(s)'
          : effectivePhase === 'gas'
            ? '(g)'
            : '(l)'
      return { text: `Ajouter ${qtyBadge} ${sp.displayFormula}${stateTag}`, valid: true }
    }
    if (!sp.canDissolveInWater) {
      return {
        text:
          effectivePhase === 'solid'
            ? `Immerger ${qtyBadge} ${sp.displayFormula}(s)`
            : `Introduire ${qtyBadge} ${sp.displayFormula}`,
        valid: true,
      }
    }
    return { text: `Dissoudre ${qtyBadge} ${sp.displayFormula}`, valid: true }
  }

  if (draggedNode.kind === 'flask') {
    if (!draggedNode.solution.hasWater && draggedNode.solution.solutes.length === 0) {
      return { text: 'Verrerie vide', valid: false }
    }
    const step = draggedNode.pourStepMl
    const stepLabel =
      typeof step === 'number' && step > 0
        ? formatVolumeMl(Math.min(step, draggedNode.solution.totalVolumeMl))
        : null
    return {
      text: stepLabel
        ? `Verser ${stepLabel}`
        : targetFlask.solution.hasWater
          ? 'Mélanger'
          : 'Transvaser',
      valid: true,
    }
  }

  return null
}

export function computeGasCollectorDropHint(
  draggedNode: CanvasNode | undefined,
  targetCollector: CanvasGasCollectorNode,
): FlaskDropHint | null {
  if (!draggedNode || draggedNode.id === targetCollector.id) return null
  if (draggedNode.kind === 'flask') {
    return {
      text:
        targetCollector.sourceFlaskId === draggedNode.id
          ? 'Déjà raccordé'
          : 'Raccorder la sortie vapeur',
      valid: targetCollector.sourceFlaskId !== draggedNode.id,
    }
  }
  if (draggedNode.kind === 'molecule') {
    const phase = getMoleculeEffectivePhase(draggedNode)
    if (phase !== 'gas') {
      return {
        text: `${draggedNode.species.displayFormula} n’est pas gazeux`,
        valid: false,
      }
    }
    return {
      text: `Stocker ${draggedNode.species.displayFormula}(g)`,
      valid: true,
    }
  }
  return null
}

export function computeThermalChamberDropHint(
  draggedNode: CanvasNode | undefined,
  targetChamber: CanvasThermalChamberNode,
): FlaskDropHint | null {
  if (!draggedNode || draggedNode.id === targetChamber.id) return null
  if (draggedNode.kind === 'molecule') {
    if (draggedNode.species.kind === 'ion') {
      return { text: 'Les ions isolés ne changent pas d’état', valid: false }
    }
    return {
      text: targetChamber.sample
        ? `Remplacer par ${draggedNode.species.displayFormula}`
        : `Placer ${draggedNode.species.displayFormula} dans la chambre`,
      valid: true,
    }
  }
  if (draggedNode.kind === 'solid') {
    return {
      text: targetChamber.sample
        ? `Remplacer par ${draggedNode.nameFr}`
        : `Placer ${draggedNode.nameFr} dans la chambre`,
      valid: true,
    }
  }
  if (draggedNode.kind === 'gas_collector') {
    if (draggedNode.gases.length === 0) {
      return { text: 'Collecteur vide', valid: false }
    }
    const primary = draggedNode.gases[0]
    return {
      text: `Transférer ${primary.displayFormula}(g) dans la chambre`,
      valid: true,
    }
  }
  return null
}

export function computeSolidDropHint(
  draggedNode: CanvasNode | undefined,
  targetSolid: CanvasSolidNode,
  alloys: AlloyRecord[],
  elementsBySymbol: Map<string, ElementRecord>,
): FlaskDropHint | null {
  if (!draggedNode || draggedNode.id === targetSolid.id) return null
  if (draggedNode.kind === 'atom') {
    const el = elementsBySymbol.get(draggedNode.symbol)
    if (!el || el.defaultState !== 'solid') {
      return { text: `${draggedNode.symbol} n’est pas solide`, valid: false }
    }
  } else if (draggedNode.kind !== 'solid') {
    return null
  }

  const preview = forgeAlloyFromNodes(
    [targetSolid, draggedNode],
    alloys,
    elementsBySymbol,
    targetSolid.x,
    targetSolid.y,
  )
  return {
    text: preview.isAlloy ? `Allier → ${preview.nameFr}` : `Fusionner (${preview.nameFr})`,
    valid: true,
  }
}
