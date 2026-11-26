export type ElementCategory =
  | 'nonmetal'
  | 'noble-gas'
  | 'alkali-metal'
  | 'alkaline-earth'
  | 'metalloid'
  | 'halogen'
  | 'transition-metal'
  | 'post-transition'
  | 'lanthanide'
  | 'actinide'

export type PhysicalState = 'solid' | 'liquid' | 'gas' | 'aqueous'

export type SpeciesKind = 'molecule' | 'ionic_compound' | 'ion' | 'element_substance'

export type ThermalNote = 'decomposes' | 'sublimes' | 'explodes' | null

export type ReactionCategory =
  | 'acid_base'
  | 'precipitation'
  | 'redox'
  | 'combustion'
  | 'complexation'
  | 'synthesis'
  | 'decomposition'
  | 'organic'

export type DissolutionType =
  | 'none'
  | 'molecular'
  | 'ionic_complete'
  | 'ionic_partial'
  | 'miscible'

export type PhCharacter =
  | 'neutral'
  | 'acidic_strong'
  | 'acidic_weak'
  | 'basic_strong'
  | 'basic_weak'

export type VesselType =
  | 'volumetric_flask'
  | 'erlenmeyer'
  | 'beaker'
  | 'test_tube'
  | 'graduated_cylinder'
  | 'pipette'
  | 'burette'
  | 'round_bottom_flask'

export type ElementBlock = 's' | 'p' | 'd' | 'f'

export interface ElementRecord {
  atomicNumber: number
  symbol: string
  nameFr: string
  atomicMass: number
  category: ElementCategory
  groupNum: number | null
  period: number
  gridRow: number
  gridCol: number
  defaultState: 'solid' | 'liquid' | 'gas'
  cpkColor: string
  electronegativity: number | null
  commonIonCharges: number[]
  block: ElementBlock
  electronConfiguration: string
  electronShells: number[]
  valenceElectrons: number
  oxidationStates: number[]
  atomicRadiusPm: number | null
  vdwRadiusPm: number | null
  ionizationEnergyKjMol: number | null
  electronAffinityKjMol: number | null
  meltingPointC: number | null
  boilingPointC: number | null
  densityGPerCm3: number | null
  discoveryYear: number | null
  discoveredBy: string | null
  radioactive: boolean
  synthetic: boolean
  crystalStructure: string | null
  summaryFr: string
}

export interface LewisAtom {
  id: string
  symbol: string
  x: number
  y: number
  lonePairs: number
  charge: number
}

export interface LewisBond {
  from: string
  to: string
  order: 1 | 2 | 3
}

export interface LewisStructure {
  atoms: LewisAtom[]
  bonds: LewisBond[]
  totalCharge?: number
  ionic?: boolean
}

export interface SpeciesRecord {
  id: string
  formula: string
  displayFormula: string
  nameFr: string
  iupacName: string | null
  casNumber: string | null
  kind: SpeciesKind
  charge: number
  molarMass: number
  standardState: PhysicalState
  meltingPointC: number | null
  boilingPointC: number | null
  thermalNote: ThermalNote
  densityGPerCm3: number | null
  appearanceFr: string | null
  colorHex: string | null
  composition: Record<string, number>
  compositionKey: string | null
  isSolvent: boolean
  canDissolveInWater: boolean
  solubilityGPerL: number | null
  dissolutionType: DissolutionType
  solutionColorHex: string | null
  phCharacter: PhCharacter
  pkaValues: number[]
  ghsPictograms: string[]
  ghsSignalWord: string | null
  popularity: number
  pubchemCid: number | null
  families: string[]
  lewis: LewisStructure | null
  behaviors: Record<string, unknown>
}

export interface VesselRecord {
  id: string
  nameFr: string
  vesselType: VesselType
  capacityMl: number
  availableCapacitiesMl: number[]
  allowsSolution: boolean
  supportsHeating: boolean
  stopperable: boolean
  precisionLabel: string
  defaultPourStepMl: number | null
  descriptionShort: string
}

export interface DissolvedSpeciesItem {
  speciesId: string
  displayFormula: string
  nameFr: string
  kind: SpeciesKind
  charge: number
  state: 'aqueous' | 'precipitate' | 'gas'
  amountMol: number
  concentrationMolPerL: number
  massConcentrationGPerL: number
  colorHex: string | null
}

