export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Atom3D {
  id: string
  symbol: string
  charge: number
  position: Vec3
  covalentRadius: number
  vdwRadius: number
  colorHex: string
}

export interface Bond3D {
  fromIndex: number
  toIndex: number
  order: 1 | 2 | 3
  lengthAngstrom: number
}

export interface Molecule3DModel {
  atoms: Atom3D[]
  bonds: Bond3D[]
  /** Bounding sphere radius including Van der Waals shells (in Å) */
  boundingRadiusVdw: number
  /** Bounding sphere radius in ball-and-stick mode (in Å) */
  boundingRadiusBallStick: number
  /** Physical end-to-end molecular span including Van der Waals radii (in Å) */
  spanAngstrom: number
  /** Primary VSEPR geometry label for compact display (e.g. "Tétraédrique", "Coudée (104,5°)") */
  geometryLabelFr: string | null
  /** Representative bond angle of the central atom in degrees, if applicable */
  centralAngleDeg: number | null
  isIonic: boolean
}

export interface AtomVseprInfo {
  degree: number
  effectiveLonePairs: number
  stericNumber: number
  idealAngleDeg: number
  isPlanarSp2: boolean
  isLinear: boolean
  geometryNameFr: string | null
}
