import type { CanvasFlaskNode, CanvasNode } from '../../shared/chemistry.ts'
import { getSelectedFlaskReaction } from '@/lib/flask-reaction-ui'
import type { AppView } from '@/components/Header'
import type { PendingMergeIsomers } from '@/components/LabCanvas'

export interface PendingMergeState extends PendingMergeIsomers {
  sourceIds: string[]
  avgX: number
  avgY: number
}

export function parseViewFromHash(hash: string): AppView {
  if (hash === '#especes' || hash === '#catalogue') return 'species'
  if (hash === '#solutions') return 'solutions'
  if (hash === '#reactions') return 'reactions'
  if (hash === '#verrerie') return 'vessels'
  if (hash === '#lewis') return 'lewis'
  if (hash === '#tableau') return 'periodic'
  return 'workbench'
}

export function createNodeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function getPendingReactionCommit(
  flask: CanvasFlaskNode,
): { reactionId: string; xMol: number } | undefined {
  const xMol = flask.reactionExtentMol ?? 0
  if (xMol <= 1e-8) return undefined
  const rxn = getSelectedFlaskReaction(flask.solution, flask.selectedReactionId)
  if (!rxn || rxn.xMaxMol <= 1e-9) return undefined
  return {
    reactionId: rxn.id,
    xMol: Math.min(rxn.xMaxMol, xMol),
  }
}

export function cloneCanvasNode(node: CanvasNode, dx: number, dy: number): CanvasNode {
  const id = createNodeId(node.kind)
  if (node.kind === 'flask') {
    return {
      ...node,
      id,
      x: node.x + dx,
      y: node.y + dy,
      vessel: { ...node.vessel },
      solution: {
        ...node.solution,
        solutesMol: { ...node.solution.solutesMol },
        solutes: node.solution.solutes.map((item) => ({ ...item })),
        dissolvedSpecies: node.solution.dissolvedSpecies.map((item) => ({ ...item })),
      },
    }
  }
  return {
    ...node,
    id,
    x: node.x + dx,
    y: node.y + dy,
  }
}

export function getDefaultWaterStepMl(capacityMl: number): number {
  if (capacityMl <= 15) return 5
  if (capacityMl <= 30) return 10
  if (capacityMl <= 120) return 50
  if (capacityMl <= 350) return 100
  if (capacityMl <= 750) return 250
  return 500
}