/**
 * Resolves the SQLite species id for any solid element symbol (`<symbol_lowercase>_solid`).
 */
export function getSolidSpeciesIdForElement(symbol: string): string {
  return `${symbol.toLowerCase()}_solid`
}

/**
 * True for monatomic solid elemental substances (e.g. Fe(s), Cu(s), Rh(s), Og(s)).
 * Kept in SQLite for flask immersion & reaction stoichiometry, but hidden from the
 * user-facing "Espèces" catalog where they would duplicate the Periodic Table.
 * Polyatomic solid elements (S₈, P₄, I₂) and gases/liquids (O₂, O₃, Cl₂, Br₂…) stay visible.
 */
export function isMonatomicSolidSpecies(
  sp: Pick<SpeciesRecord, 'kind' | 'standardState' | 'composition'>,
): boolean {
  if (sp.kind !== 'element_substance' || sp.standardState !== 'solid') return false
  const entries = Object.entries(sp.composition).filter(([, c]) => c > 0)
  return entries.length === 1 && entries[0][1] === 1
}

/**
 * Authentic macroscopic surface color for solid elements (metals, metalloids, solid nonmetals).
 */
export const ELEMENT_SOLID_COLORS: Record<string, string> = {
  // Distinctive colored metals & nonmetals
  Cu: '#c87533', // Cuivre orangé
  Au: '#e5b832', // Or jaune
  Cs: '#d4b46a', // Césium doré pâle
  Os: '#7d8fa3', // Osmium gris-bleu
  Bi: '#9d95b8', // Bismuth argent irisé
  S: '#e2c53b', // Soufre jaune citron
  C: '#2f333a', // Graphite anthracite
  P: '#c4b896', // Phosphore blanc/crème
  I: '#4c3863', // Diiode gris-violet sombre
  Se: '#6b4c52', // Sélénium gris-rouge
  B: '#4a4644', // Bore brun-noir
  Si: '#5c6470', // Silicium gris métallique sombre
  Ge: '#777e88',
  As: '#6e757f',
  Sb: '#9ca3af',
  Te: '#a8adb8',
  // Classic silvery / steely metals with realistic tonal variation
  Ag: '#dcdce2',
  Al: '#c5cbd3',
  Fe: '#7e8691',
  Zn: '#9aa4b0',
  Pb: '#686e78',
  Sn: '#b8bec7',
  Ni: '#a8a69e',
  Co: '#7f8fa6',
  Cr: '#b4bcc6',
  Mn: '#8a858c',
  Mg: '#cfd4dc',
  Ca: '#c4c7cc',
  Na: '#d0d3d8',
  K: '#c8ccd2',
  Li: '#b6bac2',
  Ti: '#9ba2ab',
  V: '#8d949e',
  W: '#717882',
  Mo: '#858d98',
  Pt: '#d2d5dc',
  Pd: '#cfd3da',
  Rh: '#d7dce3',
  Ir: '#c6ccd4',
  Ru: '#99a1ab',
  Zr: '#a8b0b9',
  Nb: '#9098a3',
  Ta: '#78818c',
  Cd: '#aeb6c0',
  In: '#c0c6ce',
  Ga: '#b8c2cc',
  Be: '#99a0a8',
  Ba: '#b5b8bf',
  Sr: '#c2c5cb',
  U: '#646b73',
  Th: '#7a8088',
}

export function getElementSolidColor(symbol: string, category?: ElementCategory): string {
  if (ELEMENT_SOLID_COLORS[symbol]) return ELEMENT_SOLID_COLORS[symbol]
  if (category === 'nonmetal') return '#71717a'
  if (category === 'metalloid') return '#6b7280'
  if (category === 'lanthanide' || category === 'actinide') return '#a1a8b3'
  return '#a8b0ba'
}

export interface SoluteSummaryItem {
  speciesId: string
  displayFormula: string
  nameFr: string
  molarMass: number
  standardState?: PhysicalState
  addedMol: number
  addedMassG: number
  dissolvedMol: number
  dissolvedMassG: number
  undissolvedMol: number
  undissolvedMassG: number
  concentrationMolPerL: number
  massConcentrationGPerL: number
  solubilityGPerL: number | null
  saturationRatio: number | null
  isSaturated: boolean
  colorHex?: string | null
  isImmersedSolid?: boolean
  isImmiscibleLiquid?: boolean
}

