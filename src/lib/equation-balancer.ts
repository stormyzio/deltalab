import type {
  CatalogSpeciesRecord,
  ElementRecord,
  PhysicalState,
} from '../../shared/chemistry.ts'
import { buildCanonicalSignature } from './chemistry-calc.ts'

export type EquationArrow = '->' | '<=>'

export interface ParsedEquationTerm {
  raw: string
  formula: string
  displayFormula: string
  composition: Record<string, number>
  charge: number
  state: PhysicalState | null
  userCoefficient: number | null
  molarMass: number
  matchedSpecies: CatalogSpeciesRecord | null
}

export interface BalancedParticipant extends ParsedEquationTerm {
  side: 'reactant' | 'product'
  coefficient: number
}

export interface ConservationRow {
  key: string
  label: string
  left: number
  right: number
  balanced: boolean
}

export type BalanceEquationResult =
  | {
      ok: true
      arrow: EquationArrow
      reactants: BalancedParticipant[]
      products: BalancedParticipant[]
      alreadyBalanced: boolean
      underdetermined: boolean
      reactionTypesFr: string[]
      conservation: ConservationRow[]
      totalMassLeftGPerMol: number
      totalMassRightGPerMol: number
      plainText: string
      latexText: string
    }
  | {
      ok: false
      errorFr: string
      hintFr?: string
      arrow: EquationArrow
      reactants: ParsedEquationTerm[]
      products: ParsedEquationTerm[]
    }

export interface EquationPreset {
  id: string
  labelFr: string
  tagFr: string
  equation: string
  defaultReactantMols?: number[]
}

export const EQUATION_PRESETS: EquationPreset[] = [
  {
    id: 'combustion_ch4',
    labelFr: 'Combustion du méthane',
    tagFr: 'Combustion',
    equation: 'CH4(g) + O2(g) -> CO2(g) + H2O(l)',
    defaultReactantMols: [0.5, 1.2],
  },
  {
    id: 'redox_mno4_fe2',
    labelFr: 'Permanganate + Fer(II)',
    tagFr: 'Redox',
    equation: 'MnO4-(aq) + Fe2+(aq) + H+(aq) -> Mn2+(aq) + Fe3+(aq) + H2O(l)',
    defaultReactantMols: [0.02, 0.12, 0.2],
  },
  {
    id: 'neutralization_h3po4',
    labelFr: 'Acide phosphorique + Chaux',
    tagFr: 'Acide-base',
    equation: 'H3PO4(aq) + Ca(OH)2(aq) -> Ca3(PO4)2(s) + H2O(l)',
    defaultReactantMols: [0.1, 0.12],
  },
  {
    id: 'copper_nitric',
    labelFr: 'Cuivre + Acide nitrique',
    tagFr: 'Redox',
    equation: 'Cu(s) + NO3-(aq) + H+(aq) -> Cu2+(aq) + NO(g) + H2O(l)',
    defaultReactantMols: [0.1, 0.08, 0.3],
  },
  {
    id: 'thermite',
    labelFr: 'Aluminothermie',
    tagFr: 'Synthèse',
    equation: 'Fe2O3(s) + Al(s) -> Fe(s) + Al2O3(s)',
    defaultReactantMols: [0.25, 0.6],
  },
  {
    id: 'precip_agcl',
    labelFr: 'Précipitation AgCl',
    tagFr: 'Précipitation',
    equation: 'AgNO3(aq) + NaCl(aq) -> AgCl(s) + NaNO3(aq)',
    defaultReactantMols: [0.05, 0.08],
  },
]

// --- Exact BigInt rational arithmetic ---

interface Rat {
  n: bigint
  d: bigint
}

function absBig(a: bigint): bigint {
  return a < 0n ? -a : a
}

function gcdBig(a: bigint, b: bigint): bigint {
  let x = absBig(a)
  let y = absBig(b)
  while (y !== 0n) {
    const t = x % y
    x = y
    y = t
  }
  return x === 0n ? 1n : x
}

function lcmBig(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n
  return absBig((a / gcdBig(a, b)) * b)
}

function makeRat(n: bigint, d: bigint = 1n): Rat {
  if (d === 0n) throw new Error('Division by zero')
  if (n === 0n) return { n: 0n, d: 1n }
  const sign = d < 0n ? -1n : 1n
  const an = n * sign
  const ad = d * sign
  const g = gcdBig(an, ad)
  return { n: an / g, d: ad / g }
}

const RAT_ZERO: Rat = { n: 0n, d: 1n }
const RAT_ONE: Rat = { n: 1n, d: 1n }

function addRat(a: Rat, b: Rat): Rat {
  return makeRat(a.n * b.d + b.n * a.d, a.d * b.d)
}

function subRat(a: Rat, b: Rat): Rat {
  return makeRat(a.n * b.d - b.n * a.d, a.d * b.d)
}

function mulRat(a: Rat, b: Rat): Rat {
  return makeRat(a.n * b.n, a.d * b.d)
}

function divRat(a: Rat, b: Rat): Rat {
  return makeRat(a.n * b.d, a.d * b.n)
}

function negRat(a: Rat): Rat {
  return { n: -a.n, d: a.d }
}

// --- Unicode normalization & formatting ---

const SUB_TO_ASCII: Record<string, string> = {
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
}

const SUP_TO_ASCII: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁺': '+',
  '⁻': '-',
}

const ASCII_TO_SUB: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
}

const ASCII_TO_SUP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
}

function normalizeUnicodeChem(input: string): string {
  let out = ''
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if (ch in SUB_TO_ASCII) {
      out += SUB_TO_ASCII[ch]
      i++
    } else if (ch in SUP_TO_ASCII) {
      // Collect contiguous superscripts as a ^... charge group
      let sup = ''
      while (i < input.length && input[i] in SUP_TO_ASCII) {
        sup += SUP_TO_ASCII[input[i]]
        i++
      }
      out += `^${sup}`
    } else if (ch === '−' || ch === '–' || ch === '—') {
      out += '-'
      i++
    } else if (ch === '•' || ch === '∙') {
      out += '·'
      i++
    } else {
      out += ch
      i++
    }
  }
  return out
}

