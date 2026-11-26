import type {
  CanvasFlaskNode,
  CanvasGasCollectorNode,
  CanvasMoleculeNode,
  CanvasSolidNode,
  CanvasThermalChamberNode,
  CollectedGasItem,
  PhysicalState,
  SpeciesRecord,
} from '../../shared/chemistry.ts'
import { createNodeId } from './workbench-helpers'

export interface ThermalPreset {
  id: string
  labelFr: string
  tempC: number
}

export const THERMAL_PRESETS: ThermalPreset[] = [
  { id: 'ln2', labelFr: 'Azote liquide', tempC: -196 },
  { id: 'dry_ice', labelFr: 'Carboglace', tempC: -78 },
  { id: 'freezer', labelFr: 'Congélateur', tempC: -20 },
  { id: 'ambient', labelFr: 'Ambiant', tempC: 20 },
  { id: 'boil', labelFr: 'Ébullition', tempC: 105 },
  { id: 'oven', labelFr: 'Four', tempC: 350 },
  { id: 'furnace', labelFr: 'Fusion', tempC: 1200 },
]

export const MIN_CHAMBER_TEMP_C = -210
export const MAX_CHAMBER_TEMP_C = 1500

/**
 * Computes the physical state of a species at a given temperature (1 atm)
 * from its real experimental melting & boiling points in SQLite.
 */
export function getSpeciesPhaseAtTemperature(
  species: Pick<
    SpeciesRecord,
    'standardState' | 'meltingPointC' | 'boilingPointC' | 'thermalNote'
  >,
  temperatureC: number,
): PhysicalState {
  const mp = species.meltingPointC
  const bp = species.boilingPointC
  const isSubliming =
    species.thermalNote === 'sublimes' ||
    (mp !== null && bp !== null && bp < mp)

  if (isSubliming && bp !== null) {
    return temperatureC >= bp ? 'gas' : 'solid'
  }
  if (bp !== null && temperatureC >= bp) return 'gas'
  if (mp !== null && temperatureC < mp) return 'solid'
  if (mp !== null && bp !== null && temperatureC >= mp && temperatureC < bp) {
    return 'liquid'
  }
  if (mp !== null && temperatureC >= mp && bp === null) {
    return 'liquid'
  }
  if (bp !== null && temperatureC < bp && mp === null) {
    return species.standardState === 'gas' ? 'liquid' : species.standardState
  }
  return species.standardState
}

/**
 * Returns the exact French physical phase-transition name when state changes.
 */
export function describePhaseTransition(
  from: PhysicalState,
  to: PhysicalState,
): string | null {
  if (from === to) return null
  if (from === 'solid' && to === 'liquid') return 'Fusion'
  if (from === 'liquid' && to === 'solid') return 'Solidification'
  if (from === 'liquid' && to === 'gas') return 'Vaporisation'
  if (from === 'gas' && to === 'liquid') return 'Liquéfaction'
  if (from === 'solid' && to === 'gas') return 'Sublimation'
  if (from === 'gas' && to === 'solid') return 'Condensation solide'
  return null
}

/**
 * Contextual French display name when a well-known substance changes phase
 * (e.g., H₂O solid = "Glace", H₂O gas = "Vapeur d’eau", CO₂ solid = "Glace carbonique").
 */
export function getPhaseContextualNameFr(
  species: Pick<SpeciesRecord, 'id' | 'nameFr' | 'standardState'>,
  phase: PhysicalState,
): string {
  if (species.id === 'h2o') {
    if (phase === 'solid') return 'Glace (eau solide)'
    if (phase === 'gas') return 'Vapeur d’eau'
    return 'Eau'
  }
  if (species.id === 'co2' && phase === 'solid') {
    return 'Glace carbonique'
  }
  if (species.id === 'n2' && phase === 'liquid') {
    return 'Azote liquide'
  }
  if (species.id === 'o2' && phase === 'liquid') {
    return 'Oxygène liquide'
  }
  if (phase === species.standardState) return species.nameFr
  const suffix = phase === 'solid' ? 'solide' : phase === 'liquid' ? 'liquide' : 'gazeux'
  return `${species.nameFr} (${suffix})`
}

export function getMoleculeEffectivePhase(node: CanvasMoleculeNode): PhysicalState {
  return node.phaseOverride ?? node.species.standardState
}

/**
 * Ideal-gas volume in mL for collected gases at temperatureC and 1 atm.
 * V(mL) = n * R * T(K) / P(atm) * 1000, with R = 0.082057 L·atm/(mol·K).
 */
export function getCollectedGasVolumeMl(
  gases: CollectedGasItem[],
  temperatureC = 20,
): number {
  const totalMol = gases.reduce((acc, g) => acc + Math.max(0, g.amountMol), 0)
  if (totalMol <= 0) return 0
  const tempK = Math.max(10, temperatureC + 273.15)
  return totalMol * 0.082057 * tempK * 1000
}

export function getCollectedGasTotalMol(gases: CollectedGasItem[]): number {
  return gases.reduce((acc, g) => acc + Math.max(0, g.amountMol), 0)
}

