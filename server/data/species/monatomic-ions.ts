import type {
  DissolutionType,
  ElementRecord,
  PhCharacter,
} from '../../../shared/chemistry.ts'
import type { DissolutionProductDef, SpeciesSeed } from '../types.ts'

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
}

const ROMAN_NUMERALS: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI',
  7: 'VII',
}

/** Exact French anion names for monatomic negative ions */
const MONATOMIC_ANION_NAME_FR: Record<string, string> = {
  H: 'Ion hydrure',
  C: 'Ion carbure',
  N: 'Ion nitrure',
  O: 'Ion oxyde',
  F: 'Ion fluorure',
  P: 'Ion phosphure',
  S: 'Ion sulfure',
  Cl: 'Ion chlorure',
  As: 'Ion arséniure',
  Se: 'Ion séléniure',
  Br: 'Ion bromure',
  Te: 'Ion tellurure',
  I: 'Ion iodure',
  At: 'Ion astature',
}

export interface MonatomicIonMeta {
  nameFr?: string
  iupacName?: string
  casNumber?: string
  pubchemCid?: number
  popularity?: number
  colorHex?: string
  solutionColorHex?: string
  appearanceFr?: string
  usesFr?: string
  identificationFr?: string
  phCharacter?: PhCharacter
  soluble?: boolean
  dissolutionType?: DissolutionType
  dissociatesInto?: DissolutionProductDef[]
}

