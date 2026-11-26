import type {
  LewisAtom,
  LewisBond,
  LewisStructure,
} from '../../shared/chemistry.ts'
import type { SpeciesSeed } from './types.ts'

export const VALENCE_ELECTRONS: Record<string, number> = {
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
  Ga: 3,
  Ge: 4,
  As: 5,
  Se: 6,
  Br: 7,
  Kr: 8,
  Rb: 1,
  Sr: 2,
  In: 3,
  Sn: 4,
  Sb: 5,
  Te: 6,
  I: 7,
  Xe: 8,
  Cs: 1,
  Ba: 2,
  Tl: 3,
  Pb: 4,
  Bi: 5,
  Po: 6,
  At: 7,
  Rn: 8,
  Fr: 1,
  Ra: 2,
  Nh: 3,
  Fl: 4,
  Mc: 5,
  Lv: 6,
  Ts: 7,
  Og: 8,
}

const METAL_CATION_SYMBOLS = new Set([
  'Li',
  'Na',
  'K',
  'Rb',
  'Cs',
  'Be',
  'Mg',
  'Ca',
  'Sr',
  'Ba',
  'Al',
  'Ti',
  'Cr',
  'Mn',
  'Fe',
  'Co',
  'Ni',
  'Cu',
  'Zn',
  'Ag',
  'Sn',
  'Pb',
])

export function computeDefaultLonePairs(
  symbol: string,
  bondOrderSum: number,
  charge: number,
): number {
  if (bondOrderSum === 0 && charge > 0 && METAL_CATION_SYMBOLS.has(symbol)) {
    return 0
  }
  const v = VALENCE_ELECTRONS[symbol]
  if (v === undefined) return 0
  const nonBonding = v - bondOrderSum - charge
  if (nonBonding <= 0) return 0
  return Math.floor(nonBonding / 2)
}

interface RawBuilderAtom {
  id: string
  symbol: string
  x: number
  y: number
  charge: number
  lonePairs?: number
}

const BOND_LEN = 56
const H_LEN = 42

class LewisBuilder {
  private atoms: RawBuilderAtom[] = []
  private bonds: LewisBond[] = []
  private autoCounter = 0

  a(
    id: string,
    symbol: string,
    x: number,
    y: number,
    opts?: { charge?: number; lonePairs?: number },
  ): this {
    this.atoms.push({
      id,
      symbol,
      x,
      y,
      charge: opts?.charge ?? 0,
      lonePairs: opts?.lonePairs,
    })
    return this
  }

  b(from: string, to: string, order: 1 | 2 | 3 = 1): this {
    this.bonds.push({ from, to, order })
    return this
  }

  atomPos(id: string): { x: number; y: number } {
    const found = this.atoms.find((item) => item.id === id)
    if (!found) throw new Error(`LewisBuilder: unknown atom id ${id}`)
    return { x: found.x, y: found.y }
  }

  attach(
    parentId: string,
    symbol: string,
    angleDeg: number,
    dist = symbol === 'H' ? H_LEN : BOND_LEN,
    order: 1 | 2 | 3 = 1,
    opts?: { id?: string; charge?: number; lonePairs?: number },
  ): string {
    const pos = this.atomPos(parentId)
    const rad = (angleDeg * Math.PI) / 180
    const id = opts?.id ?? `${symbol.toLowerCase()}_${++this.autoCounter}`
    this.a(
      id,
      symbol,
      pos.x + Math.cos(rad) * dist,
      pos.y + Math.sin(rad) * dist,
      opts,
    )
    this.b(parentId, id, order)
    return id
  }

  attachHs(parentId: string, anglesDeg: number[], dist = H_LEN): this {
    for (const deg of anglesDeg) {
      this.attach(parentId, 'H', deg, dist, 1)
    }
    return this
  }

  attachOH(
    parentId: string,
    oAngleDeg: number,
    hAngleDeg?: number,
    oDist = BOND_LEN,
  ): string {
    const oId = this.attach(parentId, 'O', oAngleDeg, oDist, 1)
    this.attach(oId, 'H', hAngleDeg ?? oAngleDeg + 32, H_LEN, 1)
    return oId
  }

  attachCH3(parentId: string, cAngleDeg: number, dist = BOND_LEN): string {
    const cId = this.attach(parentId, 'C', cAngleDeg, dist, 1)
    this.attachHs(cId, [cAngleDeg - 65, cAngleDeg, cAngleDeg + 65], H_LEN - 2)
    return cId
  }

  build(opts?: { ionic?: boolean }): LewisStructure {
    const bondSums = new Map<string, number>()
    for (const bond of this.bonds) {
      bondSums.set(bond.from, (bondSums.get(bond.from) ?? 0) + bond.order)
      bondSums.set(bond.to, (bondSums.get(bond.to) ?? 0) + bond.order)
    }

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const atom of this.atoms) {
      minX = Math.min(minX, atom.x)
      maxX = Math.max(maxX, atom.x)
      minY = Math.min(minY, atom.y)
      maxY = Math.max(maxY, atom.y)
    }
    const cx = Number.isFinite(minX) ? (minX + maxX) / 2 : 0
    const cy = Number.isFinite(minY) ? (minY + maxY) / 2 : 0

    const atoms: LewisAtom[] = this.atoms.map((atom) => {
      const bSum = bondSums.get(atom.id) ?? 0
      const lonePairs =
        atom.lonePairs !== undefined
          ? atom.lonePairs
          : computeDefaultLonePairs(atom.symbol, bSum, atom.charge)
      return {
        id: atom.id,
        symbol: atom.symbol,
        x: Math.round((atom.x - cx) * 10) / 10,
        y: Math.round((atom.y - cy) * 10) / 10,
        lonePairs,
        charge: atom.charge,
      }
    })

