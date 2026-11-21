import type { LewisStructure } from '../../../shared/chemistry.ts'
import type { Atom3D, Bond3D, Molecule3DModel, Vec3 } from './types'
import { getCpkColor, getCovalentRadius, getVdwRadius } from './constants'
import { orientMoleculeToPrincipalAxes, vLen, vSub } from './vec3'
import { classifyAtomVsepr, detectRingAtoms } from './vsepr'
import { buildComponent3D } from './builder'

export type { Atom3D, Bond3D, Molecule3DModel, Vec3 } from './types'
export {
  COVALENT_RADIUS_ANGSTROM,
  CPK_COLOR_HEX,
  VDW_RADIUS_ANGSTROM,
  getCpkColor,
  getCovalentRadius,
  getTargetBondLength,
  getVdwRadius,
} from './constants'

/** Convert any LewisStructure into a real 3D Molecule3DModel. */
export function buildMolecule3DModel(structure: LewisStructure): Molecule3DModel {
  const { atoms, bonds } = structure
  const n = atoms.length

  if (n === 0) {
    return {
      atoms: [],
      bonds: [],
      boundingRadiusVdw: 1.5,
      boundingRadiusBallStick: 1.2,
      spanAngstrom: 0,
      geometryLabelFr: null,
      centralAngleDeg: null,
      isIonic: Boolean(structure.ionic),
    }
  }

  const indexById = new Map<string, number>()
  atoms.forEach((a, i) => indexById.set(a.id, i))

  const adj: Array<Array<{ to: number; order: 1 | 2 | 3 }>> = Array.from(
    { length: n },
    () => [],
  )
  const validBonds: Array<{ a: number; b: number; order: 1 | 2 | 3 }> = []

  for (const bond of bonds) {
    const a = indexById.get(bond.from)
    const b = indexById.get(bond.to)
    if (a === undefined || b === undefined || a === b) continue
    adj[a].push({ to: b, order: bond.order })
    adj[b].push({ to: a, order: bond.order })
    validBonds.push({ a, b, order: bond.order })
  }

  const inRing = detectRingAtoms(n, adj)
  const vsepr = atoms.map((_, idx) => classifyAtomVsepr(idx, atoms, adj, inRing))

  const visited = new Uint8Array(n)
  const components: number[][] = []
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue
    const comp: number[] = []
    const q = [i]
    visited[i] = 1
    let h = 0
    while (h < q.length) {
      const cur = q[h++]
      comp.push(cur)
      for (const e of adj[cur]) {
        if (!visited[e.to]) {
          visited[e.to] = 1
          q.push(e.to)
        }
      }
    }
    components.push(comp)
  }

  const finalPositions: Vec3[] = Array.from({ length: n }, () => ({ x: 0, y: 0, z: 0 }))

  if (components.length === 1) {
    const compPos = buildComponent3D(components[0], atoms, adj, vsepr, inRing)
    for (const [idx, p] of compPos.entries()) {
      finalPositions[idx] = p
    }
  } else {
    const compModels = components.map((comp) => {
      const map = buildComponent3D(comp, atoms, adj, vsepr, inRing)
      const pts = comp.map((idx) => map.get(idx)!)
      orientMoleculeToPrincipalAxes(pts)
      let maxR = 0
      for (let i = 0; i < comp.length; i++) {
        const r = vLen(pts[i]) + getVdwRadius(atoms[comp[i]].symbol) * 0.52
        if (r > maxR) maxR = r
      }
      return { comp, pts, radius: Math.max(0.95, maxR) }
    })

    compModels.sort((a, b) => b.comp.length - a.comp.length)

    let cursorX = 0
    const gap = 0.65
    for (let c = 0; c < compModels.length; c++) {
      const item = compModels[c]
      if (c > 0) cursorX += compModels[c - 1].radius + item.radius + gap
      for (let i = 0; i < item.comp.length; i++) {
        finalPositions[item.comp[i]] = {
          x: item.pts[i].x + cursorX,
          y: item.pts[i].y,
          z: item.pts[i].z,
        }
      }
    }
  }

  orientMoleculeToPrincipalAxes(finalPositions)

  const atoms3D: Atom3D[] = atoms.map((a, idx) => ({
    id: a.id,
    symbol: a.symbol,
    charge: a.charge,
    position: finalPositions[idx],
    covalentRadius: getCovalentRadius(a.symbol),
    vdwRadius: getVdwRadius(a.symbol),
    colorHex: getCpkColor(a.symbol),
  }))

  const bonds3D: Bond3D[] = validBonds.map((b) => ({
    fromIndex: b.a,
    toIndex: b.b,
    order: b.order,
    lengthAngstrom: vLen(vSub(finalPositions[b.b], finalPositions[b.a])),
  }))

  let maxRadiusVdw = 0.9
  let maxRadiusBallStick = 0.7
  for (const a of atoms3D) {
    const d = vLen(a.position)
    maxRadiusVdw = Math.max(maxRadiusVdw, d + a.vdwRadius)
    maxRadiusBallStick = Math.max(maxRadiusBallStick, d + a.vdwRadius * 0.34)
  }

  let spanAngstrom = 0
  if (atoms3D.length === 1) {
    spanAngstrom = atoms3D[0].vdwRadius * 2
  } else {
    for (let i = 0; i < atoms3D.length; i++) {
      for (let j = i + 1; j < atoms3D.length; j++) {
        const dist =
          vLen(vSub(atoms3D[j].position, atoms3D[i].position)) +
          atoms3D[i].vdwRadius +
          atoms3D[j].vdwRadius
        if (dist > spanAngstrom) spanAngstrom = dist
      }
    }
  }

  let geometryLabelFr: string | null = null
  let centralAngleDeg: number | null = null
  if (structure.ionic || components.length > 1) {
    geometryLabelFr = 'Composé ionique'
  } else if (n === 1) {
    geometryLabelFr = 'Sphérique'
  } else if (n === 2) {
    geometryLabelFr = 'Linéaire'
  } else {
    const centers = atoms
      .map((_, i) => i)
      .filter((i) => adj[i].length >= 2)
      .sort((a, b) => adj[b].length - adj[a].length)

    if (centers.length === 1) {
      geometryLabelFr = vsepr[centers[0]].geometryNameFr
      centralAngleDeg = vsepr[centers[0]].idealAngleDeg
    } else if (centers.length > 1) {
      const allRingSp2 =
        inRing.filter(Boolean).length >= 5 &&
        centers.every((c) => !inRing[c] || vsepr[c].isPlanarSp2)
      const allPlanar = centers.every(
        (c) => vsepr[c].isPlanarSp2 || vsepr[c].isLinear,
      )
      if (allRingSp2 && allPlanar) geometryLabelFr = 'Plane (aromatique)'
      else if (centers.every((c) => vsepr[c].isLinear)) geometryLabelFr = 'Linéaire'
      else if (allPlanar) geometryLabelFr = 'Plane'
      else if (inRing.some(Boolean)) geometryLabelFr = 'Cyclique 3D'
      else geometryLabelFr = '3D (VSEPR)'
    }
  }

  return {
    atoms: atoms3D,
    bonds: bonds3D,
    boundingRadiusVdw: maxRadiusVdw,
    boundingRadiusBallStick: maxRadiusBallStick,
    spanAngstrom,
    geometryLabelFr,
    centralAngleDeg,
    isIonic: Boolean(structure.ionic || components.length > 1),
  }
}
