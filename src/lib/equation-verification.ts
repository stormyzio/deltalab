import type {
  CatalogReactionRecord,
  CatalogSpeciesRecord,
  ElementRecord,
  PredictedReactionItem,
} from '../../shared/chemistry.ts'
import { api } from './api.ts'
import { buildCanonicalSignature } from './chemistry-calc.ts'
import {
  type BalancedParticipant,
  type EquationArrow,
  balanceChemicalEquation,
} from './equation-balancer.ts'

export type EquationRealityStatus =
  | { kind: 'half_equation' }
  | { kind: 'checking' }
  | {
      kind: 'known'
      titleFr: string
      equilibriumLabel?: string | null
    }
  | {
      kind: 'non_spontaneous'
      titleFr: string
      reasonFr: string
      equilibriumLabel?: string | null
    }
  | { kind: 'spectator_only' }
  | {
      kind: 'unlisted'
      suggestedEquation?: string | null
    }
  | {
      kind: 'unknown_species'
      unknownFormulas: string[]
    }

const WATER_KEY = 'H2O1|0'
const ACID_KEY = 'H_ACID'

function canonicalKey(composition: Record<string, number>, charge: number): string {
  const sig = buildCanonicalSignature(composition)
  if ((sig === 'H1' && charge === 1) || (sig === 'H3O1' && charge === 1)) {
    return ACID_KEY
  }
  return `${sig}|${charge}`
}

function isElectronParticipant(p: BalancedParticipant): boolean {
  return (
    p.formula === 'e-' ||
    p.displayFormula === 'e⁻' ||
    (Object.keys(p.composition).length === 0 && p.charge === -1)
  )
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) {
    if (!b.has(v)) return false
  }
  return true
}

function withoutWater(s: Set<string>): Set<string> {
  const next = new Set<string>()
  for (const v of s) {
    if (v !== WATER_KEY) next.add(v)
  }
  return next
}

function sideKeySetsMatch(
  aLeft: Set<string>,
  aRight: Set<string>,
  bLeft: Set<string>,
  bRight: Set<string>,
): boolean {
  if (setsEqual(aLeft, bLeft) && setsEqual(aRight, bRight)) return true

  // Allow H2O difference when H+ / H3O+ acid notation differs between equations
  const hasAcid =
    aLeft.has(ACID_KEY) ||
    aRight.has(ACID_KEY) ||
    bLeft.has(ACID_KEY) ||
    bRight.has(ACID_KEY)
  if (!hasAcid) return false

  const aL = withoutWater(aLeft)
  const aR = withoutWater(aRight)
  const bL = withoutWater(bLeft)
  const bR = withoutWater(bRight)
  if (aL.size === 0 || aR.size === 0 || bL.size === 0 || bR.size === 0) return false
  return setsEqual(aL, bL) && setsEqual(aR, bR)
}

interface EquationSignatures {
  rawLeft: Set<string>
  rawRight: Set<string>
  netLeft: Set<string>
  netRight: Set<string>
  isSpectatorOnly: boolean
}

function expandSideKeys(
  participants: Array<{
    composition: Record<string, number>
    charge: number
    state?: string | null
    matchedSpecies: CatalogSpeciesRecord | null
  }>,
  speciesById: Map<string, CatalogSpeciesRecord>,
): { raw: Set<string>; expanded: Set<string>; dissolvedAny: boolean } {
  const raw = new Set<string>()
  const expanded = new Set<string>()
  let dissolvedAny = false

  for (const p of participants) {
    const key = canonicalKey(p.composition, p.charge)
    raw.add(key)

    const sp = p.matchedSpecies
    const canDissolve =
      sp &&
      sp.dissolutionProducts.length > 0 &&
      (p.state === 'aqueous' || p.state == null)

    if (canDissolve) {
      let addedAny = false
      for (const dp of sp.dissolutionProducts) {
        const ion = speciesById.get(dp.speciesId)
        if (ion) {
          expanded.add(canonicalKey(ion.composition, ion.charge))
          addedAny = true
        }
      }
      if (addedAny) {
        dissolvedAny = true
        continue
      }
    }

    expanded.add(key)
  }

  return { raw, expanded, dissolvedAny }
}

function buildEquationSignatures(
  reactants: Array<{
    composition: Record<string, number>
    charge: number
    state?: string | null
    matchedSpecies: CatalogSpeciesRecord | null
  }>,
  products: Array<{
    composition: Record<string, number>
    charge: number
    state?: string | null
    matchedSpecies: CatalogSpeciesRecord | null
  }>,
  speciesById: Map<string, CatalogSpeciesRecord>,
): EquationSignatures {
  const left = expandSideKeys(reactants, speciesById)
  const right = expandSideKeys(products, speciesById)

  const netLeft = new Set<string>()
  const netRight = new Set<string>()
  for (const k of left.expanded) {
    if (!right.expanded.has(k)) netLeft.add(k)
  }
  for (const k of right.expanded) {
    if (!left.expanded.has(k)) netRight.add(k)
  }

  const isSpectatorOnly =
    (left.dissolvedAny || right.dissolvedAny) &&
    netLeft.size === 0 &&
    netRight.size === 0

  return {
    rawLeft: left.raw,
    rawRight: right.raw,
    netLeft: netLeft.size > 0 ? netLeft : left.raw,
    netRight: netRight.size > 0 ? netRight : right.raw,
    isSpectatorOnly,
  }
}

