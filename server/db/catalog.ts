import type {
  AcidBaseCoupleRecord,
  CatalogDissolutionProduct,
  CatalogReactionRecord,
  CatalogSolutionRecord,
  CatalogSpeciesRecord,
  CatalogSummary,
  ElementBlock,
  ElementCategory,
  ElementRecord,
  FullCatalogResponse,
  LewisStructure,
  PhCharacter,
  PhysicalState,
  PredictReactionResponse,
  ReactionCategory,
  ReactionConstantsResponse,
  RedoxCoupleRecord,
  SolubilityProductRecord,
  SpeciesKind,
  SpeciesRecord,
  SpeciesSource,
  ThermalNote,
  VesselRecord,
  VesselType,
} from '../../shared/chemistry.ts'
import { predictReactionsBetween } from '../lib/reaction-engine.ts'
import { getDb } from './connection.ts'

export interface RawElementRow {
  atomic_number: number
  symbol: string
  name_fr: string
  atomic_mass: number
  category: string
  group_num: number | null
  period: number
  grid_row: number
  grid_col: number
  default_state: string
  cpk_color: string
  electronegativity: number | null
  common_ion_charges_json: string
  block: string
  electron_configuration: string
  electron_shells_json: string
  valence_electrons: number
  oxidation_states_json: string
  atomic_radius_pm: number | null
  vdw_radius_pm: number | null
  ionization_energy_kj_mol: number | null
  electron_affinity_kj_mol: number | null
  melting_point_c: number | null
  boiling_point_c: number | null
  density_g_per_cm3: number | null
  discovery_year: number | null
  discovered_by: string | null
  radioactive: number
  synthetic: number
  crystal_structure: string | null
  summary_fr: string
}

export interface RawSpeciesRow {
  id: string
  formula: string
  display_formula: string
  name_fr: string
  iupac_name?: string | null
  cas_number?: string | null
  kind: string
  charge: number
  molar_mass: number
  standard_state: string
  melting_point_c?: number | null
  boiling_point_c?: number | null
  thermal_note?: string | null
  density_g_per_cm3?: number | null
  appearance_fr?: string | null
  color_hex: string | null
  composition_json: string
  composition_key: string | null
  lewis_json?: string | null
  lewis_topology_key?: string | null
  source: string
  popularity: number
  smiles: string | null
  inchikey?: string | null
  pubchem_cid: number | null
  families_json: string
  is_solvent: number
  can_dissolve_in_water: number
  solubility_g_per_l: number | null
  solubility_by_temp_json?: string | null
  dissolution_type: string
  solution_color_hex: string | null
  ph_character: string
  pka_values_json?: string | null
  ghs_pictograms_json?: string | null
  ghs_signal_word?: string | null
  behaviors_json: string
}

interface RawVesselRow {
  id: string
  name_fr: string
  vessel_type: string
  capacity_ml: number
  available_capacities_json: string
  allows_solution: number
  supports_heating: number
  stopperable: number
  precision_label: string
  default_pour_step_ml: number | null
  description_short: string
}

export function mapElementRow(row: RawElementRow): ElementRecord {
  return {
    atomicNumber: row.atomic_number,
    symbol: row.symbol,
    nameFr: row.name_fr,
    atomicMass: row.atomic_mass,
    category: row.category as ElementCategory,
    groupNum: row.group_num,
    period: row.period,
    gridRow: row.grid_row,
    gridCol: row.grid_col,
    defaultState: row.default_state as 'solid' | 'liquid' | 'gas',
    cpkColor: row.cpk_color,
    electronegativity: row.electronegativity,
    commonIonCharges: JSON.parse(row.common_ion_charges_json) as number[],
    block: (row.block || 'p') as ElementBlock,
    electronConfiguration: row.electron_configuration || '',
    electronShells: JSON.parse(row.electron_shells_json || '[]') as number[],
    valenceElectrons: row.valence_electrons ?? 0,
    oxidationStates: JSON.parse(row.oxidation_states_json || '[]') as number[],
    atomicRadiusPm: row.atomic_radius_pm ?? null,
    vdwRadiusPm: row.vdw_radius_pm ?? null,
    ionizationEnergyKjMol: row.ionization_energy_kj_mol ?? null,
    electronAffinityKjMol: row.electron_affinity_kj_mol ?? null,
    meltingPointC: row.melting_point_c ?? null,
    boilingPointC: row.boiling_point_c ?? null,
    densityGPerCm3: row.density_g_per_cm3 ?? null,
    discoveryYear: row.discovery_year ?? null,
    discoveredBy: row.discovered_by ?? null,
    radioactive: Boolean(row.radioactive),
    synthetic: Boolean(row.synthetic),
    crystalStructure: row.crystal_structure ?? null,
    summaryFr: row.summary_fr || '',
  }
}

