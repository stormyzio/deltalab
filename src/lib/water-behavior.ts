import type { SpeciesRecord } from '../../shared/chemistry.ts'
import { formatFrNumber } from '@/lib/chemistry-ui'

export type SolubilityTier =
  | 'solvent'
  | 'miscible'
  | 'soluble'
  | 'sparingly_soluble'
  | 'insoluble'
  | 'ion'
  | 'unknown'

export interface WaterBehaviorSummary {
  tier: SolubilityTier
  /** Concise qualitative label, strictly monotonic with solubilityGPerL */
  tierLabel: string
  /** Exact formatted value when known (e.g. "359 g/L", "0,16 g/L", "< 0,01 g/L") */
  valueLabel: string | null
  /** Compact combined label for KPI cells */
  shortLabel: string
  /** Clear, consistent French explanation */
  descriptionFr: string
  /** Whether the species is meaningfully soluble / miscible (>= 1 g/L or miscible) */
  isEffectivelySoluble: boolean
}

function formatSolubilityValue(val: number): string {
  if (val <= 0) return '0 g/L'
  if (val < 0.001) return '< 0,001 g/L'
  if (val < 0.01) return '< 0,01 g/L'
  if (val < 1) return `${formatFrNumber(val, 2)} g/L`
  if (val < 10) return `${formatFrNumber(val, 1)} g/L`
  return `${formatFrNumber(val, 0)} g/L`
}

/**
 * Classifies water solubility/miscibility strictly from 3 clear quantitative tiers:
 *   - < 0,01 g/L    : Insoluble (solides/gaz) / Non miscible (liquides)
 *   - 0,01 – 1 g/L  : Peu soluble / Peu miscible (+ valeur g/L)
 *   - >= 1 g/L      : Soluble / Miscible (+ valeur g/L, ou Miscible en toutes proportions)
 */
