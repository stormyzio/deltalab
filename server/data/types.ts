import type {
  DissolutionType,
  LewisStructure,
  PhCharacter,
  PhysicalState,
  ReactionCategory,
  SpeciesKind,
} from '../../shared/chemistry.ts'

export interface DissolutionProductDef {
  speciesId: string
  stoichiometry?: number
  state?: 'aqueous' | 'precipitate' | 'gas'
  noteFr?: string
}

export interface NamedSolutionDef {
  id: string
  nameFr: string
  formulaLabel: string
  colorHex?: string | null
  phEstimate?: number | null
  behaviors?: Record<string, unknown>
}

export interface AqueousBehaviorDef {
  soluble: boolean
  solubilityGPerL?: number | null
  dissolutionType?: DissolutionType
  colorHex?: string | null
  phCharacter?: PhCharacter
  dissociatesInto?: DissolutionProductDef[]
  solution?: NamedSolutionDef
}

export interface SpeciesSeed {
  id: string
  formula: string
  displayFormula: string
  nameFr: string
  kind: SpeciesKind
  charge?: number
  molarMass: number
  standardState: PhysicalState
  colorHex?: string | null
  composition: Record<string, number>
  mergeable?: boolean
  isSolvent?: boolean
  aqueous?: AqueousBehaviorDef
  lewis?: LewisStructure
  behaviors?: Record<string, unknown>
}

export interface CuratedReactionDef {
  id: string
  nameFr: string
  category: ReactionCategory
  equationDisplay: string
  medium: 'aqueous' | 'gas' | 'solid' | 'any'
  reactants: Array<{ speciesId: string; formulaDisplay?: string; stoichiometry: number }>
  products: Array<{ speciesId: string; formulaDisplay?: string; stoichiometry: number }>
  conditions?: Record<string, unknown>
  observationsFr: string
}

export function buildCompositionKey(composition: Record<string, number>): string {
  return Object.entries(composition)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sym, count]) => `${sym}:${count}`)
    .join('|')
}

export function buildSolutionSignatureKey(soluteIds: string[]): string {
  return [...new Set(soluteIds)].sort((a, b) => a.localeCompare(b)).join('+')
}

export function computeMolarMassFromComposition(
  composition: Record<string, number>,
  atomicMassBySymbol: Map<string, number>,
): number {
  let mass = 0
  for (const [sym, count] of Object.entries(composition)) {
    mass += (atomicMassBySymbol.get(sym) ?? 0) * count
  }
  return Math.round(mass * 1000) / 1000
}
