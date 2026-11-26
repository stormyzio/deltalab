import type { SpeciesSeed } from '../types.ts'
import { SOLVENTS_SEED } from './solvents.ts'
import { IONS_SEED } from './ions.ts'
import { ACIDS_BASES_SEED } from './acids-bases.ts'
import { SALTS_SEED } from './salts.ts'
import { MOLECULES_SEED } from './molecules.ts'
import { ORGANICS_SEED } from './organics.ts'

export const SPECIES_SEED: SpeciesSeed[] = [
  ...SOLVENTS_SEED,
  ...IONS_SEED,
  ...ACIDS_BASES_SEED,
  ...SALTS_SEED,
  ...MOLECULES_SEED,
  ...ORGANICS_SEED,
]
