import type {
  AcidBaseCoupleRecord,
  FlaskActiveReaction,
  FlaskReactionParticipant,
  ReactionCategory,
  RedoxCoupleRecord,
  SolubilityProductRecord,
  SpeciesRecord,
} from '../../../shared/chemistry.ts'
import { roundTo } from '../math-format.ts'

export interface FlaskReactionDetectorContext {
  redoxCouples: RedoxCoupleRecord[]
  solubilityProducts: SolubilityProductRecord[]
  acidBaseCouples: AcidBaseCoupleRecord[]
  getSpeciesById: (id: string) => SpeciesRecord | null
  /** For each saturated solute (with undissolved solid), map of productSpeciesId -> dissolved mol contributed */
  saturatedSoluteContributions?: Array<Map<string, number>>
}

export interface InventoryEntry {
  speciesId: string
  displayFormula: string
  nameFr: string
  state: 'aqueous' | 'solid' | 'liquid' | 'gas'
  amountMol: number
  molarMass: number
  colorHex: string | null
}

export type MakeParticipantFn = (
  speciesId: string,
  stoichiometry: number,
  fallback: {
    displayFormula: string
    nameFr: string
    state: 'aqueous' | 'solid' | 'liquid' | 'gas'
    colorHex?: string | null
    molarMass?: number
  },
) => FlaskReactionParticipant

export type ScoredReactionCandidate = {
  reaction: FlaskActiveReaction
  priority: number
}

export type AddCandidateFn = (res: ScoredReactionCandidate | null) => void

export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a))
  let y = Math.abs(Math.trunc(b))
  while (y !== 0) {
    const t = y
    y = x % y
    x = t
  }
  return x || 1
}

export function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b)
}

function coeffFormula(
  n: number,
  formula: string,
  state: 'aqueous' | 'solid' | 'liquid' | 'gas',
): string {
  const tag =
    state === 'aqueous'
      ? '(aq)'
      : state === 'solid'
        ? '(s)'
        : state === 'gas'
          ? '(g)'
          : '(l)'
  return n === 1 ? `${formula}${tag}` : `${n} ${formula}${tag}`
}

function buildEquation(
  reactants: FlaskReactionParticipant[],
  products: FlaskReactionParticipant[],
  arrow = '→',
): string {
  const lhs = reactants
    .map((r) => coeffFormula(r.stoichiometry, r.displayFormula, r.state))
    .join(' + ')
  const rhs = products
    .map((p) => coeffFormula(p.stoichiometry, p.displayFormula, p.state))
    .join(' + ')
  return `${lhs} ${arrow} ${rhs}`
}

export function formatDeNomFr(nameFr: string): string {
  const trimmed = nameFr.trim()
  if (!trimmed) return ''
  const lowered = trimmed[0].toLowerCase() + trimmed.slice(1)
  const startsVowel = /^[aàâäeéèêëiîïoôöuùûüyh]/i.test(lowered)
  return startsVowel ? `d’${lowered}` : `de ${lowered}`
}

export function finalizeReaction(
  base: {
    id: string
    nameFr: string
    category: ReactionCategory
    equilibriumLabel: string | null
    observationsFr: string
    arrow?: string
    precipitateColorHex?: string | null
    priority: number
  },
  reactants: FlaskReactionParticipant[],
  products: FlaskReactionParticipant[],
): ScoredReactionCandidate | null {
  if (reactants.length === 0 || products.length === 0) return null

  let xMax = Infinity
  for (const r of reactants) {
    if (r.speciesId === 'h2o' && r.state === 'liquid') continue
    const ratio = r.initialMol / r.stoichiometry
    if (ratio < xMax) xMax = ratio
  }
  if (!Number.isFinite(xMax) || xMax <= 1e-7) return null

  const cleanXMax = roundTo(xMax, 6)
  const markedReactants = reactants.map((r) => ({
    ...r,
    initialMol: roundTo(r.initialMol, 6),
    isLimiting:
      !(r.speciesId === 'h2o' && r.state === 'liquid') &&
      Math.abs(r.initialMol / r.stoichiometry - xMax) <= xMax * 1e-4 + 1e-8,
  }))
  const markedProducts = products.map((p) => ({
    ...p,
    initialMol: roundTo(p.initialMol, 6),
  }))

  const evolvesGas = markedProducts.some((p) => p.state === 'gas')
  const solidProductColor =
    base.precipitateColorHex ??
    markedProducts.find((p) => p.state === 'solid' && p.colorHex)?.colorHex ??
    null

  return {
    priority: base.priority,
    reaction: {
      id: base.id,
      nameFr: base.nameFr,
      category: base.category,
      equationDisplay: buildEquation(
        markedReactants,
        markedProducts,
        base.arrow ?? '→',
      ),
      equilibriumLabel: base.equilibriumLabel,
      observationsFr: base.observationsFr,
      reactants: markedReactants,
      products: markedProducts,
      xMaxMol: cleanXMax,
      evolvesGas,
      precipitateColorHex: solidProductColor,
    },
  }
}
