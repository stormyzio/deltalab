import type { SpeciesSeed } from '../types.ts'

export const MOLECULES_SEED: SpeciesSeed[] = [
  {
    "id": "h2o2",
    "formula": "H2O2",
    "displayFormula": "H₂O₂",
    "nameFr": "Peroxyde d’hydrogène",
    "iupacName": "hydrogen peroxide",
    "casNumber": "7722-84-1",
    "pubchemCid": 784,
    "kind": "molecule",
    "molarMass": 34.014,
    "standardState": "liquid",
    "meltingPointC": -0.4,
    "boilingPointC": 150.2,
    "thermalNote": "decomposes",
    "densityGPerCm3": 1.45,
    "appearanceFr": "Liquide limpide incolore légèrement visqueux (vendu en solution aqueuse)",
    "colorHex": "#e0f2fe",
    "composition": {
      "H": 2,
      "O": 2
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11075,
    "pkaValues": [
      11.62
    ],
    "ghsPictograms": [
      "GHS03",
      "GHS05",
      "GHS06",
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Antiseptique, agent de blanchiment et réactif ampholyte redox (se dismute en H₂O + O₂).",
    "identificationFr": "Dégagement vif de dioxygène O₂ en présence d’un catalyseur (Fe³⁺, MnO₂ ou KI).",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "miscible",
      "phCharacter": "acidic_weak",
      "solution": {
        "id": "sol_eau_oxygenee",
        "nameFr": "Eau oxygénée",
        "formulaLabel": "H₂O₂(aq)",
        "colorHex": "#e0f2fe",
        "phEstimate": 6.2,
        "behaviors": {
          "oxidizer": true
        }
      },
      "solubilityGPerL": 100
    }
  },
  {
    "id": "co2",
    "formula": "CO2",
    "displayFormula": "CO₂",
    "nameFr": "Dioxyde de carbone",
    "iupacName": "carbon dioxide",
    "casNumber": "124-38-9",
    "pubchemCid": 280,
    "kind": "molecule",
    "molarMass": 44.009,
    "standardState": "gas",
    "meltingPointC": -56.6,
    "boilingPointC": -78.5,
    "thermalNote": "sublimes",
    "densityGPerCm3": 0.001977,
    "appearanceFr": "Gaz incolore inodore plus dense que l’air ; glace carbonique solide sous −78,5 °C",
    "colorHex": "#d4d4d8",
    "composition": {
      "C": 1,
      "O": 2
    },
    "popularity": 11149,
    "pkaValues": [
      6.35
    ],
    "ghsPictograms": [
      "GHS04",
      "GHS07"
    ],
    "ghsSignalWord": "Attention",
    "usesFr": "Boissons gazeuses, extincteurs, cryogénie (carboglace) et photosynthèse.",
    "identificationFr": "Trouble l’eau de chaux en formant un précipité blanc de CaCO₃.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 1.45,
      "dissolutionType": "molecular",
      "phCharacter": "acidic_weak",
      "solution": {
        "id": "sol_eau_gazeuse",
        "nameFr": "Eau carbonatée",
        "formulaLabel": "CO₂(aq)",
        "colorHex": "#e0f2fe",
        "phEstimate": 4.5,
        "behaviors": {
          "effervescent": true
        }
      }
    }
  },
  {
    "id": "cl2",
    "formula": "Cl2",
    "displayFormula": "Cl₂",
    "nameFr": "Dichlore",
    "iupacName": "molecular chlorine",
    "casNumber": "7782-50-5",
    "pubchemCid": 24526,
    "kind": "element_substance",
    "molarMass": 70.9,
    "standardState": "gas",
    "meltingPointC": -101.5,
    "boilingPointC": -34,
    "densityGPerCm3": 0.00321,
    "appearanceFr": "Gaz jaune-vert à odeur suffocante",
    "colorHex": "#bef264",
    "composition": {
      "Cl": 2
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11007,
    "ghsPictograms": [
      "GHS03",
      "GHS04",
      "GHS05",
      "GHS06",
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Désinfection de l’eau, blanchiment et synthèse du PVC et de l’eau de Javel.",
    "identificationFr": "Décolore l’indigo et bleuit le papier ioduré-amidonné.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 7.3,
      "dissolutionType": "molecular",
      "colorHex": "#ecfccb",
      "phCharacter": "acidic_weak",
      "solution": {
        "id": "sol_eau_de_chlore",
        "nameFr": "Eau de chlore",
        "formulaLabel": "Cl₂(aq)",
        "colorHex": "#ecfccb",
        "phEstimate": 3.5,
        "behaviors": {
          "oxidizer": true
        }
      }
    }
  },
  {
    "id": "br2",
    "formula": "Br2",
    "displayFormula": "Br₂",
    "nameFr": "Dibrome",
    "iupacName": "molecular bromine",
    "casNumber": "7726-95-6",
    "pubchemCid": 24408,
    "kind": "element_substance",
    "molarMass": 159.808,
    "standardState": "liquid",
    "meltingPointC": -7.2,
    "boilingPointC": 58.8,
    "densityGPerCm3": 3.12,
    "appearanceFr": "Liquide rouge-brun dense émettant d’abondantes vapeurs rousses",
    "colorHex": "#b45309",
    "composition": {
      "Br": 2
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11005,
    "ghsPictograms": [
      "GHS05",
      "GHS06",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Réactif d’addition sur les alcènes et synthèse de retardateurs de flamme.",
    "identificationFr": "L’eau de brome orangée se décolore immédiatement au contact d’un alcène.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 35.5,
      "dissolutionType": "molecular",
      "colorHex": "#d97706",
      "phCharacter": "acidic_weak",
      "solution": {
        "id": "sol_eau_de_brome",
        "nameFr": "Eau de brome",
        "formulaLabel": "Br₂(aq)",
        "colorHex": "#d97706",
        "phEstimate": 4,
        "behaviors": {
          "oxidizer": true
        }
      }
    }
  },
  {
    "id": "i2",
    "formula": "I2",
    "displayFormula": "I₂",
    "nameFr": "Diiode",
    "iupacName": "molecular iodine",
    "casNumber": "7553-56-2",
    "pubchemCid": 807,
    "kind": "element_substance",
    "molarMass": 253.8,
    "standardState": "solid",
    "meltingPointC": 113.7,
    "boilingPointC": 184.3,
    "densityGPerCm3": 4.93,
    "appearanceFr": "Paillettes gris-violet à éclat métallique ; vapeurs violettes dès chauffage doux",
    "colorHex": "#581c87",
    "composition": {
      "I": 2
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11007,
    "ghsPictograms": [
      "GHS06",
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Attention",
    "usesFr": "Titrages iodométriques (thiosulfate), antiseptiques (Bétadine) et détection de l’amidon.",
    "identificationFr": "Coloration bleu nuit intense en présence d’empois d’amidon.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 0.29,
      "dissolutionType": "molecular",
      "colorHex": "#b45309",
      "phCharacter": "neutral",
      "solution": {
        "id": "sol_eau_iodee",
        "nameFr": "Eau iodée",
        "formulaLabel": "I₂(aq)",
        "colorHex": "#b45309",
        "phEstimate": 7,
        "behaviors": {
          "oxidizer": true
        }
      }
    }
  },
  {
    "id": "so2",
    "formula": "SO2",
    "displayFormula": "SO₂",
    "nameFr": "Dioxyde de soufre",
    "iupacName": "sulfur dioxide",
    "casNumber": "7446-09-5",
    "pubchemCid": 1119,
    "kind": "molecule",
    "molarMass": 64.058,
    "standardState": "gas",
    "meltingPointC": -72,
    "boilingPointC": -10,
    "densityGPerCm3": 0.00263,
    "appearanceFr": "Gaz incolore à odeur suffocante d’allumette soufrée",
    "colorHex": "#fef08a",
    "composition": {
      "S": 1,
      "O": 2
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11078,
    "pkaValues": [
      1.85
    ],
    "ghsPictograms": [
      "GHS04",
      "GHS05",
      "GHS06",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Conservateur œnologique (sulfites), blanchiment et synthèse de H₂SO₄.",
    "identificationFr": "Décolore une solution violette de permanganate de potassium.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 112,
      "dissolutionType": "molecular",
      "phCharacter": "acidic_weak"
    }
  },
  {
    "id": "no2",
    "formula": "NO2",
    "displayFormula": "NO₂",
    "nameFr": "Dioxyde d’azote",
    "casNumber": "10102-44-0",
    "pubchemCid": 3032552,
    "kind": "molecule",
    "molarMass": 46.005,
    "standardState": "gas",
    "meltingPointC": -11.2,
    "boilingPointC": 21.2,
    "densityGPerCm3": 0.00262,
    "appearanceFr": "Gaz brun-roux très toxique à odeur âcre (se liquéfie dès 21 °C)",
    "colorHex": "#b45309",
    "composition": {
      "N": 1,
      "O": 2
    },
    "popularity": 11061,
    "ghsPictograms": [
      "GHS03",
      "GHS04",
      "GHS05",
      "GHS06",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Intermédiaire de synthèse de l’acide nitrique (procédé Ostwald).",
    "identificationFr": "Couleur brun-roux intense immédiatement reconnaissable.",
    "aqueous": {
      "soluble": true,
      "dissolutionType": "molecular",
      "colorHex": "#d97706",
      "phCharacter": "acidic_weak"
    }
  },
  {
    "id": "h2s",
    "formula": "H2S",
    "displayFormula": "H₂S",
    "nameFr": "Sulfure d’hydrogène",
    "iupacName": "sulfane",
    "casNumber": "7783-06-4",
    "pubchemCid": 402,
    "kind": "molecule",
    "molarMass": 34.076,
    "standardState": "gas",
    "meltingPointC": -85.5,
    "boilingPointC": -60.3,
    "densityGPerCm3": 0.001539,
    "appearanceFr": "Gaz incolore inflammable et toxique à odeur caractéristique d’œuf pourri",
    "colorHex": "#fef08a",
    "composition": {
      "H": 2,
      "S": 1
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11076,
    "pkaValues": [
      7.04,
      11.96
    ],
    "ghsPictograms": [
      "GHS02",
      "GHS04",
      "GHS06",
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Précipitation sélective des sulfures métalliques en chimie analytique.",
    "identificationFr": "Noircit un papier imbibé d’acétate de plomb (formation de PbS noir).",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 4,
      "dissolutionType": "molecular",
      "phCharacter": "acidic_weak"
    }
  },
  {
    "id": "n2o",
    "formula": "N2O",
    "displayFormula": "N₂O",
    "nameFr": "Protoxyde d’azote",
    "iupacName": "nitrous oxide",
    "casNumber": "10024-97-2",
    "pubchemCid": 948,
    "kind": "molecule",
    "molarMass": 44.013,
    "standardState": "gas",
    "meltingPointC": -90.8,
    "boilingPointC": -88.5,
    "densityGPerCm3": 0.001977,
    "appearanceFr": "Gaz incolore à légère odeur douceâtre",
    "colorHex": "#d4d4d8",
    "composition": {
      "N": 2,
      "O": 1
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11069,
    "ghsPictograms": [
      "GHS03",
      "GHS04",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Anesthésique médical (« gaz hilarant »), gaz propulseur alimentaire et comburant.",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 1.5,
      "dissolutionType": "molecular",
      "phCharacter": "neutral"
    }
  },
  {
    "id": "h2",
    "formula": "H2",
    "displayFormula": "H₂",
    "nameFr": "Dihydrogène",
    "iupacName": "molecular hydrogen",
    "casNumber": "1333-74-0",
    "pubchemCid": 783,
    "kind": "element_substance",
    "molarMass": 2.016,
    "standardState": "gas",
    "meltingPointC": -259.2,
    "boilingPointC": -252.9,
    "densityGPerCm3": 0.0000899,
    "appearanceFr": "Gaz incolore, inodore, extrêmement léger et inflammable",
    "colorHex": "#e4e4e7",
    "composition": {
      "H": 2
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11014,
    "ghsPictograms": [
      "GHS02",
      "GHS04"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Réducteur industriel, synthèse de l’ammoniac (Haber-Bosch) et piles à combustible.",
    "identificationFr": "Détonation caractéristique (« aboiement ») à l’approche d’une flamme.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.0016
    }
  },
  {
    "id": "o2",
    "formula": "O2",
    "displayFormula": "O₂",
    "nameFr": "Dioxygène",
    "iupacName": "molecular oxygen",
    "casNumber": "7782-44-7",
    "pubchemCid": 977,
    "kind": "element_substance",
    "molarMass": 31.998,
    "standardState": "gas",
    "meltingPointC": -218.8,
    "boilingPointC": -183,
    "densityGPerCm3": 0.001429,
    "appearanceFr": "Gaz incolore et inodore (liquide bleu pâle paramagnétique à −183 °C)",
    "colorHex": "#bae6fd",
    "composition": {
      "O": 2
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11017,
    "ghsPictograms": [
      "GHS03",
      "GHS04",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Comburant indispensable aux combustions et à la respiration cellulaire.",
    "identificationFr": "Rallume vivement une bûchette présentant un point incandescent.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.04
    }
  },
  {
    "id": "o3",
    "formula": "O3",
    "displayFormula": "O₃",
    "nameFr": "Ozone",
    "iupacName": "ozone",
    "casNumber": "10028-15-6",
    "pubchemCid": 24823,
    "kind": "element_substance",
    "molarMass": 47.997,
    "standardState": "gas",
    "meltingPointC": -192.2,
    "boilingPointC": -111.9,
    "densityGPerCm3": 0.00214,
    "appearanceFr": "Gaz bleu très pâle à odeur piquante caractéristique",
    "colorHex": "#93c5fd",
    "composition": {
      "O": 3
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11107,
    "ghsPictograms": [
      "GHS03",
      "GHS05",
      "GHS06",
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Oxydant puissant (désinfection de l’eau) et filtre UV stratosphérique.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.1
    }
  },
  {
    "id": "n2",
    "formula": "N2",
    "displayFormula": "N₂",
    "nameFr": "Diazote",
    "iupacName": "molecular nitrogen",
    "casNumber": "7727-37-9",
    "pubchemCid": 947,
    "kind": "element_substance",
    "molarMass": 28.014,
    "standardState": "gas",
    "meltingPointC": -210,
    "boilingPointC": -195.8,
    "densityGPerCm3": 0.001251,
    "appearanceFr": "Gaz incolore, inodore et chimiquement peu réactif à température ambiante",
    "colorHex": "#cbd5e1",
    "composition": {
      "N": 2
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11011,
    "ghsPictograms": [
      "GHS04",
      "GHS08"
    ],
    "ghsSignalWord": "Attention",
    "usesFr": "Atmosphère inerte de laboratoire, cryogénie (−196 °C) et synthèse d’engrais azotés.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.02
    }
  },
  {
    "id": "f2",
    "formula": "F2",
    "displayFormula": "F₂",
    "nameFr": "Difluor",
    "iupacName": "molecular fluorine",
    "casNumber": "7782-41-4",
    "pubchemCid": 24524,
    "kind": "element_substance",
    "molarMass": 37.996,
    "standardState": "gas",
    "meltingPointC": -219.7,
    "boilingPointC": -188.1,
    "densityGPerCm3": 0.001696,
    "appearanceFr": "Gaz jaune très pâle, extrêmement oxydant et toxique",
    "colorHex": "#fef08a",
    "composition": {
      "F": 2
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11007,
    "ghsPictograms": [
      "GHS03",
      "GHS04",
      "GHS05",
      "GHS06",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Fluorations industrielles (PTFE / Téflon, enrichissement de l’uranium).",
    "aqueous": {
      "soluble": false
    },
    "behaviors": {
      "strongOxidizer": true
    }
  },
  {
    "id": "s8",
    "formula": "S8",
    "displayFormula": "S₈",
    "nameFr": "Octasoufre",
    "iupacName": "sulfane",
    "casNumber": "7704-34-9",
    "pubchemCid": 5362487,
    "kind": "element_substance",
    "molarMass": 256.48,
    "standardState": "solid",
    "meltingPointC": 115.2,
    "boilingPointC": 444.6,
    "densityGPerCm3": 2.07,
    "appearanceFr": "Cristaux ou poudre jaune citron insoluble dans l’eau",
    "colorHex": "#facc15",
    "composition": {
      "S": 8
    },
    "popularity": 11000,
    "ghsPictograms": [
      "GHS02",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Attention",
    "usesFr": "Production d’acide sulfurique, vulcanisation du caoutchouc et fongicides.",
    "identificationFr": "Brûle avec une flamme bleue en dégageant du SO₂ à odeur piquante.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0
    }
  },
  {
    "id": "co",
    "formula": "CO",
    "displayFormula": "CO",
    "nameFr": "Monoxyde de carbone",
    "iupacName": "carbon monoxide",
    "casNumber": "630-08-0",
    "pubchemCid": 281,
    "kind": "molecule",
    "molarMass": 28.01,
    "standardState": "gas",
    "meltingPointC": -205,
    "boilingPointC": -191.5,
    "densityGPerCm3": 0.00125,
    "appearanceFr": "Gaz incolore, inodore et hautement toxique",
    "colorHex": "#d4d4d8",
    "composition": {
      "C": 1,
      "O": 1
    },
    "popularity": 11109,
    "ghsPictograms": [
      "GHS02",
      "GHS04",
      "GHS06",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Réducteur métallurgique (hauts-fourneaux) et gaz de synthèse industriel.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.028
    }
  },
  {
    "id": "no",
    "formula": "NO",
    "displayFormula": "NO",
    "nameFr": "Monoxyde d’azote",
    "iupacName": "nitric oxide",
    "casNumber": "10102-43-9",
    "pubchemCid": 145068,
    "kind": "molecule",
    "molarMass": 30.006,
    "standardState": "gas",
    "meltingPointC": -163.6,
    "boilingPointC": -151.8,
    "densityGPerCm3": 0.00134,
    "appearanceFr": "Gaz incolore s’oxydant instantanément à l’air en NO₂ brun-roux",
    "colorHex": "#d4d4d8",
    "composition": {
      "N": 1,
      "O": 1
    },
    "popularity": 11058,
    "ghsPictograms": [
      "GHS03",
      "GHS04",
      "GHS05",
      "GHS06",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Messager biologique vasodilatateur et intermédiaire chimique.",
    "identificationFr": "Devient immédiatement roux au contact du dioxygène de l’air.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.06
    }
  },
  {
    "id": "cao",
    "formula": "CaO",
    "displayFormula": "CaO",
    "nameFr": "Oxyde de calcium (chaux vive)",
    "iupacName": "oxocalcium",
    "casNumber": "1305-78-8",
    "pubchemCid": 14778,
    "kind": "ionic_compound",
    "molarMass": 56.077,
    "standardState": "solid",
    "meltingPointC": 2572,
    "boilingPointC": 2850,
    "densityGPerCm3": 3.34,
    "appearanceFr": "Solide blanc caustique (« chaux vive ») réagissant fortement avec l’eau",
    "colorHex": "#fafafa",
    "composition": {
      "Ca": 1,
      "O": 1
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11070,
    "ghsPictograms": [
      "GHS05",
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Cimenterie, sidérurgie et préparation d’hydroxyde de calcium (chaux éteinte).",
    "aqueous": {
      "soluble": true,
      "solubilityGPerL": 1.3,
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
      ]
    }
  },
  {
    "id": "mgo",
    "formula": "MgO",
    "displayFormula": "MgO",
    "nameFr": "Oxyde de magnésium",
    "iupacName": "oxomagnesium",
    "casNumber": "1309-48-4",
    "pubchemCid": 14792,
    "kind": "ionic_compound",
    "molarMass": 40.304,
    "standardState": "solid",
    "meltingPointC": 2852,
    "boilingPointC": 3600,
    "densityGPerCm3": 3.58,
    "appearanceFr": "Poudre blanche réfractaire très légère (magnésie)",
    "colorHex": "#fafafa",
    "composition": {
      "Mg": 1,
      "O": 1
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11060,
    "ghsPictograms": [
      "GHS07"
    ],
    "ghsSignalWord": "Attention",
    "usesFr": "Matériaux réfractaires, anti-acide et produit de combustion du magnésium.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.0086
    }
  },
  {
    "id": "al2o3",
    "formula": "Al2O3",
    "displayFormula": "Al₂O₃",
    "nameFr": "Oxyde d’aluminium (alumine)",
    "iupacName": "dialuminum;tris(oxygen(2-))",
    "casNumber": "14457-64-8",
    "pubchemCid": 9989226,
    "kind": "ionic_compound",
    "molarMass": 101.961,
    "standardState": "solid",
    "meltingPointC": 2072,
    "boilingPointC": 2977,
    "densityGPerCm3": 3.95,
    "appearanceFr": "Poudre cristalline blanche très dure (corindon / alumine)",
    "colorHex": "#f4f4f5",
    "composition": {
      "Al": 2,
      "O": 3
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11023,
    "ghsPictograms": [
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Attention",
    "usesFr": "Abrasifs, céramiques techniques, catalyse et production d’aluminium par électrolyse.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0
    }
  },
  {
    "id": "cuo",
    "formula": "CuO",
    "displayFormula": "CuO",
    "nameFr": "Oxyde de cuivre(II)",
    "iupacName": "copper oxygen(2-)",
    "casNumber": "1317-39-1",
    "pubchemCid": 164827,
    "kind": "ionic_compound",
    "molarMass": 79.545,
    "standardState": "solid",
    "meltingPointC": 1326,
    "boilingPointC": 2000,
    "thermalNote": "decomposes",
    "densityGPerCm3": 6.31,
    "appearanceFr": "Poudre noire dense insoluble dans l’eau",
    "colorHex": "#27272a",
    "composition": {
      "Cu": 1,
      "O": 1
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11042,
    "ghsPictograms": [
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Attention",
    "usesFr": "Pigments céramiques, réduction par le carbone en cuivre métallique et catalyse.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0
    }
  },
  {
    "id": "fe2o3",
    "formula": "Fe2O3",
    "displayFormula": "Fe₂O₃",
    "nameFr": "Oxyde de fer(III)",
    "iupacName": "oxo(oxoferriooxy)iron",
    "casNumber": "1309-37-1",
    "pubchemCid": 518696,
    "kind": "ionic_compound",
    "molarMass": 159.687,
    "standardState": "solid",
    "meltingPointC": 1565,
    "thermalNote": "decomposes",
    "densityGPerCm3": 5.24,
    "appearanceFr": "Poudre rouge-brun (hématite / rouille)",
    "colorHex": "#991b1b",
    "composition": {
      "Fe": 2,
      "O": 3
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11052,
    "ghsPictograms": [
      "GHS05",
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Attention",
    "usesFr": "Minerai de fer principal, pigments ocre-rouge et réaction d’aluminothermie (thermite).",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0
    }
  },
  {
    "id": "zno",
    "formula": "ZnO",
    "displayFormula": "ZnO",
    "nameFr": "Oxyde de zinc",
    "iupacName": "zinc oxygen(2-)",
    "casNumber": "1314-13-2",
    "pubchemCid": 3007857,
    "kind": "ionic_compound",
    "molarMass": 81.379,
    "standardState": "solid",
    "meltingPointC": 1975,
    "boilingPointC": 2360,
    "densityGPerCm3": 5.61,
    "appearanceFr": "Poudre blanche (jaunit réversiblement lorsqu’on la chauffe)",
    "colorHex": "#fafafa",
    "composition": {
      "Zn": 1,
      "O": 1
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11061,
    "ghsPictograms": [
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Attention",
    "usesFr": "Crèmes solaires (filtre UV), pommades apaisantes et vulcanisation du caoutchouc.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.0016
    }
  },
  {
    "id": "mno2",
    "formula": "MnO2",
    "displayFormula": "MnO₂",
    "nameFr": "Dioxyde de manganèse",
    "iupacName": "dioxomanganese",
    "casNumber": "1313-13-9",
    "pubchemCid": 14801,
    "kind": "ionic_compound",
    "molarMass": 86.936,
    "standardState": "solid",
    "meltingPointC": 535,
    "thermalNote": "decomposes",
    "densityGPerCm3": 5.03,
    "appearanceFr": "Poudre noire ou brun très foncé (pyrolusite)",
    "colorHex": "#27272a",
    "composition": {
      "Mn": 1,
      "O": 2
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11044,
    "ghsPictograms": [
      "GHS07",
      "GHS08"
    ],
    "ghsSignalWord": "Attention",
    "usesFr": "Catalyseur très actif de la décomposition de H₂O₂ et cathode des piles alcalines.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0
    }
  },
  {
    "id": "sio2",
    "formula": "SiO2",
    "displayFormula": "SiO₂",
    "nameFr": "Dioxyde de silicium (silice)",
    "iupacName": "dioxosilane",
    "casNumber": "7631-86-9",
    "pubchemCid": 24261,
    "kind": "molecule",
    "molarMass": 60.083,
    "standardState": "solid",
    "meltingPointC": 1713,
    "boilingPointC": 2950,
    "densityGPerCm3": 2.65,
    "appearanceFr": "Cristaux transparents ou poudre blanche très dure (quartz / silice)",
    "colorHex": "#f4f4f5",
    "composition": {
      "Si": 1,
      "O": 2
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11082,
    "ghsSignalWord": "Non classé",
    "usesFr": "Fabrication du verre, fibres optiques, silicium électronique et gel dessiccant.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0
    }
  },
  {
    "id": "caco3",
    "formula": "CaCO3",
    "displayFormula": "CaCO₃",
    "nameFr": "Carbonate de calcium",
    "iupacName": "calcium carbonate",
    "casNumber": "471-34-1",
    "pubchemCid": 10112,
    "kind": "ionic_compound",
    "molarMass": 100.086,
    "standardState": "solid",
    "meltingPointC": 825,
    "thermalNote": "decomposes",
    "densityGPerCm3": 2.71,
    "appearanceFr": "Poudre ou cristaux blancs (craie, calcaire, marbre)",
    "colorHex": "#fafafa",
    "composition": {
      "Ca": 1,
      "C": 1,
      "O": 3
    },
    "families": [
      "Composé ionique",
      "Carboxylate"
    ],
    "popularity": 11082,
    "ghsSignalWord": "Non classé",
    "usesFr": "Craie, ciment, charge minérale et précipité du test à l’eau de chaux.",
    "identificationFr": "Vive effervescence de CO₂ au contact d’un acide dilué (HCl, vinaigre).",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.013
    },
    "behaviors": {
      "chalkMineral": true
    }
  },
  {
    "id": "baso4",
    "formula": "BaSO4",
    "displayFormula": "BaSO₄",
    "nameFr": "Sulfate de baryum",
    "iupacName": "barium(2+) sulfate",
    "casNumber": "7727-43-7",
    "pubchemCid": 24414,
    "kind": "ionic_compound",
    "molarMass": 233.386,
    "standardState": "solid",
    "meltingPointC": 1580,
    "boilingPointC": 1600,
    "thermalNote": "decomposes",
    "densityGPerCm3": 4.49,
    "appearanceFr": "Poudre blanche très dense, quasi totalement insoluble dans l’eau",
    "colorHex": "#fafafa",
    "composition": {
      "Ba": 1,
      "S": 1,
      "O": 4
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11059,
    "ghsSignalWord": "Non classé",
    "usesFr": "Produit de contraste radiographique et test analytique des ions sulfate SO₄²⁻.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.0024
    }
  },
  {
    "id": "agcl",
    "formula": "AgCl",
    "displayFormula": "AgCl",
    "nameFr": "Chlorure d’argent",
    "iupacName": "chlorosilver",
    "casNumber": "7783-90-6",
    "pubchemCid": 24561,
    "kind": "ionic_compound",
    "molarMass": 143.32,
    "standardState": "solid",
    "meltingPointC": 455,
    "boilingPointC": 1547,
    "densityGPerCm3": 5.56,
    "appearanceFr": "Précipité blanc cailleboté qui noircit lentement à la lumière",
    "colorHex": "#f4f4f5",
    "composition": {
      "Ag": 1,
      "Cl": 1
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11048,
    "ghsPictograms": [
      "GHS05",
      "GHS07",
      "GHS09"
    ],
    "ghsSignalWord": "Attention",
    "usesFr": "Test caractéristique des ions chlorure Cl⁻ et électrodes de référence Ag/AgCl.",
    "identificationFr": "Précipité blanc cailleboté insoluble en milieu acide, soluble dans NH₃.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.0019
    }
  },
  {
    "id": "agbr",
    "formula": "AgBr",
    "displayFormula": "AgBr",
    "nameFr": "Bromure d’argent",
    "iupacName": "bromosilver",
    "casNumber": "7785-23-1",
    "pubchemCid": 66199,
    "kind": "ionic_compound",
    "molarMass": 187.774,
    "standardState": "solid",
    "meltingPointC": 432,
    "boilingPointC": 1502,
    "thermalNote": "decomposes",
    "densityGPerCm3": 6.47,
    "appearanceFr": "Précipité jaune pâle photosensible",
    "colorHex": "#fef9c3",
    "composition": {
      "Ag": 1,
      "Br": 1
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11040,
    "ghsPictograms": [
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Émulsions photographiques argentiques et test d’identification des ions Br⁻.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.00014
    }
  },
  {
    "id": "agi",
    "formula": "AgI",
    "displayFormula": "AgI",
    "nameFr": "Iodure d’argent",
    "iupacName": "iodosilver",
    "casNumber": "7783-96-2",
    "pubchemCid": 24563,
    "kind": "ionic_compound",
    "molarMass": 234.77,
    "standardState": "solid",
    "meltingPointC": 558,
    "boilingPointC": 1506,
    "densityGPerCm3": 5.68,
    "appearanceFr": "Précipité jaune vif insoluble dans l’eau et l’ammoniac",
    "colorHex": "#fde047",
    "composition": {
      "Ag": 1,
      "I": 1
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11044,
    "ghsPictograms": [
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Attention",
    "usesFr": "Ensemencement de nuages et test d’identification des ions iodure I⁻.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.000003
    }
  },
  {
    "id": "pbi2",
    "formula": "PbI2",
    "displayFormula": "PbI₂",
    "nameFr": "Iodure de plomb(II)",
    "iupacName": "diiodolead",
    "casNumber": "10101-63-0",
    "pubchemCid": 24931,
    "kind": "ionic_compound",
    "molarMass": 461,
    "standardState": "solid",
    "meltingPointC": 402,
    "boilingPointC": 872,
    "thermalNote": "decomposes",
    "densityGPerCm3": 6.16,
    "appearanceFr": "Précipité jaune d’or brillant (recristallise en paillettes dorées à chaud)",
    "colorHex": "#facc15",
    "composition": {
      "Pb": 1,
      "I": 2
    },
    "popularity": 11035,
    "ghsPictograms": [
      "GHS07",
      "GHS08",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Expérience célèbre de la « pluie d’or » et détecteurs de rayons X/gamma.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.76
    }
  },
  {
    "id": "cuoh2",
    "formula": "Cu(OH)2",
    "displayFormula": "Cu(OH)₂",
    "nameFr": "Hydroxyde de cuivre(II)",
    "iupacName": "copper dihydroxide",
    "casNumber": "20427-59-2",
    "pubchemCid": 164826,
    "kind": "ionic_compound",
    "molarMass": 97.56,
    "standardState": "solid",
    "meltingPointC": 80,
    "thermalNote": "decomposes",
    "densityGPerCm3": 3.37,
    "appearanceFr": "Précipité gélatineux bleu céleste (noircit en CuO dès 80 °C)",
    "colorHex": "#38bdf8",
    "composition": {
      "Cu": 1,
      "O": 2,
      "H": 2
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11039,
    "ghsPictograms": [
      "GHS05",
      "GHS06",
      "GHS07",
      "GHS09"
    ],
    "ghsSignalWord": "Danger",
    "usesFr": "Précipité caractéristique des ions Cu²⁺ ; réactif de Schweizer avec l’ammoniac.",
    "identificationFr": "Se redissout dans un excès d’ammoniac en donnant l’eau céleste bleu roi.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0.0029
    }
  },
  {
    "id": "cus",
    "formula": "CuS",
    "displayFormula": "CuS",
    "nameFr": "Sulfure de cuivre(II)",
    "iupacName": "copper sulfide",
    "casNumber": "1317-40-4",
    "pubchemCid": 165914,
    "kind": "ionic_compound",
    "molarMass": 95.606,
    "standardState": "solid",
    "meltingPointC": 500,
    "thermalNote": "decomposes",
    "densityGPerCm3": 4.76,
    "appearanceFr": "Solide noir à reflets bleu-indigo (covellite)",
    "colorHex": "#1e1b4b",
    "composition": {
      "Cu": 1,
      "S": 1
    },
    "families": [
      "Composé ionique"
    ],
    "popularity": 11000,
    "ghsSignalWord": "Non classé",
    "usesFr": "Précipitation analytique des ions Cu²⁺ en présence de sulfures.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0
    }
  },
  {
    "id": "fes",
    "formula": "FeS",
    "displayFormula": "FeS",
    "nameFr": "Sulfure de fer(II)",
    "iupacName": "sulfanylideneiron",
    "casNumber": "1317-37-9",
    "pubchemCid": 14828,
    "kind": "ionic_compound",
    "molarMass": 87.905,
    "standardState": "solid",
    "meltingPointC": 1194,
    "thermalNote": "decomposes",
    "densityGPerCm3": 4.84,
    "appearanceFr": "Solide gris-noir non magnétique",
    "colorHex": "#3f3f46",
    "composition": {
      "Fe": 1,
      "S": 1
    },
    "families": [
      "Inorganique"
    ],
    "popularity": 11036,
    "ghsSignalWord": "Non classé",
    "usesFr": "Production de H₂S au laboratoire par action d’un acide dilué.",
    "aqueous": {
      "soluble": false,
      "solubilityGPerL": 0
    }
  }
]
