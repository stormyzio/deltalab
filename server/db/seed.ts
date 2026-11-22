import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DatabaseSync } from 'node:sqlite'
import type {
  PhCharacter,
  PhysicalState,
  SpeciesKind,
  SpeciesRecord,
  ThermalNote,
} from '../../shared/chemistry.ts'
import { ELEMENTS_SEED } from '../data/elements.ts'
import { computeLewisTopologyKey, resolveSpeciesLewis } from '../data/lewis.ts'
import { CURATED_REACTIONS, loadReactionConstants } from '../data/reactions/index.ts'
import { SPECIES_SEED } from '../data/species/index.ts'
import {
  buildCompositionKey,
  buildSolutionSignatureKey,
  computeMolarMassFromComposition,
} from '../data/types.ts'
import { VESSELS_SEED } from '../data/vessels.ts'
import { smilesToLewis } from '../lib/smiles-lewis.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ENRICHED_SPECIES_PATH = path.resolve(
  __dirname,
  '../data/generated/species-enriched.json',
)
export const REACTION_CONSTANTS_PATH = path.resolve(
  __dirname,
  '../data/generated/reaction-constants.json',
)

export const ATOMIC_MASS_BY_SYMBOL = new Map(
  ELEMENTS_SEED.map((e) => [e.symbol, e.atomicMass]),
)

interface EnrichedSpeciesJsonEntry {
  id: string
  source: 'curated' | 'wikidata'
  wikidataId: string | null
  formula: string
  displayFormula: string
  nameFr: string
  iupacName: string | null
  casNumber: string | null
  inchikey: string | null
  pubchemCid: number | null
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
  smiles: string | null
  popularity: number
  families: string[]
  canDissolveInWater: boolean
  solubilityGPerL: number | null
  solubilityByTempC: Record<string, number> | null
  dissolutionType: SpeciesRecord['dissolutionType']
  solutionColorHex: string | null
  phCharacter: PhCharacter
  pkaValues: number[]
  ghsPictograms: string[]
  ghsSignalWord: string | null
  dissociatesInto?: Array<{ speciesId: string; stoichiometry: number }>
  behaviors: Record<string, unknown>
}

function fileSig(filePath: string): string {
  try {
    const stat = fs.statSync(filePath)
    return `${stat.size}:${Math.trunc(stat.mtimeMs)}`
  } catch {
    return 'none'
  }
}

function computeSeedVersion(): string {
  return `v11|curated:${SPECIES_SEED.length}|vessels:${VESSELS_SEED.length}|rxn:${CURATED_REACTIONS.length}|enr:${fileSig(ENRICHED_SPECIES_PATH)}|rc:${fileSig(REACTION_CONSTANTS_PATH)}`
}

