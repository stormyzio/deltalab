import type { LewisAtom, LewisBond, LewisStructure } from '../../shared/chemistry.ts'

export const LEWIS_ATOM_COLOR: Record<string, string> = {
  H: '#d4d4d8',
  C: '#f4f4f5',
  N: '#93c5fd',
  O: '#fca5a5',
  F: '#86efac',
  Cl: '#86efac',
  Br: '#f87171',
  I: '#c4b5fd',
  S: '#fde047',
  P: '#fdba74',
  Si: '#e4e4e7',
  Mn: '#d8b4fe',
  Cr: '#fdba74',
  Cu: '#7dd3fc',
  Fe: '#fbbf24',
}

export function getLewisAtomColor(symbol: string): string {
  return LEWIS_ATOM_COLOR[symbol] ?? '#e4e4e7'
}

export function formatLewisCharge(charge: number): string {
  if (charge === 0) return ''
  if (charge === 1) return '+'
  if (charge === -1) return '−'
  return charge > 0 ? `${charge}+` : `${Math.abs(charge)}−`
}

export interface BondSegment {
  x1: number
  y1: number
  x2: number
  y2: number
}

export function computeBondSegments(
  a: LewisAtom,
  b: LewisAtom,
  order: 1 | 2 | 3,
): BondSegment[] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dist = Math.hypot(dx, dy)
  if (dist < 1) return []

  const ux = dx / dist
  const uy = dy / dist
  const padA = a.symbol.length > 1 ? 15.5 : 12.5
  const padB = b.symbol.length > 1 ? 15.5 : 12.5
  if (dist <= padA + padB + 2) {
    // Atoms are very close during interactive dragging — draw thin short connector
    const midX = (a.x + b.x) / 2
    const midY = (a.y + b.y) / 2
    return [{ x1: midX - ux * 2, y1: midY - uy * 2, x2: midX + ux * 2, y2: midY + uy * 2 }]
  }

  const startX = a.x + ux * padA
  const startY = a.y + uy * padA
  const endX = b.x - ux * padB
  const endY = b.y - uy * padB

  // Unit perpendicular vector
  const px = -uy
  const py = ux

  const offsets =
    order === 1 ? [0] : order === 2 ? [-2.7, 2.7] : [-4.3, 0, 4.3]

  return offsets.map((off) => ({
    x1: startX + px * off,
    y1: startY + py * off,
    x2: endX + px * off,
    y2: endY + py * off,
  }))
}

export interface LonePairBar {
  x1: number
  y1: number
  x2: number
  y2: number
  cx: number
  cy: number
}

function normalizeAngle(rad: number): number {
  const twoPi = Math.PI * 2
  return ((rad % twoPi) + twoPi) % twoPi
}

