import type { SpeciesSeed } from '../types.ts'

export const ORGANICS_SEED: SpeciesSeed[] = [
  {
    "id": "ch4",
    "formula": "CH4",
    "displayFormula": "CH₄",
    "nameFr": "Méthane",
    "iupacName": "methane",
    "casNumber": "74-82-8",
    "pubchemCid": 297,
    "kind": "molecule",
    "molarMass": 16.043,
    "standardState": "gas",
    "meltingPointC": -182.5,
    "boilingPointC": -161.5,
    "densityGPerCm3": 0.000668,
    "appearanceFr": "Gaz incolore, inodore et inflammable (constituant principal du gaz naturel)",
    "colorHex": "#d4d4d8",
    "composition": {
      "C": 1,
      "H": 4
    },
    "families": [
      "Alcane"
    ],
    "popularity": 11120,
    "ghsPictograms": [
      "GHS02",
      "GHS04"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Combustible domestique et industriel, production de dihydrogène par vaporeformage.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.022
    }
  },
  {
    "id": "c2h6",
    "formula": "C2H6",
    "displayFormula": "C₂H₆",
    "nameFr": "Éthane",
    "iupacName": "ethane",
    "casNumber": "74-84-0",
    "pubchemCid": 6324,
    "kind": "molecule",
    "molarMass": 30.07,
    "standardState": "gas",
    "meltingPointC": -182.8,
    "boilingPointC": -88.6,
    "densityGPerCm3": 0.001264,
    "appearanceFr": "Gaz incolore, inodore et inflammable",
    "colorHex": "#d4d4d8",
    "composition": {
      "C": 2,
      "H": 6
    },
    "families": [
      "Alcane"
    ],
    "popularity": 11083,
    "ghsPictograms": [
      "GHS02",
      "GHS04",
      "GHS07"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Matière première pétrochimique pour la production d’éthylène (C₂H₄).",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.06
    }
  },
  {
    "id": "c2h4",
    "formula": "C2H4",
    "displayFormula": "C₂H₄",
    "nameFr": "Éthylène (éthène)",
    "iupacName": "ethene",
    "casNumber": "74-85-1",
    "pubchemCid": 6325,
    "kind": "molecule",
    "molarMass": 28.054,
    "standardState": "gas",
    "meltingPointC": -169.2,
    "boilingPointC": -103.7,
    "densityGPerCm3": 0.001178,
    "appearanceFr": "Gaz incolore inflammable à très légère odeur douceâtre",
    "colorHex": "#d4d4d8",
    "composition": {
      "C": 2,
      "H": 4
    },
    "families": [
      "Alcène"
    ],
    "popularity": 11080,
    "ghsPictograms": [
      "GHS02",
      "GHS04",
      "GHS07"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Monomère du polyéthylène (PE) et hormone végétale de maturation des fruits.",
    "identificationFr": "Décolore l’eau de brome (addition sur la double liaison C=C).",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.13
    }
  },
  {
    "id": "c2h2",
    "formula": "C2H2",
    "displayFormula": "C₂H₂",
    "nameFr": "Acétylène (éthyne)",
    "iupacName": "acetylene",
    "casNumber": "74-86-2",
    "pubchemCid": 6326,
    "kind": "molecule",
    "molarMass": 26.038,
    "standardState": "gas",
    "meltingPointC": -80.8,
    "boilingPointC": -84,
    "thermalNote": "sublimes",
    "densityGPerCm3": 0.001097,
    "appearanceFr": "Gaz incolore très inflammable (flamme extrêmement chaude > 3 000 °C)",
    "colorHex": "#d4d4d8",
    "composition": {
      "C": 2,
      "H": 2
    },
    "families": [
      "Alcyne"
    ],
    "popularity": 11078,
    "ghsPictograms": [
      "GHS02",
      "GHS04",
      "GHS07"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Soudage et découpage oxyacétylénique, synthèses organiques d’alcynes.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 1.2
    }
  },
  {
    "id": "c3h8",
    "formula": "C3H8",
    "displayFormula": "C₃H₈",
    "nameFr": "Propane",
    "iupacName": "propane",
    "casNumber": "74-98-6",
    "pubchemCid": 6334,
    "kind": "molecule",
    "molarMass": 44.097,
    "standardState": "gas",
    "meltingPointC": -187.7,
    "boilingPointC": -42.1,
    "densityGPerCm3": 0.00188,
    "appearanceFr": "Gaz incolore facilement liquéfiable sous pression (GPL)",
    "colorHex": "#d4d4d8",
    "composition": {
      "C": 3,
      "H": 8
    },
    "families": [
      "Alcane"
    ],
    "popularity": 11077,
    "ghsPictograms": [
      "GHS02",
      "GHS04",
      "GHS07"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Combustible de chauffage, chalumeaux et gaz de pétrole liquéfié.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.062
    }
  },
  {
    "id": "c4h10",
    "formula": "C4H10",
    "displayFormula": "C₄H₁₀",
    "nameFr": "Butane",
    "iupacName": "butane",
    "casNumber": "106-97-8",
    "pubchemCid": 7843,
    "kind": "molecule",
    "molarMass": 58.124,
    "standardState": "gas",
    "meltingPointC": -138.3,
    "boilingPointC": -0.5,
    "densityGPerCm3": 0.00248,
    "appearanceFr": "Gaz incolore liquéfiable dès 0 °C à pression atmosphérique",
    "colorHex": "#d4d4d8",
    "composition": {
      "C": 4,
      "H": 10
    },
    "families": [
      "Alcane"
    ],
    "popularity": 11077,
    "ghsPictograms": [
      "GHS02",
      "GHS04",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Gaz de briquets, réchauds portatifs et combustible domestique.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.061
    }
  },
  {
    "id": "c6h6",
    "formula": "C6H6",
    "displayFormula": "C₆H₆",
    "nameFr": "Benzène",
    "iupacName": "benzene",
    "casNumber": "71-43-2",
    "pubchemCid": 241,
    "kind": "molecule",
    "molarMass": 78.114,
    "standardState": "liquid",
    "meltingPointC": 5.5,
    "boilingPointC": 80.1,
    "densityGPerCm3": 0.876,
    "appearanceFr": "Liquide incolore volatil non miscible à l’eau (aromatique, cancérogène)",
    "colorHex": "#e4e4e7",
    "composition": {
      "C": 6,
      "H": 6
    },
    "families": [
      "Aromatique"
    ],
    "popularity": 11094,
    "ghsPictograms": [
      "GHS02",
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Archétype des composés aromatiques (délocalisation électronique cyclique).",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 1.79
    }
  },
  {
    "id": "ch4o",
    "formula": "CH3OH",
    "displayFormula": "CH₃OH",
    "nameFr": "Méthanol",
    "iupacName": "methanol",
    "casNumber": "67-56-1",
    "pubchemCid": 887,
    "kind": "molecule",
    "molarMass": 32.042,
    "standardState": "liquid",
    "meltingPointC": -97.6,
    "boilingPointC": 64.7,
    "densityGPerCm3": 0.792,
    "appearanceFr": "Liquide limpide incolore volatil, miscible à l’eau (toxique)",
    "colorHex": "#e4e4e7",
    "composition": {
      "C": 1,
      "H": 4,
      "O": 1
    },
    "families": [
      "Alcool"
    ],
    "popularity": 11083,
    "pkaValues": [
      -0.34,
      15.5
    ],
    "ghsPictograms": [
      "GHS02",
      "GHS06",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Solvant organique, synthèse du formol et carburant de piles à combustible.",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "miscible",
      "phCharacter": "neutral",
      "solubilityGPerL": 1000
    }
  },
  {
    "id": "c2h6o",
    "formula": "C2H5OH",
    "displayFormula": "C₂H₅OH",
    "nameFr": "Éthanol",
    "iupacName": "ethanol",
    "casNumber": "64-17-5",
    "pubchemCid": 702,
    "kind": "molecule",
    "molarMass": 46.069,
    "standardState": "liquid",
    "meltingPointC": -114.1,
    "boilingPointC": 78.4,
    "densityGPerCm3": 0.789,
    "appearanceFr": "Liquide limpide incolore volatil à odeur alcoolisée, miscible à l’eau",
    "colorHex": "#e4e4e7",
    "composition": {
      "C": 2,
      "H": 6,
      "O": 1
    },
    "families": [
      "Alcool"
    ],
    "popularity": 11133,
    "pkaValues": [
      -0.33,
      15.93
    ],
    "ghsPictograms": [
      "GHS02",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Solvant courant, antiseptique, bioéthanol et réactif d’estérification.",
    "identificationFr": "S’enflamme avec une flamme bleue pâle ; s’oxyde en présence de Cr₂O₇²⁻ acide.",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "miscible",
      "phCharacter": "neutral",
      "solution": {
        "id": "sol_ethanol_aqueux",
        "nameFr": "Solution hydroalcoolique",
        "formulaLabel": "C₂H₅OH(aq)",
        "colorHex": "#e0f2fe",
        "phEstimate": 7,
        "behaviors": {
          "miscible": true
        }
      },
      "solubilityGPerL": 789
    }
  },
  {
    "id": "c3h6o",
    "formula": "C3H6O",
    "displayFormula": "CH₃COCH₃",
    "nameFr": "Acétone (propanone)",
    "iupacName": "propan-2-one",
    "casNumber": "67-64-1",
    "pubchemCid": 180,
    "kind": "molecule",
    "molarMass": 58.08,
    "standardState": "liquid",
    "meltingPointC": -94.7,
    "boilingPointC": 56.1,
    "densityGPerCm3": 0.784,
    "appearanceFr": "Liquide limpide très volatil à odeur caractéristique, miscible à l’eau",
    "colorHex": "#e4e4e7",
    "composition": {
      "C": 3,
      "H": 6,
      "O": 1
    },
    "families": [
      "Cétone"
    ],
    "popularity": 11077,
    "pkaValues": [
      -3.7,
      20
    ],
    "ghsPictograms": [
      "GHS02",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Solvant polaire aprotique (nettoyage de verrerie, dégraissant, synthèse).",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "miscible",
      "phCharacter": "neutral",
      "solution": {
        "id": "sol_acetone_aqueuse",
        "nameFr": "Solution d’acétone",
        "formulaLabel": "C₃H₆O(aq)",
        "colorHex": "#e0f2fe",
        "phEstimate": 7,
        "behaviors": {
          "miscible": true
        }
      },
      "solubilityGPerL": 1000.1
    }
  },
  {
    "id": "c4h8o2",
    "formula": "CH3COOC2H5",
    "displayFormula": "CH₃COOC₂H₅",
    "nameFr": "Acétate d’éthyle",
    "iupacName": "ethyl acetate",
    "casNumber": "141-78-6",
    "pubchemCid": 8857,
    "kind": "molecule",
    "molarMass": 88.106,
    "standardState": "liquid",
    "meltingPointC": -83.6,
    "boilingPointC": 77.1,
    "thermalNote": "decomposes",
    "densityGPerCm3": 0.902,
    "appearanceFr": "Liquide incolore volatil à odeur fruitée agréable, peu miscible à l’eau",
    "colorHex": "#e4e4e7",
    "composition": {
      "C": 4,
      "H": 8,
      "O": 2
    },
    "families": [
      "Ester"
    ],
    "popularity": 11057,
    "pkaValues": [
      -5.1
    ],
    "ghsPictograms": [
      "GHS02",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Ester formé par réaction entre acide acétique et éthanol ; solvant d’extraction et vernis.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 83,
      "dissolutionType": "molecular",
      "phCharacter": "neutral"
    }
  },
  {
    "id": "c6h12o6",
    "formula": "C6H12O6",
    "displayFormula": "C₆H₁₂O₆",
    "nameFr": "Glucose",
    "iupacName": "(3R,4S,5S,6R)-6-(hydroxymethyl)oxane-2,3,4,5-tetrol",
    "casNumber": "50-99-7",
    "pubchemCid": 5793,
    "kind": "molecule",
    "molarMass": 180.156,
    "standardState": "solid",
    "meltingPointC": 146,
    "thermalNote": "decomposes",
    "densityGPerCm3": 1.54,
    "appearanceFr": "Poudre cristalline blanche à saveur sucrée, très soluble dans l’eau",
    "colorHex": "#fafafa",
    "composition": {
      "C": 6,
      "H": 12,
      "O": 6
    },
    "families": [
      "Éther",
      "Alcool"
    ],
    "popularity": 11115,
    "pkaValues": [
      12.92
    ],
    "ghsSignalWord": "Non classé",
    "usesFr": "Source d’énergie cellulaire (respiration, fermentation alcoolique) et sucre réducteur.",
    "identificationFr": "Forme un précipité rouge brique de Cu₂O à chaud avec la liqueur de Fehling.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 909,
      "dissolutionType": "molecular",
      "phCharacter": "neutral",
      "solution": {
        "id": "sol_eau_sucree",
        "nameFr": "Solution de glucose",
        "formulaLabel": "C₆H₁₂O₆(aq)",
        "colorHex": "#e0f2fe",
        "phEstimate": 7,
        "behaviors": {
          "conductive": false,
          "molecularSolution": true
        }
      }
    }
  },
  {
    "id": "c12h22o11",
    "formula": "C12H22O11",
    "displayFormula": "C₁₂H₂₂O₁₁",
    "nameFr": "Saccharose",
    "iupacName": "(2R,3R,4S,5S,6R)-2-[(2S,3S,4S,5R)-3,4-dihydroxy-2,5-bis(hydroxymethyl)oxolan-2-yl]oxy-6-(hydroxymethyl)oxane-3,4,5-triol",
    "casNumber": "57-50-1",
    "pubchemCid": 5988,
    "kind": "molecule",
    "molarMass": 342.297,
    "standardState": "solid",
    "meltingPointC": 186,
    "thermalNote": "decomposes",
    "densityGPerCm3": 1.587,
    "appearanceFr": "Cristaux blancs brillants (sucre de table) · caramélise à 186 °C",
    "colorHex": "#fafafa",
    "composition": {
      "C": 12,
      "H": 22,
      "O": 11
    },
    "families": [
      "Éther",
      "Alcool"
    ],
    "popularity": 11090,
    "pkaValues": [
      12.6
    ],
    "ghsSignalWord": "Non classé",
    "usesFr": "Disaccharide (glucose + fructose) de référence en chimie alimentaire et polarimétrie.",
    "identificationFr": "Sucre non réducteur (ne réagit pas avec la liqueur de Fehling avant hydrolyse).",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 2000,
      "dissolutionType": "molecular",
      "phCharacter": "neutral",
      "solution": {
        "id": "sol_saccharose",
        "nameFr": "Eau sucrée (saccharose)",
        "formulaLabel": "C₁₂H₂₂O₁₁(aq)",
        "colorHex": "#e0f2fe",
        "phEstimate": 7,
        "behaviors": {
          "conductive": false,
          "molecularSolution": true
        }
      }
    }
  },
  {
    "id": "c9h8o4",
    "formula": "C9H8O4",
    "displayFormula": "C₉H₈O₄",
    "nameFr": "Acide acétylsalicylique (aspirine)",
    "iupacName": "2-acetyloxybenzoic acid",
    "casNumber": "50-78-2",
    "pubchemCid": 2244,
    "kind": "molecule",
    "molarMass": 180.159,
    "standardState": "solid",
    "meltingPointC": 135,
    "boilingPointC": 140,
    "thermalNote": "decomposes",
    "densityGPerCm3": 1.4,
    "appearanceFr": "Aiguilles ou poudre cristalline blanche peu soluble dans l’eau froide",
    "colorHex": "#fafafa",
    "composition": {
      "C": 9,
      "H": 8,
      "O": 4
    },
    "families": [
      "Aromatique",
      "Ester",
      "Acide carboxylique"
    ],
    "popularity": 11113,
    "pkaValues": [
      3.38
    ],
    "ghsPictograms": [
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Attention",
    "usesFr": "Acide acétylsalicylique : médicament antalgique/antipyrétique et synthèse classique de TP.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 4.6,
      "dissolutionType": "molecular",
      "phCharacter": "acidic_weak"
    }
  }
]