function signaturesMatchDirection(
  a: EquationSignatures,
  b: EquationSignatures,
): 'forward' | 'reverse' | null {
  if (
    sideKeySetsMatch(a.rawLeft, a.rawRight, b.rawLeft, b.rawRight) ||
    sideKeySetsMatch(a.netLeft, a.netRight, b.rawLeft, b.rawRight) ||
    sideKeySetsMatch(a.rawLeft, a.rawRight, b.netLeft, b.netRight) ||
    sideKeySetsMatch(a.netLeft, a.netRight, b.netLeft, b.netRight)
  ) {
    return 'forward'
  }
  if (
    sideKeySetsMatch(a.rawLeft, a.rawRight, b.rawRight, b.rawLeft) ||
    sideKeySetsMatch(a.netLeft, a.netRight, b.rawRight, b.rawLeft) ||
    sideKeySetsMatch(a.rawLeft, a.rawRight, b.netRight, b.netLeft) ||
    sideKeySetsMatch(a.netLeft, a.netRight, b.netRight, b.netLeft)
  ) {
    return 'reverse'
  }
  return null
}

function reactionEquilibriumLabel(rxn: CatalogReactionRecord): string | null {
  if (typeof rxn.conditions?.pKs === 'number') {
    return `pKs = ${String(rxn.conditions.pKs).replace('.', ',')}`
  }
  if (typeof rxn.conditions?.deltaE0V === 'number') {
    return `ΔE° = +${String(rxn.conditions.deltaE0V).replace('.', ',')} V`
  }
  return null
}

function extractPredictIds(participants: BalancedParticipant[]): string[] | null {
  const uniqueIds: string[] = []
  for (const p of participants) {
    const id = p.matchedSpecies?.id
    if (!id) return null
    if (!uniqueIds.includes(id)) uniqueIds.push(id)
  }
  const nonWater = uniqueIds.filter((id) => id !== 'h2o')
  const picked =
    nonWater.length >= 2 && nonWater.length <= 3
      ? nonWater
      : uniqueIds.length >= 2 && uniqueIds.length <= 3
        ? uniqueIds
        : null
  return picked
}

export interface SyncRealityCheck {
  /** Final status when no async verification is needed, or null if async check should run */
  immediateStatus: EquationRealityStatus | null
  /** Fallback reverse match found in catalog.reactions (used if async check finds no forward match) */
  reverseFallback: Extract<EquationRealityStatus, { kind: 'non_spontaneous' }> | null
  userSig: EquationSignatures | null
}

export function checkEquationRealitySync(
  reactants: BalancedParticipant[],
  products: BalancedParticipant[],
  arrow: EquationArrow,
  catalogReactions: CatalogReactionRecord[],
  speciesById: Map<string, CatalogSpeciesRecord>,
): SyncRealityCheck {
  if (
    reactants.some(isElectronParticipant) ||
    products.some(isElectronParticipant)
  ) {
    return {
      immediateStatus: { kind: 'half_equation' },
      reverseFallback: null,
      userSig: null,
    }
  }

  const unknownFormulas: string[] = []
  for (const p of [...reactants, ...products]) {
    if (!p.matchedSpecies && !unknownFormulas.includes(p.displayFormula)) {
      unknownFormulas.push(p.displayFormula)
    }
  }
  if (unknownFormulas.length > 0) {
    return {
      immediateStatus: { kind: 'unknown_species', unknownFormulas },
      reverseFallback: null,
      userSig: null,
    }
  }

  const userSig = buildEquationSignatures(reactants, products, speciesById)
  if (userSig.isSpectatorOnly) {
    return {
      immediateStatus: { kind: 'spectator_only' },
      reverseFallback: null,
      userSig,
    }
  }

  let reverseFallback: Extract<EquationRealityStatus, { kind: 'non_spontaneous' }> | null =
    null

  for (const rxn of catalogReactions) {
    const rxnLeft = rxn.reactants
      .map((r) => speciesById.get(r.speciesId))
      .filter((s): s is CatalogSpeciesRecord => Boolean(s))
      .map((sp) => ({
        composition: sp.composition,
        charge: sp.charge,
        state: rxn.medium === 'aqueous' ? 'aqueous' : sp.standardState,
        matchedSpecies: sp,
      }))
    const rxnRight = rxn.products
      .map((p) => speciesById.get(p.speciesId))
      .filter((s): s is CatalogSpeciesRecord => Boolean(s))
      .map((sp) => ({
        composition: sp.composition,
        charge: sp.charge,
        state: rxn.medium === 'aqueous' ? 'aqueous' : sp.standardState,
        matchedSpecies: sp,
      }))
    if (
      rxnLeft.length !== rxn.reactants.length ||
      rxnRight.length !== rxn.products.length
    ) {
      continue
    }

    const rxnSig = buildEquationSignatures(rxnLeft, rxnRight, speciesById)
    const dir = signaturesMatchDirection(userSig, rxnSig)
    if (dir === 'forward') {
      return {
        immediateStatus: {
          kind: 'known',
          titleFr: rxn.nameFr,
          equilibriumLabel: reactionEquilibriumLabel(rxn),
        },
        reverseFallback: null,
        userSig,
      }
    }
    if (dir === 'reverse') {
      if (rxn.category === 'acid_base' && arrow === '<=>') {
        return {
          immediateStatus: {
            kind: 'known',
            titleFr: rxn.nameFr,
            equilibriumLabel: reactionEquilibriumLabel(rxn),
          },
          reverseFallback: null,
          userSig,
        }
      }
      if (!reverseFallback) {
        reverseFallback = {
          kind: 'non_spontaneous',
          titleFr: `Sens inverse de « ${rxn.nameFr} »`,
          reasonFr: `La réaction spontanée se produit dans le sens opposé (${rxn.equationDisplay}).`,
          equilibriumLabel: reactionEquilibriumLabel(rxn),
        }
      }
    }
  }

  return { immediateStatus: null, reverseFallback, userSig }
}

