import type { LewisAtom } from '../../../shared/chemistry.ts'
import type { AtomVseprInfo, Vec3 } from './types'
import { buildOrthonormalBasis, vAdd, vCross, vLen, vNorm, vScale } from './vec3'

export function classifyAtomVsepr(
  idx: number,
  atoms: LewisAtom[],
  adj: Array<Array<{ to: number; order: 1 | 2 | 3 }>>,
  inRing: boolean[],
): AtomVseprInfo {
  const atom = atoms[idx]
  const neighbors = adj[idx]
  const degree = neighbors.length
  let lp = Math.max(0, Math.trunc(atom.lonePairs))

  // Detect resonance-delocalized lone pairs (amide/aniline N, aromatic ring heteroatoms)
  const hasMultipleBondNeighbor = neighbors.some((nb) =>
    adj[nb.to].some((b) => b.order >= 2 && b.to !== idx),
  )
  const hasOwnMultipleBond = neighbors.some((nb) => nb.order >= 2)
  if (
    lp > 0 &&
    !hasOwnMultipleBond &&
    hasMultipleBondNeighbor &&
    ((atom.symbol === 'N' && degree === 3 && lp === 1) ||
      (inRing[idx] &&
        (atom.symbol === 'O' || atom.symbol === 'S' || atom.symbol === 'N')))
  ) {
    lp = Math.max(0, lp - 1)
  }

  const sn = degree + lp

  if (degree <= 1) {
    return {
      degree,
      effectiveLonePairs: lp,
      stericNumber: sn,
      idealAngleDeg: 180,
      isPlanarSp2: false,
      isLinear: true,
      geometryNameFr: null,
    }
  }

  if (sn <= 2) {
    return {
      degree,
      effectiveLonePairs: lp,
      stericNumber: 2,
      idealAngleDeg: 180,
      isPlanarSp2: false,
      isLinear: true,
      geometryNameFr: 'Linéaire (180°)',
    }
  }

  if (sn === 3) {
    if (lp === 0) {
      return {
        degree,
        effectiveLonePairs: 0,
        stericNumber: 3,
        idealAngleDeg: 120,
        isPlanarSp2: true,
        isLinear: false,
        geometryNameFr: 'Trigonale plane (120°)',
      }
    }
    return {
      degree,
      effectiveLonePairs: 1,
      stericNumber: 3,
      idealAngleDeg: 118,
      isPlanarSp2: false,
      isLinear: false,
      geometryNameFr: 'Coudée (~118°)',
    }
  }

  if (sn === 4) {
    if (lp === 0) {
      return {
        degree,
        effectiveLonePairs: 0,
        stericNumber: 4,
        idealAngleDeg: 109.47,
        isPlanarSp2: false,
        isLinear: false,
        geometryNameFr: 'Tétraédrique (109,5°)',
      }
    }
    if (lp === 1) {
      return {
        degree,
        effectiveLonePairs: 1,
        stericNumber: 4,
        idealAngleDeg: 107,
        isPlanarSp2: false,
        isLinear: false,
        geometryNameFr: 'Pyramidale trigonale (107°)',
      }
    }
    const angle = atom.symbol === 'O' ? 104.5 : atom.symbol === 'S' ? 92.1 : 104.5
    return {
      degree,
      effectiveLonePairs: 2,
      stericNumber: 4,
      idealAngleDeg: angle,
      isPlanarSp2: false,
      isLinear: false,
      geometryNameFr:
        atom.symbol === 'O'
          ? 'Coudée (104,5°)'
          : atom.symbol === 'S'
            ? 'Coudée (92°)'
            : 'Coudée (104,5°)',
    }
  }

  if (sn === 5) {
    if (lp === 0) {
      return {
        degree,
        effectiveLonePairs: 0,
        stericNumber: 5,
        idealAngleDeg: 90,
        isPlanarSp2: false,
        isLinear: false,
        geometryNameFr: 'Bipyramidale trigonale',
      }
    }
    if (lp === 1) {
      return {
        degree,
        effectiveLonePairs: 1,
        stericNumber: 5,
        idealAngleDeg: 90,
        isPlanarSp2: false,
        isLinear: false,
        geometryNameFr: 'En bascule',
      }
    }
    if (lp === 2) {
      return {
        degree,
        effectiveLonePairs: 2,
        stericNumber: 5,
        idealAngleDeg: 90,
        isPlanarSp2: false,
        isLinear: false,
        geometryNameFr: 'En T (90°)',
      }
    }
    return {
      degree,
      effectiveLonePairs: 3,
      stericNumber: 5,
      idealAngleDeg: 180,
      isPlanarSp2: false,
      isLinear: true,
      geometryNameFr: 'Linéaire (180°)',
    }
  }

  // SN >= 6 (Octahedral family)
  if (lp === 0) {
    return {
      degree,
      effectiveLonePairs: 0,
      stericNumber: 6,
      idealAngleDeg: 90,
      isPlanarSp2: false,
      isLinear: false,
      geometryNameFr: 'Octaédrique (90°)',
    }
  }
  if (lp === 1) {
    return {
      degree,
      effectiveLonePairs: 1,
      stericNumber: 6,
      idealAngleDeg: 88,
      isPlanarSp2: false,
      isLinear: false,
      geometryNameFr: 'Pyramide à base carrée',
    }
  }
  return {
    degree,
    effectiveLonePairs: 2,
    stericNumber: 6,
    idealAngleDeg: 90,
    isPlanarSp2: true,
    isLinear: false,
    geometryNameFr: 'Plan carré (90°)',
  }
}

