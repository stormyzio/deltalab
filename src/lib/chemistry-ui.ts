import type {
  DissolutionType,
  ElementCategory,
  ElementRecord,
  FlaskSolutionState,
  PhCharacter,
  PhysicalState,
  ReactionCategory,
  SpeciesKind,
  SpeciesRecord,
} from '../../shared/chemistry.ts'

export interface CategoryMeta {
  labelFr: string
  shortFr: string
  accentHex: string
}

export const CATEGORY_META: Record<ElementCategory, CategoryMeta> = {
  nonmetal: { labelFr: 'Non-métal', shortFr: 'Non-métaux', accentHex: '#60a5fa' },
  'noble-gas': { labelFr: 'Gaz noble', shortFr: 'Gaz nobles', accentHex: '#22d3ee' },
  'alkali-metal': { labelFr: 'Métal alcalin', shortFr: 'Alcalins', accentHex: '#f43f5e' },
  'alkaline-earth': { labelFr: 'Alcalino-terreux', shortFr: 'Alcalino-t.', accentHex: '#fb923c' },
  metalloid: { labelFr: 'Métalloïde', shortFr: 'Métalloïdes', accentHex: '#eab308' },
  halogen: { labelFr: 'Halogène', shortFr: 'Halogènes', accentHex: '#4ade80' },
  'transition-metal': {
    labelFr: 'Métal de transition',
    shortFr: 'Transition',
    accentHex: '#a78bfa',
  },
  'post-transition': {
    labelFr: 'Métal pauvre',
    shortFr: 'Métaux pauvres',
    accentHex: '#94a3b8',
  },
  lanthanide: { labelFr: 'Lanthanide', shortFr: 'Lanthanides', accentHex: '#f472b6' },
  actinide: { labelFr: 'Actinide', shortFr: 'Actinides', accentHex: '#e879f9' },
}

export const STATE_META: Record<PhysicalState, { tag: string; labelFr: string }> = {
  solid: { tag: 's', labelFr: 'Solide' },
  liquid: { tag: 'l', labelFr: 'Liquide' },
  gas: { tag: 'g', labelFr: 'Gaz' },
  aqueous: { tag: 'aq', labelFr: 'Aqueux' },
}

export const SPECIES_KIND_LABEL: Record<SpeciesKind, string> = {
  molecule: 'Molécule',
  ionic_compound: 'Composé ionique',
  ion: 'Ion',
  element_substance: 'Corps simple',
}

export const DISSOLUTION_LABEL: Record<DissolutionType, string> = {
  none: 'Insoluble',
  molecular: 'Moléculaire',
  ionic_complete: 'Dissociation ionique',
  ionic_partial: 'Partielle',
  miscible: 'Miscible',
}

export const PH_CHAR_LABEL: Record<PhCharacter, string> = {
  neutral: 'Neutre',
  acidic_strong: 'Acide fort',
  acidic_weak: 'Acide faible',
  basic_strong: 'Base forte',
  basic_weak: 'Base faible',
}

export const REACTION_CATEGORY_LABEL: Record<ReactionCategory, string> = {
  acid_base: 'Acide-Base',
  precipitation: 'Précipitation',
  redox: 'Oxydoréduction',
  combustion: 'Combustion',
  complexation: 'Complexation',
  synthesis: 'Synthèse',
  decomposition: 'Décomposition',
  organic: 'Organique',
}

export const WATER_MOLAR_MASS = 18.015
export const GAS_MOLAR_VOLUME_L = 24.0 // 20 °C, 1 atm

export function createEmptySolution(): FlaskSolutionState {
  return {
    hasWater: false,
    waterVolumeMl: 0,
    waterMol: 0,
    totalVolumeMl: 0,
    totalMassG: 0,
    solutesMol: {},
    solutes: [],
    hasUndissolvedSolid: false,
    recognizedSolutionId: null,
    labelFr: 'Vide',
    formulaLabel: '',
    liquidColorHex: null,
    liquidOpacity: 0,
    dissolvedSpecies: [],
    phEstimate: null,
  }
}

const FR_NUMBER_FORMATTERS = new Map<number, Intl.NumberFormat>()

export function formatFrNumber(value: number, maxDecimals = 2): string {
  let fmt = FR_NUMBER_FORMATTERS.get(maxDecimals)
  if (!fmt) {
    fmt = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxDecimals,
    })
    FR_NUMBER_FORMATTERS.set(maxDecimals, fmt)
  }
  return fmt.format(value)
}

export function getSpeciesDensityGPerMl(species: SpeciesRecord): number | null {
  if (
    typeof species.densityGPerCm3 === 'number' &&
    Number.isFinite(species.densityGPerCm3) &&
    species.densityGPerCm3 > 0
  ) {
    return species.densityGPerCm3
  }
  const d = species.behaviors.densityGPerMl
  return typeof d === 'number' && Number.isFinite(d) && d > 0 ? d : null
}

export const GHS_LABEL_FR: Record<string, string> = {
  GHS01: 'Explosif',
  GHS02: 'Inflammable',
  GHS03: 'Comburant',
  GHS04: 'Gaz sous pression',
  GHS05: 'Corrosif',
  GHS06: 'Toxique',
  GHS07: 'Irritant / Nocif',
  GHS08: 'Danger santé',
  GHS09: 'Environnement',
}