    const totalCharge = atoms.reduce((sum, atom) => sum + atom.charge, 0)
    const structure: LewisStructure = {
      atoms,
      bonds: this.bonds.map((bond) => ({ ...bond })),
    }
    if (totalCharge !== 0) structure.totalCharge = totalCharge
    if (opts?.ionic) structure.ionic = true
    return structure
  }
}

function lb(): LewisBuilder {
  return new LewisBuilder()
}

function linear(
  items: Array<{
    symbol: string
    charge?: number
    lonePairs?: number
    bondAfter?: 1 | 2 | 3
  }>,
  step = BOND_LEN,
): LewisStructure {
  const g = lb()
  let x = 0
  items.forEach((item, idx) => {
    const id = `a${idx}`
    g.a(id, item.symbol, x, 0, {
      charge: item.charge,
      lonePairs: item.lonePairs,
    })
    if (idx > 0) {
      g.b(`a${idx - 1}`, id, items[idx - 1].bondAfter ?? 1)
    }
    const nextSym = items[idx + 1]?.symbol
    const isHBond = item.symbol === 'H' || nextSym === 'H'
    x += isHBond ? Math.min(step, 46) : step
  })
  return g.build()
}

function bent(
  center: { symbol: string; charge?: number; lonePairs?: number },
  left: { symbol: string; charge?: number; lonePairs?: number; order?: 1 | 2 | 3 },
  right: { symbol: string; charge?: number; lonePairs?: number; order?: 1 | 2 | 3 },
): LewisStructure {
  const g = lb()
  g.a('c', center.symbol, 0, -14, {
    charge: center.charge,
    lonePairs: center.lonePairs,
  })
  const dLeft = left.symbol === 'H' ? 46 : BOND_LEN
  const dRight = right.symbol === 'H' ? 46 : BOND_LEN
  g.attach('c', left.symbol, 142, dLeft, left.order ?? 1, {
    id: 'l',
    charge: left.charge,
    lonePairs: left.lonePairs,
  })
  g.attach('c', right.symbol, 38, dRight, right.order ?? 1, {
    id: 'r',
    charge: right.charge,
    lonePairs: right.lonePairs,
  })
  return g.build()
}

function trigonal(
  center: { symbol: string; charge?: number; lonePairs?: number },
  arms: Array<{
    symbol: string
    order?: 1 | 2 | 3
    charge?: number
    lonePairs?: number
    withH?: boolean
  }>,
): LewisStructure {
  const g = lb()
  g.a('c', center.symbol, 0, 0, {
    charge: center.charge,
    lonePairs: center.lonePairs,
  })
  const angles = [-90, 30, 150]
  arms.forEach((arm, idx) => {
    const angle = angles[idx]
    const dist = arm.symbol === 'H' ? H_LEN + 2 : BOND_LEN
    const id = g.attach('c', arm.symbol, angle, dist, arm.order ?? 1, {
      id: `arm${idx}`,
      charge: arm.charge,
      lonePairs: arm.lonePairs,
    })
    if (arm.withH) {
      const hAngle = angle === 150 ? 180 : angle === 30 ? 0 : -45
      g.attach(id, 'H', hAngle, H_LEN, 1)
    }
  })
  return g.build()
}

function cross4(
  center: { symbol: string; charge?: number; lonePairs?: number },
  arms: Array<{
    symbol: string
    order?: 1 | 2 | 3
    charge?: number
    lonePairs?: number
    withH?: boolean
  }>,
): LewisStructure {
  const g = lb()
  g.a('c', center.symbol, 0, 0, {
    charge: center.charge,
    lonePairs: center.lonePairs,
  })
  const angles = [-90, 90, 180, 0]
  arms.forEach((arm, idx) => {
    const angle = angles[idx]
    const dist = arm.symbol === 'H' ? H_LEN + 2 : BOND_LEN
    const id = g.attach('c', arm.symbol, angle, dist, arm.order ?? 1, {
      id: `arm${idx}`,
      charge: arm.charge,
      lonePairs: arm.lonePairs,
    })
    if (arm.withH) {
      const hAngle = angle === 180 ? 180 : angle === 0 ? 0 : angle === 90 ? 55 : -35
      g.attach(id, 'H', hAngle, H_LEN, 1)
    }
  })
  return g.build()
}

function alkaneChain(nCarbons: number): LewisStructure {
  const g = lb()
  const dx = 56
  for (let i = 0; i < nCarbons; i++) {
    const id = `c${i}`
    g.a(id, 'C', i * dx, 0)
    if (i > 0) g.b(`c${i - 1}`, id, 1)
    g.attach(id, 'H', -90, H_LEN, 1)
    g.attach(id, 'H', 90, H_LEN, 1)
    if (i === 0) g.attach(id, 'H', 180, H_LEN, 1)
    if (i === nCarbons - 1) g.attach(id, 'H', 0, H_LEN, 1)
  }
  return g.build()
}

function alcoholChain(nCarbons: number): LewisStructure {
  const g = lb()
  const dx = 56
  for (let i = 0; i < nCarbons; i++) {
    const id = `c${i}`
    g.a(id, 'C', i * dx, 0)
    if (i > 0) g.b(`c${i - 1}`, id, 1)
    g.attach(id, 'H', -90, H_LEN, 1)
    g.attach(id, 'H', 90, H_LEN, 1)
    if (i === 0) g.attach(id, 'H', 180, H_LEN, 1)
  }
  const oId = g.attach(`c${nCarbons - 1}`, 'O', 0, BOND_LEN, 1, { id: 'o_oh' })
  g.attach(oId, 'H', -30, H_LEN, 1)
  return g.build()
}

function ketoneChain(leftCarbons: number, rightCarbons: number): LewisStructure {
  const g = lb()
  const total = leftCarbons + 1 + rightCarbons
  const dx = 58
  for (let i = 0; i < total; i++) {
    const id = `c${i}`
    g.a(id, 'C', i * dx, 0)
    if (i > 0) g.b(`c${i - 1}`, id, 1)
    if (i === leftCarbons) {
      g.attach(id, 'O', -90, BOND_LEN, 2)
    } else {
      g.attach(id, 'H', -90, H_LEN, 1)
      g.attach(id, 'H', 90, H_LEN, 1)
      if (i === 0) g.attach(id, 'H', 180, H_LEN, 1)
      if (i === total - 1) g.attach(id, 'H', 0, H_LEN, 1)
    }
  }
  return g.build()
}