export function computeLonePairBars(
  atom: LewisAtom,
  allAtoms: LewisAtom[],
  bonds: LewisBond[],
): LonePairBar[] {
  const count = Math.max(0, Math.min(4, Math.trunc(atom.lonePairs)))
  if (count === 0) return []

  const atomById = new Map(allAtoms.map((a) => [a.id, a]))
  const bondAngles: number[] = []
  for (const bond of bonds) {
    let other: LewisAtom | undefined
    if (bond.from === atom.id) other = atomById.get(bond.to)
    else if (bond.to === atom.id) other = atomById.get(bond.from)
    if (!other) continue
    bondAngles.push(normalizeAngle(Math.atan2(other.y - atom.y, other.x - atom.x)))
  }

  const angles: number[] = []

  if (bondAngles.length === 0) {
    // Monoatomic ion / free atom: top, right, bottom, left
    const defaults = [-Math.PI / 2, 0, Math.PI / 2, Math.PI]
    for (let i = 0; i < count; i++) {
      angles.push(defaults[i])
    }
  } else if (bondAngles.length === 1) {
    const opp = bondAngles[0] + Math.PI
    if (count === 1) {
      angles.push(opp)
    } else if (count === 2) {
      const spread = (56 * Math.PI) / 180
      angles.push(opp - spread, opp + spread)
    } else if (count === 3) {
      const spread = (82 * Math.PI) / 180
      angles.push(opp - spread, opp, opp + spread)
    } else {
      const s1 = (36 * Math.PI) / 180
      const s2 = (108 * Math.PI) / 180
      angles.push(opp - s2, opp - s1, opp + s1, opp + s2)
    }
  } else {
    bondAngles.sort((a, b) => a - b)
    const gaps: Array<{ start: number; size: number }> = []
    for (let i = 0; i < bondAngles.length; i++) {
      const start = bondAngles[i]
      const end =
        i + 1 < bondAngles.length ? bondAngles[i + 1] : bondAngles[0] + Math.PI * 2
      gaps.push({ start, size: end - start })
    }
    gaps.sort((a, b) => b.size - a.size)

    // Symmetric linear case (e.g. C-O-C with two ~180° gaps and 2 lone pairs)
    if (
      count === 2 &&
      gaps.length >= 2 &&
      gaps[0].size >= (145 * Math.PI) / 180 &&
      gaps[1].size >= (145 * Math.PI) / 180 &&
      Math.abs(gaps[0].size - gaps[1].size) < (35 * Math.PI) / 180
    ) {
      angles.push(gaps[0].start + gaps[0].size / 2, gaps[1].start + gaps[1].size / 2)
    } else {
      const biggest = gaps[0]
      if (count === 1) {
        angles.push(biggest.start + biggest.size / 2)
      } else {
        for (let i = 0; i < count; i++) {
          const t = (i + 1) / (count + 1)
          angles.push(biggest.start + biggest.size * t)
        }
      }
    }
  }

  const radius = atom.symbol.length > 1 ? 16 : 14
  const halfLen = 5.2

  return angles.map((angle) => {
    const cx = atom.x + Math.cos(angle) * radius
    const cy = atom.y + Math.sin(angle) * radius
    // Tangent vector perpendicular to radial direction
    const tx = -Math.sin(angle)
    const ty = Math.cos(angle)
    return {
      x1: cx - tx * halfLen,
      y1: cy - ty * halfLen,
      x2: cx + tx * halfLen,
      y2: cy + ty * halfLen,
      cx,
      cy,
    }
  })
}

export function computeChargeBadgePos(
  atom: LewisAtom,
  allAtoms: LewisAtom[],
  bonds: LewisBond[],
): { x: number; y: number } {
  const atomById = new Map(allAtoms.map((a) => [a.id, a]))
  const occupied: Array<{ angle: number; weight: number }> = []

  for (const bond of bonds) {
    let other: LewisAtom | undefined
    if (bond.from === atom.id) other = atomById.get(bond.to)
    else if (bond.to === atom.id) other = atomById.get(bond.from)
    if (!other) continue
    occupied.push({
      angle: Math.atan2(other.y - atom.y, other.x - atom.x),
      weight: 1.0,
    })
  }

  const lpBars = computeLonePairBars(atom, allAtoms, bonds)
  for (const bar of lpBars) {
    occupied.push({
      angle: Math.atan2(bar.cy - atom.y, bar.cx - atom.x),
      weight: 0.95,
    })
  }

  // Evaluate candidate angles around the atom, gently favoring top-right (-45°)
  const preferred = -Math.PI / 4
  let bestAngle = preferred
  let bestScore = -Infinity

  for (let deg = -180; deg < 180; deg += 15) {
    const cand = (deg * Math.PI) / 180
    let minClearance = Math.PI
    for (const occ of occupied) {
      let diff = Math.abs(cand - occ.angle)
      if (diff > Math.PI) diff = Math.PI * 2 - diff
      minClearance = Math.min(minClearance, diff / occ.weight)
    }
    let prefDiff = Math.abs(cand - preferred)
    if (prefDiff > Math.PI) prefDiff = Math.PI * 2 - prefDiff
    // Favor clearance first, break ties toward top-right corner
    const score = minClearance - prefDiff * 0.06
    if (score > bestScore) {
      bestScore = score
      bestAngle = cand
    }
  }

  const baseDist = atom.symbol.length > 1 ? 18 : 16
  const dist = atom.lonePairs > 0 ? baseDist + 4 : baseDist
  return {
    x: atom.x + Math.cos(bestAngle) * dist,
    y: atom.y + Math.sin(bestAngle) * dist,
  }
}