export const THERMAL_NOTE_FR: Record<string, string> = {
  decomposes: 'décomposition',
  sublimes: 'sublimation',
  explodes: 'instable / explosif',
}

export function formatDensity(
  densityGPerCm3: number | null,
  standardState: SpeciesRecord['standardState'],
): string {
  if (densityGPerCm3 === null || !Number.isFinite(densityGPerCm3)) return '—'
  if (standardState === 'gas' && densityGPerCm3 < 0.05) {
    return `${formatFrNumber(densityGPerCm3 * 1000, 2)} g/L`
  }
  return `${formatFrNumber(densityGPerCm3, 3)} g/cm³`
}

export function getDefaultSpeciesAmountMol(species: SpeciesRecord): number {
  if (species.isSolvent) {
    return 50 / WATER_MOLAR_MASS
  }
  if (species.standardState === 'liquid') {
    return 0.05
  }
  return 0.01
}

export function getSpeciesVolumeMl(species: SpeciesRecord, amountMol: number): number | null {
  if (species.standardState !== 'liquid') return null
  const density = getSpeciesDensityGPerMl(species)
  if (!density) return null
  return (amountMol * species.molarMass) / density
}

export function formatMol(mol: number): string {
  if (mol === 0) return '0 mol'
  const abs = Math.abs(mol)
  if (abs >= 0.1) return `${formatFrNumber(mol, 3)} mol`
  if (abs >= 1e-4) return `${formatFrNumber(mol * 1000, 2)} mmol`
  return `${formatFrNumber(mol * 1e6, 1)} µmol`
}

export function formatMassG(grams: number): string {
  if (grams === 0) return '0 g'
  const abs = Math.abs(grams)
  if (abs >= 10) return `${formatFrNumber(grams, 1)} g`
  if (abs >= 0.1) return `${formatFrNumber(grams, 2)} g`
  return `${formatFrNumber(grams * 1000, 1)} mg`
}

export function formatConcMolL(conc: number): string {
  if (conc === 0) return '0 mol/L'
  const abs = Math.abs(conc)
  if (abs >= 0.05) return `${formatFrNumber(conc, 2)} mol/L`
  if (abs >= 1e-4) return `${formatFrNumber(conc * 1000, 1)} mmol/L`
  return `${conc.toExponential(1).replace('.', ',')} mol/L`
}

export function formatConcGL(concGPerL: number): string {
  if (concGPerL === 0) return '0 g/L'
  const abs = Math.abs(concGPerL)
  if (abs >= 10) return `${formatFrNumber(concGPerL, 1)} g/L`
  if (abs >= 0.1) return `${formatFrNumber(concGPerL, 2)} g/L`
  return `${formatFrNumber(concGPerL * 1000, 1)} mg/L`
}

export function formatVolumeMl(ml: number): string {
  if (ml >= 1000) return `${formatFrNumber(ml / 1000, 2)} L`
  if (ml >= 10) return `${formatFrNumber(ml, 1)} mL`
  return `${formatFrNumber(ml, 2)} mL`
}

export function formatCapacityMl(ml: number): string {
  if (ml >= 1000) return `${formatFrNumber(ml / 1000, 2)} L`
  return `${formatFrNumber(ml, 0)} mL`
}

export function formatSpeciesQuantityBadge(
  species: SpeciesRecord,
  amountMol: number,
): string {
  const volMl = getSpeciesVolumeMl(species, amountMol)
  if (volMl !== null) {
    return formatVolumeMl(volMl)
  }
  if (species.standardState === 'solid') {
    return formatMassG(amountMol * species.molarMass)
  }
  return formatMol(amountMol)
}

export function formatElementChargeShort(charge: number): string {
  if (charge > 0) return charge === 1 ? '+' : `${charge}+`
  if (charge < 0) return charge === -1 ? '−' : `${Math.abs(charge)}−`
  return '0'
}

export function formatOxidationState(n: number): string {
  if (n > 0) return `+${n}`
  if (n < 0) return `−${Math.abs(n)}`
  return '0'
}

export function formatElementTempC(val: number | null): string {
  if (val === null) return '—'
  if (Math.abs(val) >= 100) return `${formatFrNumber(val, 0)} °C`
  return `${formatFrNumber(val, 1)} °C`
}

export function formatElementTempK(val: number | null): string {
  if (val === null) return ''
  const k = val + 273.15
  return `${formatFrNumber(k, k >= 100 ? 0 : 1)} K`
}

export function getElementStateAtTemperature(
  el: ElementRecord,
  tempC: number,
): 'solid' | 'liquid' | 'gas' | 'unknown' {
  if (el.meltingPointC === null && el.boilingPointC === null) {
    return Math.abs(tempC - 20) <= 5 ? el.defaultState : 'unknown'
  }
  if (el.boilingPointC !== null && tempC >= el.boilingPointC) return 'gas'
  if (el.meltingPointC !== null && tempC < el.meltingPointC) return 'solid'
  if (el.meltingPointC !== null && tempC >= el.meltingPointC) {
    return el.boilingPointC === null || tempC < el.boilingPointC ? 'liquid' : 'gas'
  }
  return 'unknown'
}
