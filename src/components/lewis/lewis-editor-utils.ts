import type {
  LewisAtom,
  LewisBond,
  SpeciesRecord,
} from '../../../shared/chemistry.ts'

export type BuilderTool = 'build' | 'move' | 'bond' | 'lonepair' | 'charge'

export interface Snapshot {
  atoms: LewisAtom[]
  bonds: LewisBond[]
}

export const COMMON_PALETTE_SYMBOLS = [
  'H', 'C', 'N', 'O', 'F', 'P', 'S', 'Cl',
  'Br', 'I', 'Si', 'Na', 'K', 'Ca', 'Mg', 'Al',
  'Fe', 'Cu', 'Zn', 'Ag', 'Mn', 'Cr', 'Ba', 'Pb',
]

export const QUICK_TEMPLATE_IDS = ['h2o', 'c3h6o', 'oh_minus', 'nh4_plus', 'so4_2minus']

export const GRID_STEP = 16
export const BOND_SPROUT_DIST = 56
export const LEWIS_MIN_ZOOM = 0.45
export const LEWIS_MAX_ZOOM = 2.4

export interface LewisViewport {
  x: number
  y: number
  zoom: number
}

/**
 * Clamp Lewis editor zoom and pan so the camera stays within a dynamic margin around
 * the molecule: compact for small drawings, expanding automatically as the diagram grows.
 */
export function clampLewisViewport(
  vp: LewisViewport,
  atoms: LewisAtom[],
  stageWidth: number,
  stageHeight: number,
): LewisViewport {
  const zoom = Math.max(LEWIS_MIN_ZOOM, Math.min(LEWIS_MAX_ZOOM, vp.zoom))
  if (stageWidth < 40 || stageHeight < 40) return { x: vp.x, y: vp.y, zoom }

  let minX: number
  let maxX: number
  let minY: number
  let maxY: number
  if (atoms.length === 0) {
    minX = stageWidth / 2
    maxX = stageWidth / 2
    minY = stageHeight / 2
    maxY = stageHeight / 2
  } else {
    minX = Infinity
    maxX = -Infinity
    minY = Infinity
    maxY = -Infinity
    for (const a of atoms) {
      if (a.x < minX) minX = a.x
      if (a.x > maxX) maxX = a.x
      if (a.y < minY) minY = a.y
      if (a.y > maxY) maxY = a.y
    }
  }

  const spanX = maxX - minX
  const spanY = maxY - minY
  // Base comfortable margin + proportional expansion as the drawn diagram grows
  const marginX = Math.max(220, 220 + spanX * 0.45)
  const marginY = Math.max(180, 180 + spanY * 0.45)

  const worldCenterX = (stageWidth / 2 - vp.x) / zoom
  const worldCenterY = (stageHeight / 2 - vp.y) / zoom

  const clampedCenterX = Math.max(minX - marginX, Math.min(maxX + marginX, worldCenterX))
  const clampedCenterY = Math.max(minY - marginY, Math.min(maxY + marginY, worldCenterY))

  return {
    x: stageWidth / 2 - clampedCenterX * zoom,
    y: stageHeight / 2 - clampedCenterY * zoom,
    zoom,
  }
}

/** Compute a clean centered viewport that fits all drawn atoms comfortably inside the stage. */
export function computeFitLewisViewport(
  atoms: LewisAtom[],
  stageWidth: number,
  stageHeight: number,
): LewisViewport {
  if (atoms.length === 0 || stageWidth < 40 || stageHeight < 40) {
    return { x: 0, y: 0, zoom: 1 }
  }
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const a of atoms) {
    if (a.x < minX) minX = a.x
    if (a.x > maxX) maxX = a.x
    if (a.y < minY) minY = a.y
    if (a.y > maxY) maxY = a.y
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const spanX = Math.max(80, maxX - minX + 120)
  const spanY = Math.max(80, maxY - minY + 140)
  const fitZoom = Math.min(stageWidth / spanX, stageHeight / spanY)
  const zoom = Math.max(LEWIS_MIN_ZOOM, Math.min(1.15, fitZoom))
  return {
    x: Math.round(stageWidth / 2 - cx * zoom),
    y: Math.round(stageHeight / 2 - cy * zoom),
    zoom: Math.round(zoom * 100) / 100,
  }
}

export function snapToGrid(val: number): number {
  return Math.round(val / GRID_STEP) * GRID_STEP
}

export function computeSproutEndpoint(
  fromAtom: LewisAtom,
  rawX: number,
  rawY: number,
  freeAngle: boolean,
): { x: number; y: number } {
  const dx = rawX - fromAtom.x
  const dy = rawY - fromAtom.y
  const dist = Math.hypot(dx, dy)
  if (dist < 6) {
    return { x: fromAtom.x + BOND_SPROUT_DIST, y: fromAtom.y }
  }
  if (freeAngle) {
    return { x: Math.round(rawX), y: Math.round(rawY) }
  }
  const stepAngle = Math.PI / 12
  const snappedAngle = Math.round(Math.atan2(dy, dx) / stepAngle) * stepAngle
  const snappedDist =
    dist <= 84 ? BOND_SPROUT_DIST : Math.max(BOND_SPROUT_DIST, Math.round(dist / 14) * 14)
  return {
    x: Math.round(fromAtom.x + Math.cos(snappedAngle) * snappedDist),
    y: Math.round(fromAtom.y + Math.sin(snappedAngle) * snappedDist),
  }
}

