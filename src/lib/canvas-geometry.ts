import type {
  CanvasFlaskNode,
  CanvasNode,
  CanvasSolidNode,
} from '../../shared/chemistry.ts'

export const NODE_HALF_SIZE: Record<CanvasNode['kind'], { hw: number; hh: number }> = {
  atom: { hw: 28, hh: 28 },
  molecule: { hw: 74, hh: 24 },
  solid: { hw: 58, hh: 46 },
  flask: { hw: 108, hh: 104 },
}

export function getFlaskHitTest(
  nodes: CanvasNode[],
  worldX: number,
  worldY: number,
  excludeId?: string,
): CanvasFlaskNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i]
    if (node.kind !== 'flask' || node.id === excludeId) continue
    const { hw, hh } = NODE_HALF_SIZE.flask
    if (
      worldX >= node.x - hw &&
      worldX <= node.x + hw &&
      worldY >= node.y - hh &&
      worldY <= node.y + hh
    ) {
      return node
    }
  }
  return null
}

export function getSolidHitTest(
  nodes: CanvasNode[],
  worldX: number,
  worldY: number,
  excludeId?: string,
): CanvasSolidNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i]
    if (node.kind !== 'solid' || node.id === excludeId) continue
    const { hw, hh } = NODE_HALF_SIZE.solid
    if (
      worldX >= node.x - hw &&
      worldX <= node.x + hw &&
      worldY >= node.y - hh &&
      worldY <= node.y + hh
    ) {
      return node
    }
  }
  return null
}