function formatDisplayFormula(baseFormula: string, charge: number): string {
  // Convert digits after element/closing paren to Unicode subscripts, preserving hydrate multipliers
  const parts = baseFormula.split('·').map((segment) => {
    const leadMatch = segment.match(/^(\d+)(.*)$/)
    const lead = leadMatch ? leadMatch[1] : ''
    const rest = leadMatch ? leadMatch[2] : segment
    const subbed = rest.replace(/\d+/g, (digits) =>
      digits
        .split('')
        .map((d) => ASCII_TO_SUB[d] ?? d)
        .join(''),
    )
    return `${lead}${subbed}`
  })
  const core = parts.join('·')
  if (charge === 0) return core
  const mag = Math.abs(charge)
  const sign = charge > 0 ? '+' : '-'
  const supStr = (mag === 1 ? sign : `${mag}${sign}`)
    .split('')
    .map((c) => ASCII_TO_SUP[c] ?? c)
    .join('')
  return `${core}${supStr}`
}

function formatLatexFormula(baseFormula: string, charge: number, state: PhysicalState | null): string {
  const parts = baseFormula.split('·').map((segment) => {
    const leadMatch = segment.match(/^(\d+)(.*)$/)
    const lead = leadMatch ? leadMatch[1] : ''
    const rest = leadMatch ? leadMatch[2] : segment
    const subbed = rest.replace(/\d+/g, (digits) =>
      digits.length === 1 ? `_${digits}` : `_{${digits}}`,
    )
    return `${lead}${subbed}`
  })
  let out = `\\mathrm{${parts.join(' \\cdot ')}}`
  if (charge !== 0) {
    const mag = Math.abs(charge)
    const sign = charge > 0 ? '+' : '-'
    out += `^{${mag === 1 ? sign : `${mag}${sign}`}}`
  }
  if (state) {
    const st = state === 'solid' ? 's' : state === 'liquid' ? 'l' : state === 'gas' ? 'g' : 'aq'
    out += `_{(${st})}`
  }
  return out
}

// --- Smart side splitter (never splits on charge '+') ---

export function splitEquationSideTerms(sideRaw: string): string[] {
  const s = normalizeUnicodeChem(sideRaw).trim()
  if (!s) return []

  const terms: string[] = []
  let current = ''
  let depth = 0

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '(' || ch === '[') {
      depth++
      current += ch
      continue
    }
    if (ch === ')' || ch === ']') {
      depth = Math.max(0, depth - 1)
      current += ch
      continue
    }
    if (ch === '+' && depth === 0) {
      const prevChar = i > 0 ? s[i - 1] : ''
      const nextRest = s.slice(i + 1)
      const nextTrimmed = nextRest.trimStart()
      const nextNonSpace = nextTrimmed[0] ?? ''
      const hasSpaceBefore = /\s/.test(prevChar)

      const isCharge =
        prevChar === '^' ||
        (!hasSpaceBefore &&
          (nextNonSpace === '' ||
            nextNonSpace === '+' ||
            /^\((s|l|g|aq)\)/i.test(nextTrimmed)))

      if (!isCharge) {
        const trimmed = current.trim()
        if (trimmed) terms.push(trimmed)
        current = ''
        continue
      }
    }
    current += ch
  }

  const last = current.trim()
  if (last) terms.push(last)
  return terms
}

// --- Single term parser ---

function parseFormulaComposition(
  formula: string,
  elementsBySymbol: Map<string, ElementRecord>,
): { composition: Record<string, number> } | { errorFr: string } {
  const clean = formula.replace(/\s+/g, '')
  if (!clean) return { errorFr: 'Formule vide.' }

  // Special case: free electron "e"
  if (clean === 'e') {
    return { composition: {} }
  }

  const total: Record<string, number> = {}
  const hydrateParts = clean.split('·')

  for (const part of hydrateParts) {
    if (!part) return { errorFr: `Segment d'hydrate invalide dans « ${formula} ».` }
    let idx = 0
    let partMultiplier = 1
    const leadDigits = part.match(/^(\d+)/)
    if (leadDigits) {
      partMultiplier = Number.parseInt(leadDigits[1], 10)
      idx = leadDigits[1].length
    }

    const stack: Array<Record<string, number>> = [{}]
    const openParens: string[] = []

    while (idx < part.length) {
      const ch = part[idx]
      if (ch === '(' || ch === '[') {
        stack.push({})
        openParens.push(ch)
        idx++
      } else if (ch === ')' || ch === ']') {
        if (stack.length <= 1) {
          return { errorFr: `Parenthèse fermante inattendue dans « ${formula} ».` }
        }
        const expectedOpen = ch === ')' ? '(' : '['
        const actualOpen = openParens.pop()
        if (actualOpen !== expectedOpen) {
          return { errorFr: `Parenthèses mal appariées dans « ${formula} ».` }
        }
        idx++
        let numStr = ''
        while (idx < part.length && /[0-9]/.test(part[idx])) {
          numStr += part[idx]
          idx++
        }
        const mult = numStr ? Number.parseInt(numStr, 10) : 1
        const group = stack.pop()!
        const top = stack[stack.length - 1]
        for (const [sym, cnt] of Object.entries(group)) {
          top[sym] = (top[sym] ?? 0) + cnt * mult
        }
      } else if (/[A-Z]/.test(ch)) {
        let sym = ch
        idx++
        while (idx < part.length && /[a-z]/.test(part[idx])) {
          sym += part[idx]
          idx++
        }
        if (elementsBySymbol.size > 0 && !elementsBySymbol.has(sym)) {
          return { errorFr: `Symbole chimique inconnu : « ${sym} » dans « ${formula} ».` }
        }
        let numStr = ''
        while (idx < part.length && /[0-9]/.test(part[idx])) {
          numStr += part[idx]
          idx++
        }
        const count = numStr ? Number.parseInt(numStr, 10) : 1
        if (count <= 0 || !Number.isFinite(count)) {
          return { errorFr: `Indice invalide après « ${sym} » dans « ${formula} ».` }
        }
        const top = stack[stack.length - 1]
        top[sym] = (top[sym] ?? 0) + count
      } else {
        return { errorFr: `Caractère inattendu « ${ch} » dans « ${formula} ».` }
      }
    }

    if (stack.length !== 1) {
      return { errorFr: `Parenthèse non fermée dans « ${formula} ».` }
    }
    for (const [sym, cnt] of Object.entries(stack[0])) {
      total[sym] = (total[sym] ?? 0) + cnt * partMultiplier
    }
  }

  return { composition: total }
}

