import type { SpeciesSeed } from '../types.ts'

export const SALTS_SEED: SpeciesSeed[] = [
  {
    "id": "nacl",
    "formula": "NaCl",
    "displayFormula": "NaCl",
    "nameFr": "Chlorure de sodium",
    "iupacName": "sodium chloride",
    "casNumber": "7647-14-5",
    "pubchemCid": 5234,
    "kind": "ionic_compound",
    "molarMass": 58.44,
    "standardState": "solid",
    "meltingPointC": 801,
    "boilingPointC": 1465,
    "densityGPerCm3": 2.165,
    "appearanceFr": "Cristaux cubiques blancs translucides (sel de cuisine / halite)",
    "colorHex": "#fafafa",
    "composition": {
      "Na": 1,
      "Cl": 1
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11084,
    "ghsSignalWord": "Non classé",
    "usesFr": "Alimentation, sérum physiologique (9 g/L), salage et électrolyse chlore-soude.",
    "identificationFr": "Flamme jaune intense (Na⁺) + précipité blanc AgCl avec AgNO₃.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 359,
      "dissolutionType": "ionic_complete",
      "phCharacter": "neutral",
      "dissociatesInto": [
        {
          "speciesId": "na_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "cl_minus",
          "stoichiometry": 1
        }
      ],
      "solution": {
        "id": "sol_eau_salee",
        "nameFr": "Eau salée",
        "formulaLabel": "(Na⁺ + Cl⁻)(aq)",
        "colorHex": "#bae6fd",
        "phEstimate": 7,
        "behaviors": {
          "conductive": true,
          "electrolyte": "strong"
        }
      }
    }
  },
  {
    "id": "kcl",
    "formula": "KCl",
    "displayFormula": "KCl",
    "nameFr": "Chlorure de potassium",
    "iupacName": "potassium chloride",
    "casNumber": "7447-40-7",
    "pubchemCid": 4873,
    "kind": "ionic_compound",
    "molarMass": 74.548,
    "standardState": "solid",
    "meltingPointC": 770,
    "boilingPointC": 1420,
    "thermalNote": "sublimes",
    "densityGPerCm3": 1.984,
    "appearanceFr": "Cristaux blancs cubiques",
    "colorHex": "#fafafa",
    "composition": {
      "K": 1,
      "Cl": 1
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11066,
    "ghsSignalWord": "Non classé",
    "usesFr": "Engrais potassiques, ponts salins et conservation d’électrodes pH.",
    "identificationFr": "Flamme violette (K⁺) + précipité blanc AgCl avec AgNO₃.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 342,
      "dissolutionType": "ionic_complete",
      "phCharacter": "neutral",
      "dissociatesInto": [
        {
          "speciesId": "k_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "cl_minus",
          "stoichiometry": 1
        }
      ]
    }
  },
  {
    "id": "ki",
    "formula": "KI",
    "displayFormula": "KI",
    "nameFr": "Iodure de potassium",
    "iupacName": "potassium iodide",
    "casNumber": "7681-11-0",
    "pubchemCid": 4875,
    "kind": "ionic_compound",
    "molarMass": 165.998,
    "standardState": "solid",
    "meltingPointC": 681,
    "boilingPointC": 1330,
    "densityGPerCm3": 3.12,
    "appearanceFr": "Cristaux blancs cubiques très solubles dans l’eau",
    "colorHex": "#fafafa",
    "composition": {
      "K": 1,
      "I": 1
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11055,
    "ghsPictograms": [
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Source d’ions iodure I⁻ (réactif de la pluie d’or, solubilisation du diiode, catalyseur H₂O₂).",
    "identificationFr": "Précipité jaune vif avec Pb²⁺ ou Ag⁺ ; brunit en I₂ avec un oxydant.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 1440,
      "dissolutionType": "ionic_complete",
      "phCharacter": "neutral",
      "dissociatesInto": [
        {
          "speciesId": "k_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "i_minus",
          "stoichiometry": 1
        }
      ]
    }
  },
  {
    "id": "cacl2",
    "formula": "CaCl2",
    "displayFormula": "CaCl₂",
    "nameFr": "Chlorure de calcium",
    "iupacName": "calcium dichloride",
    "casNumber": "10043-52-4",
    "pubchemCid": 5284359,
    "kind": "ionic_compound",
    "molarMass": 110.978,
    "standardState": "solid",
    "meltingPointC": 772,
    "boilingPointC": 1935,
    "densityGPerCm3": 2.15,
    "appearanceFr": "Granulés blancs très hygroscopiques (dissolution fortement exothermique)",
    "colorHex": "#fafafa",
    "composition": {
      "Ca": 1,
      "Cl": 2
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11060,
    "ghsPictograms": [
      "GHS05",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Attention",
    "usesFr": "Agent dessiccant, déneigement efficace à basse température et source de Ca²⁺.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 745,
      "dissolutionType": "ionic_complete",
      "phCharacter": "neutral",
      "dissociatesInto": [
        {
          "speciesId": "ca2_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "cl_minus",
          "stoichiometry": 2
        }
      ]
    }
  },
  {
    "id": "cuso4",
    "formula": "CuSO4",
    "displayFormula": "CuSO₄",
    "nameFr": "Sulfate de cuivre(II)",
    "iupacName": "copper sulfate",
    "casNumber": "7758-98-7",
    "pubchemCid": 24462,
    "kind": "ionic_compound",
    "molarMass": 159.602,
    "standardState": "solid",
    "meltingPointC": 110,
    "boilingPointC": 650,
    "thermalNote": "decomposes",
    "densityGPerCm3": 3.6,
    "appearanceFr": "Cristaux bleu vif (pentahydraté) ou poudre gris-blanc (anhydre) · solution bleue",
    "colorHex": "#0284c7",
    "composition": {
      "Cu": 1,
      "S": 1,
      "O": 4
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11067,
    "ghsPictograms": [
      "GHS05",
      "GHS06",
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Attention",
    "usesFr": "Demi-pile au cuivre (pile Daniell), test de présence d’eau (forme anhydre) et fongicide.",
    "identificationFr": "Solution bleu céleste donnant un précipité bleu Cu(OH)₂ avec la soude.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 203,
      "dissolutionType": "ionic_complete",
      "colorHex": "#0ea5e9",
      "phCharacter": "acidic_weak",
      "dissociatesInto": [
        {
          "speciesId": "cu2_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "so4_2minus",
          "stoichiometry": 1
        }
      ],
      "solution": {
        "id": "sol_sulfate_cuivre",
        "nameFr": "Sulfate de cuivre(II)",
        "formulaLabel": "(Cu²⁺ + SO₄²⁻)(aq)",
        "colorHex": "#0ea5e9",
        "phEstimate": 4.5,
        "behaviors": {
          "conductive": true,
          "coloredIon": "cu2_plus"
        }
      }
    },
    "behaviors": {
      "anhydrousWaterTest": true
    }
  },
  {
    "id": "cucl2",
    "formula": "CuCl2",
    "displayFormula": "CuCl₂",
    "nameFr": "Chlorure de cuivre(II)",
    "iupacName": "dichlorocopper",
    "casNumber": "7758-89-6",
    "pubchemCid": 24014,
    "kind": "ionic_compound",
    "molarMass": 134.446,
    "standardState": "solid",
    "meltingPointC": 498,
    "boilingPointC": 993,
    "thermalNote": "decomposes",
    "densityGPerCm3": 3.39,
    "appearanceFr": "Cristaux vert-turquoise (dihydraté) · solution bleu-vert",
    "colorHex": "#0d9488",
    "composition": {
      "Cu": 1,
      "Cl": 2
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11044,
    "ghsPictograms": [
      "GHS05",
      "GHS06",
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Source d’ions Cu²⁺ et Cl⁻, catalyseur d’oxydation (procédé Wacker) et pyrotechnie bleue.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 730,
      "dissolutionType": "ionic_complete",
      "colorHex": "#14b8a6",
      "phCharacter": "acidic_weak",
      "dissociatesInto": [
        {
          "speciesId": "cu2_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "cl_minus",
          "stoichiometry": 2
        }
      ],
      "solution": {
        "id": "sol_chlorure_cuivre",
        "nameFr": "Chlorure de cuivre(II)",
        "formulaLabel": "(Cu²⁺ + 2 Cl⁻)(aq)",
        "colorHex": "#14b8a6",
        "phEstimate": 4.2,
        "behaviors": {
          "conductive": true,
          "coloredIon": "cu2_plus"
        }
      }
    }
  },
  {
    "id": "fecl3",
    "formula": "FeCl3",
    "displayFormula": "FeCl₃",
    "nameFr": "Chlorure de fer(III)",
    "iupacName": "trichloroiron",
    "casNumber": "7758-94-3",
    "pubchemCid": 24380,
    "kind": "ionic_compound",
    "molarMass": 162.195,
    "standardState": "solid",
    "meltingPointC": 306,
    "boilingPointC": 315,
    "thermalNote": "decomposes",
    "densityGPerCm3": 2.9,
    "appearanceFr": "Cristaux brun-noir à reflets verts · solution jaune-orangé à rouille",
    "colorHex": "#b45309",
    "composition": {
      "Fe": 1,
      "Cl": 3
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11041,
    "ghsPictograms": [
      "GHS05",
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Gravure de circuits imprimés (perchlorure de fer), catalyseur H₂O₂ et floculant.",
    "identificationFr": "Précipité rouille Fe(OH)₃ avec OH⁻ ; rouge sang intense avec KSCN.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 920,
      "dissolutionType": "ionic_complete",
      "colorHex": "#f59e0b",
      "phCharacter": "acidic_weak",
      "dissociatesInto": [
        {
          "speciesId": "fe3_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "cl_minus",
          "stoichiometry": 3
        }
      ],
      "solution": {
        "id": "sol_chlorure_fer3",
        "nameFr": "Chlorure de fer(III)",
        "formulaLabel": "(Fe³⁺ + 3 Cl⁻)(aq)",
        "colorHex": "#f59e0b",
        "phEstimate": 2.4,
        "behaviors": {
          "conductive": true,
          "coloredIon": "fe3_plus"
        }
      }
    }
  },
  {
    "id": "feso4",
    "formula": "FeSO4",
    "displayFormula": "FeSO₄",
    "nameFr": "Sulfate de fer(II)",
    "iupacName": "iron(2+) sulfate",
    "casNumber": "7720-78-7",
    "pubchemCid": 24393,
    "kind": "ionic_compound",
    "molarMass": 151.901,
    "standardState": "solid",
    "meltingPointC": 680,
    "thermalNote": "decomposes",
    "densityGPerCm3": 2.84,
    "appearanceFr": "Cristaux vert pâle (heptahydraté) · solution vert très pâle",
    "colorHex": "#4ade80",
    "composition": {
      "Fe": 1,
      "S": 1,
      "O": 4
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11052,
    "pkaValues": [
      -3
    ],
    "ghsPictograms": [
      "GHS07"
    ],
    "ghsSignalWord": "Attention",
    "usesFr": "Réducteur en titrage redox par KMnO₄, anti-mousse et complément en fer.",
    "identificationFr": "Précipité vert kaki Fe(OH)₂ avec la soude.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 256,
      "dissolutionType": "ionic_complete",
      "colorHex": "#86efac",
      "phCharacter": "acidic_weak",
      "dissociatesInto": [
        {
          "speciesId": "fe2_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "so4_2minus",
          "stoichiometry": 1
        }
      ],
      "solution": {
        "id": "sol_sulfate_fer2",
        "nameFr": "Sulfate de fer(II)",
        "formulaLabel": "(Fe²⁺ + SO₄²⁻)(aq)",
        "colorHex": "#86efac",
        "phEstimate": 4.8,
        "behaviors": {
          "conductive": true,
          "coloredIon": "fe2_plus"
        }
      }
    }
  },
  {
    "id": "kmno4",
    "formula": "KMnO4",
    "displayFormula": "KMnO₄",
    "nameFr": "Permanganate de potassium",
    "iupacName": "potassium permanganate",
    "casNumber": "7722-64-7",
    "pubchemCid": 516875,
    "kind": "ionic_compound",
    "molarMass": 158.032,
    "standardState": "solid",
    "meltingPointC": 240,
    "thermalNote": "decomposes",
    "densityGPerCm3": 2.7,
    "appearanceFr": "Aiguilles violet foncé à reflets bronze · solution violet intense",
    "colorHex": "#7e22ce",
    "composition": {
      "K": 1,
      "Mn": 1,
      "O": 4
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11070,
    "ghsPictograms": [
      "GHS03",
      "GHS05",
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Oxydant puissant auto-indicateur pour les titrages redox (Fe²⁺, acide oxalique, H₂O₂).",
    "identificationFr": "Solution violet très intense qui se décolore instantanément face à un réducteur en milieu acide.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 64,
      "dissolutionType": "ionic_complete",
      "colorHex": "#9333ea",
      "phCharacter": "neutral",
      "dissociatesInto": [
        {
          "speciesId": "k_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "mno4_minus",
          "stoichiometry": 1
        }
      ],
      "solution": {
        "id": "sol_permanganate",
        "nameFr": "Permanganate de potassium",
        "formulaLabel": "(K⁺ + MnO₄⁻)(aq)",
        "colorHex": "#9333ea",
        "phEstimate": 7,
        "behaviors": {
          "conductive": true,
          "coloredIon": "mno4_minus",
          "oxidizer": true
        }
      }
    },
    "behaviors": {
      "strongOxidizer": true
    }
  },
  {
    "id": "k2cr2o7",
    "formula": "K2Cr2O7",
    "displayFormula": "K₂Cr₂O₇",
    "nameFr": "Dichromate de potassium",
    "iupacName": "dipotassium;oxido-(oxido(dioxo)chromio)oxy-dioxochromium",
    "casNumber": "7778-50-9",
    "pubchemCid": 24502,
    "kind": "ionic_compound",
    "molarMass": 294.181,
    "standardState": "solid",
    "meltingPointC": 398,
    "boilingPointC": 500,
    "thermalNote": "decomposes",
    "densityGPerCm3": 2.68,
    "appearanceFr": "Cristaux orange vif · solution orange",
    "colorHex": "#ea580c",
    "composition": {
      "K": 2,
      "Cr": 2,
      "O": 7
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11045,
    "ghsPictograms": [
      "GHS03",
      "GHS05",
      "GHS06",
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Oxydant fort des alcools (principe des anciens éthylotests : vire de l’orange au vert Cr³⁺).",
    "identificationFr": "Vire au jaune (CrO₄²⁻) en milieu basique, et au vert (Cr³⁺) après réduction.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 130,
      "dissolutionType": "ionic_complete",
      "colorHex": "#f97316",
      "phCharacter": "acidic_weak",
      "dissociatesInto": [
        {
          "speciesId": "k_plus",
          "stoichiometry": 2
        },
        {
          "speciesId": "cr2o7_2minus",
          "stoichiometry": 1
        }
      ],
      "solution": {
        "id": "sol_dichromate",
        "nameFr": "Dichromate de potassium",
        "formulaLabel": "(2 K⁺ + Cr₂O₇²⁻)(aq)",
        "colorHex": "#f97316",
        "phEstimate": 4,
        "behaviors": {
          "conductive": true,
          "coloredIon": "cr2o7_2minus",
          "oxidizer": true
        }
      }
    },
    "behaviors": {
      "strongOxidizer": true
    }
  },
  {
    "id": "agno3",
    "formula": "AgNO3",
    "displayFormula": "AgNO₃",
    "nameFr": "Nitrate d’argent",
    "iupacName": "silver nitrate",
    "casNumber": "7761-88-8",
    "pubchemCid": 24470,
    "kind": "ionic_compound",
    "molarMass": 169.874,
    "standardState": "solid",
    "meltingPointC": 212,
    "boilingPointC": 440,
    "thermalNote": "decomposes",
    "densityGPerCm3": 4.35,
    "appearanceFr": "Cristaux blancs photosensibles très solubles (tache la peau en noir)",
    "colorHex": "#f4f4f5",
    "composition": {
      "Ag": 1,
      "N": 1,
      "O": 3
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11061,
    "ghsPictograms": [
      "GHS03",
      "GHS05",
      "GHS06",
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Réactif de référence pour doser Cl⁻/Br⁻/I⁻ et expérience de l’arbre de Diane avec Cu.",
    "identificationFr": "Précipité blanc cailleboté AgCl dès l’ajout d’ions chlorure.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 2160,
      "dissolutionType": "ionic_complete",
      "phCharacter": "neutral",
      "dissociatesInto": [
        {
          "speciesId": "ag_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "no3_minus",
          "stoichiometry": 1
        }
      ],
      "solution": {
        "id": "sol_nitrate_argent",
        "nameFr": "Nitrate d’argent aqueux",
        "formulaLabel": "(Ag⁺ + NO₃⁻)(aq)",
        "colorHex": "#e0f2fe",
        "phEstimate": 6.5,
        "behaviors": {
          "conductive": true,
          "precipitantFor": [
            "cl_minus"
          ]
        }
      }
    },
    "behaviors": {
      "chlorideTestReagent": true
    }
  },
  {
    "id": "znso4",
    "formula": "ZnSO4",
    "displayFormula": "ZnSO₄",
    "nameFr": "Sulfate de zinc",
    "iupacName": "zinc sulfate",
    "casNumber": "7733-02-0",
    "pubchemCid": 24424,
    "kind": "ionic_compound",
    "molarMass": 161.436,
    "standardState": "solid",
    "meltingPointC": 680,
    "thermalNote": "decomposes",
    "densityGPerCm3": 3.54,
    "appearanceFr": "Cristaux blancs inodores très solubles",
    "colorHex": "#fafafa",
    "composition": {
      "Zn": 1,
      "S": 1,
      "O": 4
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11043,
    "ghsPictograms": [
      "GHS05",
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Électrolyte de la demi-pile au zinc dans la pile Daniell.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 577,
      "dissolutionType": "ionic_complete",
      "phCharacter": "acidic_weak",
      "dissociatesInto": [
        {
          "speciesId": "zn2_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "so4_2minus",
          "stoichiometry": 1
        }
      ]
    }
  },
  {
    "id": "mgso4",
    "formula": "MgSO4",
    "displayFormula": "MgSO₄",
    "nameFr": "Sulfate de magnésium",
    "iupacName": "magnesium sulfate",
    "casNumber": "7487-88-9",
    "pubchemCid": 24083,
    "kind": "ionic_compound",
    "molarMass": 120.361,
    "standardState": "solid",
    "meltingPointC": 1124,
    "thermalNote": "decomposes",
    "densityGPerCm3": 2.66,
    "appearanceFr": "Cristaux blancs (sel d’Epsom sous forme heptahydratée)",
    "colorHex": "#fafafa",
    "composition": {
      "Mg": 1,
      "S": 1,
      "O": 4
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11055,
    "ghsSignalWord": "Non classé",
    "usesFr": "Dessiccant rapide en synthèse organique et apport de magnésium en agriculture.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 351,
      "dissolutionType": "ionic_complete",
      "phCharacter": "neutral",
      "dissociatesInto": [
        {
          "speciesId": "mg2_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "so4_2minus",
          "stoichiometry": 1
        }
      ]
    }
  },
  {
    "id": "na2so4",
    "formula": "Na2SO4",
    "displayFormula": "Na₂SO₄",
    "nameFr": "Sulfate de sodium",
    "iupacName": "disodium;sulfate",
    "casNumber": "7757-82-6",
    "pubchemCid": 24436,
    "kind": "ionic_compound",
    "molarMass": 142.036,
    "standardState": "solid",
    "meltingPointC": 884,
    "boilingPointC": 1429,
    "densityGPerCm3": 2.66,
    "appearanceFr": "Poudre cristalline blanche inodore",
    "colorHex": "#fafafa",
    "composition": {
      "Na": 2,
      "S": 1,
      "O": 4
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11061,
    "ghsSignalWord": "Non classé",
    "usesFr": "Dessiccant de phases organiques au laboratoire et source d’ions sulfate SO₄²⁻.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 195,
      "dissolutionType": "ionic_complete",
      "phCharacter": "neutral",
      "dissociatesInto": [
        {
          "speciesId": "na_plus",
          "stoichiometry": 2
        },
        {
          "speciesId": "so4_2minus",
          "stoichiometry": 1
        }
      ]
    }
  },
  {
    "id": "na2co3",
    "formula": "Na2CO3",
    "displayFormula": "Na₂CO₃",
    "nameFr": "Carbonate de sodium",
    "iupacName": "disodium;carbonate",
    "casNumber": "497-19-8",
    "pubchemCid": 10340,
    "kind": "ionic_compound",
    "molarMass": 105.988,
    "standardState": "solid",
    "meltingPointC": 851,
    "boilingPointC": 1600,
    "thermalNote": "decomposes",
    "densityGPerCm3": 2.54,
    "appearanceFr": "Poudre blanche (« cristaux de soude ») donnant une solution basique",
    "colorHex": "#fafafa",
    "composition": {
      "Na": 2,
      "C": 1,
      "O": 3
    },
    "families": [
      "Composé ionique",
      "Carboxylate"
    ],
    "popularity": 11077,
    "ghsPictograms": [
      "GHS05",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Attention",
    "usesFr": "Fabrication du verre, détergents et étalon primaire en titrage acido-basique.",
    "identificationFr": "Vive effervescence de CO₂ au contact d’un acide.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 215,
      "dissolutionType": "ionic_complete",
      "phCharacter": "basic_weak",
      "dissociatesInto": [
        {
          "speciesId": "na_plus",
          "stoichiometry": 2
        },
        {
          "speciesId": "co3_2minus",
          "stoichiometry": 1
        }
      ]
    }
  },
  {
    "id": "nahco3",
    "formula": "NaHCO3",
    "displayFormula": "NaHCO₃",
    "nameFr": "Hydrogénocarbonate de sodium",
    "iupacName": "sodium hydrogen carbonate",
    "casNumber": "144-55-8",
    "pubchemCid": 516892,
    "kind": "ionic_compound",
    "molarMass": 84.006,
    "standardState": "solid",
    "meltingPointC": 50,
    "thermalNote": "decomposes",
    "densityGPerCm3": 2.2,
    "appearanceFr": "Poudre cristalline blanche fine (bicarbonate de soude)",
    "colorHex": "#fafafa",
    "composition": {
      "Na": 1,
      "H": 1,
      "C": 1,
      "O": 3
    },
    "families": [
      "Composé ionique",
      "Acide carboxylique"
    ],
    "popularity": 11000,
    "pkaValues": [
      6.3
    ],
    "ghsSignalWord": "Non classé",
    "usesFr": "Levure chimique, neutralisation douce d’acides renversés et tampon alimentaire.",
    "identificationFr": "Effervescence immédiate de CO₂ avec du vinaigre ou un acide.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 96,
      "dissolutionType": "ionic_complete",
      "phCharacter": "basic_weak",
      "dissociatesInto": [
        {
          "speciesId": "na_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "hco3_minus",
          "stoichiometry": 1
        }
      ]
    }
  },
  {
    "id": "nh4cl",
    "formula": "NH4Cl",
    "displayFormula": "NH₄Cl",
    "nameFr": "Chlorure d’ammonium",
    "iupacName": "azanium chloride",
    "casNumber": "12125-02-9",
    "pubchemCid": 25517,
    "kind": "ionic_compound",
    "molarMass": 53.489,
    "standardState": "solid",
    "meltingPointC": 338,
    "boilingPointC": 520,
    "thermalNote": "sublimes",
    "densityGPerCm3": 1.527,
    "appearanceFr": "Poudre cristalline blanche (dissolution endothermique)",
    "colorHex": "#fafafa",
    "composition": {
      "N": 1,
      "H": 4,
      "Cl": 1
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11071,
    "ghsPictograms": [
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Attention",
    "usesFr": "Piles salines, solutions tampons NH₄⁺/NH₃ et fumée blanche NH₃ + HCl.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 372,
      "dissolutionType": "ionic_complete",
      "phCharacter": "acidic_weak",
      "dissociatesInto": [
        {
          "speciesId": "nh4_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "cl_minus",
          "stoichiometry": 1
        }
      ]
    }
  },
  {
    "id": "bacl2",
    "formula": "BaCl2",
    "displayFormula": "BaCl₂",
    "nameFr": "Chlorure de baryum",
    "iupacName": "barium(2+) dichloride",
    "casNumber": "10361-37-2",
    "pubchemCid": 25204,
    "kind": "ionic_compound",
    "molarMass": 208.23,
    "standardState": "solid",
    "meltingPointC": 962,
    "boilingPointC": 1560,
    "densityGPerCm3": 3.86,
    "appearanceFr": "Cristaux blancs toxiques très solubles",
    "colorHex": "#fafafa",
    "composition": {
      "Ba": 1,
      "Cl": 2
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11049,
    "ghsPictograms": [
      "GHS06",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Réactif analytique classique pour identifier les ions sulfate SO₄²⁻ (précipité BaSO₄).",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 358,
      "dissolutionType": "ionic_complete",
      "phCharacter": "neutral",
      "dissociatesInto": [
        {
          "speciesId": "ba2_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "cl_minus",
          "stoichiometry": 2
        }
      ]
    }
  },
  {
    "id": "fecl2",
    "formula": "FeCl2",
    "displayFormula": "FeCl₂",
    "nameFr": "Chlorure de fer(II)",
    "iupacName": "dichloroiron",
    "casNumber": "7758-94-3",
    "pubchemCid": 24458,
    "kind": "ionic_compound",
    "molarMass": 126.745,
    "standardState": "solid",
    "meltingPointC": 677,
    "boilingPointC": 1023,
    "densityGPerCm3": 3.16,
    "appearanceFr": "Cristaux vert pâle hygroscopiques · solution vert pâle",
    "colorHex": "#4ade80",
    "composition": {
      "Fe": 1,
      "Cl": 2
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11041,
    "ghsPictograms": [
      "GHS05",
      "GHS07"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Réducteur en solution aqueuse et coagulant pour le traitement des eaux.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 625,
      "dissolutionType": "ionic_complete",
      "colorHex": "#86efac",
      "phCharacter": "acidic_weak",
      "dissociatesInto": [
        {
          "speciesId": "fe2_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "cl_minus",
          "stoichiometry": 2
        }
      ],
      "solution": {
        "id": "sol_chlorure_fer2",
        "nameFr": "Chlorure de fer(II)",
        "formulaLabel": "(Fe²⁺ + 2 Cl⁻)(aq)",
        "colorHex": "#86efac",
        "phEstimate": 4.5,
        "behaviors": {
          "conductive": true,
          "coloredIon": "fe2_plus"
        }
      }
    }
  },
  {
    "id": "nicl2",
    "formula": "NiCl2",
    "displayFormula": "NiCl₂",
    "nameFr": "Chlorure de nickel(II)",
    "iupacName": "dichloronickel",
    "casNumber": "7718-54-9",
    "pubchemCid": 24385,
    "kind": "ionic_compound",
    "molarMass": 129.593,
    "standardState": "solid",
    "meltingPointC": 1001,
    "boilingPointC": 973,
    "thermalNote": "sublimes",
    "densityGPerCm3": 3.55,
    "appearanceFr": "Cristaux jaune-or (anhydre) ou vert émeraude (hexahydraté) · solution verte",
    "colorHex": "#10b981",
    "composition": {
      "Ni": 1,
      "Cl": 2
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11036,
    "ghsPictograms": [
      "GHS06",
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Galvanoplastie (nickelage) et chimie de coordination du nickel(II).",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 642,
      "dissolutionType": "ionic_complete",
      "colorHex": "#34d399",
      "phCharacter": "acidic_weak",
      "dissociatesInto": [
        {
          "speciesId": "ni2_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "cl_minus",
          "stoichiometry": 2
        }
      ],
      "solution": {
        "id": "sol_chlorure_nickel",
        "nameFr": "Chlorure de nickel(II)",
        "formulaLabel": "(Ni²⁺ + 2 Cl⁻)(aq)",
        "colorHex": "#34d399",
        "phEstimate": 5,
        "behaviors": {
          "conductive": true,
          "coloredIon": "ni2_plus"
        }
      }
    }
  },
  {
    "id": "cocl2",
    "formula": "CoCl2",
    "displayFormula": "CoCl₂",
    "nameFr": "Chlorure de cobalt(II)",
    "iupacName": "cobalt(2+) dichloride",
    "casNumber": "7646-79-9",
    "pubchemCid": 3032536,
    "kind": "ionic_compound",
    "molarMass": 129.833,
    "standardState": "solid",
    "meltingPointC": 737,
    "boilingPointC": 1049,
    "densityGPerCm3": 3.36,
    "appearanceFr": "Cristaux bleu ciel (anhydre) ou rose-rouge (hexahydraté) · solution rose",
    "colorHex": "#ec4899",
    "composition": {
      "Co": 1,
      "Cl": 2
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11040,
    "ghsPictograms": [
      "GHS05",
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Indicateur d’humidité (papier au chlorure de cobalt : bleu sec, rose humide).",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 529,
      "dissolutionType": "ionic_complete",
      "colorHex": "#f472b6",
      "phCharacter": "acidic_weak",
      "dissociatesInto": [
        {
          "speciesId": "co2_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "cl_minus",
          "stoichiometry": 2
        }
      ],
      "solution": {
        "id": "sol_chlorure_cobalt",
        "nameFr": "Chlorure de cobalt(II)",
        "formulaLabel": "(Co²⁺ + 2 Cl⁻)(aq)",
        "colorHex": "#f472b6",
        "phEstimate": 5,
        "behaviors": {
          "conductive": true,
          "coloredIon": "co2_plus"
        }
      }
    }
  },
  {
    "id": "pbno32",
    "formula": "Pb(NO3)2",
    "displayFormula": "Pb(NO₃)₂",
    "nameFr": "Nitrate de plomb(II)",
    "iupacName": "lead(2+) dinitrate",
    "casNumber": "10099-74-8",
    "pubchemCid": 24924,
    "kind": "ionic_compound",
    "molarMass": 331.208,
    "standardState": "solid",
    "meltingPointC": 470,
    "thermalNote": "decomposes",
    "densityGPerCm3": 4.53,
    "appearanceFr": "Cristaux blancs denses solubles dans l’eau (toxique)",
    "colorHex": "#fafafa",
    "composition": {
      "Pb": 1,
      "N": 2,
      "O": 6
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11045,
    "ghsPictograms": [
      "GHS03",
      "GHS05",
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Source d’ions Pb²⁺ pour la précipitation spectaculaire de PbI₂ (« pluie d’or »).",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 543,
      "dissolutionType": "ionic_complete",
      "phCharacter": "acidic_weak",
      "dissociatesInto": [
        {
          "speciesId": "pb2_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "no3_minus",
          "stoichiometry": 2
        }
      ]
    }
  },
  {
    "id": "naclo",
    "formula": "NaClO",
    "displayFormula": "NaClO",
    "nameFr": "Hypochlorite de sodium",
    "iupacName": "sodium hypochlorite",
    "casNumber": "7681-52-9",
    "pubchemCid": 23665760,
    "kind": "ionic_compound",
    "molarMass": 74.439,
    "standardState": "solid",
    "meltingPointC": 18,
    "boilingPointC": 101,
    "thermalNote": "decomposes",
    "densityGPerCm3": 1.11,
    "appearanceFr": "Solution jaune très pâle à odeur caractéristique de chlore (eau de Javel)",
    "colorHex": "#fef9c3",
    "composition": {
      "Na": 1,
      "Cl": 1,
      "O": 1
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11049,
    "pkaValues": [
      7.53
    ],
    "ghsPictograms": [
      "GHS05",
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Désinfectant, agent blanchissant oxydant et oxydation douce en synthèse.",
    "identificationFr": "Ne jamais mélanger à un acide : libère du dichlore Cl₂ toxique.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 293,
      "dissolutionType": "ionic_complete",
      "phCharacter": "basic_weak",
      "dissociatesInto": [
        {
          "speciesId": "na_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "clo_minus",
          "stoichiometry": 1
        }
      ],
      "solution": {
        "id": "sol_eau_de_javel",
        "nameFr": "Eau de Javel",
        "formulaLabel": "(Na⁺ + ClO⁻)(aq)",
        "colorHex": "#fefce8",
        "phEstimate": 11.2,
        "behaviors": {
          "conductive": true,
          "oxidizer": true
        }
      },
      "colorHex": "#fefce8"
    },
    "behaviors": {
      "strongOxidizer": true
    }
  },
  {
    "id": "na2s2o3",
    "formula": "Na2S2O3",
    "displayFormula": "Na₂S₂O₃",
    "nameFr": "Thiosulfate de sodium",
    "iupacName": "disodium;dioxido-oxo-sulfanylidene-lambda6-sulfane",
    "casNumber": "7772-98-7",
    "pubchemCid": 24477,
    "kind": "ionic_compound",
    "molarMass": 158.097,
    "standardState": "solid",
    "meltingPointC": 48.3,
    "boilingPointC": 100,
    "thermalNote": "decomposes",
    "densityGPerCm3": 1.67,
    "appearanceFr": "Cristaux incolores très solubles (pentahydrate)",
    "colorHex": "#fafafa",
    "composition": {
      "Na": 2,
      "S": 2,
      "O": 3
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11045,
    "ghsSignalWord": "Non classé",
    "usesFr": "Réactif réducteur des titrages iodométriques (décolore I₂) et fixateur photo.",
    "identificationFr": "Décolore instantanément une solution brune de diiode I₂.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 701,
      "dissolutionType": "ionic_complete",
      "phCharacter": "neutral",
      "dissociatesInto": [
        {
          "speciesId": "na_plus",
          "stoichiometry": 2
        },
        {
          "speciesId": "s2o3_2minus",
          "stoichiometry": 1
        }
      ],
      "solution": {
        "id": "sol_thiosulfate",
        "nameFr": "Thiosulfate de sodium",
        "formulaLabel": "(2 Na⁺ + S₂O₃²⁻)(aq)",
        "colorHex": "#e0f2fe",
        "phEstimate": 7,
        "behaviors": {
          "conductive": true
        }
      }
    }
  },
  {
    "id": "ch3coona",
    "formula": "CH3COONa",
    "displayFormula": "CH₃COONa",
    "nameFr": "Éthanoate de sodium",
    "iupacName": "sodium acetate",
    "casNumber": "127-09-3",
    "pubchemCid": 517045,
    "kind": "ionic_compound",
    "molarMass": 82.034,
    "standardState": "solid",
    "meltingPointC": 324,
    "boilingPointC": 881,
    "thermalNote": "decomposes",
    "densityGPerCm3": 1.53,
    "appearanceFr": "Poudre ou cristaux blancs hygroscopiques",
    "colorHex": "#fafafa",
    "composition": {
      "C": 2,
      "H": 3,
      "Na": 1,
      "O": 2
    },
    "families": [
      "Composé ionique",
      "Carboxylate"
    ],
    "popularity": 11000,
    "pkaValues": [
      4.76
    ],
    "ghsSignalWord": "Non classé",
    "usesFr": "Solutions tampons acétate (pH ≈ 4,76) et chaufferettes réutilisables (surfusion).",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 464,
      "dissolutionType": "ionic_complete",
      "phCharacter": "basic_weak",
      "dissociatesInto": [
        {
          "speciesId": "na_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "ch3coo_minus",
          "stoichiometry": 1
        }
      ]
    }
  },
  {
    "id": "kscn",
    "formula": "KSCN",
    "displayFormula": "KSCN",
    "nameFr": "Thiocyanate de potassium",
    "iupacName": "potassium thiocyanate",
    "casNumber": "333-20-0",
    "pubchemCid": 516872,
    "kind": "ionic_compound",
    "molarMass": 97.176,
    "standardState": "solid",
    "meltingPointC": 173,
    "boilingPointC": 500,
    "thermalNote": "decomposes",
    "densityGPerCm3": 1.89,
    "appearanceFr": "Cristaux incolores très solubles (dissolution endothermique)",
    "colorHex": "#fafafa",
    "composition": {
      "K": 1,
      "S": 1,
      "C": 1,
      "N": 1
    },
    "families": [
      "Composé ionique",
      "Nitrile"
    ],
    "popularity": 11038,
    "ghsPictograms": [
      "GHS05",
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Réactif ultra-sensible de détection des ions Fe³⁺.",
    "identificationFr": "Forme un complexe rouge sang [Fe(SCN)]²⁺ au contact des ions Fe³⁺.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 2170,
      "dissolutionType": "ionic_complete",
      "phCharacter": "neutral",
      "dissociatesInto": [
        {
          "speciesId": "k_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "scn_minus",
          "stoichiometry": 1
        }
      ]
    }
  }
]