/** Verified metadata, IUPAC references & experimental aqueous colors for monatomic ions */
export const MONATOMIC_ION_META: Record<string, MonatomicIonMeta> = {
  'H:1': {
    nameFr: 'Ion hydrogène (proton)',
    iupacName: 'hydron',
    casNumber: '12408-02-5',
    pubchemCid: 1038,
    popularity: 11000,
    phCharacter: 'acidic_strong',
    dissociatesInto: [{ speciesId: 'h3o_plus', stoichiometry: 1, state: 'aqueous' }],
  },
  'H:-1': {
    appearanceFr: 'Anion fortement réducteur et basique (réagit vivement avec l’eau)',
    usesFr: 'Base très forte et réducteur puissant dans les hydrures ioniques (NaH, CaH₂).',
  },
  'Li:1': {
    iupacName: 'lithium(1+)',
    casNumber: '17341-24-1',
    pubchemCid: 28486,
    popularity: 11000,
    appearanceFr: 'Ion hydraté incolore en solution aqueuse',
    usesFr: 'Transport de charge dans les accumulateurs lithium-ion.',
    identificationFr: 'Colore la flamme en rouge carmin intense.',
  },
  'Na:1': {
    iupacName: 'sodium(1+)',
    casNumber: '17341-25-2',
    pubchemCid: 923,
    popularity: 11002,
    appearanceFr: 'Ion hydraté incolore en solution aqueuse',
    usesFr: 'Ion spectateur courant, essentiel à l’équilibre osmotique et aux potentiels nerveux.',
    identificationFr: 'Colore la flamme en jaune-orangé très intense (raie D à 589 nm).',
  },
  'K:1': {
    iupacName: 'potassium(1+)',
    casNumber: '24203-36-9',
    pubchemCid: 813,
    popularity: 11000,
    appearanceFr: 'Ion hydraté incolore en solution aqueuse',
    usesFr: 'Nutriment essentiel des plantes (engrais potassiques) et électrolyte intracellulaire.',
    identificationFr: 'Colore la flamme en violet-lilas pâle.',
  },
  'Rb:1': {
    appearanceFr: 'Ion hydraté incolore en solution aqueuse',
    identificationFr: 'Colore la flamme en rouge-violet.',
  },
  'Cs:1': {
    appearanceFr: 'Ion hydraté incolore en solution aqueuse',
    identificationFr: 'Colore la flamme en bleu-violet.',
  },
  'Mg:2': {
    iupacName: 'magnesium(2+)',
    casNumber: '22537-22-0',
    pubchemCid: 888,
    popularity: 11000,
  },
  'Ca:2': {
    iupacName: 'calcium(2+)',
    casNumber: '14127-61-8',
    pubchemCid: 271,
    popularity: 11000,
    appearanceFr: 'Ion hydraté incolore en solution aqueuse',
    usesFr: 'Responsable de la dureté de l’eau ; constituant des os, coquilles et calcaires.',
    identificationFr: 'Précipité blanc avec les ions oxalate ou carbonate ; flamme rouge brique.',
  },
  'Sr:2': {
    appearanceFr: 'Ion hydraté incolore en solution aqueuse',
    usesFr: 'Utilisé en pyrotechnie pour les feux rouges vifs.',
    identificationFr: 'Colore la flamme en rouge écarlate intense.',
  },
  'Ba:2': {
    iupacName: 'barium(2+)',
    casNumber: '22541-12-4',
    pubchemCid: 104810,
    popularity: 11000,
    appearanceFr: 'Ion hydraté incolore en solution aqueuse (toxique sous forme soluble)',
    usesFr: 'Réactif de détection des ions sulfate SO₄²⁻.',
    identificationFr: 'Précipité blanc très insoluble BaSO₄ avec SO₄²⁻ ; flamme vert pomme.',
  },
  'Al:3': {
    iupacName: 'aluminum(3+)',
    casNumber: '22537-23-1',
    pubchemCid: 104727,
    popularity: 11000,
  },
  'Ti:3': {
    colorHex: '#7c3aed',
    solutionColorHex: '#7c3aed',
    appearanceFr: 'Ion hydraté violet en solution aqueuse ([Ti(H₂O)₆]³⁺)',
    usesFr: 'Réducteur puissant en chimie de coordination et catalyse Ziegler-Natta.',
  },
  'V:2': {
    colorHex: '#8b5cf6',
    solutionColorHex: '#8b5cf6',
    appearanceFr: 'Ion hydraté violet en solution aqueuse ([V(H₂O)₆]²⁺)',
    usesFr: 'Couple redox des batteries à flux au vanadium.',
  },
  'V:3': {
    colorHex: '#16a34a',
    solutionColorHex: '#16a34a',
    appearanceFr: 'Ion hydraté vert en solution aqueuse ([V(H₂O)₆]³⁺)',
    usesFr: 'État d’oxydation intermédiaire dans les batteries à flux au vanadium.',
  },
  'Cr:2': {
    colorHex: '#38bdf8',
    solutionColorHex: '#38bdf8',
    appearanceFr: 'Ion hydraté bleu ciel en solution aqueuse (s’oxyde rapidement à l’air)',
    usesFr: 'Réducteur énergique en synthèse organique (réaction de Nozaki-Hiyama-Kishi).',
  },
  'Cr:3': {
    iupacName: 'chromium(3+)',
    casNumber: '16065-83-1',
    pubchemCid: 27668,
    popularity: 11000,
    colorHex: '#15803d',
    solutionColorHex: '#15803d',
    appearanceFr: 'Ion hydraté vert émeraude à bleu-violet en solution aqueuse',
    usesFr: 'Tannage du cuir, pigments verts et complexes de coordination stables.',
    identificationFr: 'Précipité gris-vert de Cr(OH)₃ avec OH⁻, redissous dans un excès de soude.',
  },
  'Mn:2': {
    iupacName: 'manganese(2+)',
    casNumber: '16397-91-4',
    pubchemCid: 27854,
    popularity: 11000,
    colorHex: '#f9a8d4',
    solutionColorHex: '#fbcfe8',
    appearanceFr: 'Ion hydraté rose très pâle (presque incolore dilué) en solution aqueuse',
    usesFr: 'Produit de réduction du permanganate MnO₄⁻ en milieu acide.',
    identificationFr: 'Précipité beige pâle Mn(OH)₂ avec OH⁻ qui brunit rapidement à l’air.',
  },
  'Fe:2': {
    iupacName: 'iron(2+)',
    casNumber: '1317-63-1',
    pubchemCid: 27284,
    popularity: 11000,
    colorHex: '#4ade80',
    solutionColorHex: '#86efac',
    appearanceFr: 'Ion hydraté vert pâle en solution aqueuse ([Fe(H₂O)₆]²⁺)',
    usesFr: 'Réducteur classique en titrage redox (sel de Mohr, sulfate de fer(II)).',
    identificationFr: 'Précipité vert kaki de Fe(OH)₂ avec OH⁻.',
  },
  'Fe:3': {
    iupacName: 'iron(3+)',
    casNumber: '20074-52-6',
    pubchemCid: 29936,
    popularity: 11000,
    colorHex: '#d97706',
    solutionColorHex: '#f59e0b',
    appearanceFr: 'Ion hydraté jaune-ocre à brun-rouille en solution aqueuse',
    usesFr: 'Coagulant pour le traitement de l’eau, gravure du cuivre et catalyseur.',
    identificationFr: 'Précipité rouille Fe(OH)₃ avec OH⁻ ; coloration rouge sang avec SCN⁻.',
  },
  'Co:2': {
    iupacName: 'cobalt(2+)',
    casNumber: '22541-53-3',
    pubchemCid: 104729,
    popularity: 11000,
    colorHex: '#ec4899',
    solutionColorHex: '#f472b6',
    appearanceFr: 'Ion hydraté rose-rouge en solution aqueuse ([Co(H₂O)₆]²⁺)',
    usesFr: 'Indicateur d’humidité (rose hydraté, bleu anhydre) et pigments.',
    identificationFr: 'Vire au bleu intense en présence d’ions Cl⁻ concentrés ([CoCl₄]²⁻).',
  },
  'Ni:2': {
    iupacName: 'nickel(2+)',
    casNumber: '14701-22-5',
    pubchemCid: 934,
    popularity: 11000,
    colorHex: '#10b981',
    solutionColorHex: '#34d399',
    appearanceFr: 'Ion hydraté vert émeraude en solution aqueuse ([Ni(H₂O)₆]²⁺)',
    usesFr: 'Galvanoplastie (nickelage) et catalyseurs d’hydrogénation.',
    identificationFr: 'Précipité vert pâle Ni(OH)₂ avec OH⁻ ; complexe rouge cerise avec la diméthylglyoxime.',
  },
  'Cu:1': {
    iupacName: 'copper(1+)',
    casNumber: '17493-86-6',
    pubchemCid: 104815,
    popularity: 11000,
  },
  'Cu:2': {
    iupacName: 'copper(2+)',
    casNumber: '15158-11-9',
    pubchemCid: 27099,
    popularity: 11000,
    colorHex: '#0284c7',
    solutionColorHex: '#0ea5e9',
    appearanceFr: 'Ion hydraté bleu céleste en solution aqueuse ([Cu(H₂O)₆]²⁺)',
    usesFr: 'Électrolyse du cuivre, fongicides (bouillie bordelaise) et pile Daniell.',
    identificationFr: 'Précipité bleu céleste Cu(OH)₂ avec OH⁻ ; complexe bleu roi avec NH₃ ; flamme verte.',
  },
  'Zn:2': {
    iupacName: 'zinc(2+)',
    casNumber: '23713-49-7',
    pubchemCid: 32051,
    popularity: 11000,
    appearanceFr: 'Ion hydraté incolore en solution aqueuse',
    usesFr: 'Galvanisation anticorrosion, piles alcalines et oligo-élément biologique.',
    identificationFr: 'Précipité blanc gélatineux Zn(OH)₂ avec OH⁻, soluble dans un excès de base.',
  },
  'Ag:1': {
    iupacName: 'silver(1+)',
    casNumber: '14701-21-4',
    pubchemCid: 104755,
    popularity: 11000,
    appearanceFr: 'Ion hydraté incolore en solution aqueuse (photosensible en présence d’halogénures)',
    usesFr: 'Réactif de dosage des halogénures (méthode de Mohr) et argenture.',
    identificationFr: 'Précipité blanc cailleboté AgCl avec Cl⁻ qui noircit à la lumière.',
  },
  'Sn:2': {
    iupacName: 'tin(2+)',
    casNumber: '22541-90-8',
    pubchemCid: 104883,
    popularity: 11000,
  },
  'Au:3': {
    colorHex: '#eab308',
    solutionColorHex: '#facc15',
    appearanceFr: 'Ion jaune doré en solution acide chlorhydrique ([AuCl₄]⁻)',
    usesFr: 'Dorure électrolytique et synthèse de nanoparticules d’or.',
  },
  'Pb:2': {
    iupacName: 'lead(2+)',
    casNumber: '14280-50-3',
    pubchemCid: 73212,
    popularity: 11000,
    appearanceFr: 'Ion hydraté incolore en solution aqueuse (toxique)',
    usesFr: 'Accumulateurs au plomb et tests de précipitation caractéristiques.',
    identificationFr: 'Précipité jaune vif PbI₂ (« pluie d’or ») avec les ions iodure I⁻.',
  },
  'Pr:3': {
    colorHex: '#86efac',
    solutionColorHex: '#bbf7d0',
    appearanceFr: 'Ion hydraté vert pâle en solution aqueuse',
  },
  'Nd:3': {
    colorHex: '#c084fc',
    solutionColorHex: '#d8b4fe',
    appearanceFr: 'Ion hydraté violet-lilas en solution aqueuse',
    usesFr: 'Aimants permanents NdFeB et lasers solides Nd:YAG.',
  },
  'Er:3': {
    colorHex: '#f9a8d4',
    solutionColorHex: '#fbcfe8',
    appearanceFr: 'Ion hydraté rose pâle en solution aqueuse',
    usesFr: 'Amplificateurs optiques pour fibres de télécommunication.',
  },
  'U:4': {
    colorHex: '#22c55e',
    solutionColorHex: '#4ade80',
    appearanceFr: 'Ion hydraté vert en solution aqueuse acide (radioactif)',
  },
  'F:-1': {
    iupacName: 'fluoride',
    casNumber: '16984-48-8',
    pubchemCid: 28179,
    popularity: 11000,
  },
  'Cl:-1': {
    iupacName: 'chloride',
    casNumber: '16887-00-6',
    pubchemCid: 312,
    popularity: 11000,
  },
  'Br:-1': {
    iupacName: 'bromide',
    casNumber: '24959-67-9',
    pubchemCid: 259,
    popularity: 11000,
  },
  'I:-1': {
    iupacName: 'iodide',
    casNumber: '20461-54-5',
    pubchemCid: 30165,
    popularity: 11000,
  },
  'O:-2': {
    iupacName: 'oxygen(2-)',
    casNumber: '16833-27-5',
    pubchemCid: 190217,
    popularity: 11000,
    phCharacter: 'basic_strong',
  },
  'S:-2': {
    iupacName: 'sulfide',
    casNumber: '18496-25-8',
    pubchemCid: 29109,
    popularity: 11000,
    phCharacter: 'basic_weak',
  },
  'N:-3': {
    popularity: 11000,
    soluble: false,
    dissolutionType: 'none',
  },
}

