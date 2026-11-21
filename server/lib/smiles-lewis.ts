import { Molecule } from 'openchemlib'
import type {
  LewisAtom,
  LewisBond,
  LewisStructure,
  SpeciesKind,
} from '../../shared/chemistry.ts'
import { computeDefaultLonePairs } from '../data/lewis.ts'

export interface ParsedSmilesSpecies {
  lewis: LewisStructure
  composition: Record<string, number>
  formula: string
  displayFormula: string
  totalCharge: number
  molarMass: number
  kind: SpeciesKind
  heavyAtomCount: number
  totalAtomCount: number
  families: string[]
  canonicalSmiles: string
  fragmentSmiles: string[]
}

const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉']
const SUPERSCRIPT_DIGITS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹']

function toSubscript(n: number): string {
  return String(n)
    .split('')
    .map((ch) => SUBSCRIPT_DIGITS[Number(ch)] ?? ch)
    .join('')
}

function toSuperscriptCharge(charge: number): string {
  if (charge === 0) return ''
  const abs = Math.abs(charge)
  const sign = charge > 0 ? '⁺' : '⁻'
  if (abs === 1) return sign
  const digits = String(abs)
    .split('')
    .map((ch) => SUPERSCRIPT_DIGITS[Number(ch)] ?? ch)
    .join('')
  return `${digits}${sign}`
}

export function formatHillPlain(composition: Record<string, number>): string {
  const entries = Object.entries(composition).filter(([, c]) => c > 0)
  const hasCarbon = entries.some(([sym]) => sym === 'C')
  entries.sort(([a], [b]) => {
    if (hasCarbon) {
      if (a === 'C') return -1
      if (b === 'C') return 1
      if (a === 'H') return -1
      if (b === 'H') return 1
    }
    return a.localeCompare(b)
  })
  return entries.map(([sym, count]) => (count === 1 ? sym : `${sym}${count}`)).join('')
}

export function formatHillDisplay(
  composition: Record<string, number>,
  charge = 0,
): string {
  const entries = Object.entries(composition).filter(([, c]) => c > 0)
  const hasCarbon = entries.some(([sym]) => sym === 'C')
  entries.sort(([a], [b]) => {
    if (hasCarbon) {
      if (a === 'C') return -1
      if (b === 'C') return 1
      if (a === 'H') return -1
      if (b === 'H') return 1
    }
    return a.localeCompare(b)
  })
  const base = entries
    .map(([sym, count]) => (count === 1 ? sym : `${sym}${toSubscript(count)}`))
    .join('')
  return `${base}${toSuperscriptCharge(charge)}`
}

function normalizeAngle(rad: number): number {
  const twoPi = Math.PI * 2
  return ((rad % twoPi) + twoPi) % twoPi
}

function pickHydrogenAngles(neighborAngles: number[], count: number): number[] {
  if (count <= 0) return []
  if (neighborAngles.length === 0) {
    if (count === 1) return [0]
    if (count === 2) return [(142 * Math.PI) / 180, (38 * Math.PI) / 180]
    if (count === 3) return [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]
    return [-Math.PI / 2, 0, Math.PI / 2, Math.PI]
  }
  if (neighborAngles.length === 1) {
    const opp = neighborAngles[0] + Math.PI
    if (count === 1) return [opp]
    if (count === 2) {
      const spread = (56 * Math.PI) / 180
      return [opp - spread, opp + spread]
    }
    if (count === 3) {
      const spread = (72 * Math.PI) / 180
      return [opp - spread, opp, opp + spread]
    }
    const s1 = (36 * Math.PI) / 180
    const s2 = (108 * Math.PI) / 180
    return [opp - s2, opp - s1, opp + s1, opp + s2]
  }

  const sorted = neighborAngles.map(normalizeAngle).sort((a, b) => a - b)
  let bestStart = sorted[0]
  let bestSize = -1
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i]
    const end = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + Math.PI * 2
    const size = end - start
    if (size > bestSize) {
      bestSize = size
      bestStart = start
    }
  }

  const out: number[] = []
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / (count + 1)
    out.push(bestStart + bestSize * t)
  }
  return out
}

