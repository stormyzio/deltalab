import type { SpeciesSeed } from '../types.ts'

export const ACIDS_BASES_SEED: SpeciesSeed[] = [
  {
    "id": "hcl",
    "formula": "HCl",
    "displayFormula": "HCl",
    "nameFr": "Chlorure d’hydrogène (acide chlorhydrique)",
    "iupacName": "chlorane",
    "casNumber": "7647-01-0",
    "pubchemCid": 313,
    "kind": "molecule",
    "molarMass": 36.458,
    "standardState": "gas",
    "meltingPointC": -114.2,
    "boilingPointC": -85.1,
    "densityGPerCm3": 0.001639,
    "appearanceFr": "Gaz incolore piquant ; fumées blanches à l’air humide (acide fort en solution)",
    "colorHex": "#e4e4e7",
    "composition": {
      "H": 1,
      "Cl": 1
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11061,
    "pkaValues": [
      -6.3
    ],
    "ghsPictograms": [
      "GHS04",
      "GHS05",
      "GHS06",
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Acide fort de référence au laboratoire, décapage des métaux et détartrage.",
    "identificationFr": "Fumées blanches de NH₄Cl à l’approche d’ammoniac ; précipité blanc AgCl avec Ag⁺.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 720,
      "dissolutionType": "ionic_complete",
      "phCharacter": "acidic_strong",
      "dissociatesInto": [
        {
          "speciesId": "h3o_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "cl_minus",
          "stoichiometry": 1
        }
      ],
      "solution": {
        "id": "sol_acide_chlorhydrique",
        "nameFr": "Acide chlorhydrique",
        "formulaLabel": "(H₃O⁺ + Cl⁻)(aq)",
        "colorHex": "#bae6fd",
        "phEstimate": 1,
        "behaviors": {
          "conductive": true,
          "acidStrength": "strong"
        }
      }
    }
  },
  {
    "id": "hno3",
    "formula": "HNO3",
    "displayFormula": "HNO₃",
    "nameFr": "Acide nitrique",
    "iupacName": "nitric acid",
    "casNumber": "7697-37-2",
    "pubchemCid": 944,
    "kind": "molecule",
    "molarMass": 63.012,
    "standardState": "liquid",
    "meltingPointC": -41.6,
    "boilingPointC": 83,
    "densityGPerCm3": 1.51,
    "appearanceFr": "Liquide incolore à légèrement jaunâtre, fumant et très oxydant",
    "colorHex": "#fef9c3",
    "composition": {
      "H": 1,
      "N": 1,
      "O": 3
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11096,
    "pkaValues": [
      -1.38
    ],
    "ghsPictograms": [
      "GHS03",
      "GHS05",
      "GHS06",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Acide fort oxydant (attaque le cuivre en dégageant NO₂ roux), engrais et nitrations.",
    "identificationFr": "Attaque le cuivre métallique en formant une solution bleue et des vapeurs rousses NO₂.",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete",
      "phCharacter": "acidic_strong",
      "dissociatesInto": [
        {
          "speciesId": "h3o_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "no3_minus",
          "stoichiometry": 1
        }
      ],
      "solution": {
        "id": "sol_acide_nitrique",
        "nameFr": "Acide nitrique",
        "formulaLabel": "(H₃O⁺ + NO₃⁻)(aq)",
        "colorHex": "#e0f2fe",
        "phEstimate": 1,
        "behaviors": {
          "conductive": true,
          "acidStrength": "strong"
        }
      }
    }
  },
  {
    "id": "h2so4",
    "formula": "H2SO4",
    "displayFormula": "H₂SO₄",
    "nameFr": "Acide sulfurique",
    "iupacName": "sulfuric acid",
    "casNumber": "7664-93-9",
    "pubchemCid": 1118,
    "kind": "molecule",
    "molarMass": 98.072,
    "standardState": "liquid",
    "meltingPointC": 10.3,
    "boilingPointC": 337,
    "densityGPerCm3": 1.84,
    "appearanceFr": "Liquide huileux incolore, très dense et fortement déshydratant",
    "colorHex": "#e4e4e7",
    "composition": {
      "H": 2,
      "S": 1,
      "O": 4
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11103,
    "pkaValues": [
      1.92
    ],
    "ghsPictograms": [
      "GHS05",
      "GHS06",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Diacide fort industriel n° 1, batteries au plomb, catalyseur d’estérification.",
    "identificationFr": "Précipité blanc très insoluble BaSO₄ avec les ions baryum Ba²⁺.",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete",
      "phCharacter": "acidic_strong",
      "dissociatesInto": [
        {
          "speciesId": "h3o_plus",
          "stoichiometry": 2
        },
        {
          "speciesId": "so4_2minus",
          "stoichiometry": 1
        }
      ],
      "solution": {
        "id": "sol_acide_sulfurique",
        "nameFr": "Acide sulfurique",
        "formulaLabel": "(2 H₃O⁺ + SO₄²⁻)(aq)",
        "colorHex": "#bae6fd",
        "phEstimate": 0.7,
        "behaviors": {
          "conductive": true,
          "acidStrength": "strong"
        }
      },
      "solubilityGPerL": 999.9
    },
    "behaviors": {
      "exothermicDilution": true
    }
  },
  {
    "id": "ch3cooh",
    "formula": "CH3COOH",
    "displayFormula": "CH₃COOH",
    "nameFr": "Acide éthanoïque (acétique)",
    "iupacName": "acetic acid",
    "casNumber": "64-19-7",
    "pubchemCid": 176,
    "kind": "molecule",
    "molarMass": 60.052,
    "standardState": "liquid",
    "meltingPointC": 16.6,
    "boilingPointC": 118.1,
    "densityGPerCm3": 1.049,
    "appearanceFr": "Liquide limpide incolore à odeur piquante de vinaigre (cristallise sous 16,6 °C)",
    "colorHex": "#e4e4e7",
    "composition": {
      "C": 2,
      "H": 4,
      "O": 2
    },
    "families": [
      "Acide carboxylique"
    ],
    "popularity": 11000,
    "pkaValues": [
      -6.1,
      4.48,
      5.31
    ],
    "ghsPictograms": [
      "GHS02",
      "GHS05",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Constituant acide du vinaigre, titrages acide faible / base forte et estérifications.",
    "identificationFr": "Odeur caractéristique de vinaigre ; pKa = 4,76.",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "miscible",
      "phCharacter": "acidic_weak",
      "solution": {
        "id": "sol_vinaigre",
        "nameFr": "Acide éthanoïque aqueux",
        "formulaLabel": "CH₃COOH(aq)",
        "colorHex": "#e0f2fe",
        "phEstimate": 2.9,
        "behaviors": {
          "acidStrength": "weak"
        }
      },
      "solubilityGPerL": 602.9
    }
  },
  {
    "id": "naoh",
    "formula": "NaOH",
    "displayFormula": "NaOH",
    "nameFr": "Hydroxyde de sodium (soude)",
    "iupacName": "sodium hydroxide",
    "casNumber": "1310-73-2",
    "pubchemCid": 14798,
    "kind": "ionic_compound",
    "molarMass": 39.997,
    "standardState": "solid",
    "meltingPointC": 323,
    "boilingPointC": 1388,
    "densityGPerCm3": 2.13,
    "appearanceFr": "Pastilles ou perles blanches très hygroscopiques (dissolution exothermique)",
    "colorHex": "#fafafa",
    "composition": {
      "Na": 1,
      "O": 1,
      "H": 1
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11086,
    "ghsPictograms": [
      "GHS05",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Base forte de référence pour les titrages, saponification et précipitation des cations.",
    "identificationFr": "pH très basique (> 13 à 0,1 mol/L) ; flamme jaune (Na⁺).",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 1110,
      "dissolutionType": "ionic_complete",
      "phCharacter": "basic_strong",
      "dissociatesInto": [
        {
          "speciesId": "na_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "oh_minus",
          "stoichiometry": 1
        }
      ],
      "solution": {
        "id": "sol_soude",
        "nameFr": "Soude",
        "formulaLabel": "(Na⁺ + OH⁻)(aq)",
        "colorHex": "#bae6fd",
        "phEstimate": 13,
        "behaviors": {
          "conductive": true,
          "baseStrength": "strong"
        }
      }
    }
  },
  {
    "id": "koh",
    "formula": "KOH",
    "displayFormula": "KOH",
    "nameFr": "Hydroxyde de potassium (potasse)",
    "iupacName": "potassium hydroxide",
    "casNumber": "1310-58-3",
    "pubchemCid": 14797,
    "kind": "ionic_compound",
    "molarMass": 56.105,
    "standardState": "solid",
    "meltingPointC": 360,
    "boilingPointC": 1327,
    "densityGPerCm3": 2.044,
    "appearanceFr": "Pastilles blanches déliquescentes",
    "colorHex": "#fafafa",
    "composition": {
      "K": 1,
      "O": 1,
      "H": 1
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11067,
    "ghsPictograms": [
      "GHS05",
      "GHS06",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Base forte (savons mous, électrolyte de piles alcalines, synthèses organiques).",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 1120,
      "dissolutionType": "ionic_complete",
      "phCharacter": "basic_strong",
      "dissociatesInto": [
        {
          "speciesId": "k_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "oh_minus",
          "stoichiometry": 1
        }
      ],
      "solution": {
        "id": "sol_potasse",
        "nameFr": "Potasse",
        "formulaLabel": "(K⁺ + OH⁻)(aq)",
        "colorHex": "#bae6fd",
        "phEstimate": 13,
        "behaviors": {
          "conductive": true,
          "baseStrength": "strong"
        }
      }
    }
  },
  {
    "id": "nh3",
    "formula": "NH3",
    "displayFormula": "NH₃",
    "nameFr": "Ammoniac",
    "iupacName": "azane",
    "casNumber": "7664-41-7",
    "pubchemCid": 222,
    "kind": "molecule",
    "molarMass": 17.031,
    "standardState": "gas",
    "meltingPointC": -77.7,
    "boilingPointC": -33.3,
    "densityGPerCm3": 0.00073,
    "appearanceFr": "Gaz incolore à odeur piquante caractéristique, très soluble dans l’eau",
    "colorHex": "#e4e4e7",
    "composition": {
      "N": 1,
      "H": 3
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11118,
    "pkaValues": [
      9.23
    ],
    "ghsPictograms": [
      "GHS02",
      "GHS04",
      "GHS05",
      "GHS06",
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Base faible, ligand complexant ([Cu(NH₃)₄]²⁺ bleu roi) et matière première des engrais.",
    "identificationFr": "Odeur piquante ; bleuit un papier pH humide ; fumées blanches avec HCl.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 529,
      "dissolutionType": "ionic_partial",
      "phCharacter": "basic_weak",
      "solution": {
        "id": "sol_ammoniaque",
        "nameFr": "Ammoniaque",
        "formulaLabel": "NH₃(aq)",
        "colorHex": "#bae6fd",
        "phEstimate": 11.1,
        "behaviors": {
          "baseStrength": "weak"
        }
      }
    }
  },
  {
    "id": "hf",
    "formula": "HF",
    "displayFormula": "HF",
    "nameFr": "Fluorure d’hydrogène (acide fluorhydrique)",
    "iupacName": "fluorane",
    "casNumber": "7664-39-3",
    "pubchemCid": 14917,
    "kind": "molecule",
    "molarMass": 20.006,
    "standardState": "gas",
    "meltingPointC": -83.6,
    "boilingPointC": 19.5,
    "densityGPerCm3": 0.99,
    "appearanceFr": "Liquide très volatil ou gaz incolore, extrêmement corrosif (attaque le verre)",
    "colorHex": "#e4e4e7",
    "composition": {
      "H": 1,
      "F": 1
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11050,
    "pkaValues": [
      3.19
    ],
    "ghsPictograms": [
      "GHS04",
      "GHS05",
      "GHS06",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Gravure du verre et des plaquettes de silicium en microélectronique.",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "miscible",
      "phCharacter": "acidic_weak",
      "solution": {
        "id": "sol_acide_fluorhydrique",
        "nameFr": "Acide fluorhydrique",
        "formulaLabel": "HF(aq)",
        "colorHex": "#bae6fd",
        "phEstimate": 2.1,
        "behaviors": {
          "acidStrength": "weak"
        }
      },
      "solubilityGPerL": 999.9
    }
  },
  {
    "id": "hbr",
    "formula": "HBr",
    "displayFormula": "HBr",
    "nameFr": "Bromure d’hydrogène (acide bromhydrique)",
    "iupacName": "bromane",
    "casNumber": "10035-10-6",
    "pubchemCid": 260,
    "kind": "molecule",
    "molarMass": 80.912,
    "standardState": "gas",
    "meltingPointC": -86.9,
    "boilingPointC": -66.8,
    "densityGPerCm3": 0.00331,
    "appearanceFr": "Gaz incolore très acide et fumant à l’air humide",
    "colorHex": "#e4e4e7",
    "composition": {
      "H": 1,
      "Br": 1
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11051,
    "pkaValues": [
      -9
    ],
    "ghsPictograms": [
      "GHS04",
      "GHS05",
      "GHS06",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Acide fort et réactif d’hydrobromation en synthèse organique.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 1930,
      "dissolutionType": "ionic_complete",
      "phCharacter": "acidic_strong",
      "dissociatesInto": [
        {
          "speciesId": "h3o_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "br_minus",
          "stoichiometry": 1
        }
      ],
      "solution": {
        "id": "sol_acide_bromhydrique",
        "nameFr": "Acide bromhydrique",
        "formulaLabel": "(H₃O⁺ + Br⁻)(aq)",
        "colorHex": "#bae6fd",
        "phEstimate": 1,
        "behaviors": {
          "conductive": true,
          "acidStrength": "strong"
        }
      }
    }
  },
  {
    "id": "hi",
    "formula": "HI",
    "displayFormula": "HI",
    "nameFr": "Iodure d’hydrogène (acide iodhydrique)",
    "iupacName": "iodane",
    "casNumber": "10034-85-2",
    "pubchemCid": 24841,
    "kind": "molecule",
    "molarMass": 127.908,
    "standardState": "gas",
    "meltingPointC": -50.8,
    "boilingPointC": -35.4,
    "thermalNote": "decomposes",
    "densityGPerCm3": 0.00523,
    "appearanceFr": "Gaz incolore très acide et réducteur",
    "colorHex": "#e4e4e7",
    "composition": {
      "H": 1,
      "I": 1
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11046,
    "pkaValues": [
      -10
    ],
    "ghsPictograms": [
      "GHS04",
      "GHS05",
      "GHS06",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Acide halogénhydrique le plus fort ; réducteur en chimie organique.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 2340,
      "dissolutionType": "ionic_complete",
      "phCharacter": "acidic_strong",
      "dissociatesInto": [
        {
          "speciesId": "h3o_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "i_minus",
          "stoichiometry": 1
        }
      ],
      "solution": {
        "id": "sol_acide_iodhydrique",
        "nameFr": "Acide iodhydrique",
        "formulaLabel": "(H₃O⁺ + I⁻)(aq)",
        "colorHex": "#bae6fd",
        "phEstimate": 1,
        "behaviors": {
          "conductive": true,
          "acidStrength": "strong"
        }
      }
    }
  },
  {
    "id": "h3po4",
    "formula": "H3PO4",
    "displayFormula": "H₃PO₄",
    "nameFr": "Acide phosphorique",
    "iupacName": "phosphoric acid",
    "casNumber": "7664-38-2",
    "pubchemCid": 1004,
    "kind": "molecule",
    "molarMass": 97.994,
    "standardState": "liquid",
    "meltingPointC": 42.4,
    "boilingPointC": 158,
    "thermalNote": "decomposes",
    "densityGPerCm3": 1.88,
    "appearanceFr": "Cristaux incolores déliquescents ou liquide sirupeux (solution à 85 %)",
    "colorHex": "#f4f4f5",
    "composition": {
      "H": 3,
      "P": 1,
      "O": 4
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11074,
    "pkaValues": [
      2.15
    ],
    "ghsPictograms": [
      "GHS05",
      "GHS06",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Triacide faible de référence pour les titrages polyacides, engrais et dérouillant.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 5480,
      "dissolutionType": "molecular",
      "phCharacter": "acidic_weak",
      "solution": {
        "id": "sol_acide_phosphorique",
        "nameFr": "Acide phosphorique aqueux",
        "formulaLabel": "H₃PO₄(aq)",
        "colorHex": "#e0f2fe",
        "phEstimate": 1.6,
        "behaviors": {
          "acidStrength": "weak"
        }
      }
    }
  },
  {
    "id": "h2co3",
    "formula": "H2CO3",
    "displayFormula": "H₂CO₃",
    "nameFr": "Acide carbonique",
    "iupacName": "carbonic acid",
    "casNumber": "463-79-6",
    "pubchemCid": 767,
    "kind": "molecule",
    "molarMass": 62.024,
    "standardState": "aqueous",
    "thermalNote": "decomposes",
    "densityGPerCm3": 1,
    "appearanceFr": "Espèce aqueuse instable en équilibre avec CO₂ dissous (eau gazeuse)",
    "colorHex": "#e4e4e7",
    "composition": {
      "H": 2,
      "C": 1,
      "O": 3
    },
    "families": [
      "Acide carboxylique"
    ],
    "popularity": 11076,
    "pkaValues": [
      6.35
    ],
    "ghsSignalWord": "Non classé",
    "usesFr": "Système tampon sanguin (H₂CO₃ / HCO₃⁻) et acidité des eaux pétillantes et pluies.",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "molecular",
      "phCharacter": "acidic_weak",
      "solubilityGPerL": 12.8
    }
  },
  {
    "id": "c6h8o7",
    "formula": "C6H8O7",
    "displayFormula": "C₆H₈O₇",
    "nameFr": "Acide citrique",
    "iupacName": "2-hydroxypropane-1,2,3-tricarboxylic acid",
    "casNumber": "77-92-9",
    "pubchemCid": 311,
    "kind": "molecule",
    "molarMass": 192.123,
    "standardState": "solid",
    "meltingPointC": 153,
    "boilingPointC": 175,
    "thermalNote": "decomposes",
    "densityGPerCm3": 1.665,
    "appearanceFr": "Cristaux blancs inodores à saveur très acide",
    "colorHex": "#fafafa",
    "composition": {
      "C": 6,
      "H": 8,
      "O": 7
    },
    "families": [
      "Acide carboxylique",
      "Alcool"
    ],
    "popularity": 11080,
    "pkaValues": [
      2.96,
      4.38,
      5.68
    ],
    "ghsPictograms": [
      "GHS07"
    ],
    "ghsSignalWord": "Attention",
    "usesFr": "Triacide organique naturel (agrumes), détartrant doux et agent chélatant.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 1477,
      "dissolutionType": "molecular",
      "phCharacter": "acidic_weak",
      "solution": {
        "id": "sol_acide_citrique",
        "nameFr": "Solution d’acide citrique",
        "formulaLabel": "C₆H₈O₇(aq)",
        "colorHex": "#e0f2fe",
        "phEstimate": 2.1
      }
    }
  },
  {
    "id": "c2h2o4",
    "formula": "H2C2O4",
    "displayFormula": "H₂C₂O₄",
    "nameFr": "Acide oxalique",
    "iupacName": "oxalic acid",
    "casNumber": "144-62-7",
    "pubchemCid": 971,
    "kind": "molecule",
    "molarMass": 90.034,
    "standardState": "solid",
    "meltingPointC": 189.5,
    "boilingPointC": 190,
    "thermalNote": "sublimes",
    "densityGPerCm3": 1.9,
    "appearanceFr": "Cristaux blancs inodores",
    "colorHex": "#fafafa",
    "composition": {
      "C": 2,
      "H": 2,
      "O": 4
    },
    "families": [
      "Acide carboxylique"
    ],
    "popularity": 11070,
    "pkaValues": [
      1.25,
      3.5
    ],
    "ghsPictograms": [
      "GHS05",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Attention",
    "usesFr": "Diacide réducteur utilisé pour étalonner les solutions de permanganate (KMnO₄).",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 95,
      "dissolutionType": "molecular",
      "phCharacter": "acidic_weak"
    }
  },
  {
    "id": "caoh2",
    "formula": "Ca(OH)2",
    "displayFormula": "Ca(OH)₂",
    "nameFr": "Hydroxyde de calcium (chaux éteinte)",
    "iupacName": "calcium dihydroxide",
    "casNumber": "1305-62-0",
    "pubchemCid": 6093208,
    "kind": "ionic_compound",
    "molarMass": 74.092,
    "standardState": "solid",
    "meltingPointC": 580,
    "thermalNote": "decomposes",
    "densityGPerCm3": 2.21,
    "appearanceFr": "Poudre blanche fine peu soluble dans l’eau (eau de chaux)",
    "colorHex": "#fafafa",
    "composition": {
      "Ca": 1,
      "O": 2,
      "H": 2
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11073,
    "ghsPictograms": [
      "GHS05",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Préparation de l’eau de chaux (test du CO₂) et neutralisation de sols acides.",
    "identificationFr": "Sa solution limpide (eau de chaux) se trouble en blanc en présence de CO₂.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 1.73,
      "dissolutionType": "ionic_complete",
      "phCharacter": "basic_strong",
      "dissociatesInto": [
        {
          "speciesId": "ca2_plus",
          "stoichiometry": 1
        },
        {
          "speciesId": "oh_minus",
          "stoichiometry": 2
        }
      ],
      "solution": {
        "id": "sol_eau_de_chaux",
        "nameFr": "Eau de chaux",
        "formulaLabel": "(Ca²⁺ + 2 OH⁻)(aq)",
        "colorHex": "#e0f2fe",
        "phEstimate": 12.4,
        "behaviors": {
          "conductive": true,
          "baseStrength": "strong"
        }
      }
    }
  },
  {
    "id": "aloh3",
    "formula": "Al(OH)3",
    "displayFormula": "Al(OH)₃",
    "nameFr": "Hydroxyde d’aluminium",
    "iupacName": "aluminum trihydroxide",
    "casNumber": "21645-51-2",
    "pubchemCid": 10176082,
    "kind": "ionic_compound",
    "molarMass": 78.003,
    "standardState": "solid",
    "meltingPointC": 300,
    "thermalNote": "decomposes",
    "densityGPerCm3": 2.42,
    "appearanceFr": "Précipité blanc gélatineux amphotère",
    "colorHex": "#f4f4f5",
    "composition": {
      "Al": 1,
      "O": 3,
      "H": 3
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11052,
    "ghsPictograms": [
      "GHS07"
    ],
    "ghsSignalWord": "Attention",
    "usesFr": "Anti-acide gastrique, retardateur de flamme et précurseur de l’alumine Al₂O₃.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.001
    }
  },
  {
    "id": "feoh2",
    "formula": "Fe(OH)2",
    "displayFormula": "Fe(OH)₂",
    "nameFr": "Hydroxyde de fer(II)",
    "iupacName": "zinc",
    "casNumber": "1309-33-7",
    "pubchemCid": 23994,
    "kind": "ionic_compound",
    "molarMass": 89.859,
    "standardState": "solid",
    "thermalNote": "decomposes",
    "densityGPerCm3": 3.4,
    "appearanceFr": "Précipité gélatineux vert kaki (brunit lentement à l’air par oxydation)",
    "colorHex": "#4d7c0f",
    "composition": {
      "Fe": 1,
      "O": 2,
      "H": 2
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11009,
    "ghsPictograms": [
      "GHS02",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Précipité caractéristique d’identification des ions fer(II) Fe²⁺.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.007
    }
  },
  {
    "id": "feoh3",
    "formula": "Fe(OH)3",
    "displayFormula": "Fe(OH)₃",
    "nameFr": "Hydroxyde de fer(III)",
    "iupacName": "iron(3+) trihydroxide",
    "casNumber": "1309-33-7",
    "pubchemCid": 73964,
    "kind": "ionic_compound",
    "molarMass": 106.866,
    "standardState": "solid",
    "meltingPointC": 135,
    "thermalNote": "decomposes",
    "densityGPerCm3": 3.1,
    "appearanceFr": "Précipité gélatineux couleur rouille (brun-orangé)",
    "colorHex": "#9a3412",
    "composition": {
      "Fe": 1,
      "O": 3,
      "H": 3
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11009,
    "ghsPictograms": [
      "GHS07"
    ],
    "ghsSignalWord": "Attention",
    "usesFr": "Précipité caractéristique des ions fer(III) Fe³⁺ ; floculation en traitement des eaux.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0
    }
  },
  {
    "id": "znoh2",
    "formula": "Zn(OH)2",
    "displayFormula": "Zn(OH)₂",
    "nameFr": "Hydroxyde de zinc",
    "iupacName": "oxocalcium",
    "casNumber": "20427-58-1",
    "pubchemCid": 14778,
    "kind": "ionic_compound",
    "molarMass": 99.394,
    "standardState": "solid",
    "meltingPointC": 125,
    "thermalNote": "decomposes",
    "densityGPerCm3": 3.05,
    "appearanceFr": "Précipité blanc gélatineux amphotère",
    "colorHex": "#f4f4f5",
    "composition": {
      "Zn": 1,
      "O": 2,
      "H": 2
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11032,
    "ghsPictograms": [
      "GHS05",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Test d’identification des ions Zn²⁺ (soluble dans un excès de soude ou d’ammoniac).",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.004
    }
  }
]