function carboxylicAcidChain(nCarbons: number): LewisStructure {
  const g = lb()
  const dx = 58
  for (let i = 0; i < nCarbons; i++) {
    const id = `c${i}`
    g.a(id, 'C', i * dx, 0)
    if (i > 0) g.b(`c${i - 1}`, id, 1)
    if (i < nCarbons - 1) {
      g.attach(id, 'H', -90, H_LEN, 1)
      g.attach(id, 'H', 90, H_LEN, 1)
      if (i === 0) g.attach(id, 'H', 180, H_LEN, 1)
    } else {
      g.attach(id, 'O', -55, BOND_LEN, 2)
      g.attachOH(id, 45, 5, BOND_LEN)
    }
  }
  return g.build()
}

function phenylBase(
  g: LewisBuilder,
  cx = 0,
  cy = 0,
  radius = 52,
  prefix = 'r',
): string[] {
  // Vertices 0..5 clockwise starting at right (0°), 60°, 120°, 180°, 240°, 300°
  const ids: string[] = []
  for (let i = 0; i < 6; i++) {
    const deg = i * 60
    const rad = (deg * Math.PI) / 180
    const id = `${prefix}${i}`
    g.a(id, 'C', cx + Math.cos(rad) * radius, cy + Math.sin(rad) * radius)
    ids.push(id)
  }
  for (let i = 0; i < 6; i++) {
    g.b(ids[i], ids[(i + 1) % 6], i % 2 === 0 ? 2 : 1)
  }
  return ids
}

function buildBenzene(): LewisStructure {
  const g = lb()
  const ids = phenylBase(g)
  for (let i = 0; i < 6; i++) {
    g.attach(ids[i], 'H', i * 60, H_LEN, 1)
  }
  return g.build()
}

function buildAspirin(): LewisStructure {
  const g = lb()
  const ids = phenylBase(g, 0, 0, 52)
  // H on positions 2, 3, 4, 5
  for (const i of [2, 3, 4, 5]) {
    g.attach(ids[i], 'H', i * 60, 38, 1)
  }
  // Position 0 (0°): -COOH
  const cAcid = g.attach(ids[0], 'C', -10, 54, 1)
  g.attach(cAcid, 'O', -65, 48, 2)
  g.attachOH(cAcid, 25, -10, 48)
  // Position 1 (60°): -O-C(=O)-CH3
  const oEst = g.attach(ids[1], 'O', 65, 50, 1)
  const cEst = g.attach(oEst, 'C', 20, 50, 1)
  g.attach(cEst, 'O', 80, 46, 2)
  g.attachCH3(cEst, -15, 52)
  return g.build()
}

function buildCitricAcid(): LewisStructure {
  // HOOC-CH2-C(OH)(COOH)-CH2-COOH (C6H8O7)
  const g = lb()
  g.a('c1', 'C', -120, 0)
  g.a('c2', 'C', -60, 0)
  g.a('c3', 'C', 0, 0)
  g.a('c4', 'C', 60, 0)
  g.a('c5', 'C', 120, 0)
  g.b('c1', 'c2', 1)
  g.b('c2', 'c3', 1)
  g.b('c3', 'c4', 1)
  g.b('c4', 'c5', 1)

  // C1: -COOH (left)
  g.attach('c1', 'O', -130, 46, 2)
  g.attachOH('c1', 135, 175, 46)
  // C2: -CH2-
  g.attachHs('c2', [-90, 90], 38)
  // C3: -OH (top) and -COOH (bottom)
  g.attachOH('c3', -90, -55, 46)
  const c6 = g.attach('c3', 'C', 90, 52, 1)
  g.attach(c6, 'O', 145, 44, 2)
  g.attachOH(c6, 40, 5, 44)
  // C4: -CH2-
  g.attachHs('c4', [-90, 90], 38)
  // C5: -COOH (right)
  g.attach('c5', 'O', -50, 46, 2)
  g.attachOH('c5', 45, 5, 46)
  return g.build()
}

function buildGlucose(): LewisStructure {
  // Open-chain D-glucose (aldose): CHO-(CHOH)4-CH2OH (C6H12O6)
  const g = lb()
  const dx = 64
  for (let i = 0; i < 6; i++) {
    const id = `c${i}`
    g.a(id, 'C', i * dx, 0)
    if (i > 0) g.b(`c${i - 1}`, id, 1)
  }
  // C0: aldehyde -CHO
  g.attach('c0', 'O', -135, 48, 2)
  g.attach('c0', 'H', 135, 40, 1)
  // C1..C4: alternating H / OH above and below for crisp legibility
  const ohAbove = [false, true, false, false]
  for (let i = 1; i <= 4; i++) {
    const up = ohAbove[i - 1]
    g.attachOH(`c${i}`, up ? -90 : 90, up ? -50 : 50, 46)
    g.attach(`c${i}`, 'H', up ? 90 : -90, 38, 1)
  }
  // C5: -CH2OH
  g.attach('c5', 'H', -90, 38, 1)
  g.attach('c5', 'H', 90, 38, 1)
  g.attachOH('c5', 0, -35, 46)
  return g.build()
}