export function parseChemTerm(
  rawInput: string,
  elementsBySymbol: Map<string, ElementRecord>,
  speciesBySigAndCharge: Map<string, CatalogSpeciesRecord>,
): { term: ParsedEquationTerm } | { errorFr: string } {
  let s = normalizeUnicodeChem(rawInput).trim()
  if (!s) return { errorFr: 'Terme vide.' }

  // 1. Optional leading stoichiometric coefficient (e.g. "2 H2O" or "3Fe")
  let userCoefficient: number | null = null
  const coeffMatch = s.match(/^(\d+)\s+(.+)$/) ?? s.match(/^(\d+)([A-Z[(e].*)$/)
  if (coeffMatch) {
    const parsedCoeff = Number.parseInt(coeffMatch[1], 10)
    if (parsedCoeff > 0) {
      userCoefficient = parsedCoeff
      s = coeffMatch[2].trim()
    }
  }

  // 2. Optional trailing physical state tag: (s), (l), (g), (aq)
  let state: PhysicalState | null = null
  const stateMatch = s.match(/\s*\((s|l|g|aq)\)\s*$/i)
  if (stateMatch) {
    const tag = stateMatch[1].toLowerCase()
    state =
      tag === 's' ? 'solid' : tag === 'l' ? 'liquid' : tag === 'g' ? 'gas' : 'aqueous'
    s = s.slice(0, stateMatch.index).trim()
  }

  // 3. Optional trailing electrical charge
  let charge = 0
  // Explicit caret syntax: ^2+, ^2-, ^+, ^-, ^+2, ^-2
  const caretCharge = s.match(/\^(\d*([+-])|([+-])\d*)$/)
  if (caretCharge) {
    const token = caretCharge[1]
    const sign = token.includes('-') ? -1 : 1
    const digits = token.replace(/[+-]/g, '')
    charge = sign * (digits ? Number.parseInt(digits, 10) : 1)
    s = s.slice(0, caretCharge.index).trim()
  } else {
    // Standard suffix syntax: Fe2+, MnO4-, SO4 2-, [Fe(CN)6]4-, H+, e-, Cr2O72-
    const suffixMatch = s.match(/(?:\s+(\d*)([+-])|(\d*)([+-]))$/)
    if (suffixMatch) {
      const signChar = suffixMatch[2] ?? suffixMatch[4]
      const sign = signChar === '-' ? -1 : 1
      const digitsStr = suffixMatch[1] ?? suffixMatch[3] ?? ''
      const baseCandidate = s.slice(0, suffixMatch.index).trim()

      // Careful disambiguation for e.g. "MnO4-" vs "Cr2O72-" vs "Fe2+" vs "SO42-" vs "NH4+"
      // If there was a space before digits+sign ("SO4 2-"), all digits are charge.
      if (suffixMatch[2] !== undefined) {
        charge = sign * (digitsStr ? Number.parseInt(digitsStr, 10) : 1)
        s = baseCandidate
      } else if (digitsStr.length === 0) {
        // Ends with single + or - (e.g. MnO4-, NH4+, H+, e-)
        charge = sign
        s = baseCandidate
      } else if (digitsStr.length === 1) {
        // Ends with single digit + sign (e.g. Fe2+, SO4-? Wait: MnO4- has base MnO and digitsStr="4"!
        // Check if base ends with an element symbol that normally takes a subscript vs charge!
        // Specifically: if baseCandidate ends with ')' or ']' (like [Fe(CN)6]4-), digitsStr IS the charge.
        // If baseCandidate is a single element like Fe, Cu, Ca, Mg, Al, Zn, S, O, N, Cl, Cr, Mn, Ag, Pb, Ba:
        //   check common oxyanions vs monatomic ions!
        const prevEndsBracket = /[)\]]$/.test(baseCandidate)
        const isSingleElement = /^[A-Z][a-z]?$/.test(baseCandidate)
        if (prevEndsBracket || isSingleElement) {
          charge = sign * Number.parseInt(digitsStr, 10)
          s = baseCandidate
        } else {
          // Ambiguous multi-atom formula ending in 1 digit + sign: e.g. MnO4-, NO3-, NH4+, H3O+, ClO4-, HCO3-, PO43-
          // Wait: PO43- has 2 digits ("43")! Single digit on multi-atom formula like "MnO4-", "NO3-", "NH4+", "OH-", "H3O+"
          // is almost always subscript + charge ±1 (e.g. MnO₄⁻, NO₃⁻, NH₄⁺, H₃O⁺, ClO₄⁻, CH₃COO⁻)!
          // Exception: check catalog first for (base+digit, ±1) vs (base, ±digit)!
          const asSub = parseFormulaComposition(`${baseCandidate}${digitsStr}`, elementsBySymbol)
          const asChg = parseFormulaComposition(baseCandidate, elementsBySymbol)
          const subKey =
            'composition' in asSub
              ? `${buildCanonicalSignature(asSub.composition)}|${sign}`
              : ''
          const chgKey =
            'composition' in asChg
              ? `${buildCanonicalSignature(asChg.composition)}|${sign * Number.parseInt(digitsStr, 10)}`
              : ''
          if (chgKey && speciesBySigAndCharge.has(chgKey) && !speciesBySigAndCharge.has(subKey)) {
            charge = sign * Number.parseInt(digitsStr, 10)
            s = baseCandidate
          } else {
            charge = sign
            s = `${baseCandidate}${digitsStr}`
          }
        }
      } else {
        // Multiple digits before sign: e.g. "SO42-", "CO32-", "PO43-", "Cr2O72-", "S2O32-", "C2O42-"
        // Last digit is the charge magnitude, earlier digits are the element subscript!
        const chgMag = Number.parseInt(digitsStr[digitsStr.length - 1], 10)
        const subDigits = digitsStr.slice(0, -1)
        charge = sign * chgMag
        s = `${baseCandidate}${subDigits}`
      }
    }
  }

  // Special case: free electron "e-" or "e"
  if (s === 'e' && (charge === -1 || charge === 0)) {
    return {
      term: {
        raw: rawInput.trim(),
        formula: 'e',
        displayFormula: 'e⁻',
        composition: {},
        charge: -1,
        state: null,
        userCoefficient,
        molarMass: 0.000549,
        matchedSpecies: null,
      },
    }
  }

  const parsedComp = parseFormulaComposition(s, elementsBySymbol)
  if ('errorFr' in parsedComp) return { errorFr: parsedComp.errorFr }

  const { composition } = parsedComp
  if (Object.keys(composition).length === 0) {
    return { errorFr: `Formule invalide : « ${rawInput.trim()} ».` }
  }

  let molarMass = 0
  for (const [sym, cnt] of Object.entries(composition)) {
    const el = elementsBySymbol.get(sym)
    molarMass += (el?.atomicMass ?? 0) * cnt
  }
  molarMass = Math.round(molarMass * 1000) / 1000

  const sig = buildCanonicalSignature(composition)
  let matchedSpecies = speciesBySigAndCharge.get(`${sig}|${charge}`) ?? null

  // If the user typed an uncharged polyatomic formula (e.g. "ClO", "MnO4", "Cr2O7", "SO4", "PO4", "CO3", "NH4")
  // that does not exist as a neutral species in the catalog, resolve it to its catalog ion if one exists.
  if (!matchedSpecies && charge === 0 && Object.keys(composition).length >= 2) {
    const prefix = `${sig}|`
    let bestIon: CatalogSpeciesRecord | null = null
    for (const [key, sp] of speciesBySigAndCharge.entries()) {
      if (key.startsWith(prefix) && sp.charge !== 0) {
        if (!bestIon || sp.popularity > bestIon.popularity) {
          bestIon = sp
        }
      }
    }
    if (bestIon) {
      charge = bestIon.charge
      matchedSpecies = bestIon
    }
  }

  const displayFormula = formatDisplayFormula(s, charge)

  return {
    term: {
      raw: rawInput.trim(),
      formula: s,
      displayFormula,
      composition,
      charge,
      state:
        state ??
        (matchedSpecies
          ? matchedSpecies.kind === 'ion'
            ? 'aqueous'
            : matchedSpecies.standardState
          : charge !== 0
            ? 'aqueous'
            : null),
      userCoefficient,
      molarMass,
      matchedSpecies,
    },
  }
}