export function mapSpeciesRow(row: RawSpeciesRow): SpeciesRecord {
  return {
    id: row.id,
    formula: row.formula,
    displayFormula: row.display_formula,
    nameFr: row.name_fr,
    iupacName: row.iupac_name ?? null,
    casNumber: row.cas_number ?? null,
    inchikey: row.inchikey ?? null,
    kind: row.kind as SpeciesKind,
    charge: row.charge,
    molarMass: row.molar_mass,
    standardState: row.standard_state as PhysicalState,
    meltingPointC: row.melting_point_c ?? null,
    boilingPointC: row.boiling_point_c ?? null,
    thermalNote: (row.thermal_note as ThermalNote) ?? null,
    densityGPerCm3: row.density_g_per_cm3 ?? null,
    appearanceFr: row.appearance_fr ?? null,
    colorHex: row.color_hex,
    composition: JSON.parse(row.composition_json) as Record<string, number>,
    compositionKey: row.composition_key,
    isSolvent: row.is_solvent === 1,
    canDissolveInWater: row.can_dissolve_in_water === 1,
    solubilityGPerL: row.solubility_g_per_l,
    solubilityByTempC: row.solubility_by_temp_json
      ? (JSON.parse(row.solubility_by_temp_json) as Record<string, number>)
      : null,
    dissolutionType: row.dissolution_type as SpeciesRecord['dissolutionType'],
    solutionColorHex: row.solution_color_hex,
    phCharacter: row.ph_character as PhCharacter,
    pkaValues: row.pka_values_json ? (JSON.parse(row.pka_values_json) as number[]) : [],
    ghsPictograms: row.ghs_pictograms_json
      ? (JSON.parse(row.ghs_pictograms_json) as string[])
      : [],
    ghsSignalWord: row.ghs_signal_word ?? null,
    source: (row.source as SpeciesSource) || 'curated',
    popularity: row.popularity ?? 0,
    smiles: row.smiles ?? null,
    pubchemCid: row.pubchem_cid ?? null,
    families: row.families_json ? (JSON.parse(row.families_json) as string[]) : [],
    lewis: row.lewis_json ? (JSON.parse(row.lewis_json) as LewisStructure) : null,
    behaviors: JSON.parse(row.behaviors_json) as Record<string, unknown>,
  }
}

function mapVesselRow(row: RawVesselRow): VesselRecord {
  const caps = row.available_capacities_json
    ? (JSON.parse(row.available_capacities_json) as number[])
    : [row.capacity_ml]
  return {
    id: row.id,
    nameFr: row.name_fr,
    vesselType: row.vessel_type as VesselType,
    capacityMl: row.capacity_ml,
    availableCapacitiesMl: caps.length > 0 ? caps : [row.capacity_ml],
    allowsSolution: row.allows_solution === 1,
    supportsHeating: row.supports_heating === 1,
    stopperable: row.stopperable === 1,
    precisionLabel: row.precision_label || 'Graduations indicatives',
    defaultPourStepMl: row.default_pour_step_ml ?? null,
    descriptionShort: row.description_short,
  }
}

export function listElements(): ElementRecord[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM elements ORDER BY atomic_number ASC')
    .all() as unknown as RawElementRow[]
  return rows.map(mapElementRow)
}