function buildSucrose(): LewisStructure {
  // α-D-glucopyranosyl-(1→2)-β-D-fructofuranoside (C12H22O11)
  const g = lb()
  // Left pyranose ring (C1-C2-C3-C4-C5-O5) centered at (-95, 0)
  g.a('g1', 'C', -46, 0)
  g.a('g2', 'C', -72, 44)
  g.a('g3', 'C', -124, 44)
  g.a('g4', 'C', -150, 0)
  g.a('g5', 'C', -124, -44)
  g.a('go', 'O', -72, -44)
  g.b('g1', 'g2', 1)
  g.b('g2', 'g3', 1)
  g.b('g3', 'g4', 1)
  g.b('g4', 'g5', 1)
  g.b('g5', 'go', 1)
  g.b('go', 'g1', 1)

  g.attach('g1', 'H', -45, 34, 1)
  g.attach('g2', 'H', 25, 32, 1)
  g.attachOH('g2', 85, 50, 40)
  g.attach('g3', 'H', 150, 32, 1)
  g.attachOH('g3', 100, 135, 40)
  g.attach('g4', 'H', 145, 32, 1)
  g.attachOH('g4', 200, 165, 40)
  g.attach('g5', 'H', -150, 32, 1)
  const g6 = g.attach('g5', 'C', -100, 48, 1)
  g.attach(g6, 'H', -160, 32, 1)
  g.attach(g6, 'H', -40, 32, 1)
  g.attachOH(g6, -100, -65, 40)

  // Glycosidic bridge O
  g.a('ob', 'O', 0, 16)
  g.b('g1', 'ob', 1)

  // Right furanose ring (F2-F3-F4-F5-FO) centered at (+92, 0)
  g.a('f2', 'C', 48, 0)
  g.a('f3', 'C', 74, 46)
  g.a('f4', 'C', 126, 34)
  g.a('f5', 'C', 126, -24)
  g.a('fo', 'O', 76, -44)
  g.b('ob', 'f2', 1)
  g.b('f2', 'f3', 1)
  g.b('f3', 'f4', 1)
  g.b('f4', 'f5', 1)
  g.b('f5', 'fo', 1)
  g.b('fo', 'f2', 1)

  // F2 has -CH2OH (C1')
  const f1 = g.attach('f2', 'C', -110, 48, 1)
  g.attach(f1, 'H', -165, 32, 1)
  g.attach(f1, 'H', -55, 32, 1)
  g.attachOH(f1, -110, -75, 40)

  g.attach('f3', 'H', 135, 32, 1)
  g.attachOH('f3', 80, 45, 40)
  g.attach('f4', 'H', 90, 32, 1)
  g.attachOH('f4', 25, -10, 40)
  g.attach('f5', 'H', 20, 32, 1)
  const f6 = g.attach('f5', 'C', -55, 48, 1)
  g.attach(f6, 'H', -115, 32, 1)
  g.attach(f6, 'H', 5, 32, 1)
  g.attachOH(f6, -55, -20, 40)

  return g.build()
}

function buildS8(): LewisStructure {
  const g = lb()
  const r = 74
  for (let i = 0; i < 8; i++) {
    const rad = ((i * 45 - 90) * Math.PI) / 180
    g.a(`s${i}`, 'S', Math.cos(rad) * r, Math.sin(rad) * r)
  }
  for (let i = 0; i < 8; i++) {
    g.b(`s${i}`, `s${(i + 1) % 8}`, 1)
  }
  return g.build()
}