// --- Exact RREF nullspace solver ---

function solveNullspaceRref(matrix: Rat[][]): Rat[][] {
  const numRows = matrix.length
  const numCols = matrix[0]?.length ?? 0
  const m = matrix.map((row) => row.map((v) => ({ ...v })))

  const pivotCols: number[] = []
  let r = 0
  for (let c = 0; c < numCols && r < numRows; c++) {
    let pivotRow = -1
    for (let i = r; i < numRows; i++) {
      if (m[i][c].n !== 0n) {
        pivotRow = i
        break
      }
    }
    if (pivotRow === -1) continue

    if (pivotRow !== r) {
      const tmp = m[r]
      m[r] = m[pivotRow]
      m[pivotRow] = tmp
    }

    const piv = m[r][c]
    for (let j = c; j < numCols; j++) {
      m[r][j] = divRat(m[r][j], piv)
    }

    for (let i = 0; i < numRows; i++) {
      if (i === r || m[i][c].n === 0n) continue
      const factor = m[i][c]
      for (let j = c; j < numCols; j++) {
        m[i][j] = subRat(m[i][j], mulRat(factor, m[r][j]))
      }
    }

    pivotCols.push(c)
    r++
  }

  const pivotSet = new Set(pivotCols)
  const freeCols: number[] = []
  for (let c = 0; c < numCols; c++) {
    if (!pivotSet.has(c)) freeCols.push(c)
  }

  const basis: Rat[][] = []
  for (const freeCol of freeCols) {
    const vec: Rat[] = Array.from({ length: numCols }, () => RAT_ZERO)
    vec[freeCol] = RAT_ONE
    for (let i = 0; i < pivotCols.length; i++) {
      const pCol = pivotCols[i]
      vec[pCol] = negRat(m[i][freeCol])
    }
    basis.push(vec)
  }
  return basis
}

function normalizePositiveIntegers(vec: Rat[]): number[] | null {
  let commonDen = 1n
  for (const v of vec) {
    commonDen = lcmBig(commonDen, v.d)
  }
  const ints = vec.map((v) => v.n * (commonDen / v.d))
  const allPos = ints.every((x) => x > 0n)
  const allNeg = ints.every((x) => x < 0n)
  if (!allPos && !allNeg) return null
  const positive = allNeg ? ints.map((x) => -x) : ints

  let g = positive[0]
  for (let i = 1; i < positive.length; i++) {
    g = gcdBig(g, positive[i])
  }
  const reduced = positive.map((x) => Number(x / g))
  if (reduced.some((x) => !Number.isSafeInteger(x) || x <= 0)) return null
  return reduced
}