const LIGHTWEIGHT_SPECIES_COLS = `
  id, formula, display_formula, name_fr, iupac_name, cas_number, inchikey,
  kind, charge, molar_mass, standard_state,
  melting_point_c, boiling_point_c, thermal_note, density_g_per_cm3,
  appearance_fr, color_hex, composition_json, composition_key,
  source, popularity, smiles, pubchem_cid, families_json,
  is_solvent, can_dissolve_in_water, solubility_g_per_l, solubility_by_temp_json,
  dissolution_type, solution_color_hex, ph_character, pka_values_json,
  ghs_pictograms_json, ghs_signal_word, behaviors_json
`

export function listSpecies(
  mergeableOnly = false,
  includeLewis = true,
): SpeciesRecord[] {
  const db = getDb()
  const cols = includeLewis ? '*' : LIGHTWEIGHT_SPECIES_COLS
  const sql = mergeableOnly
    ? `SELECT ${cols} FROM species WHERE composition_key IS NOT NULL ORDER BY popularity DESC, name_fr ASC`
    : `SELECT ${cols} FROM species ORDER BY popularity DESC, name_fr ASC`
  const rows = db.prepare(sql).all() as unknown as RawSpeciesRow[]
  return rows.map(mapSpeciesRow)
}

export function getSpeciesById(id: string): SpeciesRecord | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM species WHERE id = ?').get(id) as unknown as
    | RawSpeciesRow
    | undefined
  return row ? mapSpeciesRow(row) : null
}

export function listVessels(): VesselRecord[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM vessels ORDER BY capacity_ml ASC, name_fr ASC')
    .all() as unknown as RawVesselRow[]
  return rows.map(mapVesselRow)
}

export function getVesselById(id: string): VesselRecord | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM vessels WHERE id = ?').get(id) as unknown as
    | RawVesselRow
    | undefined
  return row ? mapVesselRow(row) : null
}