const COVALENT_AND_ION_LEWIS: Record<string, LewisStructure> = {
  // --- SOLVENT ---
  h2o: bent({ symbol: 'O' }, { symbol: 'H' }, { symbol: 'H' }),

  // --- POLYATOMIC IONS ---
  h3o_plus: trigonal(
    { symbol: 'O', charge: 1 },
    [{ symbol: 'H' }, { symbol: 'H' }, { symbol: 'H' }],
  ),
  nh4_plus: cross4(
    { symbol: 'N', charge: 1 },
    [{ symbol: 'H' }, { symbol: 'H' }, { symbol: 'H' }, { symbol: 'H' }],
  ),
  oh_minus: linear([{ symbol: 'O', charge: -1, bondAfter: 1 }, { symbol: 'H' }]),
  no3_minus: trigonal({ symbol: 'N', charge: 1 }, [
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 1, charge: -1 },
    { symbol: 'O', order: 1, charge: -1 },
  ]),
  so4_2minus: cross4({ symbol: 'S' }, [
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 1, charge: -1 },
    { symbol: 'O', order: 1, charge: -1 },
  ]),
  hso4_minus: cross4({ symbol: 'S' }, [
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 1, withH: true },
    { symbol: 'O', order: 1, charge: -1 },
  ]),
  co3_2minus: trigonal({ symbol: 'C' }, [
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 1, charge: -1 },
    { symbol: 'O', order: 1, charge: -1 },
  ]),
  hco3_minus: trigonal({ symbol: 'C' }, [
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 1, charge: -1 },
    { symbol: 'O', order: 1, withH: true },
  ]),
  po4_3minus: cross4({ symbol: 'P' }, [
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 1, charge: -1 },
    { symbol: 'O', order: 1, charge: -1 },
    { symbol: 'O', order: 1, charge: -1 },
  ]),
  h2po4_minus: cross4({ symbol: 'P' }, [
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 1, charge: -1 },
    { symbol: 'O', order: 1, withH: true },
    { symbol: 'O', order: 1, withH: true },
  ]),
  hpo4_2minus: cross4({ symbol: 'P' }, [
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 1, charge: -1 },
    { symbol: 'O', order: 1, withH: true },
    { symbol: 'O', order: 1, charge: -1 },
  ]),
  ch3coo_minus: (() => {
    const g = lb()
    g.a('c0', 'C', -32, 0)
    g.a('c1', 'C', 28, 0)
    g.b('c0', 'c1', 1)
    g.attachHs('c0', [-90, 90, 180], H_LEN)
    g.attach('c1', 'O', -50, BOND_LEN, 2)
    g.attach('c1', 'O', 50, BOND_LEN, 1, { charge: -1 })
    return g.build()
  })(),
  clo_minus: linear([
    { symbol: 'Cl', bondAfter: 1 },
    { symbol: 'O', charge: -1 },
  ]),
  mno4_minus: cross4({ symbol: 'Mn' }, [
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 1, charge: -1 },
  ]),
  cro4_2minus: cross4({ symbol: 'Cr' }, [
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 1, charge: -1 },
    { symbol: 'O', order: 1, charge: -1 },
  ]),
  cr2o7_2minus: (() => {
    const g = lb()
    g.a('o_b', 'O', 0, 10)
    g.a('cr1', 'Cr', -62, -6)
    g.a('cr2', 'Cr', 62, -6)
    g.b('cr1', 'o_b', 1)
    g.b('cr2', 'o_b', 1)
    g.attach('cr1', 'O', -90, 52, 2)
    g.attach('cr1', 'O', 110, 52, 2)
    g.attach('cr1', 'O', 180, 52, 1, { charge: -1 })
    g.attach('cr2', 'O', -90, 52, 2)
    g.attach('cr2', 'O', 70, 52, 2)
    g.attach('cr2', 'O', 0, 52, 1, { charge: -1 })
    return g.build()
  })(),
  s2o3_2minus: cross4({ symbol: 'S' }, [
    { symbol: 'S', order: 2 },
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 1, charge: -1 },
    { symbol: 'O', order: 1, charge: -1 },
  ]),
  s4o6_2minus: (() => {
    const g = lb()
    g.a('s1', 'S', -96, 0)
    g.a('s2', 'S', -32, 0)
    g.a('s3', 'S', 32, 0)
    g.a('s4', 'S', 96, 0)
    g.b('s1', 's2', 1)
    g.b('s2', 's3', 1)
    g.b('s3', 's4', 1)
    g.attach('s1', 'O', -90, 50, 2)
    g.attach('s1', 'O', 90, 50, 2)
    g.attach('s1', 'O', 180, 50, 1, { charge: -1 })
    g.attach('s4', 'O', -90, 50, 2)
    g.attach('s4', 'O', 90, 50, 2)
    g.attach('s4', 'O', 0, 50, 1, { charge: -1 })
    return g.build()
  })(),
  c2o4_2minus: (() => {
    const g = lb()
    g.a('c1', 'C', -32, 0)
    g.a('c2', 'C', 32, 0)
    g.b('c1', 'c2', 1)
    g.attach('c1', 'O', -130, 52, 2)
    g.attach('c1', 'O', 130, 52, 1, { charge: -1 })
    g.attach('c2', 'O', -50, 52, 2)
    g.attach('c2', 'O', 50, 52, 1, { charge: -1 })
    return g.build()
  })(),
  scn_minus: linear([
    { symbol: 'S', charge: -1, bondAfter: 1 },
    { symbol: 'C', bondAfter: 3 },
    { symbol: 'N' },
  ]),
  no2_minus: bent(
    { symbol: 'N' },
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 1, charge: -1 },
  ),

  // --- ACIDS & BASES (MOLECULAR) ---
  hcl: linear([{ symbol: 'H', bondAfter: 1 }, { symbol: 'Cl' }]),
  hf: linear([{ symbol: 'H', bondAfter: 1 }, { symbol: 'F' }]),
  hbr: linear([{ symbol: 'H', bondAfter: 1 }, { symbol: 'Br' }]),
  hi: linear([{ symbol: 'H', bondAfter: 1 }, { symbol: 'I' }]),
  hno3: trigonal({ symbol: 'N', charge: 1 }, [
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 1, charge: -1 },
    { symbol: 'O', order: 1, withH: true },
  ]),
  h2so4: cross4({ symbol: 'S' }, [
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 1, withH: true },
    { symbol: 'O', order: 1, withH: true },
  ]),
  h3po4: cross4({ symbol: 'P' }, [
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 1, withH: true },
    { symbol: 'O', order: 1, withH: true },
    { symbol: 'O', order: 1, withH: true },
  ]),
  h2co3: trigonal({ symbol: 'C' }, [
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 1, withH: true },
    { symbol: 'O', order: 1, withH: true },
  ]),
  nh3: trigonal({ symbol: 'N' }, [
    { symbol: 'H' },
    { symbol: 'H' },
    { symbol: 'H' },
  ]),
  ch3cooh: carboxylicAcidChain(2),
  c6h8o7: buildCitricAcid(),
  c2h2o4: (() => {
    const g = lb()
    g.a('c1', 'C', -32, 0)
    g.a('c2', 'C', 32, 0)
    g.b('c1', 'c2', 1)
    g.attach('c1', 'O', -130, 50, 2)
    g.attachOH('c1', 135, 175, 48)
    g.attach('c2', 'O', -50, 50, 2)
    g.attachOH('c2', 45, 5, 48)
    return g.build()
  })(),

  // --- INORGANIC MOLECULES & ELEMENTAL SUBSTANCES ---
  h2o2: (() => {
    const g = lb()
    g.a('o1', 'O', -30, 6)
    g.a('o2', 'O', 30, -6)
    g.b('o1', 'o2', 1)
    g.attach('o1', 'H', -130, 44, 1)
    g.attach('o2', 'H', 50, 44, 1)
    return g.build()
  })(),
  co2: linear([
    { symbol: 'O', bondAfter: 2 },
    { symbol: 'C', bondAfter: 2 },
    { symbol: 'O' },
  ]),
  sio2: linear([
    { symbol: 'O', bondAfter: 2 },
    { symbol: 'Si', bondAfter: 2 },
    { symbol: 'O' },
  ]),
  co: linear([
    { symbol: 'C', charge: -1, bondAfter: 3 },
    { symbol: 'O', charge: 1 },
  ]),
  h2: linear([{ symbol: 'H', bondAfter: 1 }, { symbol: 'H' }]),
  o2: linear([{ symbol: 'O', bondAfter: 2 }, { symbol: 'O' }]),
  n2: linear([{ symbol: 'N', bondAfter: 3 }, { symbol: 'N' }]),
  f2: linear([{ symbol: 'F', bondAfter: 1 }, { symbol: 'F' }]),
  cl2: linear([{ symbol: 'Cl', bondAfter: 1 }, { symbol: 'Cl' }]),
  br2: linear([{ symbol: 'Br', bondAfter: 1 }, { symbol: 'Br' }]),
  i2: linear([{ symbol: 'I', bondAfter: 1 }, { symbol: 'I' }]),
  o3: bent(
    { symbol: 'O', charge: 1 },
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 1, charge: -1 },
  ),
  so2: bent({ symbol: 'S' }, { symbol: 'O', order: 2 }, { symbol: 'O', order: 2 }),
  no: linear([{ symbol: 'N', bondAfter: 2, lonePairs: 1 }, { symbol: 'O' }]),
  no2: bent(
    { symbol: 'N', charge: 1, lonePairs: 0 },
    { symbol: 'O', order: 2 },
    { symbol: 'O', order: 1, charge: -1 },
  ),
  n2o: linear([
    { symbol: 'N', bondAfter: 3 },
    { symbol: 'N', charge: 1, bondAfter: 1 },
    { symbol: 'O', charge: -1 },
  ]),
  h2s: bent({ symbol: 'S' }, { symbol: 'H' }, { symbol: 'H' }),
  s8: buildS8(),

  // --- HYDROCARBONS ---
  ch4: cross4({ symbol: 'C' }, [
    { symbol: 'H' },
    { symbol: 'H' },
    { symbol: 'H' },
    { symbol: 'H' },
  ]),
  c2h6: alkaneChain(2),
  c2h4: (() => {
    const g = lb()
    g.a('c1', 'C', -32, 0)
    g.a('c2', 'C', 32, 0)
    g.b('c1', 'c2', 2)
    g.attachHs('c1', [-130, 130], 44)
    g.attachHs('c2', [-50, 50], 44)
    return g.build()
  })(),
  c2h2: linear([
    { symbol: 'H', bondAfter: 1 },
    { symbol: 'C', bondAfter: 3 },
    { symbol: 'C', bondAfter: 1 },
    { symbol: 'H' },
  ]),
  c3h8: alkaneChain(3),
  c4h10: alkaneChain(4),
  c6h6: buildBenzene(),

  // --- ALCOHOLS, KETONES, ETHERS, ESTERS ---
  ch4o: alcoholChain(1),
  c2h6o: alcoholChain(2),
  c3h6o: ketoneChain(1, 1),
  c4h10o: (() => {
    // Éther diéthylique: CH3-CH2-O-CH2-CH3
    const g = lb()
    g.a('c0', 'C', -116, 0)
    g.a('c1', 'C', -58, 0)
    g.a('o', 'O', 0, 0)
    g.a('c2', 'C', 58, 0)
    g.a('c3', 'C', 116, 0)
    g.b('c0', 'c1', 1)
    g.b('c1', 'o', 1)
    g.b('o', 'c2', 1)
    g.b('c2', 'c3', 1)
    g.attachHs('c0', [-90, 90, 180], H_LEN)
    g.attachHs('c1', [-90, 90], H_LEN)
    g.attachHs('c2', [-90, 90], H_LEN)
    g.attachHs('c3', [-90, 90, 0], H_LEN)
    return g.build()
  })(),
  c4h8o2: (() => {
    // Acétate d'éthyle: CH3-C(=O)-O-CH2-CH3
    const g = lb()
    g.a('c0', 'C', -116, 0)
    g.a('c1', 'C', -58, 0)
    g.a('o1', 'O', 0, 0)
    g.a('c2', 'C', 58, 0)
    g.a('c3', 'C', 116, 0)
    g.b('c0', 'c1', 1)
    g.b('c1', 'o1', 1)
    g.b('o1', 'c2', 1)
    g.b('c2', 'c3', 1)
    g.attachHs('c0', [-90, 90, 180], H_LEN)
    g.attach('c1', 'O', -90, 52, 2)
    g.attachHs('c2', [-90, 90], H_LEN)
    g.attachHs('c3', [-90, 90, 0], H_LEN)
    return g.build()
  })(),

  // --- BIOMOLECULES & DRUGS ---
  c6h12o6: buildGlucose(),
  c12h22o11: buildSucrose(),
  c9h8o4: buildAspirin(),

  // --- COORDINATION COMPLEXES ---
  cu_nh3_4_2plus: (() => {
    // Ion tétraamminecuivre(II): [Cu(NH3)4]2+ (complexe plan carré)
    const g = lb()
    g.a('cu', 'Cu', 0, 0, { charge: 2, lonePairs: 0 })
    const angles = [0, 90, 180, -90]
    for (const deg of angles) {
      const nId = g.attach('cu', 'N', deg, 64, 1, { charge: 0, lonePairs: 0 })
      g.attachHs(nId, [deg - 56, deg, deg + 56], 38)
    }
    return g.build()
  })(),
}