/** Return exact unit direction vectors for the bonded ligands around a root atom. */
export function getRootVseprDirections(info: AtomVseprInfo): Vec3[] {
  const { degree, effectiveLonePairs: lp, stericNumber: sn, idealAngleDeg } = info
  if (degree === 0) return []
  if (degree === 1) return [{ x: 1, y: 0, z: 0 }]

  if (sn <= 2) {
    return [
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
    ]
  }

  if (sn === 3) {
    if (degree === 2) {
      const half = ((idealAngleDeg / 2) * Math.PI) / 180
      return [
        { x: Math.sin(half), y: -Math.cos(half), z: 0 },
        { x: -Math.sin(half), y: -Math.cos(half), z: 0 },
      ]
    }
    return [0, 1, 2].map((k) => {
      const a = (k * 2 * Math.PI) / 3 + Math.PI / 2
      return { x: Math.cos(a), y: Math.sin(a), z: 0 }
    })
  }

  if (sn === 4) {
    if (degree === 2) {
      const half = ((idealAngleDeg / 2) * Math.PI) / 180
      return [
        { x: Math.sin(half), y: -Math.cos(half), z: 0 },
        { x: -Math.sin(half), y: -Math.cos(half), z: 0 },
      ]
    }
    if (degree === 3) {
      const sinHalf = Math.sin((idealAngleDeg * Math.PI) / 360)
      const sinCone = Math.min(0.99, (2 / Math.sqrt(3)) * sinHalf)
      const cosCone = Math.sqrt(Math.max(0.01, 1 - sinCone * sinCone))
      return [0, 1, 2].map((k) => {
        const phi = (k * 2 * Math.PI) / 3
        return {
          x: sinCone * Math.cos(phi),
          y: -cosCone,
          z: sinCone * Math.sin(phi),
        }
      })
    }
    const s = 1 / Math.sqrt(3)
    return [
      { x: s, y: s, z: s },
      { x: s, y: -s, z: -s },
      { x: -s, y: s, z: -s },
      { x: -s, y: -s, z: s },
    ]
  }

  if (sn === 5) {
    const axial: Vec3[] = [
      { x: 0, y: 1, z: 0 },
      { x: 0, y: -1, z: 0 },
    ]
    const eq: Vec3[] = [0, 1, 2].map((k) => {
      const a = (k * 2 * Math.PI) / 3
      return { x: Math.cos(a), y: 0, z: Math.sin(a) }
    })
    const eqCount = Math.max(0, 3 - lp)
    return [...axial, ...eq.slice(0, eqCount)].slice(0, degree)
  }

  const oct: Vec3[] = [
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
  ]
  if (degree <= oct.length) return oct.slice(0, degree)

  const dirs: Vec3[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < degree; i++) {
    const y = 1 - (i / Math.max(1, degree - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    dirs.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r })
  }
  return dirs
}

/**
 * Given already-placed incoming bond direction(s) from atom `u` to placed neighbor(s),
 * compute clean 3D unit vectors for the remaining `count` unplaced neighbors.
 */
