import type {
  CanvasFlaskNode,
  CanvasGasCollectorNode,
  CanvasNode,
  CanvasSolidNode,
  CanvasThermalChamberNode,
} from '../../shared/chemistry.ts'

export const NODE_HALF_SIZE: Record<CanvasNode['kind'], { hw: number; hh: number }> = {
  atom: { hw: 28, hh: 28 },
  molecule: { hw: 94, hh: 28 },
  solid: { hw: 94, hh: 28 },
  flask: { hw: 108, hh: 104 },
  gas_collector: { hw: 94, hh: 52 },
  thermal_chamber: { hw: 96, hh: 74 },
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

export function getGasCollectorHitTest(
  nodes: CanvasNode[],
  worldX: number,
  worldY: number,
  excludeId?: string,
): CanvasGasCollectorNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i]
    if (node.kind !== 'gas_collector' || node.id === excludeId) continue
    const { hw, hh } = NODE_HALF_SIZE.gas_collector
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

export function getThermalChamberHitTest(
  nodes: CanvasNode[],
  worldX: number,
  worldY: number,
  excludeId?: string,
): CanvasThermalChamberNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i]
    if (node.kind !== 'thermal_chamber' || node.id === excludeId) continue
    const { hw, hh } = NODE_HALF_SIZE.thermal_chamber
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
