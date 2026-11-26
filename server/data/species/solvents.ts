import type { SpeciesSeed } from '../types.ts'

export const SOLVENTS_SEED: SpeciesSeed[] = [
  {
    "id": "h2o",
    "formula": "H2O",
    "displayFormula": "H₂O",
    "nameFr": "Eau",
    "iupacName": "oxidane",
    "casNumber": "7732-18-5",
    "pubchemCid": 962,
    "kind": "molecule",
    "molarMass": 18.015,
    "standardState": "liquid",
    "meltingPointC": 0,
    "boilingPointC": 100,
    "densityGPerCm3": 1,
    "appearanceFr": "Liquide limpide, incolore et inodore",
    "colorHex": "#bae6fd",
    "composition": {
      "H": 2,
      "O": 1
    },
    "isSolvent": true,
    "families": [
      "Inorganique"
    ],
    "popularity": 11332,
    "pkaValues": [
      14
    ],
    "ghsSignalWord": "Non classé",
    "usesFr": "Solvant polaire universel, milieu réactionnel aqueux et référence thermique (0 °C / 100 °C).",
    "identificationFr": "Fait virer le sulfate de cuivre anhydre blanc au bleu vif.",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "miscible",
      "colorHex": "#bae6fd",
      "phCharacter": "neutral",
      "solubilityGPerL": 1000
    },
    "behaviors": {
      "polarSolvent": true
    }
  }
]