export function getChildVseprDirections(
  incomingDirs: Vec3[],
  count: number,
  info: AtomVseprInfo,
  dihedralHint?: Vec3,
  staggerPhaseRad = Math.PI / 3,
): Vec3[] {
  if (count <= 0) return []

  if (incomingDirs.length === 1) {
    const inDir = vNorm(incomingDirs[0])
    const outAxis = vScale(inDir, -1)
    const { u, v, w } = buildOrthonormalBasis(outAxis, dihedralHint)

    if (info.isLinear || (info.stericNumber <= 2 && count === 1)) {
      return [u]
    }

    const thetaRad = (info.idealAngleDeg * Math.PI) / 180
    const coneRad = Math.max(0.15, Math.PI - thetaRad)
    const cosA = Math.cos(coneRad)
    const sinA = Math.sin(coneRad)

    if (count === 1) {
      const phase = info.isPlanarSp2 ? 0 : Math.PI
      const radial = vAdd(vScale(v, Math.cos(phase)), vScale(w, Math.sin(phase)))
      return [vNorm(vAdd(vScale(u, cosA), vScale(radial, sinA)))]
    }

    if (count === 2) {
      if (info.isPlanarSp2) {
        return [
          vNorm(vAdd(vScale(u, cosA), vScale(v, sinA))),
          vNorm(vAdd(vScale(u, cosA), vScale(v, -sinA))),
        ]
      }
      const phases = [staggerPhaseRad + Math.PI / 3, staggerPhaseRad - Math.PI / 3]
      return phases.map((ph) => {
        const radial = vAdd(vScale(v, Math.cos(ph)), vScale(w, Math.sin(ph)))
        return vNorm(vAdd(vScale(u, cosA), vScale(radial, sinA)))
      })
    }

    if (count === 3) {
      return [0, 1, 2].map((k) => {
        const ph = staggerPhaseRad + (k * 2 * Math.PI) / 3
        const radial = vAdd(vScale(v, Math.cos(ph)), vScale(w, Math.sin(ph)))
        return vNorm(vAdd(vScale(u, cosA), vScale(radial, sinA)))
      })
    }

    const dirs: Vec3[] = []
    if (count >= 4) {
      dirs.push(u)
      const rem = count - 1
      for (let k = 0; k < rem; k++) {
        const ph = (k * 2 * Math.PI) / rem
        dirs.push(vNorm(vAdd(vScale(v, Math.cos(ph)), vScale(w, Math.sin(ph)))))
      }
    }
    return dirs.slice(0, count)
  }

  if (incomingDirs.length === 2) {
    const d1 = vNorm(incomingDirs[0])
    const d2 = vNorm(incomingDirs[1])
    let bisector = vScale(vAdd(d1, d2), -1)
    if (vLen(bisector) < 1e-4) {
      bisector = buildOrthonormalBasis(d1).v
    } else {
      bisector = vNorm(bisector)
    }
    let normal = vCross(d1, d2)
    if (vLen(normal) < 1e-4) {
      normal = buildOrthonormalBasis(d1, bisector).w
    } else {
      normal = vNorm(normal)
    }

    if (count === 1) {
      if (info.isPlanarSp2) return [bisector]
      const lift = Math.sin((35 * Math.PI) / 180)
      const fwd = Math.cos((35 * Math.PI) / 180)
      return [vNorm(vAdd(vScale(bisector, fwd), vScale(normal, lift)))]
    }

    const half = ((info.idealAngleDeg / 2) * Math.PI) / 180
    const results: Vec3[] = [
      vNorm(vAdd(vScale(bisector, Math.cos(half)), vScale(normal, Math.sin(half)))),
      vNorm(vAdd(vScale(bisector, Math.cos(half)), vScale(normal, -Math.sin(half)))),
    ]
    for (let k = 2; k < count; k++) {
      results.push(vNorm(vAdd(bisector, vScale(normal, k % 2 === 0 ? 0.5 : -0.5))))
    }
    return results.slice(0, count)
  }

  let sum: Vec3 = { x: 0, y: 0, z: 0 }
  for (const d of incomingDirs) sum = vAdd(sum, vNorm(d))
  const away = vLen(sum) > 1e-4 ? vNorm(vScale(sum, -1)) : { x: 0, y: 0, z: 1 }
  if (count === 1) return [away]
  const { u, v, w } = buildOrthonormalBasis(away)
  return Array.from({ length: count }, (_, k) => {
    const ph = (k * 2 * Math.PI) / count
    return vNorm(
      vAdd(
        vScale(u, 0.7),
        vScale(vAdd(vScale(v, Math.cos(ph)), vScale(w, Math.sin(ph))), 0.7),
      ),
    )
  })
}

/** Mark atoms participating in any cycle of length <= 8. */
export function detectRingAtoms(
  n: number,
  adj: Array<Array<{ to: number; order: 1 | 2 | 3 }>>,
): boolean[] {
  const inRing = new Array<boolean>(n).fill(false)
  for (let u = 0; u < n; u++) {
    for (const edge of adj[u]) {
      const v = edge.to
      if (v <= u) continue
      const dist = new Int16Array(n).fill(-1)
      const parent = new Int16Array(n).fill(-1)
      const queue: number[] = [u]
      dist[u] = 0
      let found = false
      let head = 0
      while (head < queue.length && !found) {
        const cur = queue[head++]
        if (dist[cur] >= 7) continue
        for (const nb of adj[cur]) {
          if ((cur === u && nb.to === v) || (cur === v && nb.to === u)) continue
          if (dist[nb.to] !== -1) continue
          dist[nb.to] = dist[cur] + 1
          parent[nb.to] = cur
          if (nb.to === v) {
            found = true
            break
          }
          queue.push(nb.to)
        }
      }
      if (found) {
        let cur = v
        while (cur !== -1) {
          inRing[cur] = true
          cur = parent[cur]
        }
      }
    }
  }
  return inRing
}