function formatChargeSuperscript(charge: number): string {
  const abs = Math.abs(charge)
  const sign = charge > 0 ? '⁺' : '⁻'
  if (abs === 1) return sign
  const digits = String(abs)
    .split('')
    .map((d) => SUPERSCRIPT_DIGITS[d] ?? d)
    .join('')
  return `${digits}${sign}`
}

function formatFormulaAscii(symbol: string, charge: number): string {
  const abs = Math.abs(charge)
  const sign = charge > 0 ? '+' : '-'
  return abs === 1 ? `${symbol}${sign}` : `${symbol}${abs}${sign}`
}

export function buildMonatomicIonId(symbol: string, charge: number): string {
  const sym = symbol.toLowerCase()
  const abs = Math.abs(charge)
  const suffix = charge > 0 ? 'plus' : 'minus'
  return abs === 1 ? `${sym}_${suffix}` : `${sym}${abs}_${suffix}`
}

function buildMonatomicIonNameFr(el: ElementRecord, charge: number): string {
  if (charge < 0) {
    return (
      MONATOMIC_ANION_NAME_FR[el.symbol] ?? `Ion ${el.nameFr.toLowerCase()}ure`
    )
  }
  const positiveCharges = el.commonIonCharges.filter((c) => c > 0)
  const baseLower = el.nameFr.toLowerCase()
  if (positiveCharges.length > 1) {
    const roman = ROMAN_NUMERALS[charge] ?? String(charge)
    return `Ion ${baseLower}(${roman})`
  }
  return `Ion ${baseLower}`
}

