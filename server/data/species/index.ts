import type { SpeciesSeed } from '../types.ts'
import { SOLVENTS_SEED } from './curated/solvents.ts'
import { IONS_SEED } from './curated/ions.ts'
import { ACIDS_BASES_SEED } from './curated/acids-bases.ts'
import { SALTS_SEED } from './curated/salts.ts'
import { MOLECULES_SEED } from './curated/molecules.ts'
import { ORGANICS_SEED } from './curated/organics.ts'

export const SPECIES_SEED: SpeciesSeed[] = [
  ...SOLVENTS_SEED,
  ...IONS_SEED,
  ...ACIDS_BASES_SEED,
  ...SALTS_SEED,
  ...MOLECULES_SEED,
  ...ORGANICS_SEED,
]
