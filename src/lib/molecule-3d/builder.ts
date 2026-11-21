import type { LewisAtom } from '../../../shared/chemistry.ts'
import type { AtomVseprInfo, Vec3 } from './types'
import { getTargetBondLength, getVdwRadius } from './constants'
import { vAdd, vCross, vDot, vLen, vNorm, vScale, vSub } from './vec3'
import { getChildVseprDirections, getRootVseprDirections } from './vsepr'

/**
 * Seed 3D coordinates for a connected component using VSEPR rules and ring puckering,
 * then apply fast deterministic UFF-like force-field relaxation.
 */
export function buildComponent3D(
  compIndices: number[],
  atoms: LewisAtom[],
  adj: Array<Array<{ to: number; order: 1 | 2 | 3 }>>,
  vsepr: AtomVseprInfo[],
  inRing: boolean[],
): Map<number, Vec3> {
  const pos = new Map<number, Vec3>()
  if (compIndices.length === 0) return pos
  if (compIndices.length === 1) {
    pos.set(compIndices[0], { x: 0, y: 0, z: 0 })
    return pos
  }

  const ringNodes = compIndices.filter((i) => inRing[i])

  // Step 1: Seed coordinates
  if (ringNodes.length >= 3) {
    let bondDistSum = 0
    let bondDistCount = 0
    for (const u of ringNodes) {
      for (const e of adj[u]) {
        if (e.to > u && inRing[e.to]) {
          const d2d = Math.hypot(
            atoms[e.to].x - atoms[u].x,
            atoms[e.to].y - atoms[u].y,
          )
          if (d2d > 1e-3) {
            bondDistSum += d2d
            bondDistCount++
          }
        }
      }
    }
    const avg2d = bondDistCount > 0 ? bondDistSum / bondDistCount : 48
    const scale = 1.46 / avg2d
    let cx = 0
    let cy = 0
    for (const u of ringNodes) {
      cx += atoms[u].x
      cy += atoms[u].y
    }
    cx /= ringNodes.length
    cy /= ringNodes.length

    const parity = new Map<number, number>()
    for (const start of ringNodes) {
      if (parity.has(start)) continue
      const q = [start]
      parity.set(start, 1)
      let h = 0
      while (h < q.length) {
        const cur = q[h++]
        const p = parity.get(cur) ?? 1
        for (const nb of adj[cur]) {
          if (inRing[nb.to] && !parity.has(nb.to)) {
            parity.set(nb.to, -p)
            q.push(nb.to)
          }
        }
      }
    }

    for (const u of ringNodes) {
      const isSp3Ring = !vsepr[u].isPlanarSp2 && !vsepr[u].isLinear
      const zPucker = isSp3Ring ? (parity.get(u) ?? 1) * 0.25 : 0
      pos.set(u, {
        x: (atoms[u].x - cx) * scale,
        y: -(atoms[u].y - cy) * scale,
        z: zPucker,
      })
    }

    const queue = [...ringNodes]
    let head = 0
    while (head < queue.length) {
      const u = queue[head++]
      const uPos = pos.get(u)!
      const placedDirs: Vec3[] = []
      const unplacedEdges: Array<{ to: number; order: 1 | 2 | 3 }> = []
      for (const e of adj[u]) {
        const nbPos = pos.get(e.to)
        if (nbPos) {
          placedDirs.push(vSub(nbPos, uPos))
        } else {
          unplacedEdges.push(e)
        }
      }
      if (unplacedEdges.length === 0) continue

      unplacedEdges.sort((a, b) => adj[b.to].length - adj[a.to].length)
      const dirs = getChildVseprDirections(placedDirs, unplacedEdges.length, vsepr[u])
      for (let i = 0; i < unplacedEdges.length; i++) {
        const edge = unplacedEdges[i]
        const len = getTargetBondLength(atoms[u].symbol, atoms[edge.to].symbol, edge.order)
        pos.set(edge.to, vAdd(uPos, vScale(dirs[i], len)))
        queue.push(edge.to)
      }
    }
  } else {
    let root = compIndices[0]
    let bestScore = -1
    for (const idx of compIndices) {
      const deg = adj[idx].length
      const heavyBonus = atoms[idx].symbol === 'H' ? 0 : 10
      const score = deg * 100 + heavyBonus
      if (score > bestScore) {
        bestScore = score
        root = idx
      }
    }

    pos.set(root, { x: 0, y: 0, z: 0 })
    const rootEdges = [...adj[root]].sort((a, b) => adj[b.to].length - adj[a.to].length)
    const rootDirs = getRootVseprDirections(vsepr[root])
    const queue: Array<{ idx: number; parent: number; refVec?: Vec3 }> = []

    for (let i = 0; i < rootEdges.length; i++) {
      const edge = rootEdges[i]
      const len = getTargetBondLength(atoms[root].symbol, atoms[edge.to].symbol, edge.order)
      const dir = rootDirs[i] ?? { x: 1, y: 0, z: 0 }
      pos.set(edge.to, vScale(dir, len))
      const siblingDir = rootDirs[(i + 1) % rootDirs.length]
      queue.push({ idx: edge.to, parent: root, refVec: siblingDir })
    }

    let head = 0
    while (head < queue.length) {
      const { idx: u, parent, refVec } = queue[head++]
      const uPos = pos.get(u)!
      const pPos = pos.get(parent)!
      const unplacedEdges = adj[u]
        .filter((e) => !pos.has(e.to))
        .sort((a, b) => adj[b.to].length - adj[a.to].length)
      if (unplacedEdges.length === 0) continue

      const parentBond = adj[u].find((e) => e.to === parent)
      const isDoubleLink =
        parentBond?.order === 2 && vsepr[u].isPlanarSp2 && vsepr[parent].isPlanarSp2
      const incoming = [vSub(pPos, uPos)]
      const dirs = getChildVseprDirections(
        incoming,
        unplacedEdges.length,
        vsepr[u],
        refVec,
        isDoubleLink ? 0 : Math.PI / 3,
      )

      for (let i = 0; i < unplacedEdges.length; i++) {
        const edge = unplacedEdges[i]
        const len = getTargetBondLength(atoms[u].symbol, atoms[edge.to].symbol, edge.order)
        pos.set(edge.to, vAdd(uPos, vScale(dirs[i], len)))
        queue.push({ idx: edge.to, parent: u, refVec: vSub(pPos, uPos) })
      }
    }
  }

  for (const idx of compIndices) {
    if (!pos.has(idx)) {
      pos.set(idx, { x: Math.cos(idx), y: Math.sin(idx), z: 0 })
    }
  }

  // Step 2: Fast, deterministic 3D force-field relaxation
  const localN = compIndices.length
  if (localN <= 2) return pos

  const globalToLocal = new Map<number, number>()
  compIndices.forEach((g, l) => globalToLocal.set(g, l))

  const coords: Vec3[] = compIndices.map((g) => ({ ...pos.get(g)! }))
  const forces: Vec3[] = Array.from({ length: localN }, () => ({ x: 0, y: 0, z: 0 }))

  interface LocalBond {
    a: number
    b: number
    order: 1 | 2 | 3
    r0: number
  }
  const localBonds: LocalBond[] = []
  const bondedPairSet = new Set<number>()
  const oneThreePairSet = new Set<number>()

  for (let la = 0; la < localN; la++) {
    const ga = compIndices[la]
    for (const e of adj[ga]) {
      const lb = globalToLocal.get(e.to)
      if (lb === undefined || lb <= la) continue
      localBonds.push({
        a: la,
        b: lb,
        order: e.order,
        r0: getTargetBondLength(atoms[ga].symbol, atoms[e.to].symbol, e.order),
      })
      bondedPairSet.add(la * localN + lb)
      bondedPairSet.add(lb * localN + la)
    }
  }

  interface AngleTerm {
    center: number
    i: number
    j: number
    cosTarget: number
    isMultiAngle: boolean
  }
  const angleTerms: AngleTerm[] = []
  const planarCenters: Array<{ center: number; nbs: number[] }> = []

  for (let lc = 0; lc < localN; lc++) {
    const gc = compIndices[lc]
    const info = vsepr[gc]
    const nbs = adj[gc]
      .map((e) => globalToLocal.get(e.to))
      .filter((x): x is number => x !== undefined)

    if (nbs.length < 2) continue

    for (let a = 0; a < nbs.length; a++) {
      for (let b = a + 1; b < nbs.length; b++) {
        const i = nbs[a]
        const j = nbs[b]
        oneThreePairSet.add(i * localN + j)
        oneThreePairSet.add(j * localN + i)
        angleTerms.push({
          center: lc,
          i,
          j,
          cosTarget: Math.cos((info.idealAngleDeg * Math.PI) / 180),
          isMultiAngle: info.stericNumber >= 5 && !info.isLinear,
        })
      }
    }

    if (info.isPlanarSp2 && nbs.length === 3) {
      planarCenters.push({ center: lc, nbs })
    }
  }

  const doubleBondPlanes: Array<{
    u: number
    v: number
    uNbs: number[]
    vNbs: number[]
  }> = []
  for (const b of localBonds) {
    if (b.order !== 2) continue
    const gu = compIndices[b.a]
    const gv = compIndices[b.b]
    if (!vsepr[gu].isPlanarSp2 || !vsepr[gv].isPlanarSp2) continue
    const uNbs = adj[gu]
      .map((e) => globalToLocal.get(e.to))
      .filter((x): x is number => x !== undefined && x !== b.b)
    const vNbs = adj[gv]
      .map((e) => globalToLocal.get(e.to))
      .filter((x): x is number => x !== undefined && x !== b.a)
    if (uNbs.length >= 1 && vNbs.length >= 1) {
      doubleBondPlanes.push({ u: b.a, v: b.b, uNbs, vNbs })
    }
  }

  const vdwRadii = compIndices.map((g) => getVdwRadius(atoms[g].symbol))
  const iterations = localN > 50 ? 90 : 150

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < localN; i++) {
      forces[i].x = 0
      forces[i].y = 0
      forces[i].z = 0
    }

    // 1. Bond stretching
    for (const b of localBonds) {
      const pa = coords[b.a]
      const pb = coords[b.b]
      const dx = pb.x - pa.x
      const dy = pb.y - pa.y
      const dz = pb.z - pa.z
      const dist = Math.hypot(dx, dy, dz) || 1e-4
      const f = (0.9 * (dist - b.r0)) / dist
      forces[b.a].x += f * dx
      forces[b.a].y += f * dy
      forces[b.a].z += f * dz
      forces[b.b].x -= f * dx
      forces[b.b].y -= f * dy
      forces[b.b].z -= f * dz
    }

    // 2. VSEPR angle bending
    for (const ang of angleTerms) {
      const pc = coords[ang.center]
      const u = vSub(coords[ang.i], pc)
      const v = vSub(coords[ang.j], pc)
      const lu = vLen(u)
      const lv = vLen(v)
      if (lu < 1e-4 || lv < 1e-4) continue
      const uHat = vScale(u, 1 / lu)
      const vHat = vScale(v, 1 / lv)
      const cosCur = Math.max(-1, Math.min(1, vDot(uHat, vHat)))

      let cosTarget = ang.cosTarget
      if (ang.isMultiAngle) {
        if (cosCur < -0.65) cosTarget = -1
        else if (cosCur < -0.25) cosTarget = -0.5
        else cosTarget = 0
      }

      const delta = cosCur - cosTarget
      const k = 0.28
      const dCosDu = vScale(vSub(vHat, vScale(uHat, cosCur)), 1 / lu)
      const dCosDv = vScale(vSub(uHat, vScale(vHat, cosCur)), 1 / lv)
      const fi = vScale(dCosDu, -k * delta)
      const fj = vScale(dCosDv, -k * delta)

      forces[ang.i].x += fi.x
      forces[ang.i].y += fi.y
      forces[ang.i].z += fi.z
      forces[ang.j].x += fj.x
      forces[ang.j].y += fj.y
      forces[ang.j].z += fj.z
      forces[ang.center].x -= fi.x + fj.x
      forces[ang.center].y -= fi.y + fj.y
      forces[ang.center].z -= fi.z + fj.z
    }

    // 3. Planarity for sp² trigonal centers
    for (const pl of planarCenters) {
      const pc = coords[pl.center]
      const p0 = coords[pl.nbs[0]]
      const nVec = vCross(vSub(coords[pl.nbs[1]], p0), vSub(coords[pl.nbs[2]], p0))
      const nLen = vLen(nVec)
      if (nLen < 1e-4) continue
      const nHat = vScale(nVec, 1 / nLen)
      const signedDist = vDot(vSub(pc, p0), nHat)
      const f = -0.3 * signedDist
      forces[pl.center].x += f * nHat.x
      forces[pl.center].y += f * nHat.y
      forces[pl.center].z += f * nHat.z
      const share = -f / 3
      for (const nb of pl.nbs) {
        forces[nb].x += share * nHat.x
        forces[nb].y += share * nHat.y
        forces[nb].z += share * nHat.z
      }
    }

    // 4. Coplanarity across sp²=sp² double bonds
    for (const db of doubleBondPlanes) {
      const pu = coords[db.u]
      const pv = coords[db.v]
      const axis = vNorm(vSub(pv, pu))
      const nU = vCross(axis, vSub(coords[db.uNbs[0]], pu))
      const nV = vCross(axis, vSub(coords[db.vNbs[0]], pv))
      if (vLen(nU) < 1e-4 || vLen(nV) < 1e-4) continue
      const hU = vNorm(nU)
      let hV = vNorm(nV)
      if (vDot(hU, hV) < 0) hV = vScale(hV, -1)
      const avgNormal = vNorm(vAdd(hU, hV))
      for (const idx of db.uNbs) {
        const d = vDot(vSub(coords[idx], pu), avgNormal)
        forces[idx].x -= 0.16 * d * avgNormal.x
        forces[idx].y -= 0.16 * d * avgNormal.y
        forces[idx].z -= 0.16 * d * avgNormal.z
      }
      for (const idx of db.vNbs) {
        const d = vDot(vSub(coords[idx], pv), avgNormal)
        forces[idx].x -= 0.16 * d * avgNormal.x
        forces[idx].y -= 0.16 * d * avgNormal.y
        forces[idx].z -= 0.16 * d * avgNormal.z
      }
    }

    // 5. Soft steric repulsion for non-bonded atoms
    for (let i = 0; i < localN; i++) {
      for (let j = i + 1; j < localN; j++) {
        const key = i * localN + j
        if (bondedPairSet.has(key) || oneThreePairSet.has(key)) continue
        const dx = coords[j].x - coords[i].x
        const dy = coords[j].y - coords[i].y
        const dz = coords[j].z - coords[i].z
        const distSq = dx * dx + dy * dy + dz * dz
        const minDist = 0.72 * (vdwRadii[i] + vdwRadii[j])
        if (distSq >= minDist * minDist) continue
        const dist = Math.sqrt(distSq) || 0.05
        const push = (0.14 * (minDist - dist)) / dist
        forces[i].x -= push * dx
        forces[i].y -= push * dy
        forces[i].z -= push * dz
        forces[j].x += push * dx
        forces[j].y += push * dy
        forces[j].z += push * dz
      }
    }

    const stepScale = iter < iterations * 0.6 ? 0.32 : 0.18
    const maxStep = 0.09
    for (let i = 0; i < localN; i++) {
      let sx = forces[i].x * stepScale
      let sy = forces[i].y * stepScale
      let sz = forces[i].z * stepScale
      const mag = Math.hypot(sx, sy, sz)
      if (mag > maxStep) {
        const r = maxStep / mag
        sx *= r
        sy *= r
        sz *= r
      }
      coords[i].x += sx
      coords[i].y += sy
      coords[i].z += sz
    }
  }

  for (let i = 0; i < localN; i++) {
    pos.set(compIndices[i], coords[i])
  }
  return pos
}