function findPositiveCombination(basis: Rat[][]): number[] | null {
  if (basis.length === 1) return normalizePositiveIntegers(basis[0])
  if (basis.length === 0) return null

  // Try equal sum first, then small integer weights
  const dim = basis[0].length
  const tryWeights = (weights: number[]): number[] | null => {
    const combined: Rat[] = Array.from({ length: dim }, () => RAT_ZERO)
    for (let b = 0; b < basis.length; b++) {
      const w = makeRat(BigInt(weights[b]))
      for (let i = 0; i < dim; i++) {
        combined[i] = addRat(combined[i], mulRat(w, basis[b][i]))
      }
    }
    return normalizePositiveIntegers(combined)
  }

  const ones = Array.from({ length: basis.length }, () => 1)
  const direct = tryWeights(ones)
  if (direct) return direct

  if (basis.length === 2) {
    for (let a = 1; a <= 6; a++) {
      for (let b = -6; b <= 6; b++) {
        if (b === 0) continue
        const res = tryWeights([a, b])
        if (res) return res
      }
    }
  } else if (basis.length === 3) {
    for (let a = 1; a <= 3; a++) {
      for (let b = -3; b <= 3; b++) {
        for (let c = -3; c <= 3; c++) {
          if (b === 0 && c === 0) continue
          const res = tryWeights([a, b, c])
          if (res) return res
        }
      }
    }
  }
  return null
}

// --- Reaction type classifier ---

function classifyReaction(
  reactants: BalancedParticipant[],
  products: BalancedParticipant[],
): string[] {
  const tags: string[] = []
  const rKeys = new Set(reactants.map((r) => buildCanonicalSignature(r.composition)))
  const pKeys = new Set(products.map((p) => buildCanonicalSignature(p.composition)))

  // Combustion: O2 on left + CO2 and/or H2O on right with C-containing fuel
  const hasO2 = reactants.some((r) => r.composition.O === 2 && Object.keys(r.composition).length === 1)
  const hasCO2 = products.some((p) => p.composition.C === 1 && p.composition.O === 2 && Object.keys(p.composition).length === 2)
  const hasH2O = products.some((p) => p.composition.H === 2 && p.composition.O === 1 && Object.keys(p.composition).length === 2)
  const hasOrganic = reactants.some((r) => (r.composition.C ?? 0) >= 1 && (r.composition.H ?? 0) >= 1)
  if (hasO2 && hasOrganic && (hasCO2 || hasH2O)) {
    tags.push('Combustion')
  }

  // Half-equation detection
  const hasFreeElectron =
    reactants.some((r) => r.formula === 'e') || products.some((p) => p.formula === 'e')
  if (hasFreeElectron) {
    tags.push('Demi-équation redox')
  }

  // Redox detection: free elemental substance changing into compound or single-element ion changing charge
  const hasElemental = (list: BalancedParticipant[]) =>
    list.some((item) => Object.keys(item.composition).length === 1 && item.charge === 0)
  const elementalChanged =
    (hasElemental(reactants) && !reactants.every((r) => pKeys.has(buildCanonicalSignature(r.composition)))) ||
    (hasElemental(products) && !products.every((p) => rKeys.has(buildCanonicalSignature(p.composition))))
  const ionChargeChanged = reactants.some(
    (r) =>
      Object.keys(r.composition).length === 1 &&
      products.some(
        (p) =>
          Object.keys(p.composition).length === 1 &&
          Object.keys(p.composition)[0] === Object.keys(r.composition)[0] &&
          p.charge !== r.charge,
      ),
  )
  const hasClassicOxidizer = reactants.some(
    (r) =>
      (r.composition.Mn === 1 && r.composition.O === 4) ||
      (r.composition.Cr === 2 && r.composition.O === 7) ||
      (r.composition.N === 1 && r.composition.O === 3 && products.some((p) => p.composition.N === 1 && p.composition.O === 1)),
  )

  if (!hasFreeElectron && (elementalChanged || ionChargeChanged || hasClassicOxidizer)) {
    tags.push('Oxydoréduction')
  }

  // Precipitation: aqueous reactants forming at least one solid product
  const formsSolid = products.some((p) => p.state === 'solid')
  const aqueousReactants = reactants.some((r) => r.state === 'aqueous' || r.charge !== 0)
  if (formsSolid && aqueousReactants && !tags.includes('Oxydoréduction')) {
    tags.push('Précipitation')
  }

  // Acid-base: H+/H3O+/OH- or H2O formation without redox
  const hasAcidBaseActor =
    reactants.some(
      (r) =>
        r.displayFormula === 'H⁺' ||
        r.displayFormula === 'H₃O⁺' ||
        r.displayFormula === 'OH⁻' ||
        r.matchedSpecies?.phCharacter === 'acidic_strong' ||
        r.matchedSpecies?.phCharacter === 'acidic_weak' ||
        r.matchedSpecies?.phCharacter === 'basic_strong' ||
        r.matchedSpecies?.phCharacter === 'basic_weak',
    ) && !tags.includes('Oxydoréduction')
  if (hasAcidBaseActor && (hasH2O || reactants.length >= 2)) {
    tags.push('Acide-base')
  }

  // Synthesis / Decomposition
  if (reactants.length >= 2 && products.length === 1) tags.push('Synthèse')
  if (reactants.length === 1 && products.length >= 2) tags.push('Décomposition')

  // Ionic vs molecular
  const isIonic = [...reactants, ...products].some((x) => x.charge !== 0)
  if (isIonic && !hasFreeElectron) tags.push('Équation ionique')

  return tags.length > 0 ? tags.slice(0, 3) : ['Réaction chimique']
}

function getTermIdentityKey(t: ParsedEquationTerm): string {
  if (t.formula === 'e' && t.charge === -1) return 'e|-1'
  return `${buildCanonicalSignature(t.composition)}|${t.charge}|${t.formula}`
}