// Explicit ion decompositions for insoluble ionic compounds & oxides
// (where `aqueous.dissociatesInto` is absent or represents hydrolysis like CaO -> OH-)
const EXPLICIT_IONIC_UNITS: Record<
  string,
  Array<{ symbol?: string; charge?: number; ionId?: string; count: number }>
> = {
  cao: [
    { ionId: 'ca2_plus', count: 1 },
    { ionId: 'o2_minus', count: 1 },
  ],
  mgo: [
    { ionId: 'mg2_plus', count: 1 },
    { ionId: 'o2_minus', count: 1 },
  ],
  al2o3: [
    { ionId: 'al3_plus', count: 2 },
    { ionId: 'o2_minus', count: 3 },
  ],
  cuo: [
    { ionId: 'cu2_plus', count: 1 },
    { ionId: 'o2_minus', count: 1 },
  ],
  fe2o3: [
    { ionId: 'fe3_plus', count: 2 },
    { ionId: 'o2_minus', count: 3 },
  ],
  zno: [
    { ionId: 'zn2_plus', count: 1 },
    { ionId: 'o2_minus', count: 1 },
  ],
  mno2: [
    { symbol: 'Mn', charge: 4, count: 1 },
    { ionId: 'o2_minus', count: 2 },
  ],
  aloh3: [
    { ionId: 'al3_plus', count: 1 },
    { ionId: 'oh_minus', count: 3 },
  ],
  feoh2: [
    { ionId: 'fe2_plus', count: 1 },
    { ionId: 'oh_minus', count: 2 },
  ],
  feoh3: [
    { ionId: 'fe3_plus', count: 1 },
    { ionId: 'oh_minus', count: 3 },
  ],
  znoh2: [
    { ionId: 'zn2_plus', count: 1 },
    { ionId: 'oh_minus', count: 2 },
  ],
  cuoh2: [
    { ionId: 'cu2_plus', count: 1 },
    { ionId: 'oh_minus', count: 2 },
  ],
  caco3: [
    { ionId: 'ca2_plus', count: 1 },
    { ionId: 'co3_2minus', count: 1 },
  ],
  baso4: [
    { ionId: 'ba2_plus', count: 1 },
    { ionId: 'so4_2minus', count: 1 },
  ],
  agcl: [
    { ionId: 'ag_plus', count: 1 },
    { ionId: 'cl_minus', count: 1 },
  ],
  agbr: [
    { ionId: 'ag_plus', count: 1 },
    { ionId: 'br_minus', count: 1 },
  ],
  agi: [
    { ionId: 'ag_plus', count: 1 },
    { ionId: 'i_minus', count: 1 },
  ],
  pbi2: [
    { ionId: 'pb2_plus', count: 1 },
    { ionId: 'i_minus', count: 2 },
  ],
  cus: [
    { ionId: 'cu2_plus', count: 1 },
    { ionId: 's2_minus', count: 1 },
  ],
  fes: [
    { ionId: 'fe2_plus', count: 1 },
    { ionId: 's2_minus', count: 1 },
  ],
}

