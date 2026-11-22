import {
  ELEMENT_SYMBOL_TO_SOLID_SPECIES_ID,
  type CanvasFlaskNode,
  type CanvasNode,
} from '../../../shared/chemistry.ts'
import { formatSpeciesQuantityBadge, formatVolumeMl } from '@/lib/chemistry-ui'

export interface FlaskDropHint {
  text: string
  valid: boolean
}

export function computeCanvasDropHint(
  draggedNode: CanvasNode | undefined,
  targetFlask: CanvasFlaskNode,
): FlaskDropHint | null {
  if (!draggedNode) return null

  if (draggedNode.kind === 'atom') {
    const solidId = ELEMENT_SYMBOL_TO_SOLID_SPECIES_ID[draggedNode.symbol]
    if (!solidId) {
      return { text: `${draggedNode.symbol} non immergeable seul`, valid: false }
    }
    return {
      text: targetFlask.solution.hasWater
        ? `Immerger ${draggedNode.symbol}(s)`
        : `Ajouter ${draggedNode.symbol}(s)`,
      valid: true,
    }
  }

  if (draggedNode.kind === 'molecule') {
    const sp = draggedNode.species
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
        sp.standardState === 'solid'
          ? '(s)'
          : sp.standardState === 'gas'
            ? '(g)'
            : '(l)'
      return { text: `Ajouter ${qtyBadge} ${sp.displayFormula}${stateTag}`, valid: true }
    }
    if (!sp.canDissolveInWater) {
      return {
        text:
          sp.standardState === 'solid'
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
