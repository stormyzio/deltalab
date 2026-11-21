import type { Vec3 } from './types'

export function vAdd(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

export function vSub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

export function vScale(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s }
}

export function vDot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

export function vCross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

export function vLen(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z)
}

export function vNorm(a: Vec3): Vec3 {
  const l = vLen(a)
  if (l < 1e-8) return { x: 1, y: 0, z: 0 }
  return { x: a.x / l, y: a.y / l, z: a.z / l }
}

export function buildOrthonormalBasis(
  primary: Vec3,
  hint?: Vec3,
): { u: Vec3; v: Vec3; w: Vec3 } {
  const u = vNorm(primary)
  let ref = hint && vLen(hint) > 1e-5 ? vNorm(hint) : { x: 0, y: 0, z: 1 }
  if (Math.abs(vDot(u, ref)) > 0.94) {
    ref = Math.abs(u.x) < 0.85 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }
  }
  const v = vNorm(vCross(ref, u))
  const w = vNorm(vCross(u, v))
  return { u, v, w }
}

/**
 * Center positions at their geometric centroid and align principal inertia axes
 * so molecules face the camera cleanly.
 */
export function orientMoleculeToPrincipalAxes(positions: Vec3[]): void {
  const n = positions.length
  if (n <= 1) return

  let cx = 0
  let cy = 0
  let cz = 0
  for (const p of positions) {
    cx += p.x
    cy += p.y
    cz += p.z
  }
  cx /= n
  cy /= n
  cz /= n
  for (const p of positions) {
    p.x -= cx
    p.y -= cy
    p.z -= cz
  }

  if (n === 2) {
    const dir = vNorm(vSub(positions[1], positions[0]))
    const { u, v, w } = buildOrthonormalBasis(dir)
    for (const p of positions) {
      const nx = vDot(p, u)
      const ny = vDot(p, v)
      const nz = vDot(p, w)
      p.x = nx
      p.y = ny
      p.z = nz
    }
    return
  }

  // 3x3 symmetric covariance matrix + Jacobi eigendecomposition
  let xx = 0
  let xy = 0
  let xz = 0
  let yy = 0
  let yz = 0
  let zz = 0
  for (const p of positions) {
    xx += p.x * p.x
    xy += p.x * p.y
    xz += p.x * p.z
    yy += p.y * p.y
    yz += p.y * p.z
    zz += p.z * p.z
  }

  const m = [
    [xx, xy, xz],
    [xy, yy, yz],
    [xz, yz, zz],
  ]
  const eig = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ]

  for (let sweep = 0; sweep < 18; sweep++) {
    for (let p = 0; p < 3; p++) {
      for (let q = p + 1; q < 3; q++) {
        const mpq = m[p][q]
        if (Math.abs(mpq) < 1e-10) continue
        const tau = (m[q][q] - m[p][p]) / (2 * mpq)
        const t =
          tau >= 0
            ? 1 / (tau + Math.sqrt(1 + tau * tau))
            : -1 / (-tau + Math.sqrt(1 + tau * tau))
        const c = 1 / Math.sqrt(1 + t * t)
        const s = t * c
        const mpp = m[p][p]
        const mqq = m[q][q]
        m[p][p] = mpp - t * mpq
        m[q][q] = mqq + t * mpq
        m[p][q] = 0
        m[q][p] = 0
        for (let r = 0; r < 3; r++) {
          if (r === p || r === q) continue
          const mrp = m[r][p]
          const mrq = m[r][q]
          m[r][p] = c * mrp - s * mrq
          m[p][r] = m[r][p]
          m[r][q] = s * mrp + c * mrq
          m[q][r] = m[r][q]
        }
        for (let r = 0; r < 3; r++) {
          const erp = eig[r][p]
          const erq = eig[r][q]
          eig[r][p] = c * erp - s * erq
          eig[r][q] = s * erp + c * erq
        }
      }
    }
  }

  const axes = [0, 1, 2]
    .map((col) => ({
      val: m[col][col],
      vec: vNorm({ x: eig[0][col], y: eig[1][col], z: eig[2][col] }),
    }))
    .sort((a, b) => b.val - a.val)

  const axX = axes[0].vec
  const axY = axes[1].vec
  const axZ = vNorm(vCross(axX, axY))

  for (const p of positions) {
    const nx = vDot(p, axX)
    const ny = vDot(p, axY)
    const nz = vDot(p, axZ)
    p.x = nx
    p.y = ny
    p.z = nz
  }
}