export interface ConnectedComponentBox {
  atomIds: Set<string>
  atoms: LewisAtom[]
  totalCharge: number
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export function extractComponents(structure: LewisStructure): ConnectedComponentBox[] {
  const { atoms, bonds } = structure
  const adj = new Map<string, string[]>()
  for (const a of atoms) adj.set(a.id, [])
  for (const b of bonds) {
    adj.get(b.from)?.push(b.to)
    adj.get(b.to)?.push(b.from)
  }

  const atomById = new Map(atoms.map((a) => [a.id, a]))
  const visited = new Set<string>()
  const components: ConnectedComponentBox[] = []

  for (const atom of atoms) {
    if (visited.has(atom.id)) continue
    const queue = [atom.id]
    const compIds = new Set<string>()
    visited.add(atom.id)
    while (queue.length > 0) {
      const curr = queue.shift()!
      compIds.add(curr)
      for (const nxt of adj.get(curr) ?? []) {
        if (!visited.has(nxt)) {
          visited.add(nxt)
          queue.push(nxt)
        }
      }
    }
    const compAtoms = [...compIds].map((id) => atomById.get(id)!).filter(Boolean)
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    let totalCharge = 0
    for (const a of compAtoms) {
      minX = Math.min(minX, a.x)
      maxX = Math.max(maxX, a.x)
      minY = Math.min(minY, a.y)
      maxY = Math.max(maxY, a.y)
      totalCharge += a.charge
    }
    components.push({
      atomIds: compIds,
      atoms: compAtoms,
      totalCharge,
      minX,
      maxX,
      minY,
      maxY,
    })
  }

  return components
}

// Client-side valence map & octet helpers for the Lewis Builder
export const CLIENT_VALENCE_ELECTRONS: Record<string, number> = {
  H: 1,
  He: 2,
  Li: 1,
  Be: 2,
  B: 3,
  C: 4,
  N: 5,
  O: 6,
  F: 7,
  Ne: 8,
  Na: 1,
  Mg: 2,
  Al: 3,
  Si: 4,
  P: 5,
  S: 6,
  Cl: 7,
  Ar: 8,
  K: 1,
  Ca: 2,
  Cr: 6,
  Mn: 7,
  Br: 7,
  I: 7,
  Ba: 2,
}

export function getAtomBondOrderSum(atomId: string, bonds: LewisBond[]): number {
  let sum = 0
  for (const b of bonds) {
    if (b.from === atomId || b.to === atomId) sum += b.order
  }
  return sum
}

export function computeExpectedFormalCharge(
  symbol: string,
  bondOrderSum: number,
  lonePairs: number,
): number | null {
  const v = CLIENT_VALENCE_ELECTRONS[symbol]
  if (v === undefined) return null
  return v - bondOrderSum - lonePairs * 2
}

export function getAtomShellElectrons(atom: LewisAtom, bonds: LewisBond[]): number {
  const bondOrderSum = getAtomBondOrderSum(atom.id, bonds)
  return bondOrderSum * 2 + atom.lonePairs * 2
}

function computeClientWlColors(
  atoms: LewisAtom[],
  bonds: LewisBond[],
): { key: string; colors: number[] } {
  const n = atoms.length
  const totalCharge = atoms.reduce((s, a) => s + a.charge, 0)
  if (n === 0) return { key: 'empty', colors: [] }

  const indexById = new Map(atoms.map((a, i) => [a.id, i]))
  const adj: Array<Array<{ to: number; order: number }>> = Array.from(
    { length: n },
    () => [],
  )
  const edges: Array<{ u: number; v: number; order: number }> = []
  const seen = new Set<string>()
  for (const b of bonds) {
    const u = indexById.get(b.from)
    const v = indexById.get(b.to)
    if (u === undefined || v === undefined || u === v) continue
    const pk = u < v ? `${u}:${v}` : `${v}:${u}`
    if (seen.has(pk)) continue
    seen.add(pk)
    adj[u].push({ to: v, order: b.order })
    adj[v].push({ to: u, order: b.order })
    edges.push({ u, v, order: b.order })
  }

  const uniqueInit = [...new Set(atoms.map((a) => a.symbol))].sort()
  const initRank = new Map(uniqueInit.map((s, i) => [s, i]))
  let colors = atoms.map((a) => initRank.get(a.symbol)!)

  for (let iter = 0; iter < 6; iter++) {
    const sigs = colors.map((col, i) => {
      const neigh = adj[i]
        .map((e) => `${e.order}:${colors[e.to]}`)
        .sort()
        .join(',')
      return `${col}|${neigh}`
    })
    const uniq = [...new Set(sigs)].sort()
    const rank = new Map(uniq.map((s, i) => [s, i]))
    colors = sigs.map((s) => rank.get(s)!)
  }

  const nodePart = atoms
    .map((a, i) => `${colors[i]}:${a.symbol}`)
    .sort()
    .join(',')
  const edgePart = edges
    .map(({ u, v, order }) => {
      const cu = colors[u]
      const cv = colors[v]
      const [a, b] = cu <= cv ? [cu, cv] : [cv, cu]
      return `${a}-${b}:${order}`
    })
    .sort()
    .join(',')
  return { key: `q=${totalCharge}|n=[${nodePart}]|e=[${edgePart}]`, colors }
}

/**
 * Copies expected lone pairs and formal charges onto the user's drawn atoms
 * without moving their coordinates when bond topology matches; falls back to
 * replacing with a centered copy of `expected` if bond orders differ.
 */
export function applyExpectedLewisToDrawing(
  drawnAtoms: LewisAtom[],
  drawnBonds: LewisBond[],
  expected: LewisStructure,
  canvasCenter: { x: number; y: number },
): { atoms: LewisAtom[]; bonds: LewisBond[] } {
  const dr = computeClientWlColors(drawnAtoms, drawnBonds)
  const ex = computeClientWlColors(expected.atoms, expected.bonds)

  if (dr.key === ex.key) {
    const expQueues = new Map<number, Array<{ lonePairs: number; charge: number }>>()
    expected.atoms.forEach((a, i) => {
      const col = ex.colors[i]
      const q = expQueues.get(col) ?? []
      q.push({ lonePairs: a.lonePairs, charge: a.charge })
      expQueues.set(col, q)
    })

    const nextAtoms = drawnAtoms.map((a, i) => {
      const queue = expQueues.get(dr.colors[i])
      const target = queue?.shift()
      return target
        ? { ...a, lonePairs: target.lonePairs, charge: target.charge }
        : a
    })
    return { atoms: nextAtoms, bonds: drawnBonds }
  }

  // Fallback when bond orders differed: place reference Lewis cleanly at canvas center
  const scale = 1.15
  const atoms = expected.atoms.map((a, idx) => ({
    ...a,
    id: `ref_${idx}_${Date.now().toString(36)}`,
    x: Math.round(canvasCenter.x + a.x * scale),
    y: Math.round(canvasCenter.y + a.y * scale),
  }))
  const idMap = new Map(expected.atoms.map((a, idx) => [a.id, atoms[idx].id]))
  const bonds = expected.bonds.map((b) => ({
    from: idMap.get(b.from) ?? b.from,
    to: idMap.get(b.to) ?? b.to,
    order: b.order,
  }))
  return { atoms, bonds }
}

