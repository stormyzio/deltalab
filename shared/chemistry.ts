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

export type SpeciesSource = 'curated' | 'wikidata' | 'pubchem_live'

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
  inchikey: string | null
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
  solubilityByTempC: Record<string, number> | null
  dissolutionType: DissolutionType
  solutionColorHex: string | null
  phCharacter: PhCharacter
  pkaValues: number[]
  ghsPictograms: string[]
  ghsSignalWord: string | null
  source: SpeciesSource
  popularity: number
  smiles: string | null
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

export const ELEMENT_SYMBOL_TO_SOLID_SPECIES_ID: Record<string, string> = {
  Cu: 'cu_solid',
  Ag: 'ag_solid',
  Zn: 'zn_solid',
  Fe: 'fe_solid',
  Mg: 'mg_solid',
  Al: 'al_solid',
  Pb: 'pb_solid',
  Sn: 'sn_solid',
  Ni: 'ni_solid',
  Co: 'co_solid',
  Au: 'au_solid',
  Na: 'na_solid',
  K: 'k_solid',
  Ca: 'ca_solid',
  Li: 'li_solid',
  Cr: 'cr_solid',
  Mn: 'mn_solid',
  C: 'c_solid',
  S: 's8',
  P: 'p4',
  I: 'i2',
}

export interface SoluteSummaryItem {
  speciesId: string
  displayFormula: string
  nameFr: string
  molarMass: number
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

export type LookupPubChemResponse =
  | {
      found: true
      alreadyInDb: boolean
      exactLewisValid: boolean
      species: SpeciesRecord
      expectedLewis: LewisStructure
      issuesFr: string[]
    }
  | {
      found: false
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
  }
  incomingFlask?: {
    waterVolumeMl: number
    solutesMol: Record<string, number>
    transferVolumeMl?: number
    sourceTemperatureC?: number
  }
}

export type EvaluateFlaskAdditionResponse =
  | {
      ok: true
      solution: FlaskSolutionState
      remainingSourceFlask?: {
        solution: FlaskSolutionState
      } | null
      messageFr: string
      effect:
        | 'water_added'
        | 'dissolved'
        | 'saturated'
        | 'solid_immersed'
        | 'diluted'
        | 'mixed'
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
  redoxCouplesCount?: number
  solubilityProductsCount?: number
  acidBaseCouplesCount?: number
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

export interface PredictReactionResponse {
  speciesA: { id: string; displayFormula: string; nameFr: string }
  speciesB: { id: string; displayFormula: string; nameFr: string }
  speciesC?: { id: string; displayFormula: string; nameFr: string } | null
  reactions: PredictedReactionItem[]
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
}

export type CanvasNode = CanvasAtomNode | CanvasMoleculeNode | CanvasFlaskNode

export interface WorkspaceSnapshot {
  nodes: CanvasNode[]
  discoveredSpeciesIds: string[]
}