/**
 * Generates clean, chemically accurate monatomic ion records for every element
 * in ELEMENTS_SEED that defines commonIonCharges.
 */
export function buildMonatomicIonSeeds(elements: ElementRecord[]): SpeciesSeed[] {
  const result: SpeciesSeed[] = []

  for (const el of elements) {
    if (el.category === 'noble-gas' || el.commonIonCharges.length === 0) continue
    for (const charge of el.commonIonCharges) {
      if (charge === 0) continue
      const key = `${el.symbol}:${charge}`
      const meta = MONATOMIC_ION_META[key]
      const isCation = charge > 0
      const family = isCation ? 'Cation monoatomique' : 'Anion monoatomique'
      const defaultAppearance = isCation
        ? 'Ion hydraté incolore en solution aqueuse'
        : 'Anion monoatomique en solution aqueuse'
      const soluble = meta?.soluble ?? true

      result.push({
        id: buildMonatomicIonId(el.symbol, charge),
        formula: formatFormulaAscii(el.symbol, charge),
        displayFormula: `${el.symbol}${formatChargeSuperscript(charge)}`,
        nameFr: meta?.nameFr ?? buildMonatomicIonNameFr(el, charge),
        iupacName: meta?.iupacName ?? null,
        casNumber: meta?.casNumber ?? null,
        pubchemCid: meta?.pubchemCid ?? null,
        kind: 'ion',
        charge,
        molarMass: el.atomicMass,
        standardState: 'aqueous',
        appearanceFr: meta?.appearanceFr ?? defaultAppearance,
        colorHex: meta?.colorHex ?? null,
        composition: { [el.symbol]: 1 },
        mergeable: false,
        families: [family],
        popularity: meta?.popularity ?? Math.max(100, 4000 - el.atomicNumber * 20),
        usesFr: meta?.usesFr,
        identificationFr: meta?.identificationFr,
        aqueous: {
          soluble,
          dissolutionType:
            meta?.dissolutionType ?? (soluble ? 'ionic_complete' : 'none'),
          colorHex: meta?.solutionColorHex ?? null,
          phCharacter: meta?.phCharacter ?? 'neutral',
          ...(meta?.dissociatesInto ? { dissociatesInto: meta.dissociatesInto } : {}),
        },
      })
    }
  }

  return result
}