export interface ImmisciblePhaseInfo {
  speciesIds: string[]
  formula: string
  labelFr: string
  volumeMl: number
  densityGPerCm3: number
  position: 'top' | 'bottom'
  colorHex: string
  opacity: number
}

export interface FilteredSolidItem {
  speciesId: string
  displayFormula: string
  nameFr: string
  amountMol: number
  massG: number
  colorHex: string | null
}

export interface FlaskReactionParticipant {
  speciesId: string
  displayFormula: string
  nameFr: string
  stoichiometry: number
  state: 'aqueous' | 'solid' | 'liquid' | 'gas'
  colorHex: string | null
  initialMol: number
  molarMass: number
  isLimiting?: boolean
}

export interface FlaskActiveReaction {
  id: string
  nameFr: string
  category: ReactionCategory
  equationDisplay: string
  equilibriumLabel: string | null
  observationsFr: string
  reactants: FlaskReactionParticipant[]
  products: FlaskReactionParticipant[]
  xMaxMol: number
  evolvesGas: boolean
  precipitateColorHex: string | null
}

export interface FlaskSolutionState {
  hasWater: boolean
  waterVolumeMl: number
  waterMol: number
  totalVolumeMl: number
  totalMassG: number
  solutesMol: Record<string, number>
  solutes: SoluteSummaryItem[]
  hasUndissolvedSolid: boolean
  sedimentColorHex?: string | null
  immisciblePhase?: ImmisciblePhaseInfo | null
  recognizedSolutionId: string | null
  labelFr: string
  formulaLabel: string
  liquidColorHex: string | null
  liquidOpacity: number
  dissolvedSpecies: DissolvedSpeciesItem[]
  phEstimate: number | null
  activeReaction?: FlaskActiveReaction | null
  availableReactions?: FlaskActiveReaction[]
}

export interface MergeAtomsRequest {
  symbols?: string[]
  composition?: Record<string, number>
  totalCharge?: number
}

export type MergeAtomsResponse =
  | {
      matched: true
      species: SpeciesRecord
      candidates: SpeciesRecord[]
      totalCandidatesCount: number
      compositionFormula: string
    }
  | {
      matched: false
      compositionFormula: string
      reasonFr: string
    }

export interface MatchLewisRequest {
  atoms: LewisAtom[]
  bonds: LewisBond[]
}

export type MatchLewisResponse =
  | {
      matched: true
      exactLewisValid: boolean
      species: SpeciesRecord
      expectedLewis: LewisStructure
      issuesFr: string[]
    }
  | {
      matched: false
      compositionFormula: string
      totalCharge: number
      sameFormulaSpecies: Array<{
        id: string
        displayFormula: string
        nameFr: string
      }>
      reasonFr: string
    }

export interface IonizeRequest {
  composition: Record<string, number>
  currentCharge: number
  direction: 1 | -1
}

export type IonizeResponse =
  | {
      ok: true
      resultKind: 'ion'
      species: SpeciesRecord
      messageFr: string
    }
  | {
      ok: true
      resultKind: 'neutral_atom'
      element: ElementRecord
      messageFr: string
    }
  | {
      ok: true
      resultKind: 'neutral_species'
      species: SpeciesRecord
      messageFr: string
    }
  | {
      ok: false
      reasonFr: string
    }

export interface EvaluateFlaskAdditionRequest {
  vesselId: string
  vesselCapacityMl?: number
  temperatureC?: number
  currentWaterVolumeMl: number
  currentSolutesMol: Record<string, number>
  incomingSpeciesId?: string
  incomingElementSymbol?: string
  incomingAmountMol?: number
  incomingWaterVolumeMl?: number
  evaporateWaterMl?: number
  recomputeOnly?: boolean
  setWaterVolumeMl?: number
  setSolutesMol?: Record<string, number>
  commitReaction?: {
    reactionId: string
    xMol: number
    gasCapturedByCollector?: boolean
  }
  incomingFlask?: {
    waterVolumeMl: number
    solutesMol: Record<string, number>
    transferVolumeMl?: number
    sourceTemperatureC?: number
    filterSolids?: boolean
  }
}