function mergeSameSideTerms(terms: ParsedEquationTerm[]): ParsedEquationTerm[] {
  const byKey = new Map<string, ParsedEquationTerm>()
  for (const t of terms) {
    const key = getTermIdentityKey(t)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, { ...t })
    } else {
      const c1 = existing.userCoefficient ?? 1
      const c2 = t.userCoefficient ?? 1
      existing.userCoefficient = c1 + c2
    }
  }
  return [...byKey.values()]
}

function sortElementsChem(els: Iterable<string>): string[] {
  return [...els].sort((a, b) => {
    if (a === 'C') return -1
    if (b === 'C') return 1
    if (a === 'H') return -1
    if (b === 'H') return 1
    if (a === 'O') return -1
    if (b === 'O') return 1
    return a.localeCompare(b)
  })
}

interface SolvedSystem {
  reactants: ParsedEquationTerm[]
  products: ParsedEquationTerm[]
  coeffs: number[]
  basisLength: number
  allElements: string[]
  hasCharge: boolean
  autoCompleted: boolean
}

function trySolveTermSet(
  rTerms: ParsedEquationTerm[],
  pTerms: ParsedEquationTerm[],
  autoCompleted = false,
): SolvedSystem | null {
  if (rTerms.length === 0 || pTerms.length === 0) return null
  const leftEls = new Set<string>()
  const rightEls = new Set<string>()
  for (const r of rTerms) {
    for (const sym of Object.keys(r.composition)) leftEls.add(sym)
  }
  for (const p of pTerms) {
    for (const sym of Object.keys(p.composition)) rightEls.add(sym)
  }
  if (leftEls.size !== rightEls.size) return null
  for (const sym of leftEls) {
    if (!rightEls.has(sym)) return null
  }

  const allElements = sortElementsChem(leftEls)
  const allTerms = [...rTerms, ...pTerms]
  const hasCharge = allTerms.some((t) => t.charge !== 0)

  const matrix: Rat[][] = []
  for (const sym of allElements) {
    const row: Rat[] = []
    for (const r of rTerms) row.push(makeRat(BigInt(r.composition[sym] ?? 0)))
    for (const p of pTerms) row.push(makeRat(-BigInt(p.composition[sym] ?? 0)))
    matrix.push(row)
  }
  if (hasCharge) {
    const row: Rat[] = []
    for (const r of rTerms) row.push(makeRat(BigInt(r.charge)))
    for (const p of pTerms) row.push(makeRat(-BigInt(p.charge)))
    matrix.push(row)
  }

  if (matrix.length === 0) return null
  const basis = solveNullspaceRref(matrix)
  if (basis.length === 0) return null
  if (autoCompleted && basis.length !== 1) return null

  const coeffs = findPositiveCombination(basis)
  if (!coeffs) return null

  return {
    reactants: rTerms,
    products: pTerms,
    coeffs,
    basisLength: basis.length,
    allElements,
    hasCharge,
    autoCompleted,
  }
}

function gcdNumber(a: number, b: number): number {
  let x = Math.abs(Math.round(a))
  let y = Math.abs(Math.round(b))
  while (y !== 0) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}

function simplifyBalancedParticipants(
  rawReactants: BalancedParticipant[],
  rawProducts: BalancedParticipant[],
): { reactants: BalancedParticipant[]; products: BalancedParticipant[] } {
  let reactants = rawReactants.map((r) => ({ ...r }))
  let products = rawProducts.map((p) => ({ ...p }))

  // Check if all species on left and right are identical (e.g. H2O -> H2O)
  const rKeySet = new Set(reactants.map(getTermIdentityKey))
  const pKeySet = new Set(products.map(getTermIdentityKey))
  const allIdentical =
    rKeySet.size === pKeySet.size && [...rKeySet].every((k) => pKeySet.has(k))

  // Cancel any species appearing on both sides when there is a real net reaction
  if (!allIdentical) {
    for (const key of rKeySet) {
      if (!pKeySet.has(key)) continue
      const rItem = reactants.find((r) => getTermIdentityKey(r) === key)
      const pItem = products.find((p) => getTermIdentityKey(p) === key)
      if (!rItem || !pItem) continue
      const minC = Math.min(rItem.coefficient, pItem.coefficient)
      if (
        reactants.length > (rItem.coefficient === minC ? 1 : 0) &&
        products.length > (pItem.coefficient === minC ? 1 : 0)
      ) {
        rItem.coefficient -= minC
        pItem.coefficient -= minC
      }
    }
    reactants = reactants.filter((r) => r.coefficient > 0)
    products = products.filter((p) => p.coefficient > 0)
  }

  // Divide all coefficients by their GCD for irreducible stoichiometry
  const allCoeffs = [
    ...reactants.map((r) => r.coefficient),
    ...products.map((p) => p.coefficient),
  ]
  if (allCoeffs.length > 0) {
    let g = allCoeffs[0]
    for (let i = 1; i < allCoeffs.length; i++) {
      g = gcdNumber(g, allCoeffs[i])
    }
    if (g > 1) {
      for (const r of reactants) r.coefficient = Math.round(r.coefficient / g)
      for (const p of products) p.coefficient = Math.round(p.coefficient / g)
    }
  }

  return { reactants, products }
}

// --- Main public entry point ---

