import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DatabaseSync } from 'node:sqlite'
import {
  type AlloyRecord,
  getElementSolidColor,
  getSolidSpeciesIdForElement,
} from '../../shared/chemistry.ts'
import { ELEMENTS_SEED } from '../data/elements.ts'
import {
  computeLewisTopologyKey,
  makeMonoatomicLewis,
  resolveSpeciesLewis,
} from '../data/lewis.ts'
import { CURATED_REACTIONS, loadReactionConstants } from '../data/reactions/index.ts'
import { SPECIES_SEED } from '../data/species/index.ts'
import { buildMonatomicIonSeeds } from '../data/species/monatomic-ions.ts'
import {
  buildCompositionKey,
  buildSolutionSignatureKey,
  computeMolarMassFromComposition,
} from '../data/types.ts'
import { VESSELS_SEED } from '../data/vessels.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const REACTION_CONSTANTS_PATH = path.resolve(
  __dirname,
  '../data/reactions/constants.json',
)
export const ALLOYS_PATH = path.resolve(__dirname, '../data/alloys.json')

export const ATOMIC_MASS_BY_SYMBOL = new Map(
  ELEMENTS_SEED.map((e) => [e.symbol, e.atomicMass]),
)

const COMMON_SOLID_SYMBOLS = new Set([
  'Cu',
  'Ag',
  'Zn',
  'Fe',
  'Mg',
  'Al',
  'Pb',
  'Sn',
  'Ni',
  'Co',
  'Au',
  'Na',
  'K',
  'Ca',
  'Li',
  'Cr',
  'Mn',
  'C',
])

const COMMON_SOLID_OVERRIDES: Record<
  string,
  { nameFr?: string; behaviors?: Record<string, unknown> }