export type EvaluateFlaskAdditionResponse =
  | {
      ok: true
      solution: FlaskSolutionState
      remainingSourceFlask?: {
        solution: FlaskSolutionState
      } | null
      filteredSolids?: FilteredSolidItem[]
      messageFr: string
      effect:
        | 'water_added'
        | 'dissolved'
        | 'saturated'
        | 'solid_immersed'
        | 'diluted'
        | 'mixed'
        | 'filtered'
        | 'evaporated'
        | 'temperature_changed'
        | 'reaction_committed'
        | 'batch_configured'
    }
  | {
      ok: false
      code:
        | 'NEED_WATER_FIRST'
        | 'INSOLUBLE'
        | 'CAPACITY_EXCEEDED'
        | 'UNKNOWN_SPECIES'
        | 'EMPTY_SOURCE'
      messageFr: string
    }

export interface CatalogSummary {
  elementsCount: number
  speciesCount: number
  solutionsCount: number
  vesselsCount: number
  reactionsCount: number
  alloysCount?: number
  redoxCouplesCount?: number
  solubilityProductsCount?: number
  acidBaseCouplesCount?: number
}

export interface AlloyComponentSpec {
  symbol: string
  minPct: number
  maxPct: number
  typicalPct: number
  optional?: boolean
}

export interface AlloyRecord {
  id: string
  nameFr: string
  familyFr: string
  baseElement: string
  components: AlloyComponentSpec[]
  densityGPerCm3: number
  meltingPointC: number | null
  colorHex: string
  usesFr: string
}

export interface RedoxCoupleRecord {
  id: string
  coupleLabel: string
  oxFormula: string
  redFormula: string
  oxSpeciesId: string | null
  redSpeciesId: string | null
  oxStoich: number
  redStoich: number
  electrons: number
  hPlus: number
  h2o: number
  halfEquation: string
  e0V: number
  medium: 'acidic' | 'basic' | 'neutral'
  source: string
}

export interface SolubilityProductRecord {
  id: string
  solidSpeciesId: string | null
  solidFormula: string
  solidNameFr: string
  cationSpeciesId: string | null
  cationFormula: string
  cationStoich: number
  anionSpeciesId: string | null
  anionFormula: string
  anionStoich: number
  pKs: number
  ks: number
  precipitateColorHex: string | null
  precipitateColorFr: string
  source: string
}

export interface AcidBaseCoupleRecord {
  id: string
  acidSpeciesId: string | null
  baseSpeciesId: string | null
  acidFormula: string
  baseFormula: string
  acidNameFr: string
  pKa: number
  source: string
}

export interface ReactionConstantsResponse {
  redoxCouples: RedoxCoupleRecord[]
  solubilityProducts: SolubilityProductRecord[]
  acidBaseCouples: AcidBaseCoupleRecord[]
}

export interface PredictedReactionItem {
  category: ReactionCategory
  titleFr: string
  equationDisplay: string
  spontaneous: boolean
  equilibriumLabel: string | null
  observationsFr: string
  detailsFr: string
  setupReactants?: Array<{ speciesId: string; stoichiometry: number }>
  setupMedium?: 'aqueous' | 'gas' | 'solid' | 'any'
}

export type ReactionPredictionContextId =
  | 'direct'
  | 'acidic'
  | 'basic'
  | 'aqueous'
  | 'oxygen'

export interface PredictedReactionGroup {
  context: ReactionPredictionContextId
  labelFr: string
  addedSpeciesFormula?: string
  reactions: PredictedReactionItem[]
}

export interface PredictReactionResponse {
  species: Array<{ id: string; displayFormula: string; nameFr: string }>
  speciesA?: { id: string; displayFormula: string; nameFr: string }
  speciesB?: { id: string; displayFormula: string; nameFr: string }
  speciesC?: { id: string; displayFormula: string; nameFr: string } | null
  reactions: PredictedReactionItem[]
  contextGroups?: PredictedReactionGroup[]
}

export interface CatalogDissolutionProduct {
  speciesId: string
  displayFormula: string
  nameFr: string
  stoichiometry: number
  stateInSolution: 'aqueous' | 'precipitate' | 'gas'
  colorHex: string | null
}

export interface CatalogSolutionRecord {
  id: string
  nameFr: string
  formulaLabel: string
  solventId: string
  soluteIds: string[]
  soluteFormulas: string[]
  colorHex: string | null
  phEstimate: number | null
  behaviors: Record<string, unknown>
}

