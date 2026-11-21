import type { SpeciesSeed } from '../../types.ts'

export const SOLVENTS_SEED: SpeciesSeed[] = [
  {
    id: 'h2o',
    formula: 'H2O',
    displayFormula: 'H₂O',
    nameFr: 'Eau',
    kind: 'molecule',
    molarMass: 18.015,
    standardState: 'liquid',
    colorHex: '#bae6fd',
    composition: { H: 2, O: 1 },
    isSolvent: true,
    aqueous: {
      soluble: true,
      dissolutionType: 'miscible',
      colorHex: '#bae6fd',
      phCharacter: 'neutral',
    },
    behaviors: {
      boilingPointC: 100,
      meltingPointC: 0,
      densityGPerMl: 1.0,
      polarSolvent: true,
    },
  },
]