export function getDominantGasColor(gases: CollectedGasItem[]): string {
  if (gases.length === 0) return '#bae6fd'
  const sorted = [...gases].sort((a, b) => b.amountMol - a.amountMol)
  for (const g of sorted) {
    if (
      g.colorHex &&
      g.colorHex.toLowerCase() !== '#e4e4e7' &&
      g.colorHex.toLowerCase() !== '#ffffff' &&
      g.colorHex.toLowerCase() !== '#f4f4f5'
    ) {
      return g.colorHex
    }
  }
  return '#cbd5e1'
}

export function createGasCollectorNode(x: number, y: number): CanvasGasCollectorNode {
  return {
    id: createNodeId('gascol'),
    kind: 'gas_collector',
    x,
    y,
    capacityMl: 1000,
    temperatureC: 20,
    sourceFlaskId: null,
    gases: [],
  }
}

export function createThermalChamberNode(
  x: number,
  y: number,
  initialTargetC = -20,
): CanvasThermalChamberNode {
  return {
    id: createNodeId('thermo'),
    kind: 'thermal_chamber',
    x,
    y,
    temperatureC: 20,
    targetTemperatureC: initialTargetC,
    powerOn: true,
    sample: null,
  }
}

export function mergeGasIntoCollector(
  gases: CollectedGasItem[],
  incoming: CollectedGasItem,
): CollectedGasItem[] {
  if (incoming.amountMol <= 1e-8) return gases
  const idx = gases.findIndex((g) => g.speciesId === incoming.speciesId)
  if (idx === -1) return [...gases, { ...incoming }]
  return gases.map((g, i) =>
    i === idx ? { ...g, amountMol: Math.round((g.amountMol + incoming.amountMol) * 1e6) / 1e6 } : g,
  )
}

export interface VolatileBoilTarget {
  speciesId: string
  isWater: boolean
  boilingPointC: number
  availableMol: number
  species: SpeciesRecord
}

/**
 * Finds the lowest-boiling volatile liquid currently present in a flask
 * so heating a mixture (e.g. water + ethanol or water + acetone) boils off
 * the most volatile component first (real fractional distillation!).
 */
export function getMostVolatileBoilingTarget(
  flask: CanvasFlaskNode,
  speciesMap: Map<string, SpeciesRecord>,
): VolatileBoilTarget | null {
  const candidates: VolatileBoilTarget[] = []

  if (flask.solution.hasWater && flask.solution.waterVolumeMl > 1.5) {
    const h2o = speciesMap.get('h2o')
    if (h2o) {
      candidates.push({
        speciesId: 'h2o',
        isWater: true,
        boilingPointC: h2o.boilingPointC ?? 100,
        availableMol: flask.solution.waterMol,
        species: h2o,
      })
    }
  }

  for (const [spId, mol] of Object.entries(flask.solution.solutesMol)) {
    if (mol <= 1e-5 || spId === 'h2o') continue
    const sp = speciesMap.get(spId)
    if (!sp) continue
    if (sp.standardState !== 'liquid') continue
    if (sp.boilingPointC === null || sp.boilingPointC > 220) continue
    candidates.push({
      speciesId: spId,
      isWater: false,
      boilingPointC: sp.boilingPointC,
      availableMol: mol,
      species: sp,
    })
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.boilingPointC - b.boilingPointC)
  return candidates[0]
}

export function buildSpeciesRecordFromSolid(
  solid: CanvasSolidNode,
  speciesMap: Map<string, SpeciesRecord>,
): SpeciesRecord | null {
  if (!solid.isAlloy && solid.components.length === 1) {
    const existing = speciesMap.get(solid.components[0].speciesId)
    if (existing) return existing
  }
  const primary = solid.components[0]
  if (!primary) return null
  const primarySp = speciesMap.get(primary.speciesId)
  return {
    id: solid.alloyId ?? primary.speciesId,
    formula: primarySp?.formula ?? primary.symbol,
    displayFormula: solid.isAlloy
      ? solid.components.map((c) => c.symbol).join('·')
      : (primarySp?.displayFormula ?? primary.symbol),
    nameFr: solid.nameFr,
    iupacName: null,
    casNumber: null,
    kind: 'element_substance',
    charge: 0,
    molarMass: primarySp?.molarMass ?? 63.55,
    standardState: 'solid',
    meltingPointC: solid.meltingPointC,
    boilingPointC: primarySp?.boilingPointC ?? null,
    thermalNote: null,
    densityGPerCm3: solid.densityGPerCm3,
    appearanceFr: solid.nameFr,
    colorHex: solid.colorHex,
    composition: primarySp?.composition ?? { [primary.symbol]: 1 },
    compositionKey: primarySp?.compositionKey ?? null,
    lewis: primarySp?.lewis ?? null,
    popularity: 0,
    pubchemCid: null,
    families: [],
    isSolvent: false,
    canDissolveInWater: false,
    solubilityGPerL: 0,
    dissolutionType: 'none',
    solutionColorHex: null,
    phCharacter: 'neutral',
    pkaValues: [],
    ghsPictograms: [],
    ghsSignalWord: null,
    behaviors: {},
  }
}
