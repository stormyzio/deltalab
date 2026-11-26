import type { SpeciesSeed } from '../types.ts'

export const IONS_SEED: SpeciesSeed[] = [
  {
    "id": "h3o_plus",
    "formula": "H3O+",
    "displayFormula": "H₃O⁺",
    "nameFr": "Ion oxonium",
    "iupacName": "oxidanium",
    "casNumber": "13968-08-6",
    "pubchemCid": 123332,
    "kind": "ion",
    "charge": 1,
    "molarMass": 19.023,
    "standardState": "aqueous",
    "appearanceFr": "Ion hydraté responsable de l’acidité des solutions aqueuses",
    "composition": {
      "H": 3,
      "O": 1
    },
    "families": [
      "Ion"
    ],
    "popularity": 11000,
    "pkaValues": [
      0
    ],
    "usesFr": "Porteur de l’acidité en solution aqueuse : pH = −log([H₃O⁺]).",
    "identificationFr": "Fait virer le papier pH au rouge/orange et le BBT au jaune.",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete",
      "phCharacter": "acidic_strong"
    }
  },
  {
    "id": "nh4_plus",
    "formula": "NH4+",
    "displayFormula": "NH₄⁺",
    "nameFr": "Ion ammonium",
    "iupacName": "azanium",
    "casNumber": "14798-03-9",
    "pubchemCid": 223,
    "kind": "ion",
    "charge": 1,
    "molarMass": 18.039,
    "standardState": "aqueous",
    "appearanceFr": "Cation polyatomique incolore faiblement acide (pKa = 9,25)",
    "composition": {
      "N": 1,
      "H": 4
    },
    "families": [
      "Ion"
    ],
    "popularity": 11000,
    "pkaValues": [
      9.25
    ],
    "usesFr": "Source d’azote dans les engrais et composant de solutions tampons.",
    "identificationFr": "Dégage de l’ammoniac NH₃ (odeur piquante) par chauffage avec de la soude.",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete",
      "phCharacter": "acidic_weak",
      "solubilityGPerL": 510.5
    }
  },
  {
    "id": "oh_minus",
    "formula": "OH-",
    "displayFormula": "OH⁻",
    "nameFr": "Ion hydroxyde",
    "iupacName": "hydroxide",
    "casNumber": "14280-30-9",
    "pubchemCid": 961,
    "kind": "ion",
    "charge": -1,
    "molarMass": 17.007,
    "standardState": "aqueous",
    "appearanceFr": "Ion hydraté responsable de la basicité des solutions aqueuses",
    "composition": {
      "O": 1,
      "H": 1
    },
    "families": [
      "Ion"
    ],
    "popularity": 11000,
    "usesFr": "Base forte en solution aqueuse ; réactif de précipitation des hydroxydes métalliques.",
    "identificationFr": "Fait virer la phénolphtaléine au rose-magenta et le BBT au bleu.",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete",
      "phCharacter": "basic_strong"
    }
  },
  {
    "id": "no3_minus",
    "formula": "NO3-",
    "displayFormula": "NO₃⁻",
    "nameFr": "Ion nitrate",
    "iupacName": "nitrate",
    "casNumber": "14797-55-8",
    "pubchemCid": 943,
    "kind": "ion",
    "charge": -1,
    "molarMass": 62.004,
    "standardState": "aqueous",
    "appearanceFr": "Anion incolore très soluble (pratiquement aucun sel de nitrate ne précipite)",
    "composition": {
      "N": 1,
      "O": 3
    },
    "families": [
      "Ion"
    ],
    "popularity": 11000,
    "usesFr": "Ion spectateur idéal pour introduire des cations métalliques (AgNO₃, Pb(NO₃)₂).",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete"
    }
  },
  {
    "id": "so4_2minus",
    "formula": "SO4^2-",
    "displayFormula": "SO₄²⁻",
    "nameFr": "Ion sulfate",
    "iupacName": "sulfate",
    "casNumber": "14808-79-8",
    "pubchemCid": 1117,
    "kind": "ion",
    "charge": -2,
    "molarMass": 96.056,
    "standardState": "aqueous",
    "appearanceFr": "Anion polyatomique incolore très stable en solution",
    "composition": {
      "S": 1,
      "O": 4
    },
    "families": [
      "Ion"
    ],
    "popularity": 11000,
    "usesFr": "Contre-ion courant (CuSO₄, FeSO₄, H₂SO₄).",
    "identificationFr": "Précipité blanc très insoluble de BaSO₄ par ajout de chlorure de baryum BaCl₂.",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete",
      "solubilityGPerL": 979.3
    }
  },
  {
    "id": "hso4_minus",
    "formula": "HSO4-",
    "displayFormula": "HSO₄⁻",
    "nameFr": "Ion hydrogénosulfate",
    "iupacName": "hydrogen sulfate",
    "casNumber": "14996-02-2",
    "pubchemCid": 61778,
    "kind": "ion",
    "charge": -1,
    "molarMass": 97.064,
    "standardState": "aqueous",
    "appearanceFr": "Ion hydraté incolore en solution aqueuse",
    "composition": {
      "H": 1,
      "S": 1,
      "O": 4
    },
    "families": [
      "Ion"
    ],
    "popularity": 11000,
    "pkaValues": [
      1.99
    ],
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete",
      "phCharacter": "acidic_weak",
      "solubilityGPerL": 989.6
    }
  },
  {
    "id": "co3_2minus",
    "formula": "CO3^2-",
    "displayFormula": "CO₃²⁻",
    "nameFr": "Ion carbonate",
    "iupacName": "carbonate",
    "casNumber": "3812-32-6",
    "pubchemCid": 19660,
    "kind": "ion",
    "charge": -2,
    "molarMass": 60.008,
    "standardState": "aqueous",
    "appearanceFr": "Anion basique incolore",
    "composition": {
      "C": 1,
      "O": 3
    },
    "families": [
      "Ion",
      "Carboxylate"
    ],
    "popularity": 11000,
    "usesFr": "Base faible (pKa = 10,33) et constituant des calcaires et coquilles.",
    "identificationFr": "Vive effervescence de CO₂ par ajout d’un acide.",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete",
      "phCharacter": "basic_weak"
    }
  },
  {
    "id": "hco3_minus",
    "formula": "HCO3-",
    "displayFormula": "HCO₃⁻",
    "nameFr": "Ion hydrogénocarbonate",
    "iupacName": "hydrogen carbonate",
    "casNumber": "71-52-3",
    "pubchemCid": 769,
    "kind": "ion",
    "charge": -1,
    "molarMass": 61.016,
    "standardState": "aqueous",
    "appearanceFr": "Anion amphotère incolore (couple CO₂,H₂O / HCO₃⁻ / CO₃²⁻)",
    "composition": {
      "H": 1,
      "C": 1,
      "O": 3
    },
    "families": [
      "Ion",
      "Acide carboxylique"
    ],
    "popularity": 11000,
    "pkaValues": [
      10.33
    ],
    "usesFr": "Tampon physiologique majeur du sang humain (pH ≈ 7,4).",
    "identificationFr": "Effervescence immédiate de CO₂ au contact d’un acide.",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete",
      "phCharacter": "basic_weak"
    }
  },
  {
    "id": "po4_3minus",
    "formula": "PO4^3-",
    "displayFormula": "PO₄³⁻",
    "nameFr": "Ion phosphate",
    "iupacName": "phosphate",
    "casNumber": "14265-44-2",
    "pubchemCid": 1061,
    "kind": "ion",
    "charge": -3,
    "molarMass": 94.97,
    "standardState": "aqueous",
    "appearanceFr": "Ion hydraté incolore en solution aqueuse",
    "composition": {
      "P": 1,
      "O": 4
    },
    "families": [
      "Ion"
    ],
    "popularity": 11000,
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete",
      "phCharacter": "basic_weak"
    }
  },
  {
    "id": "ch3coo_minus",
    "formula": "CH3COO-",
    "displayFormula": "CH₃COO⁻",
    "nameFr": "Ion éthanoate",
    "iupacName": "acetate",
    "casNumber": "71-50-1",
    "pubchemCid": 175,
    "kind": "ion",
    "charge": -1,
    "molarMass": 59.044,
    "standardState": "aqueous",
    "appearanceFr": "Ion hydraté incolore en solution aqueuse",
    "composition": {
      "C": 2,
      "H": 3,
      "O": 2
    },
    "families": [
      "Ion",
      "Carboxylate"
    ],
    "popularity": 11000,
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete",
      "phCharacter": "basic_weak",
      "solubilityGPerL": 592.8
    }
  },
  {
    "id": "clo_minus",
    "formula": "ClO-",
    "displayFormula": "ClO⁻",
    "nameFr": "Ion hypochlorite",
    "iupacName": "hypochlorite",
    "casNumber": "14380-61-1",
    "pubchemCid": 61739,
    "kind": "ion",
    "charge": -1,
    "molarMass": 51.449,
    "standardState": "aqueous",
    "appearanceFr": "Ion hydraté incolore en solution aqueuse",
    "composition": {
      "Cl": 1,
      "O": 1
    },
    "families": [
      "Ion"
    ],
    "popularity": 11000,
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete",
      "phCharacter": "basic_weak"
    }
  },
  {
    "id": "mno4_minus",
    "formula": "MnO4-",
    "displayFormula": "MnO₄⁻",
    "nameFr": "Ion permanganate",
    "iupacName": "permanganate",
    "casNumber": "14333-13-2",
    "pubchemCid": 24401,
    "kind": "ion",
    "charge": -1,
    "molarMass": 118.934,
    "standardState": "aqueous",
    "appearanceFr": "Anion violet intense en solution aqueuse",
    "colorHex": "#9333ea",
    "composition": {
      "Mn": 1,
      "O": 4
    },
    "families": [
      "Ion"
    ],
    "popularity": 11000,
    "usesFr": "Oxydant puissant très utilisé en titrage redox (E° = 1,51 V en milieu acide).",
    "identificationFr": "Couleur violette intense disparaissant en présence de Fe²⁺ ou d’acide oxalique.",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete",
      "colorHex": "#9333ea"
    }
  },
  {
    "id": "cr2o7_2minus",
    "formula": "Cr2O7^2-",
    "displayFormula": "Cr₂O₇²⁻",
    "nameFr": "Ion dichromate",
    "iupacName": "oxido-(oxido(dioxo)chromio)oxy-dioxochromium",
    "casNumber": "13907-47-6",
    "pubchemCid": 24503,
    "kind": "ion",
    "charge": -2,
    "molarMass": 215.985,
    "standardState": "aqueous",
    "appearanceFr": "Anion orange vif en solution aqueuse acide",
    "colorHex": "#f97316",
    "composition": {
      "Cr": 2,
      "O": 7
    },
    "families": [
      "Ion"
    ],
    "popularity": 11000,
    "usesFr": "Oxydant fort (E° = 1,33 V) réduit en ions Cr³⁺ verts.",
    "identificationFr": "Passe de l’orange au jaune (CrO₄²⁻) en milieu basique.",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete",
      "colorHex": "#f97316"
    }
  },
  {
    "id": "cro4_2minus",
    "formula": "CrO4^2-",
    "displayFormula": "CrO₄²⁻",
    "nameFr": "Ion chromate",
    "iupacName": "dioxido(dioxo)chromium",
    "casNumber": "13907-45-4",
    "pubchemCid": 24461,
    "kind": "ion",
    "charge": -2,
    "molarMass": 115.992,
    "standardState": "aqueous",
    "appearanceFr": "Anion jaune citron en solution aqueuse basique",
    "colorHex": "#facc15",
    "composition": {
      "Cr": 1,
      "O": 4
    },
    "families": [
      "Ion"
    ],
    "popularity": 11000,
    "usesFr": "Indicateur de fin de dosage des chlorures par la méthode de Mohr (Ag₂CrO₄ rouge brique).",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete",
      "colorHex": "#facc15"
    }
  },
  {
    "id": "s2o3_2minus",
    "formula": "S2O3^2-",
    "displayFormula": "S₂O₃²⁻",
    "nameFr": "Ion thiosulfate",
    "iupacName": "dioxido-oxo-sulfanylidene-lambda6-sulfane",
    "casNumber": "14383-50-7",
    "pubchemCid": 1084,
    "kind": "ion",
    "charge": -2,
    "molarMass": 112.117,
    "standardState": "aqueous",
    "appearanceFr": "Anion réducteur incolore en solution aqueuse",
    "composition": {
      "S": 2,
      "O": 3
    },
    "families": [
      "Ion"
    ],
    "popularity": 11000,
    "usesFr": "Réactif réducteur des titrages iodométriques (oxydé en tétrathionate S₄O₆²⁻).",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete"
    }
  },
  {
    "id": "s4o6_2minus",
    "formula": "S4O6^2-",
    "displayFormula": "S₄O₆²⁻",
    "nameFr": "Ion tétrathionate",
    "casNumber": "15536-54-6",
    "pubchemCid": 4657547,
    "kind": "ion",
    "charge": -2,
    "molarMass": 224.234,
    "standardState": "aqueous",
    "appearanceFr": "Ion hydraté incolore en solution aqueuse",
    "composition": {
      "S": 4,
      "O": 6
    },
    "families": [
      "Ion"
    ],
    "popularity": 11000,
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete"
    }
  },
  {
    "id": "c2o4_2minus",
    "formula": "C2O4^2-",
    "displayFormula": "C₂O₄²⁻",
    "nameFr": "Ion oxalate",
    "iupacName": "oxalate",
    "casNumber": "338-70-5",
    "pubchemCid": 71081,
    "kind": "ion",
    "charge": -2,
    "molarMass": 88.018,
    "standardState": "aqueous",
    "appearanceFr": "Ion hydraté incolore en solution aqueuse",
    "composition": {
      "C": 2,
      "O": 4
    },
    "families": [
      "Ion",
      "Carboxylate"
    ],
    "popularity": 11000,
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete",
      "solubilityGPerL": 105.6
    }
  },
  {
    "id": "scn_minus",
    "formula": "SCN-",
    "displayFormula": "SCN⁻",
    "nameFr": "Ion thiocyanate",
    "iupacName": "thiocyanate",
    "casNumber": "302-04-5",
    "pubchemCid": 9322,
    "kind": "ion",
    "charge": -1,
    "molarMass": 58.078,
    "standardState": "aqueous",
    "appearanceFr": "Anion incolore en solution aqueuse",
    "composition": {
      "S": 1,
      "C": 1,
      "N": 1
    },
    "families": [
      "Ion",
      "Nitrile"
    ],
    "popularity": 11000,
    "usesFr": "Ligand complexant très sensible aux ions fer(III).",
    "identificationFr": "Coloration rouge sang instantanée en présence d’ions Fe³⁺.",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete"
    }
  },
  {
    "id": "no2_minus",
    "formula": "NO2-",
    "displayFormula": "NO₂⁻",
    "nameFr": "Ion nitrite",
    "iupacName": "nitrite",
    "casNumber": "14797-65-0",
    "pubchemCid": 946,
    "kind": "ion",
    "charge": -1,
    "molarMass": 46.005,
    "standardState": "aqueous",
    "appearanceFr": "Ion hydraté incolore en solution aqueuse",
    "colorHex": "#e4e4e7",
    "composition": {
      "N": 1,
      "O": 2
    },
    "families": [
      "Ion"
    ],
    "popularity": 11000,
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete",
      "phCharacter": "basic_weak"
    }
  },
  {
    "id": "h2po4_minus",
    "formula": "H2PO4-",
    "displayFormula": "H₂PO₄⁻",
    "nameFr": "Ion dihydrogénophosphate",
    "iupacName": "dihydrogen phosphate",
    "casNumber": "14066-20-7",
    "pubchemCid": 1003,
    "kind": "ion",
    "charge": -1,
    "molarMass": 96.986,
    "standardState": "aqueous",
    "appearanceFr": "Ion hydraté incolore en solution aqueuse",
    "composition": {
      "H": 2,
      "P": 1,
      "O": 4
    },
    "families": [
      "Ion"
    ],
    "popularity": 11000,
    "pkaValues": [
      7.2
    ],
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete",
      "phCharacter": "acidic_weak"
    }
  },
  {
    "id": "hpo4_2minus",
    "formula": "HPO4^2-",
    "displayFormula": "HPO₄²⁻",
    "nameFr": "Ion hydrogénophosphate",
    "iupacName": "hydrogen phosphate",
    "casNumber": "14066-19-4",
    "pubchemCid": 3681305,
    "kind": "ion",
    "charge": -2,
    "molarMass": 95.978,
    "standardState": "aqueous",
    "appearanceFr": "Ion hydraté incolore en solution aqueuse",
    "composition": {
      "H": 1,
      "P": 1,
      "O": 4
    },
    "families": [
      "Ion"
    ],
    "popularity": 11000,
    "pkaValues": [
      12.35
    ],
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete",
      "phCharacter": "basic_weak"
    }
  },
  {
    "id": "cu_nh3_4_2plus",
    "formula": "[Cu(NH3)4]2+",
    "displayFormula": "[Cu(NH₃)₄]²⁺",
    "nameFr": "Ion tétraamminecuivre(II)",
    "iupacName": "copper azane",
    "casNumber": "16828-95-8",
    "pubchemCid": 61847,
    "kind": "ion",
    "charge": 2,
    "molarMass": 131.67,
    "standardState": "aqueous",
    "appearanceFr": "Complexe bleu roi intense (« eau céleste ») en solution ammoniacale",
    "colorHex": "#1d4ed8",
    "composition": {
      "Cu": 1,
      "N": 4,
      "H": 12
    },
    "popularity": 11000,
    "usesFr": "Complexe emblématique de chimie de coordination (cuivre(II) + excès d’ammoniac).",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "ionic_complete",
      "colorHex": "#1d4ed8"
    }
  }
]
