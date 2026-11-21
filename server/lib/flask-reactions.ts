import type {
  DissolvedSpeciesItem,
  FlaskActiveReaction,
  FlaskReactionParticipant,
  SoluteSummaryItem,
} from '../../shared/chemistry.ts'
import { detectAqueousAndSolutionReactions } from './flask-reactions/aqueous-detectors.ts'
import { detectNonAqueousAndCombustionReactions } from './flask-reactions/dry-rules.ts'
import type {
  FlaskReactionDetectorContext,
  InventoryEntry,
  ScoredReactionCandidate,
} from './flask-reactions/helpers.ts'

export type { FlaskReactionDetectorContext }

export function detectFlaskReactions(
  waterMol: number,
  totalVolumeL: number,
  dissolvedSpecies: DissolvedSpeciesItem[],
  solutes: SoluteSummaryItem[],
  ctx: FlaskReactionDetectorContext,
): FlaskActiveReaction[] {
  const hasWater = waterMol > 1e-6
  if (hasWater && totalVolumeL <= 0) return []
  if (!hasWater && dissolvedSpecies.length === 0 && solutes.length === 0) return []

  const inv = new Map<string, InventoryEntry>()
  if (hasWater) {
    inv.set('h2o', {
      speciesId: 'h2o',
      displayFormula: 'H₂O',
      nameFr: 'Eau',
      state: 'liquid',
      amountMol: waterMol,
      molarMass: 18.015,
      colorHex: '#bae6fd',
    })
  }

  for (const d of dissolvedSpecies) {
    if (d.amountMol <= 1e-8) continue
    const normalizedId = hasWater && d.speciesId === 'h_plus' ? 'h3o_plus' : d.speciesId
    const sp = ctx.getSpeciesById(normalizedId)
    const state: InventoryEntry['state'] =
      d.state === 'precipitate'
        ? 'solid'
        : d.state === 'gas'
          ? 'gas'
          : !hasWater && sp?.standardState === 'liquid'
            ? 'liquid'
            : !hasWater && sp?.standardState === 'gas'
              ? 'gas'
              : !hasWater && sp?.standardState === 'solid'
                ? 'solid'
                : 'aqueous'
    const existing = inv.get(normalizedId)
    if (existing) {
      existing.amountMol += d.amountMol
    } else {
      inv.set(normalizedId, {
        speciesId: normalizedId,
        displayFormula: normalizedId === 'h3o_plus' ? 'H₃O⁺' : d.displayFormula,
        nameFr: normalizedId === 'h3o_plus' ? 'Ion oxonium' : d.nameFr,
        state,
        amountMol: d.amountMol,
        molarMass: sp?.molarMass ?? 50,
        colorHex: d.colorHex ?? sp?.solutionColorHex ?? sp?.colorHex ?? null,
      })
    }
  }

  for (const s of solutes) {
    if (s.undissolvedMol <= 1e-8) continue
    const sp = ctx.getSpeciesById(s.speciesId)
    if (!sp) continue
    if (hasWater && sp.standardState !== 'solid') continue
    if (hasWater && !s.isImmersedSolid && s.dissolvedMol > 0) continue
    const existing = inv.get(s.speciesId)
    if (existing) {
      existing.amountMol += s.undissolvedMol
    } else {
      inv.set(s.speciesId, {
        speciesId: s.speciesId,
        displayFormula: s.displayFormula,
        nameFr: s.nameFr,
        state:
          sp.standardState === 'gas'
            ? 'gas'
            : sp.standardState === 'liquid'
              ? 'liquid'
              : 'solid',
        amountMol: s.undissolvedMol,
        molarMass: s.molarMass,
        colorHex: s.colorHex ?? sp.colorHex ?? '#d4d4d8',
      })
    }
  }

  const makeParticipant = (
    speciesId: string,
    stoichiometry: number,
    fallback: {
      displayFormula: string
      nameFr: string
      state: 'aqueous' | 'solid' | 'liquid' | 'gas'
      colorHex?: string | null
      molarMass?: number
    },
  ): FlaskReactionParticipant => {
    const cur = inv.get(speciesId)
    const sp = ctx.getSpeciesById(speciesId)
    return {
      speciesId,
      displayFormula:
        cur?.displayFormula ?? sp?.displayFormula ?? fallback.displayFormula,
      nameFr: cur?.nameFr ?? sp?.nameFr ?? fallback.nameFr,
      stoichiometry,
      state: cur?.state ?? fallback.state,
      colorHex:
        cur?.colorHex ??
        (fallback.state === 'aqueous'
          ? sp?.solutionColorHex ?? fallback.colorHex ?? null
          : sp?.colorHex ?? fallback.colorHex ?? null),
      initialMol: cur?.amountMol ?? 0,
      molarMass: cur?.molarMass ?? sp?.molarMass ?? fallback.molarMass ?? 50,
    }
  }

  const candidates: ScoredReactionCandidate[] = []
  const seenIds = new Set<string>()
  const addCandidate = (res: ScoredReactionCandidate | null) => {
    if (!res || seenIds.has(res.reaction.id)) return
    seenIds.add(res.reaction.id)
    candidates.push(res)
  }

  detectAqueousAndSolutionReactions(
    hasWater,
    totalVolumeL,
    inv,
    ctx,
    makeParticipant,
    addCandidate,
  )
  detectNonAqueousAndCombustionReactions(
    hasWater,
    inv,
    ctx,
    makeParticipant,
    addCandidate,
  )

  candidates.sort((a, b) => b.priority - a.priority)
  return candidates.slice(0, 6).map((c) => c.reaction)
}