export function makeMonoatomicLewis(symbol: string, charge: number): LewisStructure {
  const lonePairs = computeDefaultLonePairs(symbol, 0, charge)
  const structure: LewisStructure = {
    atoms: [{ id: 'a0', symbol, x: 0, y: 0, lonePairs, charge }],
    bonds: [],
  }
  if (charge !== 0) structure.totalCharge = charge
  return structure
}

function combineIonicUnits(units: LewisStructure[]): LewisStructure {
  const atoms: LewisAtom[] = []
  const bonds: LewisBond[] = []

  // Measure bounding width of each ionic fragment
  const boxes = units.map((unit) => {
    let minX = Infinity
    let maxX = -Infinity
    for (const a of unit.atoms) {
      minX = Math.min(minX, a.x)
      maxX = Math.max(maxX, a.x)
    }
    const width = Math.max(36, maxX - minX + 36)
    return { minX, maxX, width }
  })

  const gap = 42
  const totalWidth =
    boxes.reduce((sum, box) => sum + box.width, 0) + gap * Math.max(0, units.length - 1)
  let cursorX = -totalWidth / 2

  units.forEach((unit, uIdx) => {
    const box = boxes[uIdx]
    const targetCenterX = cursorX + box.width / 2
    const currentCenterX = (box.minX + box.maxX) / 2
    const offsetX = targetCenterX - currentCenterX

    for (const a of unit.atoms) {
      atoms.push({
        ...a,
        id: `u${uIdx}_${a.id}`,
        x: Math.round((a.x + offsetX) * 10) / 10,
        y: a.y,
      })
    }
    for (const b of unit.bonds) {
      bonds.push({
        from: `u${uIdx}_${b.from}`,
        to: `u${uIdx}_${b.to}`,
        order: b.order,
      })
    }

    cursorX += box.width + gap
  })

  return {
    atoms,
    bonds,
    ionic: true,
  }
}

export function resolveSpeciesLewis(
  sp: SpeciesSeed,
  speciesById: Map<string, SpeciesSeed>,
): LewisStructure | null {
  if (sp.lewis) return sp.lewis

  const direct = COVALENT_AND_ION_LEWIS[sp.id]
  if (direct) return direct

  // Monoatomic ions (Na+, Cl-, Fe3+, O2-, etc.)
  const entries = Object.entries(sp.composition).filter(([, count]) => count > 0)
  if (entries.length === 1 && entries[0][1] === 1) {
    return makeMonoatomicLewis(entries[0][0], sp.charge ?? 0)
  }

  // Ionic compounds: explicit ion list or `aqueous.dissociatesInto`
  if (sp.kind === 'ionic_compound') {
    const explicit = EXPLICIT_IONIC_UNITS[sp.id]
    if (explicit) {
      const units: LewisStructure[] = []
      for (const item of explicit) {
        for (let k = 0; k < item.count; k++) {
          if (item.ionId) {
            const ionSeed = speciesById.get(item.ionId)
            const ionLewis = ionSeed ? resolveSpeciesLewis(ionSeed, speciesById) : null
            if (ionLewis) units.push(ionLewis)
          } else if (item.symbol) {
            units.push(makeMonoatomicLewis(item.symbol, item.charge ?? 0))
          }
        }
      }
      if (units.length > 0) return combineIonicUnits(units)
    }

    const diss = sp.aqueous?.dissociatesInto
    if (diss && diss.length > 0) {
      const units: LewisStructure[] = []
      for (const prod of diss) {
        const ionSeed = speciesById.get(prod.speciesId)
        if (!ionSeed) continue
        const ionLewis = resolveSpeciesLewis(ionSeed, speciesById)
        if (!ionLewis) continue
        const count = prod.stoichiometry ?? 1
        for (let k = 0; k < count; k++) {
          units.push(ionLewis)
        }
      }
      if (units.length > 0) return combineIonicUnits(units)
    }
  }

  return null
}

// --- WEISFEILER-LEHMAN CANONICAL TOPOLOGY HASHING ---

export interface TopologyAnalysis {
  key: string
  colors: number[]
  totalCharge: number
}

