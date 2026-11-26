import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { seedDatabase } from './seed.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '../..')

function resolveDbPath(): string {
  if (process.env.DELTALAB_DB_PATH) return process.env.DELTALAB_DB_PATH
  const candidates = [
    path.join(process.cwd(), 'data', 'deltalab.sqlite'),
    path.join(ROOT_DIR, 'data', 'deltalab.sqlite'),
    path.resolve(__dirname, '../data/deltalab.sqlite'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return path.join(ROOT_DIR, 'data', 'deltalab.sqlite')
}

function resolveSchemaPath(): string {
  const candidates = [
    path.resolve(__dirname, '../schema.sql'),
    path.join(process.cwd(), 'server', 'schema.sql'),
    path.join(ROOT_DIR, 'server', 'schema.sql'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return path.resolve(__dirname, '../schema.sql')
}

const isReadOnlyRuntime =
  process.env.VERCEL === '1' ||
  process.env.VERCEL === 'true' ||
  process.env.DELTALAB_READONLY === '1'

let dbInstance: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance

  const dbPath = resolveDbPath()

  // On Vercel / serverless read-only environments, open the pre-seeded SQLite file
  // directly in read-only mode with zero disk writes and instant cold start.
  if (isReadOnlyRuntime && fs.existsSync(dbPath)) {
    const db = new DatabaseSync(dbPath, { readOnly: true })
    dbInstance = db
    return db
  }

  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)
  const schemaSql = fs.readFileSync(resolveSchemaPath(), 'utf-8')

  const speciesTableRow = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'species'")
    .get() as { sql: string } | undefined

  if (speciesTableRow) {
    const speciesCols = db
      .prepare('PRAGMA table_info(species)')
      .all() as Array<{ name: string }>
    const hasLegacyUniqueComposition = speciesTableRow.sql.includes(
      'composition_key TEXT UNIQUE',
    )
    const hasRemovedCols =
      speciesCols.some((col) => col.name === 'source') ||
      speciesCols.some((col) => col.name === 'smiles') ||
      speciesCols.some((col) => col.name === 'inchikey') ||
      speciesCols.some((col) => col.name === 'solubility_by_temp_json')
    const missingCols =
      !speciesCols.some((col) => col.name === 'lewis_json') ||
      !speciesCols.some((col) => col.name === 'lewis_topology_key') ||
      !speciesCols.some((col) => col.name === 'atom_signature') ||
      !speciesCols.some((col) => col.name === 'popularity') ||
      !speciesCols.some((col) => col.name === 'families_json') ||
      !speciesCols.some((col) => col.name === 'cas_number') ||
      !speciesCols.some((col) => col.name === 'density_g_per_cm3') ||
      !speciesCols.some((col) => col.name === 'pka_values_json')

    if (hasLegacyUniqueComposition || hasRemovedCols || missingCols) {
      db.exec('PRAGMA foreign_keys = OFF')
      db.exec('BEGIN TRANSACTION')
      try {
        db.exec('DROP TABLE IF EXISTS dissolution_rules')
        db.exec('DROP TABLE IF EXISTS solution_components')
        db.exec('DROP TABLE IF EXISTS solutions')
        db.exec('DROP TABLE IF EXISTS species')
        db.exec('DELETE FROM meta')
        db.exec('COMMIT')
      } catch {
        db.exec('ROLLBACK')
        db.exec('BEGIN TRANSACTION')
        db.exec('DROP TABLE IF EXISTS dissolution_rules')
        db.exec('DROP TABLE IF EXISTS solution_components')
        db.exec('DROP TABLE IF EXISTS solutions')
        db.exec('DROP TABLE IF EXISTS species')
        db.exec('COMMIT')
      } finally {
        db.exec('PRAGMA foreign_keys = ON')
      }
    }
  }

  const alloysTableRow = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'alloys'")
    .get() as { sql: string } | undefined
  if (alloysTableRow) {
    const alloyCols = db
      .prepare('PRAGMA table_info(alloys)')
      .all() as Array<{ name: string }>
    if (alloyCols.some((c) => c.name === 'source')) {
      db.exec('DROP TABLE IF EXISTS alloys')
      try {
        db.exec("DELETE FROM meta WHERE key = 'seed_version'")
      } catch {
        // meta may not exist yet
      }
    }
  }

  const elementsTableRow = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'elements'")
    .get() as { sql: string } | undefined
  if (elementsTableRow) {
    const elCols = db
      .prepare('PRAGMA table_info(elements)')
      .all() as Array<{ name: string }>
    if (!elCols.some((c) => c.name === 'electron_configuration')) {
      db.exec('DROP TABLE IF EXISTS elements')
      try {
        db.exec("DELETE FROM meta WHERE key = 'seed_version'")
      } catch {
        // meta may not exist yet
      }
    }
  }

  const vesselsTableRow = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'vessels'")
    .get() as { sql: string } | undefined
  if (vesselsTableRow) {
    const vesselCols = db
      .prepare('PRAGMA table_info(vessels)')
      .all() as Array<{ name: string }>
    if (!vesselCols.some((c) => c.name === 'available_capacities_json')) {
      db.exec('DROP TABLE IF EXISTS vessels')
    }
  }

  const rxnTableRow = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'reactions'")
    .get() as { sql: string } | undefined
  if (rxnTableRow) {
    const rxnCols = db
      .prepare('PRAGMA table_info(reactions)')
      .all() as Array<{ name: string }>
    if (!rxnCols.some((c) => c.name === 'category')) {
      db.exec('DROP TABLE IF EXISTS reactions')
    }
  }

  db.exec(schemaSql)
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_species_atom_sig_charge ON species(atom_signature, charge)',
  )
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_species_lewis_topology ON species(lewis_topology_key)',
  )
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_species_popularity ON species(popularity DESC)',
  )

  seedDatabase(db)
  dbInstance = db
  return db
}