export function seedDatabase(db: DatabaseSync): void {
  const targetVersion = computeSeedVersion()
  const existingMeta = db
    .prepare("SELECT value FROM meta WHERE key = 'seed_version'")
    .get() as { value: string } | undefined
  const elementsCountRow = db
    .prepare('SELECT COUNT(*) as c FROM elements')
    .get() as { c: number } | undefined
  if (existingMeta?.value === targetVersion && (elementsCountRow?.c ?? 0) >= 118) {
    return
  }

  let enrichedEntries: EnrichedSpeciesJsonEntry[] = []
  try {
    if (fs.existsSync(ENRICHED_SPECIES_PATH)) {
      enrichedEntries = JSON.parse(
        fs.readFileSync(ENRICHED_SPECIES_PATH, 'utf-8'),
      ) as EnrichedSpeciesJsonEntry[]
    }
  } catch (err) {
    console.warn('[DeltaLab] Could not read enriched species JSON:', err)
  }

  const enrichedById = new Map(enrichedEntries.map((e) => [e.id, e]))
  const reactionConstants = loadReactionConstants()

  db.exec('BEGIN TRANSACTION')
  try {
    const insertElement = db.prepare(`
      INSERT OR REPLACE INTO elements (
        atomic_number, symbol, name_fr, atomic_mass, category, group_num,
        period, grid_row, grid_col, default_state, cpk_color,
        electronegativity, common_ion_charges_json,
        block, electron_configuration, electron_shells_json, valence_electrons,
        oxidation_states_json, atomic_radius_pm, vdw_radius_pm,
        ionization_energy_kj_mol, electron_affinity_kj_mol,
        melting_point_c, boiling_point_c, density_g_per_cm3,
        discovery_year, discovered_by, radioactive, synthetic,
        crystal_structure, summary_fr
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const el of ELEMENTS_SEED) {
      insertElement.run(
        el.atomicNumber,
        el.symbol,
        el.nameFr,
        el.atomicMass,
        el.category,
        el.groupNum,
        el.period,
        el.gridRow,
        el.gridCol,
        el.defaultState,
        el.cpkColor,
        el.electronegativity,
        JSON.stringify(el.commonIonCharges),
        el.block,
        el.electronConfiguration,
        JSON.stringify(el.electronShells),
        el.valenceElectrons,
        JSON.stringify(el.oxidationStates),
        el.atomicRadiusPm,
        el.vdwRadiusPm,
        el.ionizationEnergyKjMol,
        el.electronAffinityKjMol,
        el.meltingPointC,
        el.boilingPointC,
        el.densityGPerCm3,
        el.discoveryYear,
        el.discoveredBy,
        el.radioactive ? 1 : 0,
        el.synthetic ? 1 : 0,
        el.crystalStructure,
        el.summaryFr,
      )
    }

    db.exec('DELETE FROM dissolution_rules')
    db.exec('DELETE FROM solution_components')
    db.exec('DELETE FROM solutions')
    db.exec("DELETE FROM species WHERE source != 'pubchem_live'")

    const insertSpecies = db.prepare(`
      INSERT OR REPLACE INTO species (
        id, formula, display_formula, name_fr, iupac_name, cas_number,
        kind, charge, molar_mass, standard_state,
        melting_point_c, boiling_point_c, thermal_note, density_g_per_cm3,
        appearance_fr, color_hex, composition_json, composition_key, atom_signature,
        lewis_json, lewis_topology_key, source, popularity, smiles, inchikey, pubchem_cid, families_json,
        is_solvent, can_dissolve_in_water, solubility_g_per_l, solubility_by_temp_json,
        dissolution_type, solution_color_hex, ph_character, pka_values_json,
        ghs_pictograms_json, ghs_signal_word, behaviors_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const speciesById = new Map(SPECIES_SEED.map((sp) => [sp.id, sp]))
    const seededTopoKeys = new Set<string>()
    const seededIds = new Set<string>()

    // Layer 1: Hand-curated workbench core enriched with authoritative PubChem / AqSolDB / IUPAC data
    for (const sp of SPECIES_SEED) {
      const enr = enrichedById.get(sp.id)
      const atomSignature = buildCompositionKey(sp.composition)
      const isMergeable = sp.mergeable ?? sp.kind !== 'ion'
      const compositionKey = isMergeable ? atomSignature : null
      const lewis = resolveSpeciesLewis(sp, speciesById)
      const lewisJson = lewis ? JSON.stringify(lewis) : null
      const lewisTopologyKey = lewis
        ? computeLewisTopologyKey(lewis.atoms, lewis.bonds, false)
        : null
      if (lewisTopologyKey) seededTopoKeys.add(lewisTopologyKey)
      seededIds.add(sp.id)

      const computedMass =
        computeMolarMassFromComposition(sp.composition, ATOMIC_MASS_BY_SYMBOL) ||
        sp.molarMass
      const aq = sp.aqueous
      const soluble = aq?.soluble ?? false
      const dissolutionType =
        aq?.dissolutionType ??
        (soluble ? (aq?.dissociatesInto ? 'ionic_complete' : 'molecular') : 'none')
      const densityFallback =
        typeof sp.behaviors?.densityGPerMl === 'number'
          ? sp.behaviors.densityGPerMl
          : null
      const pkaFallback =
        typeof sp.behaviors?.pKa === 'number' ? [sp.behaviors.pKa] : []
      const pkaValues = enr?.pkaValues?.length ? enr.pkaValues : pkaFallback

      insertSpecies.run(
        sp.id,
        sp.formula,
        sp.displayFormula,
        sp.nameFr,
        enr?.iupacName ?? null,
        enr?.casNumber ?? null,
        sp.kind,
        sp.charge ?? 0,
        computedMass,
        sp.standardState,
        enr?.meltingPointC ?? null,
        enr?.boilingPointC ?? null,
        enr?.thermalNote ?? null,
        enr?.densityGPerCm3 ?? densityFallback,
        enr?.appearanceFr ?? null,
        sp.colorHex ?? enr?.colorHex ?? null,
        JSON.stringify(sp.composition),
        compositionKey,
        atomSignature,
        lewisJson,
        lewisTopologyKey,
        'curated',
        10000 + (enr?.popularity ?? 0),
        enr?.smiles ?? null,
        enr?.inchikey ?? null,
        enr?.pubchemCid ?? null,
        JSON.stringify(enr?.families ?? []),
        sp.isSolvent ? 1 : 0,
        soluble ? 1 : 0,
        aq?.solubilityGPerL ?? enr?.solubilityGPerL ?? null,
        enr?.solubilityByTempC ? JSON.stringify(enr.solubilityByTempC) : null,
        dissolutionType,
        aq?.colorHex ?? null,
        aq?.phCharacter ?? 'neutral',
        JSON.stringify(pkaValues),
        JSON.stringify(enr?.ghsPictograms ?? []),
        enr?.ghsSignalWord ?? null,
        JSON.stringify({
          ...(sp.behaviors ?? {}),
          ...(enr?.densityGPerCm3 ? { densityGPerMl: enr.densityGPerCm3 } : {}),
        }),
      )
    }

    // Layer 2: Strictly filtered complete species from PubChem + AqSolDB + IUPAC
    const extWithDissociation: EnrichedSpeciesJsonEntry[] = []
    for (const entry of enrichedEntries) {
      if (entry.source === 'curated' || seededIds.has(entry.id)) continue
      if (!entry.smiles) continue

      const parsed = smilesToLewis(entry.smiles, ATOMIC_MASS_BY_SYMBOL, {
        maxHeavyAtoms: 55,
        maxTotalAtoms: 140,
        maxMolarMass: 900,
      })
      if (!parsed) continue
      const lewisTopologyKey = computeLewisTopologyKey(
        parsed.lewis.atoms,
        parsed.lewis.bonds,
        false,
      )
      if (seededTopoKeys.has(lewisTopologyKey)) continue
      seededTopoKeys.add(lewisTopologyKey)
      seededIds.add(entry.id)

      const atomSignature = buildCompositionKey(entry.composition)
      const compositionKey = entry.kind !== 'ion' ? atomSignature : null
      const computedMass =
        computeMolarMassFromComposition(entry.composition, ATOMIC_MASS_BY_SYMBOL) ||
        entry.molarMass

      if (entry.dissociatesInto?.length) extWithDissociation.push(entry)

      insertSpecies.run(
        entry.id,
        entry.formula,
        entry.displayFormula,
        entry.nameFr,
        entry.iupacName,
        entry.casNumber,
        entry.kind,
        entry.charge ?? 0,
        computedMass,
        entry.standardState,
        entry.meltingPointC,
        entry.boilingPointC,
        entry.thermalNote,
        entry.densityGPerCm3,
        entry.appearanceFr,
        entry.colorHex,
        JSON.stringify(entry.composition),
        compositionKey,
        atomSignature,
        JSON.stringify(parsed.lewis),
        lewisTopologyKey,
        'wikidata',
        entry.popularity,
        entry.smiles,
        entry.inchikey,
        entry.pubchemCid,
        JSON.stringify(entry.families ?? []),
        0,
        entry.canDissolveInWater ? 1 : 0,
        entry.solubilityGPerL,
        entry.solubilityByTempC ? JSON.stringify(entry.solubilityByTempC) : null,
        entry.dissolutionType,
        entry.solutionColorHex,
        entry.phCharacter,
        JSON.stringify(entry.pkaValues ?? []),
        JSON.stringify(entry.ghsPictograms ?? []),
        entry.ghsSignalWord,
        JSON.stringify(entry.behaviors ?? {}),
      )
    }

    const insertRule = db.prepare(`
      INSERT INTO dissolution_rules (
        solute_id, solvent_id, product_species_id, stoichiometry, state_in_solution, note_fr
      ) VALUES (?, ?, ?, ?, ?, ?)
    `)

    for (const sp of SPECIES_SEED) {
      if (
        !sp.aqueous?.soluble ||
        sp.isSolvent ||
        (sp.kind === 'ion' && !sp.aqueous.dissociatesInto)
      ) {
        continue
      }
      const products = sp.aqueous.dissociatesInto ?? [
        { speciesId: sp.id, stoichiometry: 1, state: 'aqueous' as const },
      ]
      for (const prod of products) {
        if (!seededIds.has(prod.speciesId)) continue
        insertRule.run(
          sp.id,
          'h2o',
          prod.speciesId,
          prod.stoichiometry ?? 1,
          prod.state ?? 'aqueous',
          prod.noteFr ?? null,
        )
      }
    }

    for (const entry of extWithDissociation) {
      for (const prod of entry.dissociatesInto ?? []) {
        if (!seededIds.has(prod.speciesId)) continue
        insertRule.run(
          entry.id,
          'h2o',
          prod.speciesId,
          prod.stoichiometry,
          'aqueous',
          null,
        )
      }
    }

    const insertSolution = db.prepare(`
      INSERT INTO solutions (
        id, name_fr, formula_label, solvent_id, signature_key, color_hex, ph_estimate, is_aqueous, behaviors_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `)
    const insertSolComp = db.prepare(`
      INSERT INTO solution_components (solution_id, species_id, role) VALUES (?, ?, ?)
    `)

    for (const sp of SPECIES_SEED) {
      const sol = sp.aqueous?.solution
      if (!sol) continue
      const sig = buildSolutionSignatureKey([sp.id])
      insertSolution.run(
        sol.id,
        sol.nameFr,
        sol.formulaLabel,
        'h2o',
        sig,
        sol.colorHex ?? sp.aqueous?.colorHex ?? null,
        sol.phEstimate ?? null,
        JSON.stringify(sol.behaviors ?? {}),
      )
      insertSolComp.run(sol.id, 'h2o', 'solvent')
      insertSolComp.run(sol.id, sp.id, 'solute')
    }

    db.exec('DELETE FROM vessels')
    const insertVessel = db.prepare(`
      INSERT OR REPLACE INTO vessels (
        id, name_fr, vessel_type, capacity_ml, available_capacities_json,
        allows_solution, supports_heating, stopperable, precision_label,
        default_pour_step_ml, description_short
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const vessel of VESSELS_SEED) {
      insertVessel.run(
        vessel.id,
        vessel.nameFr,
        vessel.vesselType,
        vessel.capacityMl,
        JSON.stringify(vessel.availableCapacitiesMl),
        vessel.allowsSolution ? 1 : 0,
        vessel.supportsHeating ? 1 : 0,
        vessel.stopperable ? 1 : 0,
        vessel.precisionLabel,
        vessel.defaultPourStepMl,
        vessel.descriptionShort,
      )
    }

    db.exec('DELETE FROM reactions')
    const insertReaction = db.prepare(`
      INSERT OR REPLACE INTO reactions (
        id, name_fr, category, equation_display, medium, reactants_json, products_json, conditions_json, observations_fr
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const rxn of CURATED_REACTIONS) {
      insertReaction.run(
        rxn.id,
        rxn.nameFr,
        rxn.category,
        rxn.equationDisplay,
        rxn.medium,
        JSON.stringify(rxn.reactants),
        JSON.stringify(rxn.products),
        JSON.stringify(rxn.conditions ?? {}),
        rxn.observationsFr,
      )
    }

    db.exec('DELETE FROM redox_couples')
    const insertRedox = db.prepare(`
      INSERT OR REPLACE INTO redox_couples (
        id, couple_label, ox_formula, red_formula, ox_species_id, red_species_id,
        ox_stoich, red_stoich, electrons, h_plus, h2o, half_equation, e0_v, medium, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const c of reactionConstants.redoxCouples) {
      insertRedox.run(
        c.id,
        c.coupleLabel,
        c.oxFormula,
        c.redFormula,
        c.oxSpeciesId,
        c.redSpeciesId,
        c.oxStoich,
        c.redStoich,
        c.electrons,
        c.hPlus,
        c.h2o,
        c.halfEquation,
        c.e0V,
        c.medium,
        c.source,
      )
    }

    db.exec('DELETE FROM solubility_products')
    const insertKs = db.prepare(`
      INSERT OR REPLACE INTO solubility_products (
        id, solid_species_id, solid_formula, solid_name_fr,
        cation_species_id, cation_formula, cation_stoich,
        anion_species_id, anion_formula, anion_stoich,
        pks, ks, precipitate_color_hex, precipitate_color_fr, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const k of reactionConstants.solubilityProducts) {
      insertKs.run(
        k.id,
        k.solidSpeciesId,
        k.solidFormula,
        k.solidNameFr,
        k.cationSpeciesId,
        k.cationFormula,
        k.cationStoich,
        k.anionSpeciesId,
        k.anionFormula,
        k.anionStoich,
        k.pKs,
        k.ks,
        k.precipitateColorHex,
        k.precipitateColorFr,
        k.source,
      )
    }

    db.exec('DELETE FROM acid_base_couples')
    const insertAb = db.prepare(`
      INSERT OR REPLACE INTO acid_base_couples (
        id, acid_species_id, base_species_id, acid_formula, base_formula, acid_name_fr, pka, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const ab of reactionConstants.acidBaseCouples) {
      insertAb.run(
        ab.id,
        ab.acidSpeciesId,
        ab.baseSpeciesId,
        ab.acidFormula,
        ab.baseFormula,
        ab.acidNameFr,
        ab.pKa,
        ab.source,
      )
    }

    db.prepare(
      "INSERT OR REPLACE INTO meta (key, value) VALUES ('seed_version', ?)",
    ).run(targetVersion)

    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
