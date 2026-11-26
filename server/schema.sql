PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS elements (
  atomic_number INTEGER PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  name_fr TEXT NOT NULL,
  atomic_mass REAL NOT NULL,
  category TEXT NOT NULL,
  group_num INTEGER,
  period INTEGER NOT NULL,
  grid_row INTEGER NOT NULL,
  grid_col INTEGER NOT NULL,
  default_state TEXT NOT NULL,
  cpk_color TEXT NOT NULL,
  electronegativity REAL,
  common_ion_charges_json TEXT NOT NULL DEFAULT '[]',
  block TEXT NOT NULL DEFAULT 'p',
  electron_configuration TEXT NOT NULL DEFAULT '',
  electron_shells_json TEXT NOT NULL DEFAULT '[]',
  valence_electrons INTEGER NOT NULL DEFAULT 0,
  oxidation_states_json TEXT NOT NULL DEFAULT '[]',
  atomic_radius_pm REAL,
  vdw_radius_pm REAL,
  ionization_energy_kj_mol REAL,
  electron_affinity_kj_mol REAL,
  melting_point_c REAL,
  boiling_point_c REAL,
  density_g_per_cm3 REAL,
  discovery_year INTEGER,
  discovered_by TEXT,
  radioactive INTEGER NOT NULL DEFAULT 0,
  synthetic INTEGER NOT NULL DEFAULT 0,
  crystal_structure TEXT,
  summary_fr TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS species (
  id TEXT PRIMARY KEY,
  formula TEXT NOT NULL,
  display_formula TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  iupac_name TEXT,
  cas_number TEXT,
  kind TEXT NOT NULL,
  charge INTEGER NOT NULL DEFAULT 0,
  molar_mass REAL NOT NULL,
  standard_state TEXT NOT NULL,
  melting_point_c REAL,
  boiling_point_c REAL,
  thermal_note TEXT,
  density_g_per_cm3 REAL,
  appearance_fr TEXT,
  color_hex TEXT,
  composition_json TEXT NOT NULL,
  composition_key TEXT,
  atom_signature TEXT NOT NULL DEFAULT '',
  lewis_json TEXT,
  lewis_topology_key TEXT,
  popularity INTEGER NOT NULL DEFAULT 0,
  pubchem_cid INTEGER,
  families_json TEXT NOT NULL DEFAULT '[]',
  is_solvent INTEGER NOT NULL DEFAULT 0,
  can_dissolve_in_water INTEGER NOT NULL DEFAULT 0,
  solubility_g_per_l REAL,
  dissolution_type TEXT NOT NULL DEFAULT 'none',
  solution_color_hex TEXT,
  ph_character TEXT NOT NULL DEFAULT 'neutral',
  pka_values_json TEXT NOT NULL DEFAULT '[]',
  ghs_pictograms_json TEXT NOT NULL DEFAULT '[]',
  ghs_signal_word TEXT,
  behaviors_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_species_composition_key ON species(composition_key);
CREATE INDEX IF NOT EXISTS idx_species_kind ON species(kind);
CREATE INDEX IF NOT EXISTS idx_species_lewis_topology ON species(lewis_topology_key);
CREATE INDEX IF NOT EXISTS idx_species_popularity ON species(popularity DESC);
CREATE INDEX IF NOT EXISTS idx_species_cas ON species(cas_number);

CREATE TABLE IF NOT EXISTS dissolution_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  solute_id TEXT NOT NULL REFERENCES species(id) ON DELETE CASCADE,
  solvent_id TEXT NOT NULL REFERENCES species(id) ON DELETE CASCADE,
  product_species_id TEXT NOT NULL REFERENCES species(id) ON DELETE CASCADE,
  stoichiometry INTEGER NOT NULL DEFAULT 1,
  state_in_solution TEXT NOT NULL DEFAULT 'aqueous',
  note_fr TEXT
);

CREATE INDEX IF NOT EXISTS idx_dissolution_solute ON dissolution_rules(solute_id, solvent_id);

CREATE TABLE IF NOT EXISTS solutions (
  id TEXT PRIMARY KEY,
  name_fr TEXT NOT NULL,
  formula_label TEXT NOT NULL,
  solvent_id TEXT NOT NULL REFERENCES species(id),
  signature_key TEXT NOT NULL UNIQUE,
  color_hex TEXT,
  ph_estimate REAL,
  is_aqueous INTEGER NOT NULL DEFAULT 1,
  behaviors_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS solution_components (
  solution_id TEXT NOT NULL REFERENCES solutions(id) ON DELETE CASCADE,
  species_id TEXT NOT NULL REFERENCES species(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'solute',
  PRIMARY KEY (solution_id, species_id)
);

CREATE TABLE IF NOT EXISTS vessels (
  id TEXT PRIMARY KEY,
  name_fr TEXT NOT NULL,
  vessel_type TEXT NOT NULL,
  capacity_ml REAL NOT NULL,
  available_capacities_json TEXT NOT NULL DEFAULT '[]',
  allows_solution INTEGER NOT NULL DEFAULT 1,
  supports_heating INTEGER NOT NULL DEFAULT 0,
  stopperable INTEGER NOT NULL DEFAULT 0,
  precision_label TEXT NOT NULL DEFAULT 'Approximative',
  default_pour_step_ml REAL,
  description_short TEXT NOT NULL
);

-- Dedicated reactions & scientific constants layer (strictly separate from species)
CREATE TABLE IF NOT EXISTS reactions (
  id TEXT PRIMARY KEY,
  name_fr TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'acid_base',
  equation_display TEXT NOT NULL,
  medium TEXT NOT NULL,
  reactants_json TEXT NOT NULL,
  products_json TEXT NOT NULL,
  conditions_json TEXT NOT NULL DEFAULT '{}',
  observations_fr TEXT
);

CREATE TABLE IF NOT EXISTS redox_couples (
  id TEXT PRIMARY KEY,
  couple_label TEXT NOT NULL,
  ox_formula TEXT NOT NULL,
  red_formula TEXT NOT NULL,
  ox_species_id TEXT,
  red_species_id TEXT,
  ox_stoich INTEGER NOT NULL DEFAULT 1,
  red_stoich INTEGER NOT NULL DEFAULT 1,
  electrons INTEGER NOT NULL DEFAULT 1,
  h_plus INTEGER NOT NULL DEFAULT 0,
  h2o INTEGER NOT NULL DEFAULT 0,
  half_equation TEXT NOT NULL,
  e0_v REAL NOT NULL,
  medium TEXT NOT NULL DEFAULT 'neutral',
  source TEXT NOT NULL DEFAULT 'CRC/IUPAC'
);

CREATE TABLE IF NOT EXISTS solubility_products (
  id TEXT PRIMARY KEY,
  solid_species_id TEXT,
  solid_formula TEXT NOT NULL,
  solid_name_fr TEXT NOT NULL,
  cation_species_id TEXT,
  cation_formula TEXT NOT NULL,
  cation_stoich INTEGER NOT NULL DEFAULT 1,
  anion_species_id TEXT,
  anion_formula TEXT NOT NULL,
  anion_stoich INTEGER NOT NULL DEFAULT 1,
  pks REAL NOT NULL,
  ks REAL NOT NULL,
  precipitate_color_hex TEXT,
  precipitate_color_fr TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'CRC/IUPAC'
);

CREATE TABLE IF NOT EXISTS acid_base_couples (
  id TEXT PRIMARY KEY,
  acid_species_id TEXT,
  base_species_id TEXT,
  acid_formula TEXT NOT NULL,
  base_formula TEXT NOT NULL,
  acid_name_fr TEXT NOT NULL,
  pka REAL NOT NULL,
  source TEXT NOT NULL DEFAULT 'IUPAC'
);

CREATE TABLE IF NOT EXISTS alloys (
  id TEXT PRIMARY KEY,
  name_fr TEXT NOT NULL,
  family_fr TEXT NOT NULL,
  base_element TEXT NOT NULL,
  components_json TEXT NOT NULL,
  density_g_per_cm3 REAL NOT NULL,
  melting_point_c REAL,
  color_hex TEXT NOT NULL,
  uses_fr TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_alloys_base_element ON alloys(base_element);

CREATE TABLE IF NOT EXISTS workspace_state (
  id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