function matchPredictedItems(
  items: PredictedReactionItem[],
  userSig: EquationSignatures,
  elementsBySymbol: Map<string, ElementRecord>,
  speciesBySigAndCharge: Map<string, CatalogSpeciesRecord>,
  speciesById: Map<string, CatalogSpeciesRecord>,
): { matched: PredictedReactionItem; dir: 'forward' | 'reverse' } | null {
  for (const item of items) {
    const parsed = balanceChemicalEquation(
      item.equationDisplay,
      elementsBySymbol,
      speciesBySigAndCharge,
    )
    if (!parsed.ok) continue
    const predSig = buildEquationSignatures(
      parsed.reactants,
      parsed.products,
      speciesById,
    )
    const dir = signaturesMatchDirection(userSig, predSig)
    if (dir) return { matched: item, dir }
  }
  return null
}

export async function verifyEquationRealityAsync(params: {
  reactants: BalancedParticipant[]
  products: BalancedParticipant[]
  userSig: EquationSignatures
  reverseFallback: Extract<EquationRealityStatus, { kind: 'non_spontaneous' }> | null
  elementsBySymbol: Map<string, ElementRecord>
  speciesBySigAndCharge: Map<string, CatalogSpeciesRecord>
  speciesById: Map<string, CatalogSpeciesRecord>
}): Promise<EquationRealityStatus> {
  const {
    reactants,
    products,
    userSig,
    reverseFallback,
    elementsBySymbol,
    speciesBySigAndCharge,
    speciesById,
  } = params

  let suggestedEquation: string | null = null

  // 1. Query forward reactants in reaction predictor
  const fwdIds = extractPredictIds(reactants)
  if (fwdIds) {
    try {
      const resp = await api.predictReaction(fwdIds[0], fwdIds[1], fwdIds[2])
      const hit = matchPredictedItems(
        resp.reactions,
        userSig,
        elementsBySymbol,
        speciesBySigAndCharge,
        speciesById,
      )
      if (hit && hit.dir === 'forward') {
        if (hit.matched.spontaneous) {
          return {
            kind: 'known',
            titleFr: hit.matched.titleFr,
            equilibriumLabel: hit.matched.equilibriumLabel,
          }
        }
        return {
          kind: 'non_spontaneous',
          titleFr: hit.matched.titleFr,
          reasonFr:
            hit.matched.detailsFr ||
            'Équation correcte, mais thermodynamiquement défavorable dans ce sens.',
          equilibriumLabel: hit.matched.equilibriumLabel,
        }
      }
      const firstSpontaneous = resp.reactions.find((r) => r.spontaneous)
      if (firstSpontaneous) {
        suggestedEquation = firstSpontaneous.equationDisplay
      }
    } catch {
      // Fall through cleanly if predictor is unavailable for a species
    }
  }

  // 2. If not matched forward, check if reverse direction is a known spontaneous reaction
  if (reverseFallback) return reverseFallback

  const revIds = extractPredictIds(products)
  if (revIds) {
    try {
      const resp = await api.predictReaction(revIds[0], revIds[1], revIds[2])
      const hit = matchPredictedItems(
        resp.reactions,
        userSig,
        elementsBySymbol,
        speciesBySigAndCharge,
        speciesById,
      )
      if (hit && hit.dir === 'reverse' && hit.matched.spontaneous) {
        return {
          kind: 'non_spontaneous',
          titleFr: hit.matched.titleFr,
          reasonFr: `La réaction spontanée a lieu dans le sens inverse (${hit.matched.equationDisplay}).`,
          equilibriumLabel: hit.matched.equilibriumLabel,
        }
      }
    } catch {
      // Ignore
    }
  }

  return { kind: 'unlisted', suggestedEquation }
}