export function describeWaterBehavior(sp: SpeciesRecord): WaterBehaviorSummary {
  if (sp.isSolvent) {
    return {
      tier: 'solvent',
      tierLabel: 'Solvant',
      valueLabel: null,
      shortLabel: 'Solvant',
      descriptionFr: 'Solvant polaire principal utilisé pour préparer les solutions aqueuses.',
      isEffectivelySoluble: true,
    }
  }

  if (sp.kind === 'ion') {
    const sol = sp.canDissolveInWater || sp.solubilityGPerL !== null
    return {
      tier: sol ? 'ion' : 'unknown',
      tierLabel: sol ? 'Ion aqueux' : 'Non renseigné',
      valueLabel: sp.solubilityGPerL !== null ? formatSolubilityValue(sp.solubilityGPerL) : null,
      shortLabel: sol ? 'Ion aqueux' : 'Non renseigné',
      descriptionFr: sol
        ? 'Ion présent uniquement dissous dans l’eau (entouré de molécules H₂O, noté (aq)) ; sa solubilité dépend du sel complet.'
        : 'Espèce ionique (données de solubilité non renseignées).',
      isEffectivelySoluble: sol,
    }
  }

  const solVal = sp.solubilityGPerL
  const isLiquid = sp.standardState === 'liquid'
  const isGas = sp.standardState === 'gas'

  // Miscible liquids (explicitly flagged as miscible in all proportions)
  if (isLiquid && sp.dissolutionType === 'miscible') {
    return {
      tier: 'miscible',
      tierLabel: 'Miscible',
      valueLabel: null,
      shortLabel: 'Miscible',
      descriptionFr: 'Liquide miscible à l’eau en toutes proportions (aucune limite en g/L, une seule phase).',
      isEffectivelySoluble: true,
    }
  }

  const density =
    typeof sp.densityGPerCm3 === 'number' && sp.densityGPerCm3 > 0
      ? sp.densityGPerCm3
      : typeof sp.behaviors?.densityGPerMl === 'number' && sp.behaviors.densityGPerMl > 0
        ? sp.behaviors.densityGPerMl
        : null

  const liquidPhaseNote =
    density !== null
      ? density < 1
        ? `flotte sur l’eau, d = ${formatFrNumber(density, 2)}`
        : `coule sous l’eau, d = ${formatFrNumber(density, 2)}`
      : 'deux phases distinctes'

  // Strictly quantitative 3-tier classification whenever solubilityGPerL is known
  if (solVal !== null && Number.isFinite(solVal)) {
    const valueLabel = formatSolubilityValue(solVal)

    if (solVal < 0.01) {
      const tierLabel = isLiquid ? 'Non miscible' : 'Insoluble'
      return {
        tier: 'insoluble',
        tierLabel,
        valueLabel: null,
        shortLabel: tierLabel,
        descriptionFr: isLiquid
          ? `Liquide non miscible à l’eau (${valueLabel}) : forme deux phases distinctes (${liquidPhaseNote}).`
          : isGas
            ? `Gaz insoluble dans l’eau (${valueLabel} à 20 °C).`
            : `Solide insoluble dans l’eau (${valueLabel}) : reste immergé au fond (filtrable).`,
        isEffectivelySoluble: false,
      }
    }

    if (solVal < 1) {
      const tierLabel = isLiquid ? 'Peu miscible' : 'Peu soluble'
      return {
        tier: 'sparingly_soluble',
        tierLabel,
        valueLabel,
        shortLabel: `${tierLabel} (${valueLabel})`,
        descriptionFr: isLiquid
          ? `Liquide peu miscible à l’eau (${valueLabel}) : forme deux phases au-delà (${liquidPhaseNote}).`
          : isGas
            ? `Gaz peu soluble dans l’eau (${valueLabel} à 20 °C).`
            : `Solide peu soluble dans l’eau (${valueLabel} à 20 °C) : sature rapidement.`,
        isEffectivelySoluble: false,
      }
    }

    // >= 1 g/L
    const tierLabel = isLiquid ? 'Miscible' : 'Soluble'
    return {
      tier: 'soluble',
      tierLabel,
      valueLabel,
      shortLabel: `${tierLabel} (${valueLabel})`,
      descriptionFr: isLiquid
        ? `Liquide miscible jusqu’à ${valueLabel} à 20 °C (deux phases au-delà · ${liquidPhaseNote}).`
        : isGas
          ? `Gaz soluble dans l’eau (${valueLabel} à 20 °C ; diminue quand T augmente).`
          : `Solide soluble dans l’eau jusqu’à ${valueLabel} à 20 °C.`,
      isEffectivelySoluble: true,
    }
  }

  // Fallback when solubilityGPerL is null
  if (sp.canDissolveInWater) {
    const tierLabel = isLiquid ? 'Miscible' : 'Soluble'
    return {
      tier: 'soluble',
      tierLabel,
      valueLabel: null,
      shortLabel: tierLabel,
      descriptionFr: isLiquid
        ? 'Liquide miscible à l’eau.'
        : isGas
          ? 'Gaz soluble dans l’eau (valeur exacte en g/L non renseignée).'
          : 'Solide soluble dans l’eau (valeur exacte en g/L non renseignée).',
      isEffectivelySoluble: true,
    }
  }

  const tierLabel = isLiquid ? 'Non miscible' : 'Insoluble'
  return {
    tier: 'insoluble',
    tierLabel,
    valueLabel: null,
    shortLabel: tierLabel,
    descriptionFr: isLiquid
      ? `Liquide non miscible à l’eau : forme deux phases distinctes (${liquidPhaseNote}).`
      : isGas
        ? 'Gaz insoluble dans l’eau.'
        : 'Solide insoluble dans l’eau : reste immergé (filtrable).',
    isEffectivelySoluble: false,
  }
}

/**
 * Ultra-fast zero-allocation numeric sort key for H2O solubility/miscibility.
 * Order (desc): Solvant > Miscible/Soluble sans limite > Ion aqueux > Soluble/Miscible (g/L)
 * > Peu soluble/miscible (g/L) > Insoluble/Non miscible > Non renseigné (always last).
 */
export function getSolubilitySortValue(sp: SpeciesRecord): number | null {
  if (sp.isSolvent) return 1e13
  if (sp.standardState === 'liquid' && sp.dissolutionType === 'miscible') return 1e12
  if (sp.kind === 'ion') {
    if (sp.solubilityGPerL !== null && Number.isFinite(sp.solubilityGPerL)) {
      return sp.solubilityGPerL
    }
    return sp.canDissolveInWater ? 1e11 : null
  }
  if (sp.solubilityGPerL !== null && Number.isFinite(sp.solubilityGPerL)) {
    return sp.solubilityGPerL
  }
  if (sp.canDissolveInWater) return 1e12
  return 0
}