> = {
  C: { nameFr: 'Carbone (graphite)' },
  Na: { behaviors: { reactsWithWater: true } },
  K: { behaviors: { reactsWithWater: true } },
  Ca: { behaviors: { reactsWithWater: true } },
  Li: { behaviors: { reactsWithWater: true } },
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
  return `v25-clean|el:${ELEMENTS_SEED.length}|sp:${SPECIES_SEED.length}|vessels:${VESSELS_SEED.length}|rxn:${CURATED_REACTIONS.length}|rc:${fileSig(REACTION_CONSTANTS_PATH)}|alloys:${fileSig(ALLOYS_PATH)}`
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

  const reactionConstants = loadReactionConstants()

  let alloysSeed: AlloyRecord[] = []
  try {
    if (fs.existsSync(ALLOYS_PATH)) {
      alloysSeed = JSON.parse(fs.readFileSync(ALLOYS_PATH, 'utf-8')) as AlloyRecord[]
    }
  } catch (err) {
    console.warn('[DeltaLab] Could not read alloys JSON:', err)
  }

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
    db.exec('DELETE FROM species')

    const insertSpecies = db.prepare(`
      INSERT OR REPLACE INTO species (
        id, formula, display_formula, name_fr, iupac_name, cas_number,
        kind, charge, molar_mass, standard_state,
        melting_point_c, boiling_point_c, thermal_note, density_g_per_cm3,
        appearance_fr, color_hex, composition_json, composition_key, atom_signature,
        lewis_json, lewis_topology_key, popularity, pubchem_cid, families_json,
        is_solvent, can_dissolve_in_water, solubility_g_per_l,
        dissolution_type, solution_color_hex, ph_character, pka_values_json,
        ghs_pictograms_json, ghs_signal_word, behaviors_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const generatedMonatomicIons = buildMonatomicIonSeeds(ELEMENTS_SEED)
    const speciesById = new Map(
      [...SPECIES_SEED, ...generatedMonatomicIons].map((sp) => [sp.id, sp]),
    )

    const iupacAcidPkaBySpeciesId = new Map<string, number[]>()
    for (const ab of reactionConstants.acidBaseCouples) {
      if (!ab.acidSpeciesId) continue
      const arr = iupacAcidPkaBySpeciesId.get(ab.acidSpeciesId) ?? []
      arr.push(ab.pKa)
      iupacAcidPkaBySpeciesId.set(ab.acidSpeciesId, arr)
    }
    for (const arr of iupacAcidPkaBySpeciesId.values()) arr.sort((a, b) => a - b)

    const seededIds = new Set<string>()

    // Layer 1A: Curated core species + polyatomic ions
    for (const sp of SPECIES_SEED) {
      seededIds.add(sp.id)
      const ionCharge = sp.charge ?? 0
      const atomSignature = buildCompositionKey(sp.composition)
      const isMergeable = sp.mergeable ?? sp.kind !== 'ion'
      const compositionKey = isMergeable ? atomSignature : null
      const lewis = resolveSpeciesLewis(sp, speciesById)
      const lewisJson = lewis ? JSON.stringify(lewis) : null
      const lewisTopologyKey = lewis
        ? computeLewisTopologyKey(lewis.atoms, lewis.bonds, false)
        : null

      const computedMass =
        computeMolarMassFromComposition(sp.composition, ATOMIC_MASS_BY_SYMBOL) ||
        sp.molarMass
      const aq = sp.aqueous
      const soluble = aq?.soluble ?? false
      const dissolutionType =
        aq?.dissolutionType ??
        (soluble ? (aq?.dissociatesInto ? 'ionic_complete' : 'molecular') : 'none')
      const pkaValues = sp.pkaValues?.length
        ? sp.pkaValues
        : (iupacAcidPkaBySpeciesId.get(sp.id) ?? [])

      const behaviors: Record<string, unknown> = {
        ...(sp.behaviors ?? {}),
        ...(sp.usesFr ? { usesFr: sp.usesFr } : {}),
        ...(sp.identificationFr ? { identificationFr: sp.identificationFr } : {}),
      }

      insertSpecies.run(
        sp.id,
        sp.formula,
        sp.displayFormula,
        sp.nameFr,
        sp.iupacName ?? null,
        sp.casNumber ?? null,
        sp.kind,
        ionCharge,
        computedMass,
        sp.standardState,
        sp.meltingPointC ?? null,
        sp.boilingPointC ?? null,
        sp.thermalNote ?? null,
        sp.densityGPerCm3 ?? null,
        sp.appearanceFr ?? null,
        sp.colorHex ?? null,
        JSON.stringify(sp.composition),
        compositionKey,
        atomSignature,
        lewisJson,
        lewisTopologyKey,
        sp.popularity ?? 10000,
        sp.pubchemCid ?? null,
        JSON.stringify(sp.families ?? []),
        sp.isSolvent ? 1 : 0,
        soluble ? 1 : 0,
        soluble ? (aq?.solubilityGPerL ?? null) : 0,
        dissolutionType,
        aq?.colorHex ?? null,
        aq?.phCharacter ?? 'neutral',
        JSON.stringify(pkaValues),
        JSON.stringify(sp.ghsPictograms ?? []),
        sp.ghsSignalWord ?? null,
        JSON.stringify(behaviors),
      )
    }

    // Layer 1B: Solid elemental substances for all solid elements in the periodic table
    for (const el of ELEMENTS_SEED) {
      if (el.defaultState !== 'solid') continue
      const solidId = getSolidSpeciesIdForElement(el.symbol)
      if (seededIds.has(solidId)) continue
      seededIds.add(solidId)

      const isMetal =
        el.category !== 'nonmetal' &&
        el.category !== 'metalloid' &&
        el.category !== 'halogen' &&
        el.category !== 'noble-gas'
      const comp = { [el.symbol]: 1 }
      const atomSignature = buildCompositionKey(comp)
      const solidColor = getElementSolidColor(el.symbol, el.category)
      const override = COMMON_SOLID_OVERRIDES[el.symbol]
      const nameFr =
        override?.nameFr ??
        (isMetal ? `${el.nameFr} métallique` : `${el.nameFr} solide`)

      const solidThermalNote =
        el.meltingPointC !== null &&
        el.boilingPointC !== null &&
        el.boilingPointC < el.meltingPointC
          ? 'sublimes'
          : null
      const solidLewis = makeMonoatomicLewis(el.symbol, 0)
      const solidLewisJson = JSON.stringify(solidLewis)
      const solidLewisTopoKey = computeLewisTopologyKey(
        solidLewis.atoms,
        solidLewis.bonds,
        false,
      )

      insertSpecies.run(
        solidId,
        el.symbol,
        el.symbol,
        nameFr,
        null,
        null,
        'element_substance',
        0,
        el.atomicMass,
        'solid',
        el.meltingPointC,
        el.boilingPointC,
        solidThermalNote,
        el.densityGPerCm3,
        isMetal ? 'Métal solide' : 'Solide élémentaire',
        solidColor,
        JSON.stringify(comp),
        null,
        atomSignature,
        solidLewisJson,
        solidLewisTopoKey,
        COMMON_SOLID_SYMBOLS.has(el.symbol) ? 11000 : 3500,
        null,
        JSON.stringify([isMetal ? 'Métal' : 'Corps simple']),
        0,
        0,
        0,
        'none',
        null,
        'neutral',
        '[]',
        '[]',
        null,
        JSON.stringify(override?.behaviors ?? {}),
      )
    }

    // Layer 1C: Complete coverage of monatomic ions across the periodic table
    for (const ion of generatedMonatomicIons) {
      if (seededIds.has(ion.id)) continue
      seededIds.add(ion.id)
      const sym = Object.keys(ion.composition)[0]
      const charge = ion.charge ?? 0
      const atomSignature = buildCompositionKey(ion.composition)
      const ionLewis = makeMonoatomicLewis(sym, charge)
      const ionLewisJson = JSON.stringify(ionLewis)
      const ionLewisTopoKey = computeLewisTopologyKey(
        ionLewis.atoms,
        ionLewis.bonds,
        false,
      )
      const aq = ion.aqueous
      const soluble = aq?.soluble ?? true
      const behaviors: Record<string, unknown> = {
        ...(ion.usesFr ? { usesFr: ion.usesFr } : {}),
        ...(ion.identificationFr ? { identificationFr: ion.identificationFr } : {}),
      }

      insertSpecies.run(
        ion.id,
        ion.formula,
        ion.displayFormula,
        ion.nameFr,
        ion.iupacName ?? null,
        ion.casNumber ?? null,
        'ion',
        charge,
        ion.molarMass,
        'aqueous',
        null,
        null,
        null,
        null,
        ion.appearanceFr ?? null,
        ion.colorHex ?? null,
        JSON.stringify(ion.composition),
        null,
        atomSignature,
        ionLewisJson,
        ionLewisTopoKey,
        ion.popularity ?? 3000,
        ion.pubchemCid ?? null,
        JSON.stringify(ion.families ?? []),
        0,
        soluble ? 1 : 0,
        null,
        aq?.dissolutionType ?? (soluble ? 'ionic_complete' : 'none'),
        aq?.colorHex ?? null,
        aq?.phCharacter ?? 'neutral',
        '[]',
        '[]',
        null,
        JSON.stringify(behaviors),
      )
    }

    const insertRule = db.prepare(`
      INSERT INTO dissolution_rules (
        solute_id, solvent_id, product_species_id, stoichiometry, state_in_solution, note_fr
      ) VALUES (?, ?, ?, ?, ?, ?)
    `)

    for (const sp of [...SPECIES_SEED, ...generatedMonatomicIons]) {
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
      const allPresent =
        rxn.reactants.every((r) => seededIds.has(r.speciesId)) &&
        rxn.products.every((p) => seededIds.has(p.speciesId))
      if (!allPresent) continue
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
      if (
        (c.oxSpeciesId && !seededIds.has(c.oxSpeciesId)) ||
        (c.redSpeciesId && !seededIds.has(c.redSpeciesId))
      ) {
        continue
      }
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
      if (
        (k.solidSpeciesId && !seededIds.has(k.solidSpeciesId)) ||
        (k.cationSpeciesId && !seededIds.has(k.cationSpeciesId)) ||
        (k.anionSpeciesId && !seededIds.has(k.anionSpeciesId))
      ) {
        continue
      }
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
      if (
        (ab.acidSpeciesId && !seededIds.has(ab.acidSpeciesId)) ||
        (ab.baseSpeciesId && !seededIds.has(ab.baseSpeciesId))
      ) {
        continue
      }
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

    db.exec('DELETE FROM alloys')
    const insertAlloy = db.prepare(`
      INSERT OR REPLACE INTO alloys (
        id, name_fr, family_fr, base_element, components_json,
        density_g_per_cm3, melting_point_c, color_hex, uses_fr
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const al of alloysSeed) {
      insertAlloy.run(
        al.id,
        al.nameFr,
        al.familyFr,
        al.baseElement,
        JSON.stringify(al.components),
        al.densityGPerCm3,
        al.meltingPointC,
        al.colorHex,
        al.usesFr,
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