const HALOGENS = new Set(['F', 'Cl', 'Br', 'I'])

function detectChemicalFamilies(
  atoms: LewisAtom[],
  bonds: LewisBond[],
  mol: Molecule,
  totalCharge: number,
  isIonic: boolean,
): string[] {
  const families = new Set<string>()
  if (totalCharge !== 0) families.add('Ion')
  if (isIonic) families.add('Composé ionique')

  const atomById = new Map(atoms.map((a) => [a.id, a]))
  const adj = new Map<string, Array<{ atom: LewisAtom; order: number }>>()
  for (const a of atoms) adj.set(a.id, [])
  for (const b of bonds) {
    const u = atomById.get(b.from)
    const v = atomById.get(b.to)
    if (!u || !v) continue
    adj.get(u.id)!.push({ atom: v, order: b.order })
    adj.get(v.id)!.push({ atom: u, order: b.order })
  }

  const hasCarbon = atoms.some((a) => a.symbol === 'C')
  if (!hasCarbon) {
    if (!isIonic && totalCharge === 0) families.add('Inorganique')
    return [...families]
  }

  // Aromatic ring detection via OpenChemLib helper arrays
  mol.ensureHelperArrays(Molecule.cHelperRings)
  const hasAromatic = mol.getAromaticRingCount() > 0
  if (hasAromatic) families.add('Aromatique')

  const aromaticAtomIds = new Set<string>()
  for (let i = 0; i < mol.getAllAtoms(); i++) {
    if (mol.isAromaticAtom(i)) aromaticAtomIds.add(`h${i}`)
  }

  let hasCarboxyl = false
  let hasAmine = false
  let hasHalogenOnC = false
  let hasCCDouble = false
  let hasCCTriple = false

  for (const atom of atoms) {
    const neigh = adj.get(atom.id) ?? []

    if (atom.symbol === 'C') {
      const doubleO = neigh.filter((n) => n.atom.symbol === 'O' && n.order === 2)
      const singleO = neigh.filter((n) => n.atom.symbol === 'O' && n.order === 1)
      const singleN = neigh.filter((n) => n.atom.symbol === 'N' && n.order === 1)
      const tripleN = neigh.filter((n) => n.atom.symbol === 'N' && n.order === 3)
      const cNeigh = neigh.filter((n) => n.atom.symbol === 'C')
      const hNeigh = neigh.filter((n) => n.atom.symbol === 'H')

      if (tripleN.length > 0) families.add('Nitrile')

      if (doubleO.length === 1) {
        const hasOH = singleO.some((o) =>
          (adj.get(o.atom.id) ?? []).some((x) => x.atom.symbol === 'H'),
        )
        const hasOC = singleO.some((o) =>
          (adj.get(o.atom.id) ?? []).some(
            (x) => x.atom.symbol === 'C' && x.atom.id !== atom.id,
          ),
        )
        const hasOMinus = singleO.some((o) => o.atom.charge < 0)

        if (hasOH) {
          families.add('Acide carboxylique')
          hasCarboxyl = true
        } else if (hasOMinus) {
          families.add('Carboxylate')
        } else if (hasOC) {
          families.add('Ester')
        } else if (singleN.length > 0) {
          families.add('Amide')
        } else if (hNeigh.length >= 1) {
          families.add('Aldéhyde')
        } else if (cNeigh.length === 2) {
          families.add('Cétone')
        }
      }

      if (neigh.some((n) => HALOGENS.has(n.atom.symbol))) {
        hasHalogenOnC = true
      }

      for (const n of cNeigh) {
        if (n.order === 2 && !aromaticAtomIds.has(atom.id)) hasCCDouble = true
        if (n.order === 3) hasCCTriple = true
      }
    }

    if (atom.symbol === 'O' && atom.charge === 0 && neigh.length === 2) {
      const cParents = neigh.filter((n) => n.atom.symbol === 'C' && n.order === 1)
      const hParents = neigh.filter((n) => n.atom.symbol === 'H' && n.order === 1)
      if (cParents.length === 1 && hParents.length === 1) {
        const parentC = cParents[0].atom
        const isAcidOH = (adj.get(parentC.id) ?? []).some(
          (x) => x.atom.symbol === 'O' && x.order === 2,
        )
        if (!isAcidOH) {
          if (aromaticAtomIds.has(parentC.id)) families.add('Phénol')
          else families.add('Alcool')
        }
      } else if (cParents.length === 2) {
        const isEsterO = cParents.some((c) =>
          (adj.get(c.atom.id) ?? []).some((x) => x.atom.symbol === 'O' && x.order === 2),
        )
        if (!isEsterO) families.add('Éther')
      }
    }

    if (atom.symbol === 'N' && atom.charge === 0) {
      const cSingle = neigh.filter((n) => n.atom.symbol === 'C' && n.order === 1)
      const isAmide = cSingle.some((c) =>
        (adj.get(c.atom.id) ?? []).some((x) => x.atom.symbol === 'O' && x.order === 2),
      )
      const hasO = neigh.some((n) => n.atom.symbol === 'O')
      if (hasO) {
        families.add('Dérivé nitré')
      } else if (cSingle.length >= 1 && !isAmide && !aromaticAtomIds.has(atom.id)) {
        families.add('Amine')
        hasAmine = true
      }
    }

    if (atom.symbol === 'S' && atom.charge === 0) {
      const hasH = neigh.some((n) => n.atom.symbol === 'H')
      const hasC = neigh.some((n) => n.atom.symbol === 'C')
      if (hasH && hasC) families.add('Thiol')
    }
  }

  if (hasCarboxyl && hasAmine) families.add('Acide aminé')
  if (hasHalogenOnC) families.add('Halogénoalcane')
  if (hasCCDouble) families.add('Alcène')
  if (hasCCTriple) families.add('Alcyne')

  const onlyCH = atoms.every((a) => a.symbol === 'C' || a.symbol === 'H')
  if (onlyCH && !hasAromatic && !hasCCDouble && !hasCCTriple && totalCharge === 0) {
    families.add('Alcane')
  }

  return [...families].slice(0, 4)
}