export function balanceChemicalEquation(
  rawEquation: string,
  elementsBySymbol: Map<string, ElementRecord>,
  speciesBySigAndCharge: Map<string, CatalogSpeciesRecord>,
): BalanceEquationResult {
  const cleaned = rawEquation.trim()
  if (!cleaned) {
    return {
      ok: false,
      errorFr: 'Saisissez une équation chimique (ex. Fe + O2 -> Fe2O3).',
      arrow: '->',
      reactants: [],
      products: [],
    }
  }

  // Detect arrow
  const arrowRegex = /\s*(<=>|<->|⇌|->|=>|→|=)\s*/
  const match = cleaned.match(arrowRegex)
  if (!match || match.index === undefined) {
    return {
      ok: false,
      errorFr: 'Ajoutez une flèche (->, →, ⇌ ou =) entre les réactifs et les produits.',
      arrow: '->',
      reactants: [],
      products: [],
    }
  }

  const arrowRaw = match[1]
  const arrow: EquationArrow =
    arrowRaw === '<=>' || arrowRaw === '<->' || arrowRaw === '⇌' ? '<=>' : '->'

  const leftStr = cleaned.slice(0, match.index).trim()
  const rightStr = cleaned.slice(match.index + match[0].length).trim()

  if (!leftStr || !rightStr) {
    return {
      ok: false,
      errorFr: 'Renseignez au moins un réactif à gauche et un produit à droite.',
      arrow,
      reactants: [],
      products: [],
    }
  }

  const leftRawTerms = splitEquationSideTerms(leftStr)
  const rightRawTerms = splitEquationSideTerms(rightStr)

  const parsedReactants: ParsedEquationTerm[] = []
  for (const raw of leftRawTerms) {
    const parsed = parseChemTerm(raw, elementsBySymbol, speciesBySigAndCharge)
    if ('errorFr' in parsed) {
      return {
        ok: false,
        errorFr: parsed.errorFr,
        arrow,
        reactants: parsedReactants,
        products: [],
      }
    }
    parsedReactants.push(parsed.term)
  }

  const parsedProducts: ParsedEquationTerm[] = []
  for (const raw of rightRawTerms) {
    const parsed = parseChemTerm(raw, elementsBySymbol, speciesBySigAndCharge)
    if ('errorFr' in parsed) {
      return {
        ok: false,
        errorFr: parsed.errorFr,
        arrow,
        reactants: parsedReactants,
        products: parsedProducts,
      }
    }
    parsedProducts.push(parsed.term)
  }

  const reactants = mergeSameSideTerms(parsedReactants)
  const products = mergeSameSideTerms(parsedProducts)

  if (reactants.length === 0 || products.length === 0) {
    return {
      ok: false,
      errorFr: 'Renseignez au moins un réactif et un produit.',
      arrow,
      reactants,
      products,
    }
  }

  // If the user wrote the same species on both sides alongside other reacting species,
  // also prepare a de-duplicated variant (removing the cross-side duplicate from one or both sides)
  let solved: SolvedSystem | null = null

  const rKeys = new Set(reactants.map(getTermIdentityKey))
  const pKeys = new Set(products.map(getTermIdentityKey))
  const sharedKeys = [...rKeys].filter((k) => pKeys.has(k))
  const allSame =
    sharedKeys.length === rKeys.size && sharedKeys.length === pKeys.size

  if (sharedKeys.length > 0 && !allSame) {
    // Try removing shared species from both sides (pure spectators), then from left only, then from right only
    const rWithout = reactants.filter((r) => !sharedKeys.includes(getTermIdentityKey(r)))
    const pWithout = products.filter((p) => !sharedKeys.includes(getTermIdentityKey(p)))
    solved =
      trySolveTermSet(rWithout, pWithout) ??
      trySolveTermSet(rWithout, products) ??
      trySolveTermSet(reactants, pWithout)
  }

  if (!solved) {
    solved = trySolveTermSet(reactants, products)
  }

  // If direct balancing failed, check if this is a half-equation or aqueous redox skeleton
  // that can be automatically completed with e⁻, H⁺(aq), and/or H₂O(l).
  if (!solved) {
    const leftEls = new Set<string>()
    const rightEls = new Set<string>()
    for (const r of reactants) {
      for (const sym of Object.keys(r.composition)) leftEls.add(sym)
    }
    for (const p of products) {
      for (const sym of Object.keys(p.composition)) rightEls.add(sym)
    }

    const nonHOOnlyLeft = [...leftEls].filter(
      (s) => s !== 'H' && s !== 'O' && !rightEls.has(s),
    )
    const nonHOOnlyRight = [...rightEls].filter(
      (s) => s !== 'H' && s !== 'O' && !leftEls.has(s),
    )

    if (nonHOOnlyLeft.length === 0 && nonHOOnlyRight.length === 0) {
      const presentKeys = new Set([
        ...reactants.map(getTermIdentityKey),
        ...products.map(getTermIdentityKey),
      ])
      const termElectron: ParsedEquationTerm = {
        raw: 'e-',
        formula: 'e',
        displayFormula: 'e⁻',
        composition: {},
        charge: -1,
        state: null,
        userCoefficient: null,
        molarMass: 0.000549,
        matchedSpecies: null,
      }
      const hPlusSpecies = speciesBySigAndCharge.get('H1|1') ?? null
      const termHPlus: ParsedEquationTerm = {
        raw: 'H+(aq)',
        formula: 'H',
        displayFormula: 'H⁺',
        composition: { H: 1 },
        charge: 1,
        state: 'aqueous',
        userCoefficient: null,
        molarMass: 1.008,
        matchedSpecies: hPlusSpecies,
      }
      const h2oSpecies = speciesBySigAndCharge.get('H2O1|0') ?? null
      const termH2O: ParsedEquationTerm = {
        raw: 'H2O(l)',
        formula: 'H2O',
        displayFormula: 'H₂O',
        composition: { H: 2, O: 1 },
        charge: 0,
        state: 'liquid',
        userCoefficient: null,
        molarMass: 18.015,
        matchedSpecies: h2oSpecies,
      }

      const candidateGroups: ParsedEquationTerm[][] = [
        [termElectron],
        [termH2O],
        [termHPlus],
        [termHPlus, termElectron],
        [termH2O, termElectron],
        [termH2O, termHPlus],
        [termH2O, termHPlus, termElectron],
      ]

      outer: for (const group of candidateGroups) {
        const missingHelpers = group.filter(
          (h) => !presentKeys.has(getTermIdentityKey(h)),
        )
        if (missingHelpers.length !== group.length) continue
        const totalCombos = 1 << missingHelpers.length
        for (let mask = 0; mask < totalCombos; mask++) {
          const rCand = [...reactants]
          const pCand = [...products]
          for (let i = 0; i < missingHelpers.length; i++) {
            if ((mask & (1 << i)) === 0) {
              rCand.push(missingHelpers[i])
            } else {
              pCand.push(missingHelpers[i])
            }
          }
          const attempt = trySolveTermSet(rCand, pCand, true)
          if (attempt) {
            solved = attempt
            break outer
          }
        }
      }
    }
  }

  if (!solved) {
    // Detailed diagnostic error when even auto-completion cannot balance
    const leftEls = new Set<string>()
    const rightEls = new Set<string>()
    for (const r of reactants) {
      for (const sym of Object.keys(r.composition)) leftEls.add(sym)
    }
    for (const p of products) {
      for (const sym of Object.keys(p.composition)) rightEls.add(sym)
    }
    const onlyLeft = [...leftEls].filter((s) => !rightEls.has(s))
    const onlyRight = [...rightEls].filter((s) => !leftEls.has(s))
    if (onlyLeft.length > 0 || onlyRight.length > 0) {
      const msgs: string[] = []
      if (onlyLeft.length > 0) {
        msgs.push(`${onlyLeft.join(', ')} présent dans les réactifs mais absent des produits`)
      }
      if (onlyRight.length > 0) {
        msgs.push(`${onlyRight.join(', ')} présent dans les produits mais absent des réactifs`)
      }
      return {
        ok: false,
        errorFr: `Conservation des éléments impossible : ${msgs.join(' ; ')}.`,
        hintFr: 'Ajoutez l’espèce manquante pour fermer le bilan.',
        arrow,
        reactants,
        products,
      }
    }

    return {
      ok: false,
      errorFr: 'Équilibrage impossible avec des coefficients strictement positifs.',
      hintFr:
        'Un réactif ou un produit se trouve probablement du mauvais côté de la flèche, ou une espèce manque.',
      arrow,
      reactants,
      products,
    }
  }

  const rawBalancedReactants: BalancedParticipant[] = solved.reactants.map((r, i) => ({
    ...r,
    side: 'reactant',
    coefficient: solved.coeffs[i],
  }))
  const rawBalancedProducts: BalancedParticipant[] = solved.products.map((p, i) => ({
    ...p,
    side: 'product',
    coefficient: solved.coeffs[solved.reactants.length + i],
  }))

  const { reactants: balancedReactants, products: balancedProducts } =
    simplifyBalancedParticipants(rawBalancedReactants, rawBalancedProducts)

  const allElements = solved.allElements
  const hasCharge = solved.hasCharge
  const basis = { length: solved.basisLength }

  const alreadyBalanced =
    !solved.autoCompleted &&
    balancedReactants.length === parsedReactants.length &&
    balancedProducts.length === parsedProducts.length &&
    balancedReactants.every((r, idx) => (parsedReactants[idx].userCoefficient ?? 1) === r.coefficient) &&
    balancedProducts.every((p, idx) => (parsedProducts[idx].userCoefficient ?? 1) === p.coefficient)

  const conservation: ConservationRow[] = allElements.map((sym) => {
    const left = balancedReactants.reduce(
      (sum, r) => sum + r.coefficient * (r.composition[sym] ?? 0),
      0,
    )
    const right = balancedProducts.reduce(
      (sum, p) => sum + p.coefficient * (p.composition[sym] ?? 0),
      0,
    )
    return {
      key: sym,
      label: elementsBySymbol.get(sym)?.nameFr ?? sym,
      left,
      right,
      balanced: left === right,
    }
  })

  if (hasCharge) {
    const leftCharge = balancedReactants.reduce(
      (sum, r) => sum + r.coefficient * r.charge,
      0,
    )
    const rightCharge = balancedProducts.reduce(
      (sum, p) => sum + p.coefficient * p.charge,
      0,
    )
    conservation.push({
      key: 'Charge',
      label: 'Charge électrique',
      left: leftCharge,
      right: rightCharge,
      balanced: leftCharge === rightCharge,
    })
  }

  const totalMassLeftGPerMol =
    Math.round(
      balancedReactants.reduce((sum, r) => sum + r.coefficient * r.molarMass, 0) * 100,
    ) / 100
  const totalMassRightGPerMol =
    Math.round(
      balancedProducts.reduce((sum, p) => sum + p.coefficient * p.molarMass, 0) * 100,
    ) / 100

  const arrowGlyph = arrow === '<=>' ? '⇌' : '→'
  const fmtPlainTerm = (t: BalancedParticipant) => {
    const st =
      t.state === 'solid'
        ? '(s)'
        : t.state === 'liquid'
          ? '(l)'
          : t.state === 'gas'
            ? '(g)'
            : t.state === 'aqueous'
              ? '(aq)'
              : ''
    return `${t.coefficient > 1 ? `${t.coefficient} ` : ''}${t.displayFormula}${st}`
  }
  const plainText = `${balancedReactants.map(fmtPlainTerm).join(' + ')} ${arrowGlyph} ${balancedProducts.map(fmtPlainTerm).join(' + ')}`

  const latexArrow = arrow === '<=>' ? '\\rightleftharpoons' : '\\rightarrow'
  const fmtLatexTerm = (t: BalancedParticipant) =>
    `${t.coefficient > 1 ? `${t.coefficient}\\,` : ''}${formatLatexFormula(t.formula, t.charge, t.state)}`
  const latexText = `${balancedReactants.map(fmtLatexTerm).join(' + ')} ${latexArrow} ${balancedProducts.map(fmtLatexTerm).join(' + ')}`

  return {
    ok: true,
    arrow,
    reactants: balancedReactants,
    products: balancedProducts,
    alreadyBalanced,
    underdetermined: basis.length > 1,
    reactionTypesFr: classifyReaction(balancedReactants, balancedProducts),
    conservation,
    totalMassLeftGPerMol,
    totalMassRightGPerMol,
    plainText,
    latexText,
  }
}