export interface CatalogReactionRecord {
  id: string
  nameFr: string
  category: ReactionCategory
  equationDisplay: string
  medium: 'aqueous' | 'gas' | 'solid' | 'any'
  reactants: Array<{ speciesId: string; displayFormula: string; stoichiometry: number }>
  products: Array<{ speciesId: string; displayFormula: string; stoichiometry: number }>
  conditions: Record<string, unknown>
  observationsFr: string | null
}

export interface CatalogSpeciesRecord extends SpeciesRecord {
  dissolutionProducts: CatalogDissolutionProduct[]
  namedSolutionId: string | null
}

export interface FullCatalogResponse {
  summary: CatalogSummary
  elements: ElementRecord[]
  species: CatalogSpeciesRecord[]
  solutions: CatalogSolutionRecord[]
  reactions: CatalogReactionRecord[]
  vessels: VesselRecord[]
  alloys: AlloyRecord[]
}

export interface SolidComponent {
  symbol: string
  massG: number
  speciesId: string
}

export interface CanvasSolidNode {
  id: string
  kind: 'solid'
  x: number
  y: number
  nameFr: string
  alloyId: string | null
  isAlloy: boolean
  components: SolidComponent[]
  densityGPerCm3: number
  meltingPointC: number | null
  colorHex: string
  usesFr?: string | null
}

export interface CanvasAtomNode {
  id: string
  kind: 'atom'
  x: number
  y: number
  symbol: string
  atomicNumber: number
  nameFr: string
  category: ElementCategory
  cpkColor: string
}

export interface CanvasMoleculeNode {
  id: string
  kind: 'molecule'
  x: number
  y: number
  species: SpeciesRecord
  amountMol: number
  /** Current physical phase after a thermal phase change (defaults to species.standardState) */
  phaseOverride?: PhysicalState
  /** Sample temperature in °C when transformed away from 20 °C */
  temperatureC?: number
}

export interface CollectedGasItem {
  speciesId: string
  formula: string
  displayFormula: string
  nameFr: string
  molarMass: number
  amountMol: number
  colorHex: string | null
  meltingPointC: number | null
  boilingPointC: number | null
}

export interface CanvasGasCollectorNode {
  id: string
  kind: 'gas_collector'
  x: number
  y: number
  label?: string
  capacityMl: number
  temperatureC: number
  /** Linked source flask capturing evaporated vapor or evolved reaction gases */
  sourceFlaskId: string | null
  gases: CollectedGasItem[]
}

export interface ThermalChamberSample {
  species: SpeciesRecord
  amountMol: number
  currentState: PhysicalState
  /** Preserved solid metadata if a pure/alloy solid block was loaded */
  solidBlock?: {
    nameFr: string
    colorHex: string
    densityGPerCm3: number
    meltingPointC: number | null
    alloyId: string | null
    isAlloy: boolean
    components: SolidComponent[]
    usesFr?: string | null
  } | null
}

export interface CanvasThermalChamberNode {
  id: string
  kind: 'thermal_chamber'
  x: number
  y: number
  label?: string
  temperatureC: number
  targetTemperatureC: number
  powerOn: boolean
  sample: ThermalChamberSample | null
}

export type PhIndicatorId =
  | 'bbt'
  | 'phenolphthalein'
  | 'methyl_orange'
  | 'phenol_red'
  | 'universal'

export type FlaskProbeType = 'ph' | 'thermometer' | 'conductimeter'

export interface CanvasFlaskNode {
  id: string
  kind: 'flask'
  x: number
  y: number
  vessel: VesselRecord
  solution: FlaskSolutionState
  temperatureC?: number
  stoppered?: boolean
  pourStepMl?: number | null
  customLabel?: string
  reactionExtentMol?: number
  selectedReactionId?: string
  indicatorId?: PhIndicatorId | null
  probes?: FlaskProbeType[]
  stirrerOn?: boolean
  heaterTargetC?: number | null
  hasFilter?: boolean
  filteredSolids?: FilteredSolidItem[]
}

export type CanvasNode =
  | CanvasAtomNode
  | CanvasMoleculeNode
  | CanvasSolidNode
  | CanvasFlaskNode
  | CanvasGasCollectorNode
  | CanvasThermalChamberNode

export interface WorkspaceSnapshot {
  nodes: CanvasNode[]
  discoveredSpeciesIds: string[]
}