export function computeOpenSproutPosition(
  fromAtom: LewisAtom,
  atoms: LewisAtom[],
  bonds: LewisBond[],
): { x: number; y: number } {
  const neighborAngles: number[] = []
  let maxNeighborOrder = 1
  for (const b of bonds) {
    const otherId = b.from === fromAtom.id ? b.to : b.to === fromAtom.id ? b.from : null
    if (!otherId) continue
    const other = atoms.find((a) => a.id === otherId)
    if (!other) continue
    neighborAngles.push(Math.atan2(other.y - fromAtom.y, other.x - fromAtom.x))
    if (b.order > maxNeighborOrder) maxNeighborOrder = b.order
  }

  const candidateAngles: number[] = []
  if (neighborAngles.length === 0) {
    candidateAngles.push(0, -Math.PI / 6, Math.PI / 6, Math.PI, -Math.PI / 2, Math.PI / 2)
  } else if (neighborAngles.length === 1) {
    const a0 = neighborAngles[0]
    if (maxNeighborOrder >= 2 && (fromAtom.symbol === 'C' || fromAtom.symbol === 'N')) {
      candidateAngles.push(a0 + Math.PI, a0 + (2 * Math.PI) / 3, a0 - (2 * Math.PI) / 3)
    } else if (fromAtom.symbol === 'O' || fromAtom.symbol === 'S') {
      const bent = (108 * Math.PI) / 180
      candidateAngles.push(a0 + bent, a0 - bent, a0 + (2 * Math.PI) / 3, a0 - (2 * Math.PI) / 3)
    } else {
      candidateAngles.push(
        a0 + (2 * Math.PI) / 3,
        a0 - (2 * Math.PI) / 3,
        a0 + Math.PI,
        a0 + Math.PI / 2,
        a0 - Math.PI / 2,
      )
    }
  } else {
    const sorted = [...neighborAngles].sort((a, b) => a - b)
    const gaps: Array<{ mid: number; size: number }> = []
    for (let i = 0; i < sorted.length; i++) {
      const curr = sorted[i]
      const next = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + Math.PI * 2
      const size = next - curr
      gaps.push({ mid: curr + size / 2, size })
    }
    gaps.sort((a, b) => b.size - a.size)
    for (const g of gaps) candidateAngles.push(g.mid)
  }

  for (let k = 0; k < 12; k++) candidateAngles.push((k * Math.PI) / 6)

  let bestPos = {
    x: Math.round(fromAtom.x + Math.cos(candidateAngles[0]) * BOND_SPROUT_DIST),
    y: Math.round(fromAtom.y + Math.sin(candidateAngles[0]) * BOND_SPROUT_DIST),
  }
  let bestMinClearance = -1

  for (const ang of candidateAngles) {
    const px = Math.round(fromAtom.x + Math.cos(ang) * BOND_SPROUT_DIST)
    const py = Math.round(fromAtom.y + Math.sin(ang) * BOND_SPROUT_DIST)
    let minClearance = Infinity
    for (const other of atoms) {
      if (other.id === fromAtom.id) continue
      const d = Math.hypot(other.x - px, other.y - py)
      if (d < minClearance) minClearance = d
    }
    if (minClearance >= 28) return { x: px, y: py }
    if (minClearance > bestMinClearance) {
      bestMinClearance = minClearance
      bestPos = { x: px, y: py }
    }
  }

  return bestPos
}

export function makeAtomId(): string {
  return `la_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

export function normalizeBondKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`
}

export function speciesToCanvasState(
  species: SpeciesRecord,
  center: { x: number; y: number },
): { atoms: LewisAtom[]; bonds: LewisBond[] } {
  const lewis = species.lewis
  if (!lewis) return { atoms: [], bonds: [] }
  const scale = 1.15
  const stamp = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`
  const atoms: LewisAtom[] = lewis.atoms.map((a, idx) => ({
    ...a,
    id: `tpl_${idx}_${stamp}`,
    x: Math.round(center.x + a.x * scale),
    y: Math.round(center.y + a.y * scale),
  }))
  const idMap = new Map(lewis.atoms.map((a, idx) => [a.id, atoms[idx].id]))
  const bonds: LewisBond[] = lewis.bonds.map((b) => ({
    from: idMap.get(b.from) ?? b.from,
    to: idMap.get(b.to) ?? b.to,
    order: b.order,
  }))
  return { atoms, bonds }
}