export function analyzeLewisTopology(
  atoms: LewisAtom[],
  bonds: LewisBond[],
  ignoreBondOrder = false,
): TopologyAnalysis {
  const n = atoms.length
  const totalCharge = atoms.reduce((sum, atom) => sum + (atom.charge || 0), 0)
  if (n === 0) {
    return { key: `q=${totalCharge}|n=[]|e=[]`, colors: [], totalCharge }
  }

  const indexById = new Map<string, number>()
  atoms.forEach((atom, i) => indexById.set(atom.id, i))

  const adj: Array<Array<{ to: number; order: number }>> = Array.from(
    { length: n },
    () => [],
  )
  const validBonds: Array<{ u: number; v: number; order: number }> = []
  const seenEdge = new Set<string>()

  for (const bond of bonds) {
    const u = indexById.get(bond.from)
    const v = indexById.get(bond.to)
    if (u === undefined || v === undefined || u === v) continue
    const pairKey = u < v ? `${u}:${v}` : `${v}:${u}`
    if (seenEdge.has(pairKey)) continue
    seenEdge.add(pairKey)
    const order = ignoreBondOrder ? 1 : bond.order
    adj[u].push({ to: v, order })
    adj[v].push({ to: u, order })
    validBonds.push({ u, v, order })
  }

  // Initial color compression from element symbols
  const initialLabels = atoms.map((a) => a.symbol)
  const uniqueInit = [...new Set(initialLabels)].sort()
  const initRank = new Map(uniqueInit.map((label, idx) => [label, idx]))
  let colors = initialLabels.map((label) => initRank.get(label)!)

  // 6 rounds of Weisfeiler-Lehman color refinement
  for (let iter = 0; iter < 6; iter++) {
    const nextSigs = colors.map((col, i) => {
      const neigh = adj[i]
        .map((edge) => `${edge.order}:${colors[edge.to]}`)
        .sort()
        .join(',')
      return `${col}|${neigh}`
    })
    const uniqueSigs = [...new Set(nextSigs)].sort()
    const rankMap = new Map(uniqueSigs.map((sig, idx) => [sig, idx]))
    colors = nextSigs.map((sig) => rankMap.get(sig)!)
  }

  const nodePart = atoms
    .map((atom, i) => `${colors[i]}:${atom.symbol}`)
    .sort()
    .join(',')
  const edgePart = validBonds
    .map(({ u, v, order }) => {
      const cu = colors[u]
      const cv = colors[v]
      const [a, b] = cu <= cv ? [cu, cv] : [cv, cu]
      return `${a}-${b}:${order}`
    })
    .sort()
    .join(',')

  return {
    key: `q=${totalCharge}|n=[${nodePart}]|e=[${edgePart}]`,
    colors,
    totalCharge,
  }
}

export function computeLewisTopologyKey(
  atoms: LewisAtom[],
  bonds: LewisBond[],
  ignoreBondOrder = false,
): string {
  return analyzeLewisTopology(atoms, bonds, ignoreBondOrder).key
}

export function validateLewisElectrons(
  drawn: { atoms: LewisAtom[]; bonds: LewisBond[] },
  expected: LewisStructure,
): { exactLewisValid: boolean; issuesFr: string[] } {
  const drawnInfo = analyzeLewisTopology(drawn.atoms, drawn.bonds, false)
  const expectedInfo = analyzeLewisTopology(expected.atoms, expected.bonds, false)

  const issuesFr: string[] = []
  if (drawnInfo.key !== expectedInfo.key) {
    issuesFr.push(
      'L’ordre des liaisons (simples, doubles ou triples) ne correspond pas au schéma de Lewis attendu.',
    )
    return { exactLewisValid: false, issuesFr }
  }

  // Group (lonePairs, charge) multisets by canonical WL orbit color
  const groupOrbit = (atoms: LewisAtom[], colors: number[]) => {
    const map = new Map<
      number,
      { symbol: string; entries: Array<{ lonePairs: number; charge: number }> }
    >()
    atoms.forEach((atom, i) => {
      const col = colors[i]
      const bucket = map.get(col) ?? { symbol: atom.symbol, entries: [] }
      bucket.entries.push({ lonePairs: atom.lonePairs, charge: atom.charge })
      map.set(col, bucket)
    })
    for (const bucket of map.values()) {
      bucket.entries.sort((a, b) =>
        a.charge !== b.charge ? a.charge - b.charge : a.lonePairs - b.lonePairs,
      )
    }
    return map
  }

  const drawnOrbits = groupOrbit(drawn.atoms, drawnInfo.colors)
  const expectedOrbits = groupOrbit(expected.atoms, expectedInfo.colors)

  for (const [col, expBucket] of expectedOrbits.entries()) {
    const drBucket = drawnOrbits.get(col)
    if (!drBucket) continue
    for (let i = 0; i < expBucket.entries.length; i++) {
      const exp = expBucket.entries[i]
      const dr = drBucket.entries[i]
      if (!dr) continue
      if (dr.charge !== exp.charge) {
        const expQ = exp.charge > 0 ? `+${exp.charge}` : `${exp.charge}`
        const drQ = dr.charge > 0 ? `+${dr.charge}` : `${dr.charge}`
        issuesFr.push(
          `${expBucket.symbol} : charge formelle ${expQ} attendue (actuellement ${drQ}).`,
        )
      }
      if (dr.lonePairs !== exp.lonePairs) {
        const unit = exp.lonePairs > 1 ? 'doublets non liants attendus' : 'doublet non liant attendu'
        issuesFr.push(
          `${expBucket.symbol} : ${exp.lonePairs} ${unit} (actuellement ${dr.lonePairs}).`,
        )
      }
    }
  }

  // Deduplicate identical messages for symmetric atoms (e.g. two identical O atoms)
  const uniqueIssues = [...new Set(issuesFr)]
  return {
    exactLewisValid: uniqueIssues.length === 0,
    issuesFr: uniqueIssues,
  }
}