export function smilesToLewis(
  rawSmiles: string,
  atomicMassBySymbol: Map<string, number>,
  options?: { maxHeavyAtoms?: number; maxTotalAtoms?: number; maxMolarMass?: number },
): ParsedSmilesSpecies | null {
  const trimmed = rawSmiles.trim()
  if (!trimmed || trimmed.includes('*')) return null

  const maxHeavyAtoms = options?.maxHeavyAtoms ?? 26
  const maxTotalAtoms = options?.maxTotalAtoms ?? 65
  const maxMolarMass = options?.maxMolarMass ?? 420

  let mol: Molecule
  try {
    mol = Molecule.fromSmiles(trimmed)
  } catch {
    return null
  }

  const heavyCount = mol.getAllAtoms()
  if (heavyCount === 0 || heavyCount > maxHeavyAtoms) return null

  mol.ensureHelperArrays(Molecule.cHelperNeighbours)

  // Validate all atoms: known element, no exotic isotopes, no radicals
  let estimatedTotalAtoms = heavyCount
  for (let i = 0; i < heavyCount; i++) {
    const z = mol.getAtomicNo(i)
    if (z <= 0 || z > 118) return null
    if (mol.getAtomMass(i) !== 0) return null // Reject isotopic variants (2H, 13C, 14C...)
    if (mol.getAtomRadical(i) !== 0) return null // Reject unstable radicals
    estimatedTotalAtoms += mol.getImplicitHydrogens(i)
  }
  if (estimatedTotalAtoms > maxTotalAtoms) return null

  // Validate bond orders (1, 2, 3 only — reject metal coordinate / quadruple / delocalized fallback)
  for (let b = 0; b < mol.getAllBonds(); b++) {
    const order = mol.getBondOrder(b)
    if (order !== 1 && order !== 2 && order !== 3) return null
  }

  // Generate clean 2D coordinates for the heavy-atom skeleton
  try {
    mol.inventCoordinates()
  } catch {
    return null
  }

  // Detect disconnected fragments (e.g. ionic salts vs neutral mixtures)
  const fragIndices = new Array<number>(heavyCount).fill(0)
  const fragCount = mol.getFragmentNumbers(fragIndices, false, false)

  const fragCharges = new Array<number>(fragCount).fill(0)
  for (let i = 0; i < heavyCount; i++) {
    fragCharges[fragIndices[i]] += mol.getAtomCharge(i)
  }

  // Reject multi-component neutral mixtures (e.g. hydrates, co-crystals, mixtures);
  // keep true ionic compounds where every fragment is an ion!
  const isIonic = fragCount > 1
  if (isIonic) {
    const allCharged = fragCharges.every((q) => q !== 0)
    const hasPos = fragCharges.some((q) => q > 0)
    const hasNeg = fragCharges.some((q) => q < 0)
    if (!allCharged || !hasPos || !hasNeg) return null
  }

  // Scale heavy-atom bond length to our standard Lewis bond length (56px)
  const TARGET_BOND_LEN = 56
  const H_BOND_LEN = 40
  const bondLengths: number[] = []
  for (let b = 0; b < mol.getAllBonds(); b++) {
    const a1 = mol.getBondAtom(0, b)
    const a2 = mol.getBondAtom(1, b)
    const d = Math.hypot(
      mol.getAtomX(a2) - mol.getAtomX(a1),
      mol.getAtomY(a2) - mol.getAtomY(a1),
    )
    if (d > 0.01) bondLengths.push(d)
  }
  bondLengths.sort((a, b) => a - b)
  const medianLen =
    bondLengths.length > 0 ? bondLengths[Math.floor(bondLengths.length / 2)] : 1.5
  const scale = TARGET_BOND_LEN / medianLen

  // Build explicit heavy atoms & bonds per fragment, then expand implicit H's cleanly
  const heavyAtoms: Array<{
    id: string
    idx: number
    frag: number
    symbol: string
    x: number
    y: number
    charge: number
    implicitH: number
  }> = []

  for (let i = 0; i < heavyCount; i++) {
    heavyAtoms.push({
      id: `h${i}`,
      idx: i,
      frag: fragIndices[i],
      symbol: mol.getAtomLabel(i),
      x: mol.getAtomX(i) * scale,
      y: mol.getAtomY(i) * scale,
      charge: mol.getAtomCharge(i),
      implicitH: mol.getImplicitHydrogens(i),
    })
  }

  const rawBonds: LewisBond[] = []
  for (let b = 0; b < mol.getAllBonds(); b++) {
    const a1 = mol.getBondAtom(0, b)
    const a2 = mol.getBondAtom(1, b)
    const order = mol.getBondOrder(b) as 1 | 2 | 3
    rawBonds.push({ from: `h${a1}`, to: `h${a2}`, order })
  }

  // Collect neighbor angles for each heavy atom so explicit H's go into open gaps
  const neighborAnglesByHeavy = new Map<number, number[]>()
  for (let i = 0; i < heavyCount; i++) neighborAnglesByHeavy.set(i, [])
  for (let b = 0; b < mol.getAllBonds(); b++) {
    const u = mol.getBondAtom(0, b)
    const v = mol.getBondAtom(1, b)
    const au = heavyAtoms[u]
    const av = heavyAtoms[v]
    neighborAnglesByHeavy.get(u)!.push(Math.atan2(av.y - au.y, av.x - au.x))
    neighborAnglesByHeavy.get(v)!.push(Math.atan2(au.y - av.y, au.x - av.x))
  }

  const allAtomsPreLayout: Array<{
    id: string
    frag: number
    symbol: string
    x: number
    y: number
    charge: number
  }> = heavyAtoms.map((a) => ({
    id: a.id,
    frag: a.frag,
    symbol: a.symbol,
    x: a.x,
    y: a.y,
    charge: a.charge,
  }))

  let hCounter = 0
  for (const hAtom of heavyAtoms) {
    if (hAtom.implicitH <= 0) continue
    const angles = pickHydrogenAngles(
      neighborAnglesByHeavy.get(hAtom.idx) ?? [],
      hAtom.implicitH,
    )
    for (const ang of angles) {
      const hid = `eh${++hCounter}`
      allAtomsPreLayout.push({
        id: hid,
        frag: hAtom.frag,
        symbol: 'H',
        x: hAtom.x + Math.cos(ang) * H_BOND_LEN,
        y: hAtom.y + Math.sin(ang) * H_BOND_LEN,
        charge: 0,
      })
      rawBonds.push({ from: hAtom.id, to: hid, order: 1 })
    }
  }

  // If ionic with multiple fragments, lay out fragments cleanly side-by-side
  if (fragCount > 1) {
    const fragGroups = Array.from({ length: fragCount }, (_, f) =>
      allAtomsPreLayout.filter((a) => a.frag === f),
    )
    // Put cations left, anions right
    const order = fragGroups
      .map((atoms, idx) => ({
        atoms,
        charge: fragCharges[idx],
        minX: Math.min(...atoms.map((a) => a.x)),
        maxX: Math.max(...atoms.map((a) => a.x)),
        minY: Math.min(...atoms.map((a) => a.y)),
        maxY: Math.max(...atoms.map((a) => a.y)),
      }))
      .sort((a, b) => b.charge - a.charge)

    const gap = 46
    const widths = order.map((g) => Math.max(36, g.maxX - g.minX + 36))
    const totalW = widths.reduce((s, w) => s + w, 0) + gap * (order.length - 1)
    let cursorX = -totalW / 2

    order.forEach((group, idx) => {
      const cx = (group.minX + group.maxX) / 2
      const cy = (group.minY + group.maxY) / 2
      const targetCx = cursorX + widths[idx] / 2
      for (const a of group.atoms) {
        a.x = a.x - cx + targetCx
        a.y = a.y - cy
      }
      cursorX += widths[idx] + gap
    })
  }

  // Center entire structure around (0, 0) and compute lone pairs + composition + molar mass
  const bondSums = new Map<string, number>()
  for (const b of rawBonds) {
    bondSums.set(b.from, (bondSums.get(b.from) ?? 0) + b.order)
    bondSums.set(b.to, (bondSums.get(b.to) ?? 0) + b.order)
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const a of allAtomsPreLayout) {
    minX = Math.min(minX, a.x)
    maxX = Math.max(maxX, a.x)
    minY = Math.min(minY, a.y)
    maxY = Math.max(maxY, a.y)
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2

  const composition: Record<string, number> = {}
  let totalCharge = 0
  let molarMass = 0

  const finalAtoms: LewisAtom[] = allAtomsPreLayout.map((a) => {
    composition[a.symbol] = (composition[a.symbol] ?? 0) + 1
    totalCharge += a.charge
    const mass = atomicMassBySymbol.get(a.symbol)
    if (mass !== undefined) molarMass += mass
    const lonePairs = computeDefaultLonePairs(
      a.symbol,
      bondSums.get(a.id) ?? 0,
      a.charge,
    )
    return {
      id: a.id,
      symbol: a.symbol,
      x: Math.round((a.x - cx) * 10) / 10,
      y: Math.round((a.y - cy) * 10) / 10,
      lonePairs,
      charge: a.charge,
    }
  })

  molarMass = Math.round(molarMass * 1000) / 1000
  if (molarMass <= 0 || molarMass > maxMolarMass) return null

  const lewis: LewisStructure = {
    atoms: finalAtoms,
    bonds: rawBonds,
  }
  if (totalCharge !== 0) lewis.totalCharge = totalCharge
  if (isIonic) lewis.ionic = true

  const elemTypes = Object.keys(composition)
  const kind: SpeciesKind =
    totalCharge !== 0
      ? 'ion'
      : isIonic
        ? 'ionic_compound'
        : elemTypes.length === 1
          ? 'element_substance'
          : 'molecule'

  const families = detectChemicalFamilies(finalAtoms, rawBonds, mol, totalCharge, isIonic)
  const canonicalSmiles = mol.toSmiles()

  // Extract individual fragment canonical SMILES (for ionic salt dissociation matching)
  const fragmentSmiles: string[] = []
  if (fragCount > 1) {
    const frags = mol.getFragments()
    for (const f of frags) {
      fragmentSmiles.push(f.toSmiles())
    }
  }

  return {
    lewis,
    composition,
    formula: formatHillPlain(composition) + (totalCharge !== 0 ? (totalCharge > 0 ? `+${totalCharge}` : `${totalCharge}`) : ''),
    displayFormula: formatHillDisplay(composition, totalCharge),
    totalCharge,
    molarMass,
    kind,
    heavyAtomCount: heavyCount,
    totalAtomCount: finalAtoms.length,
    families,
    canonicalSmiles,
    fragmentSmiles,
  }
}

/**
 * Converts a user-drawn Lewis graph (with explicit H atoms) into a canonical SMILES.
 * Returns null if the user's explicit hydrogens do not match valid valence
 * (preventing partial drawings like "C-O" from falsely matching Methanol!).
 */
export function lewisGraphToSmiles(
  atoms: LewisAtom[],
  bonds: LewisBond[],
): { smiles: string } | { errorFr: string } {
  if (atoms.length === 0) {
    return { errorFr: 'Placez au moins un atome avant de rechercher sur PubChem.' }
  }

  const m = new Molecule(atoms.length, bonds.length)
  const idxMap = new Map<string, number>()
  const drawnCounts: Record<string, number> = {}
  let drawnCharge = 0

  for (const a of atoms) {
    const z = Molecule.getAtomicNoFromLabel(a.symbol)
    if (!z || z <= 0) {
      return { errorFr: `Élément inconnu : ${a.symbol}.` }
    }
    const idx = m.addAtom(z)
    if (a.charge !== 0) m.setAtomCharge(idx, a.charge)
    idxMap.set(a.id, idx)
    drawnCounts[a.symbol] = (drawnCounts[a.symbol] ?? 0) + 1
    drawnCharge += a.charge
  }

  const seenEdge = new Set<string>()
  for (const b of bonds) {
    const u = idxMap.get(b.from)
    const v = idxMap.get(b.to)
    if (u === undefined || v === undefined || u === v) continue
    const pk = u < v ? `${u}:${v}` : `${v}:${u}`
    if (seenEdge.has(pk)) continue
    seenEdge.add(pk)
    const bi = m.addBond(u, v)
    m.setBondOrder(bi, b.order)
  }

  // Only remove explicit H atoms if there is at least one non-H atom (keep H2 / H+ intact!)
  const hasNonH = atoms.some((a) => a.symbol !== 'H')
  if (hasNonH) {
    m.removeExplicitHydrogens()
  }

  const smiles = m.toSmiles()
  if (!smiles) {
    return { errorFr: 'Impossible de convertir ce schéma en structure SMILES.' }
  }

  // Strict valence consistency check: verify round-tripped SMILES has the EXACT same
  // total composition & charge as what the user drew!
  try {
    const check = Molecule.fromSmiles(smiles)
    check.ensureHelperArrays(Molecule.cHelperNeighbours)
    const expectedCounts: Record<string, number> = {}
    let expectedCharge = 0
    for (let i = 0; i < check.getAllAtoms(); i++) {
      const sym = check.getAtomLabel(i)
      expectedCounts[sym] = (expectedCounts[sym] ?? 0) + 1
      expectedCharge += check.getAtomCharge(i)
      const impH = check.getImplicitHydrogens(i)
      if (impH > 0) expectedCounts.H = (expectedCounts.H ?? 0) + impH
    }
    if (expectedCharge !== drawnCharge) {
      return {
        errorFr:
          'Vérifiez les charges formelles et le nombre d’hydrogènes avant la recherche PubChem.',
      }
    }
    const allSyms = new Set([
      ...Object.keys(drawnCounts),
      ...Object.keys(expectedCounts),
    ])
    for (const sym of allSyms) {
      if ((drawnCounts[sym] ?? 0) !== (expectedCounts[sym] ?? 0)) {
        const diff = (expectedCounts[sym] ?? 0) - (drawnCounts[sym] ?? 0)
        if (sym === 'H' && diff > 0) {
          return {
            errorFr: `Schéma incomplet : il manque ${diff} atome${diff > 1 ? 's' : ''} d’hydrogène (H) pour satisfaire les valences.`,
          }
        }
        return {
          errorFr:
            'Les valences des atomes dessinés ne correspondent pas à une structure complète (vérifiez les H, liaisons multiples et charges).',
        }
      }
    }
  } catch {
    return { errorFr: 'Structure invalide pour la recherche PubChem.' }
  }

  return { smiles }
}