export function getCatalogSummary(): CatalogSummary {
  const db = getDb()
  const count = (table: string) =>
    (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c
  return {
    elementsCount: count('elements'),
    speciesCount: count('species'),
    solutionsCount: count('solutions'),
    vesselsCount: count('vessels'),
    reactionsCount: count('reactions'),
    redoxCouplesCount: count('redox_couples'),
    solubilityProductsCount: count('solubility_products'),
    acidBaseCouplesCount: count('acid_base_couples'),
  }
}

interface RawCatalogRuleRow {
  solute_id: string
  product_species_id: string
  stoichiometry: number
  state_in_solution: string
  display_formula: string
  name_fr: string
  color_hex: string | null
  solution_color_hex: string | null
}

interface RawFullSolutionRow {
  id: string
  name_fr: string
  formula_label: string
  solvent_id: string
  color_hex: string | null
  ph_estimate: number | null
  behaviors_json: string
}

interface RawSolCompRow {
  solution_id: string
  species_id: string
  role: string
}

interface RawReactionRow {
  id: string
  name_fr: string
  category: string
  equation_display: string
  medium: string
  reactants_json: string
  products_json: string
  conditions_json: string
  observations_fr: string | null
}

function mapReactionRow(
  row: RawReactionRow,
  formulaMap?: Map<string, string>,
): CatalogReactionRecord {
  const rawReactants = JSON.parse(row.reactants_json) as Array<{
    speciesId: string
    formulaDisplay?: string
    stoichiometry: number
  }>
  const rawProducts = JSON.parse(row.products_json) as Array<{
    speciesId: string
    formulaDisplay?: string
    stoichiometry: number
  }>
  return {
    id: row.id,
    nameFr: row.name_fr,
    category: (row.category as ReactionCategory) || 'acid_base',
    equationDisplay: row.equation_display,
    medium: row.medium as CatalogReactionRecord['medium'],
    reactants: rawReactants.map((r) => ({
      speciesId: r.speciesId,
      stoichiometry: r.stoichiometry,
      displayFormula: r.formulaDisplay ?? formulaMap?.get(r.speciesId) ?? r.speciesId,
    })),
    products: rawProducts.map((p) => ({
      speciesId: p.speciesId,
      stoichiometry: p.stoichiometry,
      displayFormula: p.formulaDisplay ?? formulaMap?.get(p.speciesId) ?? p.speciesId,
    })),
    conditions: JSON.parse(row.conditions_json) as Record<string, unknown>,
    observationsFr: row.observations_fr,
  }
}

export function getFullCatalog(): FullCatalogResponse {
  const db = getDb()
  const elements = listElements()
  const baseSpecies = listSpecies(false, false)
  const vessels = listVessels()
  const summary = getCatalogSummary()

  const speciesFormulaMap = new Map<string, string>()
  for (const sp of baseSpecies) speciesFormulaMap.set(sp.id, sp.displayFormula)

  const ruleRows = db
    .prepare(`
      SELECT
        r.solute_id,
        r.product_species_id,
        r.stoichiometry,
        r.state_in_solution,
        s.display_formula,
        s.name_fr,
        s.color_hex,
        s.solution_color_hex
      FROM dissolution_rules r
      JOIN species s ON s.id = r.product_species_id
      WHERE r.solvent_id = 'h2o'
      ORDER BY r.id ASC
    `)
    .all() as unknown as RawCatalogRuleRow[]

  const rulesBySolute = new Map<string, CatalogDissolutionProduct[]>()
  for (const r of ruleRows) {
    const list = rulesBySolute.get(r.solute_id) ?? []
    list.push({
      speciesId: r.product_species_id,
      displayFormula: r.display_formula,
      nameFr: r.name_fr,
      stoichiometry: r.stoichiometry,
      stateInSolution: r.state_in_solution as 'aqueous' | 'precipitate' | 'gas',
      colorHex: r.solution_color_hex ?? r.color_hex,
    })
    rulesBySolute.set(r.solute_id, list)
  }

  const solRows = db
    .prepare('SELECT * FROM solutions ORDER BY name_fr ASC')
    .all() as unknown as RawFullSolutionRow[]
  const compRows = db
    .prepare("SELECT solution_id, species_id, role FROM solution_components WHERE role = 'solute'")
    .all() as unknown as RawSolCompRow[]

  const solutesBySolution = new Map<string, string[]>()
  const solutionBySingleSolute = new Map<string, string>()
  for (const c of compRows) {
    const list = solutesBySolution.get(c.solution_id) ?? []
    list.push(c.species_id)
    solutesBySolution.set(c.solution_id, list)
  }
  for (const [solId, soluteIds] of solutesBySolution.entries()) {
    if (soluteIds.length === 1) solutionBySingleSolute.set(soluteIds[0], solId)
  }

  const solutions: CatalogSolutionRecord[] = solRows.map((row) => {
    const soluteIds = solutesBySolution.get(row.id) ?? []
    return {
      id: row.id,
      nameFr: row.name_fr,
      formulaLabel: row.formula_label,
      solventId: row.solvent_id,
      soluteIds,
      soluteFormulas: soluteIds.map((id) => speciesFormulaMap.get(id) ?? id),
      colorHex: row.color_hex,
      phEstimate: row.ph_estimate,
      behaviors: JSON.parse(row.behaviors_json) as Record<string, unknown>,
    }
  })

  const species: CatalogSpeciesRecord[] = baseSpecies.map((sp) => ({
    ...sp,
    dissolutionProducts: rulesBySolute.get(sp.id) ?? [],
    namedSolutionId: solutionBySingleSolute.get(sp.id) ?? null,
  }))

  const rxnRows = db
    .prepare('SELECT * FROM reactions ORDER BY name_fr ASC')
    .all() as unknown as RawReactionRow[]
  const reactions = rxnRows.map((row) => mapReactionRow(row, speciesFormulaMap))

  return { summary, elements, species, solutions, reactions, vessels }
}

interface RawRedoxRow {
  id: string
  couple_label: string
  ox_formula: string
  red_formula: string
  ox_species_id: string | null
  red_species_id: string | null
  ox_stoich: number
  red_stoich: number
  electrons: number
  h_plus: number
  h2o: number
  half_equation: string
  e0_v: number
  medium: string
  source: string
}

interface RawSolubilityProductRow {
  id: string
  solid_species_id: string | null
  solid_formula: string
  solid_name_fr: string
  cation_species_id: string | null
  cation_formula: string
  cation_stoich: number
  anion_species_id: string | null
  anion_formula: string
  anion_stoich: number
  pks: number
  ks: number
  precipitate_color_hex: string | null
  precipitate_color_fr: string
  source: string
}

interface RawAcidBaseRow {
  id: string
  acid_species_id: string | null
  base_species_id: string | null
  acid_formula: string
  base_formula: string
  acid_name_fr: string
  pka: number
  source: string
}

export function getReactionConstants(): ReactionConstantsResponse {
  const db = getDb()
  const redoxRows = db
    .prepare('SELECT * FROM redox_couples ORDER BY e0_v DESC')
    .all() as unknown as RawRedoxRow[]
  const ksRows = db
    .prepare('SELECT * FROM solubility_products ORDER BY pks ASC')
    .all() as unknown as RawSolubilityProductRow[]
  const abRows = db
    .prepare('SELECT * FROM acid_base_couples ORDER BY pka ASC')
    .all() as unknown as RawAcidBaseRow[]

  const redoxCouples: RedoxCoupleRecord[] = redoxRows.map((r) => ({
    id: r.id,
    coupleLabel: r.couple_label,
    oxFormula: r.ox_formula,
    redFormula: r.red_formula,
    oxSpeciesId: r.ox_species_id,
    redSpeciesId: r.red_species_id,
    oxStoich: r.ox_stoich,
    redStoich: r.red_stoich,
    electrons: r.electrons,
    hPlus: r.h_plus,
    h2o: r.h2o,
    halfEquation: r.half_equation,
    e0V: r.e0_v,
    medium: r.medium as RedoxCoupleRecord['medium'],
    source: r.source,
  }))

  const solubilityProducts: SolubilityProductRecord[] = ksRows.map((k) => ({
    id: k.id,
    solidSpeciesId: k.solid_species_id,
    solidFormula: k.solid_formula,
    solidNameFr: k.solid_name_fr,
    cationSpeciesId: k.cation_species_id,
    cationFormula: k.cation_formula,
    cationStoich: k.cation_stoich,
    anionSpeciesId: k.anion_species_id,
    anionFormula: k.anion_formula,
    anionStoich: k.anion_stoich,
    pKs: k.pks,
    ks: k.ks,
    precipitateColorHex: k.precipitate_color_hex,
    precipitateColorFr: k.precipitate_color_fr,
    source: k.source,
  }))

  const acidBaseCouples: AcidBaseCoupleRecord[] = abRows.map((ab) => ({
    id: ab.id,
    acidSpeciesId: ab.acid_species_id,
    baseSpeciesId: ab.base_species_id,
    acidFormula: ab.acid_formula,
    baseFormula: ab.base_formula,
    acidNameFr: ab.acid_name_fr,
    pKa: ab.pka,
    source: ab.source,
  }))

  return { redoxCouples, solubilityProducts, acidBaseCouples }
}

export function predictReactionByIds(
  speciesAId: string,
  speciesBId: string,
  speciesCId?: string,
): PredictReactionResponse | null {
  const spA = getSpeciesById(speciesAId)
  const spB = getSpeciesById(speciesBId)
  if (!spA || !spB) return null
  const spC = speciesCId ? getSpeciesById(speciesCId) : null

  const db = getDb()
  const constants = getReactionConstants()
  const rxnRows = db
    .prepare('SELECT * FROM reactions ORDER BY name_fr ASC')
    .all() as unknown as RawReactionRow[]
  const curatedReactions = rxnRows.map((row) => mapReactionRow(row))

  const ruleStmt = db.prepare(
    "SELECT product_species_id FROM dissolution_rules WHERE solute_id = ? AND solvent_id = 'h2o'",
  )

  return predictReactionsBetween(
    spA,
    spB,
    {
      curatedReactions,
      redoxCouples: constants.redoxCouples,
      solubilityProducts: constants.solubilityProducts,
      acidBaseCouples: constants.acidBaseCouples,
      getDissolvedIonIds: (id) => {
        const rows = ruleStmt.all(id) as Array<{ product_species_id: string }>
        return rows.map((r) => r.product_species_id)
      },
    },
    spC,
  )
}
