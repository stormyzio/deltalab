import {
  type AlloyRecord,
  type CanvasFlaskNode,
  type CanvasNode,
  type CanvasSolidNode,
  type ElementRecord,
} from '../../../shared/chemistry.ts'
import {
  formatMassG,
  formatSpeciesQuantityBadge,
  formatVolumeMl,
} from '@/lib/chemistry-ui'
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
