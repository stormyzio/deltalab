import type {
  AcidBaseCoupleRecord,
  CatalogReactionRecord,
  PredictedReactionGroup,
  PredictedReactionItem,
  PredictReactionResponse,
  ReactionCategory,
  RedoxCoupleRecord,
  SolubilityProductRecord,
  SpeciesRecord,
} from '../../shared/chemistry.ts'

export interface ReactionEngineContext {
  curatedReactions: CatalogReactionRecord[]
  redoxCouples: RedoxCoupleRecord[]
  solubilityProducts: SolubilityProductRecord[]
  acidBaseCouples: AcidBaseCoupleRecord[]
  getDissolvedIonIds: (speciesId: string) => string[]
}

export interface PredictReactionsOptions {
  forcedRedoxMedium?: 'acidic' | 'basic'
  requiredSlots?: number[]
}

export interface ReactionContextSpeciesMap {
  acidic?: SpeciesRecord | null
  basic?: SpeciesRecord | null
  aqueous?: SpeciesRecord | null
  oxygen?: SpeciesRecord | null
}

interface DirectReactionRule {
  reactantIds: string[]
  requiresAcid?: boolean
  requiresBase?: boolean
  category: ReactionCategory
  titleFr: string
  equationDisplay: string
  equilibriumLabel: string | null
  observationsFr: string
  detailsFr: string
  medium: 'aqueous' | 'gas' | 'solid' | 'any'
  setupReactants: Array<{ speciesId: string; stoichiometry: number }>
}

const DIRECT_SINGLE_REACTANT_RULES: DirectReactionRule[] = [
  {
    reactantIds: ['caco3'],
    category: 'decomposition',
    titleFr: 'Calcination du carbonate de calcium',
    equationDisplay: 'CaCO₃(s) → CaO(s) + CO₂(g)',
    equilibriumLabel: 'Thermique (~850 °C)',
    observationsFr:
      'Décomposition thermique formant de la chaux vive CaO(s) et du dioxyde de carbone CO₂(g).',
    detailsFr: 'Procédé industriel de fabrication de la chaux vive.',
    medium: 'solid',
    setupReactants: [{ speciesId: 'caco3', stoichiometry: 1 }],
  },
  {
    reactantIds: ['nahco3'],
    category: 'decomposition',
    titleFr: 'Décomposition thermique du bicarbonate de sodium',
    equationDisplay: '2 NaHCO₃(s) → Na₂CO₃(s) + H₂O(g) + CO₂(g)',
    equilibriumLabel: 'Thermique (> 80 °C)',
    observationsFr:
      'Dégagement gazeux de CO₂ et de vapeur d’eau laissant du carbonate de sodium.',
    detailsFr: 'Principe de la levure chimique et des extincteurs à poudre.',
    medium: 'solid',
    setupReactants: [{ speciesId: 'nahco3', stoichiometry: 2 }],
  },
  {
    reactantIds: ['h2co3'],
    category: 'decomposition',
    titleFr: 'Dissociation de l’acide carbonique',
    equationDisplay: 'H₂CO₃(aq) ⇌ H₂O(l) + CO₂(g)',
    equilibriumLabel: 'Équilibre rapide',
    observationsFr: 'Dégagement gazeux progressif de dioxyde de carbone dissous.',
    detailsFr: 'L’acide carbonique en solution aqueuse est instable et libère CO₂.',
    medium: 'aqueous',
    setupReactants: [{ speciesId: 'h2co3', stoichiometry: 1 }],
  },
]

const DIRECT_PAIR_RULES: DirectReactionRule[] = [
  // Combustions / oxydations sèches
  {
    reactantIds: ['fe_solid', 'o2'],
    category: 'combustion',
    titleFr: 'Oxydation du fer par le dioxygène',
    equationDisplay: '4 Fe(s) + 3 O₂(g) → 2 Fe₂O₃(s)',
    equilibriumLabel: 'Exothermique (voie sèche)',
    observationsFr:
      'Incandescence dans le dioxygène avec formation d’oxyde de fer(III) Fe₂O₃(s).',
    detailsFr: 'Combustion vive du fer à haute température.',
    medium: 'solid',
    setupReactants: [
      { speciesId: 'fe_solid', stoichiometry: 4 },
      { speciesId: 'o2', stoichiometry: 3 },
    ],
  },
  {
    reactantIds: ['cu_solid', 'o2'],
    category: 'combustion',
    titleFr: 'Oxydation du cuivre par le dioxygène',
    equationDisplay: '2 Cu(s) + O₂(g) → 2 CuO(s)',
    equilibriumLabel: 'Solide noir CuO(s)',
    observationsFr:
      'Le cuivre rouge-brun se recouvre d’une couche noire d’oxyde de cuivre(II) CuO(s).',
    detailsFr: 'Oxydation directe du métal à chaud.',
    medium: 'solid',
    setupReactants: [
      { speciesId: 'cu_solid', stoichiometry: 2 },
      { speciesId: 'o2', stoichiometry: 1 },
    ],
  },
  {
    reactantIds: ['zn_solid', 'o2'],
    category: 'combustion',
    titleFr: 'Combustion du zinc dans le dioxygène',
    equationDisplay: '2 Zn(s) + O₂(g) → 2 ZnO(s)',
    equilibriumLabel: 'Flamme bleu-vert · ZnO(s)',
    observationsFr:
      'Flamme bleu-vert lumineuse formant des flocons blancs d’oxyde de zinc ZnO(s).',
    detailsFr: 'Synthèse directe de l’oxyde de zinc.',
    medium: 'solid',
    setupReactants: [
      { speciesId: 'zn_solid', stoichiometry: 2 },
      { speciesId: 'o2', stoichiometry: 1 },
    ],
  },
  {
    reactantIds: ['al_solid', 'o2'],
    category: 'combustion',
    titleFr: 'Oxydation de l’aluminium par le dioxygène',
    equationDisplay: '4 Al(s) + 3 O₂(g) → 2 Al₂O₃(s)',
    equilibriumLabel: 'Très exothermique',
    observationsFr:
      'Formation d’alumine blanche Al₂O₃(s) très réfractaire.',
    detailsFr: 'Oxydation vive de l’aluminium divisé ou passivé en surface.',
    medium: 'solid',
    setupReactants: [
      { speciesId: 'al_solid', stoichiometry: 4 },
      { speciesId: 'o2', stoichiometry: 3 },
    ],
  },
  {
    reactantIds: ['ca_solid', 'o2'],
    category: 'combustion',
    titleFr: 'Combustion du calcium dans le dioxygène',
    equationDisplay: '2 Ca(s) + O₂(g) → 2 CaO(s)',
    equilibriumLabel: 'Exothermique · CaO(s)',
    observationsFr: 'Flamme rouge-orangé formant de la chaux vive CaO(s).',
    detailsFr: 'Oxydation directe d’un métal alcalino-terreux.',
    medium: 'solid',
    setupReactants: [
      { speciesId: 'ca_solid', stoichiometry: 2 },
      { speciesId: 'o2', stoichiometry: 1 },
    ],
  },
  {
    reactantIds: ['s_solid', 'o2'],
    category: 'combustion',
    titleFr: 'Combustion du soufre dans le dioxygène',
    equationDisplay: 'S(s) + O₂(g) → SO₂(g)',
    equilibriumLabel: 'Flamme bleue · SO₂(g)',
    observationsFr:
      'Flamme bleue caractéristique et dégagement suffocant de dioxyde de soufre.',
    detailsFr: 'Combustion complète du soufre élémentaire.',
    medium: 'solid',
    setupReactants: [
      { speciesId: 's_solid', stoichiometry: 1 },
      { speciesId: 'o2', stoichiometry: 1 },
    ],
  },
  {
    reactantIds: ['s8', 'o2'],
    category: 'combustion',
    titleFr: 'Combustion de l’octasoufre dans le dioxygène',
    equationDisplay: 'S₈(s) + 8 O₂(g) → 8 SO₂(g)',
    equilibriumLabel: 'Flamme bleue · SO₂(g)',
    observationsFr:
      'Flamme bleue caractéristique et dégagement suffocant de dioxyde de soufre.',
    detailsFr: 'Combustion complète du soufre moléculaire S₈.',
    medium: 'solid',
    setupReactants: [
      { speciesId: 's8', stoichiometry: 1 },
      { speciesId: 'o2', stoichiometry: 8 },
    ],
  },
  // Synthèses directes
  {
    reactantIds: ['fe_solid', 's_solid'],
    category: 'synthesis',
    titleFr: 'Synthèse du sulfure de fer(II)',
    equationDisplay: 'Fe(s) + S(s) → FeS(s)',
    equilibriumLabel: 'Voie sèche · Exothermique',
    observationsFr:
      'Incandescence formant un solide gris-noir non magnétique de FeS(s).',
    detailsFr: 'Réaction exothermique classique entre poudre de fer et fleur de soufre.',
    medium: 'solid',
    setupReactants: [
      { speciesId: 'fe_solid', stoichiometry: 1 },
      { speciesId: 's_solid', stoichiometry: 1 },
    ],
  },
  {
    reactantIds: ['cu_solid', 'cl2'],
    category: 'redox',
    titleFr: 'Combustion du cuivre dans le dichlore',
    equationDisplay: 'Cu(s) + Cl₂(g) → CuCl₂(s)',
    equilibriumLabel: 'Voie sèche · CuCl₂(s)',
    observationsFr: 'Formation de fumées jaunâtres de chlorure de cuivre(II) anhydre.',
    detailsFr: 'Oxydation directe du cuivre par le dichlore gazeux.',
    medium: 'solid',
    setupReactants: [
      { speciesId: 'cu_solid', stoichiometry: 1 },
      { speciesId: 'cl2', stoichiometry: 1 },
    ],
  },
  {
    reactantIds: ['h2', 'cl2'],
    category: 'synthesis',
    titleFr: 'Synthèse du chlorure d’hydrogène',
    equationDisplay: 'H₂(g) + Cl₂(g) → 2 HCl(g)',
    equilibriumLabel: 'Phase gazeuse · Explosive',
    observationsFr:
      'Réaction explosive amorcée par la lumière formant du chlorure d’hydrogène gazeux.',
    detailsFr: 'Réaction radicalaire en chaîne entre dihydrogène et dichlore.',
    medium: 'gas',
    setupReactants: [
      { speciesId: 'h2', stoichiometry: 1 },
      { speciesId: 'cl2', stoichiometry: 1 },
    ],
  },
  // Réactions avec l'eau
  {
    reactantIds: ['na_solid', 'h2o'],
    category: 'redox',
    titleFr: 'Réaction vive du sodium avec l’eau',
    equationDisplay: '2 Na(s) + 2 H₂O(l) → 2 Na⁺(aq) + 2 OH⁻(aq) + H₂(g)',
    equilibriumLabel: 'Exothermique · pH basique',
    observationsFr:
      'Le sodium fond en bille, s’agite en surface avec effervescence de H₂ et alcalinise l’eau.',
    detailsFr: 'Réduction de l’eau par un métal alcalin (ΔE° = +1,88 V).',
    medium: 'aqueous',
    setupReactants: [
      { speciesId: 'na_solid', stoichiometry: 2 },
    ],
  },
  {
    reactantIds: ['k_solid', 'h2o'],
    category: 'redox',
    titleFr: 'Réaction violente du potassium avec l’eau',
    equationDisplay: '2 K(s) + 2 H₂O(l) → 2 K⁺(aq) + 2 OH⁻(aq) + H₂(g)',
    equilibriumLabel: 'Flamme lilas · Exothermique',
    observationsFr:
      'Inflammation immédiate du dihydrogène dégagé avec flamme violet-lilas.',
    detailsFr: 'Réduction très exothermique de l’eau par le potassium.',
    medium: 'aqueous',
    setupReactants: [
      { speciesId: 'k_solid', stoichiometry: 2 },
    ],
  },
  {
    reactantIds: ['li_solid', 'h2o'],
    category: 'redox',
    titleFr: 'Réaction du lithium avec l’eau',
    equationDisplay: '2 Li(s) + 2 H₂O(l) → 2 Li⁺(aq) + 2 OH⁻(aq) + H₂(g)',
    equilibriumLabel: 'Exothermique · pH basique',
    observationsFr:
      'Effervescence régulière de dihydrogène et formation d’une solution basique.',
    detailsFr: 'Réduction de l’eau par le lithium métallique.',
    medium: 'aqueous',
    setupReactants: [
      { speciesId: 'li_solid', stoichiometry: 2 },
    ],
  },
  {
    reactantIds: ['ca_solid', 'h2o'],
    category: 'redox',
    titleFr: 'Réaction du calcium avec l’eau',
    equationDisplay: 'Ca(s) + 2 H₂O(l) → Ca²⁺(aq) + 2 OH⁻(aq) + H₂(g)',
    equilibriumLabel: 'Effervescence H₂(g)',
    observationsFr:
      'Dégagement soutenu de bulles de dihydrogène et trouble léger de chaux.',
    detailsFr: 'Réduction de l’eau par le calcium métallique.',
    medium: 'aqueous',
    setupReactants: [
      { speciesId: 'ca_solid', stoichiometry: 1 },
    ],
  },
  {
    reactantIds: ['cao', 'h2o'],
    category: 'synthesis',
    titleFr: 'Hydratation de la chaux vive (extinction)',
    equationDisplay: 'CaO(s) + H₂O(l) → Ca(OH)₂(s)',
    equilibriumLabel: 'Très exothermique',
    observationsFr:
      'Dégagement intense de chaleur transformant la chaux vive en chaux éteinte.',
    detailsFr: 'Réaction d’extinction de l’oxyde de calcium.',
    medium: 'aqueous',
    setupReactants: [
      { speciesId: 'cao', stoichiometry: 1 },
    ],
  },
  {
    reactantIds: ['co2', 'h2o'],
    category: 'acid_base',
    titleFr: 'Hydratation du dioxyde de carbone',
    equationDisplay: 'CO₂(g) + H₂O(l) ⇌ H₂CO₃(aq)',
    equilibriumLabel: 'Équilibre aqueux (pH ≈ 5,6)',
    observationsFr: 'Acidification légère de l’eau par dissolution du CO₂.',
    detailsFr: 'Équilibre de formation de l’acide carbonique dissous.',
    medium: 'aqueous',
    setupReactants: [{ speciesId: 'co2', stoichiometry: 1 }],
  },
  // Attaques acides de solides insolubles (carbonates, sulfures, oxydes, hydroxydes)
  {
    reactantIds: ['caco3'],
    requiresAcid: true,
    category: 'acid_base',
    titleFr: 'Attaque acide du carbonate de calcium',
    equationDisplay: 'CaCO₃(s) + 2 H₃O⁺(aq) → Ca²⁺(aq) + CO₂(g) + 3 H₂O(l)',
    equilibriumLabel: 'Effervescence CO₂(g)',
    observationsFr:
      'Vive effervescence avec dissolution du calcaire et dégagement de CO₂.',
    detailsFr: 'Test caractéristique des carbonates en milieu acide.',
    medium: 'aqueous',
    setupReactants: [
      { speciesId: 'caco3', stoichiometry: 1 },
      { speciesId: 'h3o_plus', stoichiometry: 2 },
    ],
  },
  {
    reactantIds: ['fes'],
    requiresAcid: true,
    category: 'acid_base',
    titleFr: 'Attaque acide du sulfure de fer(II)',
    equationDisplay: 'FeS(s) + 2 H₃O⁺(aq) → Fe²⁺(aq) + H₂S(g) + 2 H₂O(l)',
    equilibriumLabel: 'Dégagement H₂S(g)',
    observationsFr:
      'Dissolution du sulfure noir avec dégagement gazeux de sulfure d’hydrogène.',
    detailsFr: 'Synthèse classique de H₂S au laboratoire.',
    medium: 'aqueous',
    setupReactants: [
      { speciesId: 'fes', stoichiometry: 1 },
      { speciesId: 'h3o_plus', stoichiometry: 2 },
    ],
  },
  {
    reactantIds: ['cuo'],
    requiresAcid: true,
    category: 'acid_base',
    titleFr: 'Dissolution acide de l’oxyde de cuivre(II)',
    equationDisplay: 'CuO(s) + 2 H₃O⁺(aq) → Cu²⁺(aq) + 3 H₂O(l)',
    equilibriumLabel: 'Solution bleue Cu²⁺(aq)',
    observationsFr:
      'La poudre noire de CuO se dissout en donnant une solution bleue limpide.',
    detailsFr: 'Neutralisation d’un oxyde basique par un acide.',
    medium: 'aqueous',
    setupReactants: [
      { speciesId: 'cuo', stoichiometry: 1 },
      { speciesId: 'h3o_plus', stoichiometry: 2 },
    ],
  },
  {
    reactantIds: ['mgo'],
    requiresAcid: true,
    category: 'acid_base',
    titleFr: 'Dissolution acide de l’oxyde de magnésium',
    equationDisplay: 'MgO(s) + 2 H₃O⁺(aq) → Mg²⁺(aq) + 3 H₂O(l)',
    equilibriumLabel: 'Totale · Exothermique',
    observationsFr: 'Dissolution complète de la magnésie blanche en solution incolore.',
    detailsFr: 'Neutralisation d’un oxyde basique.',
    medium: 'aqueous',
    setupReactants: [
      { speciesId: 'mgo', stoichiometry: 1 },
      { speciesId: 'h3o_plus', stoichiometry: 2 },
    ],
  },
  {
    reactantIds: ['zno'],
    requiresAcid: true,
    category: 'acid_base',
    titleFr: 'Dissolution acide de l’oxyde de zinc',
    equationDisplay: 'ZnO(s) + 2 H₃O⁺(aq) → Zn²⁺(aq) + 3 H₂O(l)',
    equilibriumLabel: 'Totale',
    observationsFr: 'Dissolution complète de l’oxyde blanc en solution limpide.',
    detailsFr: 'Neutralisation d’un oxyde amphotère en milieu acide.',
    medium: 'aqueous',
    setupReactants: [
      { speciesId: 'zno', stoichiometry: 1 },
      { speciesId: 'h3o_plus', stoichiometry: 2 },
    ],
  },
  {
    reactantIds: ['cao'],
    requiresAcid: true,
    category: 'acid_base',
    titleFr: 'Neutralisation acide de l’oxyde de calcium',
    equationDisplay: 'CaO(s) + 2 H₃O⁺(aq) → Ca²⁺(aq) + 3 H₂O(l)',
    equilibriumLabel: 'Très exothermique',
    observationsFr: 'Dissolution rapide et exothermique de la chaux vive.',
    detailsFr: 'Neutralisation d’un oxyde basique.',
    medium: 'aqueous',
    setupReactants: [
      { speciesId: 'cao', stoichiometry: 1 },
      { speciesId: 'h3o_plus', stoichiometry: 2 },
    ],
  },
  {
    reactantIds: ['fe2o3'],
    requiresAcid: true,
    category: 'acid_base',
    titleFr: 'Dissolution acide de l’oxyde de fer(III)',
    equationDisplay: 'Fe₂O₃(s) + 6 H₃O⁺(aq) → 2 Fe³⁺(aq) + 9 H₂O(l)',
    equilibriumLabel: 'Solution jaune-ocre Fe³⁺',
    observationsFr:
      'Attaque lente de la rouille formant une solution jaune-ambre d’ions Fe³⁺.',
    detailsFr: 'Décapage acide de l’oxyde ferrique.',
    medium: 'aqueous',
    setupReactants: [
      { speciesId: 'fe2o3', stoichiometry: 1 },
      { speciesId: 'h3o_plus', stoichiometry: 6 },
    ],
  },
  {
    reactantIds: ['cuoh2'],
    requiresAcid: true,
    category: 'acid_base',
    titleFr: 'Dissolution acide de l’hydroxyde de cuivre(II)',
    equationDisplay: 'Cu(OH)₂(s) + 2 H₃O⁺(aq) → Cu²⁺(aq) + 4 H₂O(l)',
    equilibriumLabel: 'Solution bleue Cu²⁺(aq)',
    observationsFr:
      'Le précipité bleu gélatineux se dissout immédiatement en solution limpide bleue.',
    detailsFr: 'Neutralisation acide-base d’un hydroxyde peu soluble.',
    medium: 'aqueous',
    setupReactants: [
      { speciesId: 'cuoh2', stoichiometry: 1 },
      { speciesId: 'h3o_plus', stoichiometry: 2 },
    ],
  },
  {
    reactantIds: ['feoh3'],
    requiresAcid: true,
    category: 'acid_base',
    titleFr: 'Dissolution acide de l’hydroxyde de fer(III)',
    equationDisplay: 'Fe(OH)₃(s) + 3 H₃O⁺(aq) → Fe³⁺(aq) + 6 H₂O(l)',
    equilibriumLabel: 'Solution jaune-ambre',
    observationsFr: 'Le précipité rouille se redissout en ions Fe³⁺(aq).',
    detailsFr: 'Neutralisation acide d’un hydroxyde métallique.',
    medium: 'aqueous',
    setupReactants: [
      { speciesId: 'feoh3', stoichiometry: 1 },
      { speciesId: 'h3o_plus', stoichiometry: 3 },
    ],
  },
  {
    reactantIds: ['aloh3'],
    requiresAcid: true,
    category: 'acid_base',
    titleFr: 'Dissolution acide de l’hydroxyde d’aluminium',
    equationDisplay: 'Al(OH)₃(s) + 3 H₃O⁺(aq) → Al³⁺(aq) + 6 H₂O(l)',
    equilibriumLabel: 'Totale',
    observationsFr: 'Le précipité blanc gélatineux se dissout en solution limpide.',
    detailsFr: 'Neutralisation en milieu acide d’un hydroxyde amphotère.',
    medium: 'aqueous',
    setupReactants: [
      { speciesId: 'aloh3', stoichiometry: 1 },
      { speciesId: 'h3o_plus', stoichiometry: 3 },
    ],
  },
  // Réactions en milieu basique (OH-)
  {
    reactantIds: ['co2'],
    requiresBase: true,
    category: 'acid_base',
    titleFr: 'Absorption du dioxyde de carbone en milieu basique',
    equationDisplay: 'CO₂(g) + 2 OH⁻(aq) → CO₃²⁻(aq) + H₂O(l)',
    equilibriumLabel: 'Totale en milieu basique',
    observationsFr:
      'Capture du dioxyde de carbone sous forme d’ions carbonate en solution basique.',
    detailsFr: 'Neutralisation de l’oxyde acide CO₂ par les ions hydroxyde.',
    medium: 'aqueous',
    setupReactants: [
      { speciesId: 'co2', stoichiometry: 1 },
      { speciesId: 'oh_minus', stoichiometry: 2 },
    ],
  },
  {
    reactantIds: ['cl2'],
    requiresBase: true,
    category: 'redox',
    titleFr: 'Dismutation du dichlore en milieu basique',
    equationDisplay: 'Cl₂(g) + 2 OH⁻(aq) → ClO⁻(aq) + Cl⁻(aq) + H₂O(l)',
    equilibriumLabel: 'Eau de Javel · Milieu basique',
    observationsFr:
      'Dismutation du dichlore formant des ions hypochlorite ClO⁻ et chlorure Cl⁻.',
    detailsFr: 'Réaction industrielle de préparation de l’eau de Javel à froid.',
    medium: 'aqueous',
    setupReactants: [
      { speciesId: 'cl2', stoichiometry: 1 },
      { speciesId: 'oh_minus', stoichiometry: 2 },
    ],
  },
]

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a))
  let y = Math.abs(Math.trunc(b))
  while (y !== 0) {
    const t = y
    y = x % y
    x = t
  }
  return x || 1
}

function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b)
}

function coeff(n: number, formula: string): string {
  return n === 1 ? formula : `${n} ${formula}`
}

function formatPowerOf10(exp: number): string {
  const rounded = Math.round(exp * 10) / 10
  if (Math.abs(rounded) < 0.05) return 'K ≈ 1'
  if (Math.abs(rounded) <= 3) {
    const val = 10 ** rounded
    return `K ≈ ${val >= 10 ? val.toFixed(0) : val.toPrecision(2).replace('.', ',')}`
  }
  const intExp = Math.round(rounded)
  const supDigits: Record<string, string> = {
    '-': '⁻',
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
  const sup = String(intExp)
    .split('')
    .map((c) => supDigits[c] ?? c)
    .join('')
  return `K ≈ 10${sup}`
}

function collectRoleIds(
  species: SpeciesRecord,
  getDissolvedIonIds: (id: string) => string[],
): Set<string> {
  const ids = new Set<string>([species.id])
  for (const ionId of getDissolvedIonIds(species.id)) {
    ids.add(ionId)
  }
  if (ids.has('h_plus')) ids.add('h3o_plus')
  if (ids.has('h3o_plus')) ids.add('h_plus')
  return ids
}

function normalizeEquationDedupKey(equationDisplay: string): string {
  const clean = equationDisplay
    .replace(/\((s|l|g|aq)\)/gi, '')
    .replace(/H₃O⁺/g, 'H⁺')
    .replace(/H3O\+/g, 'H⁺')
  const parts = clean.split(/\s*(?:→|⇌|->|<=>)\s*/)
  if (parts.length !== 2) return clean.replace(/\s+/g, '')
  const normSide = (side: string) => {
    const uniqueTerms = new Set(
      side
        .split(/\s+\+\s+/)
        .map((t) => t.trim().replace(/^\d+\s+/, '').replace(/\s+/g, ''))
        .filter(Boolean),
    )
    return [...uniqueTerms].sort().join('+')
  }
  return `${normSide(parts[0])}=>${normSide(parts[1])}`
}

const BASIC_EXCLUDED_COUPLE_IDS = new Set([
  'rx_h_h2',
  'rx_mno4_mn2',
  'rx_mno2_mn2',
  'rx_cr2o7_cr3',
  'rx_clo_cl2',
])

export function predictReactionsForSpecies(
  rawSpeciesList: SpeciesRecord[],
  ctx: ReactionEngineContext,
  options?: PredictReactionsOptions,
): PredictReactionResponse {
  const speciesList: SpeciesRecord[] = []
  const seenInputIds = new Set<string>()
  for (const sp of rawSpeciesList) {
    if (!seenInputIds.has(sp.id)) {
      seenInputIds.add(sp.id)
      speciesList.push(sp)
    }
  }

  const reactions: PredictedReactionItem[] = []
  const seenEquations = new Set<string>()
  const requiredSlots = options?.requiredSlots ?? []
  const coversRequired = (usedSlots: Set<number>) =>
    requiredSlots.every((idx) => usedSlots.has(idx))

  const pushUnique = (item: PredictedReactionItem) => {
    const key = normalizeEquationDedupKey(item.equationDisplay)
    if (seenEquations.has(key)) return
    seenEquations.add(key)
    reactions.push(item)
  }

  const roleSets = speciesList.map((sp) => collectRoleIds(sp, ctx.getDissolvedIonIds))
  const combinedRoles = new Set<string>()
  for (const set of roleSets) {
    for (const id of set) combinedRoles.add(id)
  }

  const toResponse = (): PredictReactionResponse => ({
    species: speciesList.map((sp) => ({
      id: sp.id,
      displayFormula: sp.displayFormula,
      nameFr: sp.nameFr,
    })),
    speciesA: speciesList[0]
      ? {
          id: speciesList[0].id,
          displayFormula: speciesList[0].displayFormula,
          nameFr: speciesList[0].nameFr,
        }
      : undefined,
    speciesB: speciesList[1]
      ? {
          id: speciesList[1].id,
          displayFormula: speciesList[1].displayFormula,
          nameFr: speciesList[1].nameFr,
        }
      : undefined,
    speciesC: speciesList[2]
      ? {
          id: speciesList[2].id,
          displayFormula: speciesList[2].displayFormula,
          nameFr: speciesList[2].nameFr,
        }
      : null,
    reactions,
  })

  if (speciesList.length === 0) return toResponse()

  // Single-reactant decompositions / equilibria
  if (speciesList.length === 1) {
    const single = speciesList[0]
    for (const rxn of ctx.curatedReactions) {
      if (rxn.reactants.length !== 1) continue
      if (rxn.reactants[0].speciesId !== single.id) continue
      pushUnique({
        category: rxn.category,
        titleFr: rxn.nameFr,
        equationDisplay: rxn.equationDisplay,
        spontaneous: true,
        equilibriumLabel:
          typeof rxn.conditions?.pKs === 'number'
            ? `pKs = ${String(rxn.conditions.pKs).replace('.', ',')}`
            : typeof rxn.conditions?.deltaE0V === 'number'
              ? `ΔE° = +${String(rxn.conditions.deltaE0V).replace('.', ',')} V`
              : null,
        observationsFr: rxn.observationsFr ?? 'Réaction répertoriée.',
        detailsFr: 'Réaction emblématique du catalogue DeltaLab.',
        setupReactants: rxn.reactants.map((r) => ({
          speciesId: r.speciesId,
          stoichiometry: r.stoichiometry,
        })),
        setupMedium: rxn.medium,
      })
    }
    for (const rule of DIRECT_SINGLE_REACTANT_RULES) {
      if (rule.reactantIds.every((id) => combinedRoles.has(id))) {
        pushUnique({
          category: rule.category,
          titleFr: rule.titleFr,
          equationDisplay: rule.equationDisplay,
          spontaneous: true,
          equilibriumLabel: rule.equilibriumLabel,
          observationsFr: rule.observationsFr,
          detailsFr: rule.detailsFr,
          setupReactants: rule.setupReactants,
          setupMedium: rule.medium,
        })
      }
    }
    return toResponse()
  }

  // 1. Named curated reactions matching the selected species (or their dissociated ions)
  for (const rxn of ctx.curatedReactions) {
    const rIds = rxn.reactants.map((r) => r.speciesId)
    if (rIds.length < 2) continue
    const allCovered = rIds.every(
      (id) => combinedRoles.has(id) || id === 'h3o_plus' || id === 'h2o',
    )
    if (!allCovered) continue

    const matchedSlots = roleSets.filter((set) => rIds.some((id) => set.has(id))).length
    const distinctSources = new Set<number>()
    for (const id of rIds) {
      roleSets.forEach((set, idx) => {
        if (set.has(id)) distinctSources.add(idx)
      })
    }
    if (
      matchedSlots < Math.min(2, speciesList.length) ||
      distinctSources.size < 2 ||
      !coversRequired(distinctSources)
    ) {
      continue
    }

    pushUnique({
      category: rxn.category,
      titleFr: rxn.nameFr,
      equationDisplay: rxn.equationDisplay,
      spontaneous: true,
      equilibriumLabel:
        typeof rxn.conditions?.pKs === 'number'
          ? `pKs = ${String(rxn.conditions.pKs).replace('.', ',')}`
          : typeof rxn.conditions?.deltaE0V === 'number'
            ? `ΔE° = +${String(rxn.conditions.deltaE0V).replace('.', ',')} V`
            : null,
      observationsFr: rxn.observationsFr ?? 'Réaction répertoriée.',
      detailsFr: 'Réaction emblématique du catalogue DeltaLab.',
      setupReactants: rxn.reactants.map((r) => ({
        speciesId: r.speciesId,
        stoichiometry: r.stoichiometry,
      })),
      setupMedium: rxn.medium,
    })
  }

  // 1B. Direct rules (combustions, dry syntheses, alkali + water, acid/base attacks on insoluble solids)
  for (const rule of DIRECT_PAIR_RULES) {
    if (rule.requiresAcid) {
      if (!combinedRoles.has('h3o_plus')) continue
      const solidOk = rule.reactantIds.every((id) => combinedRoles.has(id))
      if (!solidOk) continue
      const usedSlots = new Set<number>()
      roleSets.forEach((set, idx) => {
        if (rule.reactantIds.some((id) => set.has(id)) || set.has('h3o_plus')) {
          usedSlots.add(idx)
        }
      })
      if (!coversRequired(usedSlots)) continue
      const acidCarrier = speciesList.find(
        (sp, idx) =>
          !rule.reactantIds.includes(sp.id) && roleSets[idx].has('h3o_plus'),
      )
      const setup = acidCarrier
        ? [
            { speciesId: rule.reactantIds[0], stoichiometry: rule.setupReactants[0].stoichiometry },
            { speciesId: acidCarrier.id, stoichiometry: rule.setupReactants[1].stoichiometry },
          ]
        : rule.setupReactants
      pushUnique({
        category: rule.category,
        titleFr: rule.titleFr,
        equationDisplay: rule.equationDisplay,
        spontaneous: true,
        equilibriumLabel: rule.equilibriumLabel,
        observationsFr: rule.observationsFr,
        detailsFr: rule.detailsFr,
        setupReactants: setup,
        setupMedium: rule.medium,
      })
    } else if (rule.requiresBase) {
      if (!combinedRoles.has('oh_minus')) continue
      const targetOk = rule.reactantIds.every((id) => combinedRoles.has(id))
      if (!targetOk) continue
      const usedSlots = new Set<number>()
      roleSets.forEach((set, idx) => {
        if (rule.reactantIds.some((id) => set.has(id)) || set.has('oh_minus')) {
          usedSlots.add(idx)
        }
      })
      if (!coversRequired(usedSlots)) continue
      const baseCarrier = speciesList.find(
        (sp, idx) =>
          !rule.reactantIds.includes(sp.id) && roleSets[idx].has('oh_minus'),
      )
      const setup = baseCarrier
        ? [
            { speciesId: rule.reactantIds[0], stoichiometry: rule.setupReactants[0].stoichiometry },
            { speciesId: baseCarrier.id, stoichiometry: rule.setupReactants[1].stoichiometry },
          ]
        : rule.setupReactants
      pushUnique({
        category: rule.category,
        titleFr: rule.titleFr,
        equationDisplay: rule.equationDisplay,
        spontaneous: true,
        equilibriumLabel: rule.equilibriumLabel,
        observationsFr: rule.observationsFr,
        detailsFr: rule.detailsFr,
        setupReactants: setup,
        setupMedium: rule.medium,
      })
    } else if (rule.reactantIds.every((id) => combinedRoles.has(id))) {
      const usedSlots = new Set<number>()
      roleSets.forEach((set, idx) => {
        if (rule.reactantIds.some((id) => set.has(id))) {
          usedSlots.add(idx)
        }
      })
      if (!coversRequired(usedSlots)) continue
      pushUnique({
        category: rule.category,
        titleFr: rule.titleFr,
        equationDisplay: rule.equationDisplay,
        spontaneous: true,
        equilibriumLabel: rule.equilibriumLabel,
        observationsFr: rule.observationsFr,
        detailsFr: rule.detailsFr,
        setupReactants: rule.setupReactants,
        setupMedium: rule.medium,
      })
    }
  }

  // 2. Precipitation (pKs) between ions brought by distinct reactants
  for (const ks of ctx.solubilityProducts) {
    if (!ks.cationSpeciesId || !ks.anionSpeciesId) continue
    if (!combinedRoles.has(ks.cationSpeciesId) || !combinedRoles.has(ks.anionSpeciesId)) {
      continue
    }
    const catSlots = roleSets
      .map((s, idx) => (s.has(ks.cationSpeciesId!) ? idx : -1))
      .filter((i) => i >= 0)
    const anSlots = roleSets
      .map((s, idx) => (s.has(ks.anionSpeciesId!) ? idx : -1))
      .filter((i) => i >= 0)
    const canComeFromDifferent = catSlots.some((c) =>
      anSlots.some((a) => a !== c && requiredSlots.every((r) => r === c || r === a)),
    )
    if (!canComeFromDifferent) continue
    if (speciesList.some((sp) => sp.id === ks.solidSpeciesId)) continue

    const eq = `${coeff(ks.cationStoich, `${ks.cationFormula}(aq)`)} + ${coeff(ks.anionStoich, `${ks.anionFormula}(aq)`)} → ${ks.solidFormula}(s)`
    pushUnique({
      category: 'precipitation',
      titleFr: `Précipitation de ${ks.solidNameFr.toLowerCase()}`,
      equationDisplay: eq,
      spontaneous: true,
      equilibriumLabel: `pKs = ${ks.pKs.toFixed(2).replace('.', ',')}`,
      observationsFr: `Formation d’un précipité ${ks.precipitateColorFr.toLowerCase()} dès que Qr > Ks.`,
      detailsFr: `Constante de solubilité Ks = ${ks.ks.toExponential(2).replace('.', ',')} (${ks.source}).`,
      setupReactants: [
        { speciesId: ks.cationSpeciesId, stoichiometry: ks.cationStoich },
        { speciesId: ks.anionSpeciesId, stoichiometry: ks.anionStoich },
      ],
      setupMedium: 'aqueous',
    })
  }

  // 3. Acid-Base proton transfer (Brønsted pKa)
  const allAcids = ctx.acidBaseCouples.filter(
    (c) => c.acidSpeciesId && combinedRoles.has(c.acidSpeciesId),
  )
  const allBases = ctx.acidBaseCouples.filter(
    (c) => c.baseSpeciesId && combinedRoles.has(c.baseSpeciesId),
  )

  const abPairs: Array<[AcidBaseCoupleRecord, AcidBaseCoupleRecord]> = []
  for (const ac of allAcids) {
    for (const bs of allBases) {
      if (ac.id === bs.id) continue
      // Avoid redundant molecular strong-acid variant when H3O+ is already present via dissociation
      if (
        ac.pKa < 0 &&
        ac.acidSpeciesId !== 'h3o_plus' &&
        combinedRoles.has('h3o_plus') &&
        speciesList.some((sp) => sp.id === ac.acidSpeciesId && sp.kind !== 'ion')
      ) {
        continue
      }
      const acidSlots = roleSets
        .map((s, idx) => (ac.acidSpeciesId && s.has(ac.acidSpeciesId) ? idx : -1))
        .filter((i) => i >= 0)
      const baseSlots = roleSets
        .map((s, idx) => (bs.baseSpeciesId && s.has(bs.baseSpeciesId) ? idx : -1))
        .filter((i) => i >= 0)
      if (
        acidSlots.some((a) =>
          baseSlots.some((b) => b !== a && requiredSlots.every((r) => r === a || r === b)),
        )
      ) {
        abPairs.push([ac, bs])
      }
    }
  }

  abPairs.sort((p1, p2) => p2[1].pKa - p2[0].pKa - (p1[1].pKa - p1[0].pKa))
  for (const [acidC, baseC] of abPairs.slice(0, 3)) {
    const deltaPka = baseC.pKa - acidC.pKa
    if (deltaPka < -1.5) continue
    const total = deltaPka >= 3
    const arrow = total ? '→' : '⇌'
    const rhs =
      acidC.baseFormula === baseC.acidFormula
        ? acidC.baseFormula === 'H₂O'
          ? '2 H₂O(l)'
          : `2 ${acidC.baseFormula}(aq)`
        : `${acidC.baseFormula}(aq) + ${baseC.acidFormula}(aq)`
    const eq = `${acidC.acidFormula}(aq) + ${baseC.baseFormula}(aq) ${arrow} ${rhs}`
    pushUnique({
      category: 'acid_base',
      titleFr: total ? 'Réaction acide-base totale' : 'Équilibre acide-base',
      equationDisplay: eq,
      spontaneous: deltaPka > 0,
      equilibriumLabel: `ΔpKa = ${deltaPka >= 0 ? '+' : ''}${deltaPka.toFixed(2).replace('.', ',')} · ${formatPowerOf10(deltaPka)}`,
      observationsFr: total
        ? 'Transfert quasi-total de proton (réaction quantitative).'
        : 'Équilibre partiel entre les deux couples acide/base.',
      detailsFr: `Couples ${acidC.acidFormula}/${acidC.baseFormula} (pKa = ${acidC.pKa.toFixed(2).replace('.', ',')}) et ${baseC.acidFormula}/${baseC.baseFormula} (pKa = ${baseC.pKa.toFixed(2).replace('.', ',')}).`,
      setupReactants:
        acidC.acidSpeciesId && baseC.baseSpeciesId
          ? [
              { speciesId: acidC.acidSpeciesId, stoichiometry: 1 },
              { speciesId: baseC.baseSpeciesId, stoichiometry: 1 },
            ]
          : undefined,
      setupMedium: 'aqueous',
    })
  }

  // 4. Redox (Gamma rule ΔE° = E°_ox - E°_red > 0.05 V; supports acidic and basic media)
  const hasAqueousContext = speciesList.some(
    (sp) =>
      sp.id === 'h2o' ||
      sp.kind === 'ion' ||
      (sp.canDissolveInWater &&
        (sp.dissolutionType === 'ionic_complete' ||
          sp.dissolutionType === 'ionic_partial' ||
          sp.phCharacter !== 'neutral')),
  )

  const hasExplicitAcid = combinedRoles.has('h3o_plus') || combinedRoles.has('h_plus')
  const hasBasicContext = combinedRoles.has('oh_minus')
  const redoxMode: 'acidic' | 'basic' =
    options?.forcedRedoxMedium ??
    (hasBasicContext && !hasExplicitAcid ? 'basic' : 'acidic')

  const effectiveE0 = (c: RedoxCoupleRecord): number => {
    if (redoxMode === 'basic') {
      if (c.medium === 'basic') return c.e0V
      return c.e0V - (0.05916 * 14 * c.hPlus) / c.electrons
    }
    return c.e0V
  }

  const coupleMatchesSlot = (
    c: RedoxCoupleRecord,
    side: 'ox' | 'red',
    slotIdx: number,
  ): boolean => {
    const sp = speciesList[slotIdx]
    const roles = roleSets[slotIdx]
    const targetId = side === 'ox' ? c.oxSpeciesId : c.redSpeciesId
    const targetFormula = side === 'ox' ? c.oxFormula : c.redFormula
    if (redoxMode === 'basic') {
      if (BASIC_EXCLUDED_COUPLE_IDS.has(c.id)) return false
      if (side === 'red' && targetId === 'h2o') return false
      if (c.id === 'rx_h2o_h2') {
        return side === 'ox' && roles.has('h2o')
      }
      if (targetId === 'h2o') return false
    } else {
      if (c.id === 'rx_h2o_h2') {
        if (!(side === 'ox' && roles.has('h2o'))) return false
      } else {
        if (targetId === 'h2o' || c.medium === 'basic') return false
      }
    }
    if (targetId && roles.has(targetId)) return true
    return sp.kind === 'element_substance' && targetFormula === sp.displayFormula
  }

  const oxCouples = ctx.redoxCouples.filter((c) =>
    speciesList.some((_, idx) => coupleMatchesSlot(c, 'ox', idx)),
  )
  const redCouples = ctx.redoxCouples.filter(
    (c) =>
      c.id !== 'rx_cu1_cu' &&
      speciesList.some((_, idx) => coupleMatchesSlot(c, 'red', idx)),
  )

  const minDeltaE0 = redoxMode === 'basic' ? 0.035 : 0.05
  const redoxPairs: Array<[RedoxCoupleRecord, RedoxCoupleRecord]> = []
  for (const oxC of oxCouples) {
    for (const redC of redCouples) {
      if (oxC.id === redC.id || effectiveE0(oxC) - effectiveE0(redC) <= minDeltaE0) continue
      if (oxC.oxSpeciesId && oxC.oxSpeciesId === redC.redSpeciesId) continue
      const oxSlots = speciesList
        .map((_, idx) => (coupleMatchesSlot(oxC, 'ox', idx) ? idx : -1))
        .filter((i) => i >= 0)
      const redSlots = speciesList
        .map((_, idx) => (coupleMatchesSlot(redC, 'red', idx) ? idx : -1))
        .filter((i) => i >= 0)
      if (
        !oxSlots.some((o) =>
          redSlots.some((r) => r !== o && requiredSlots.every((req) => req === o || req === r)),
        )
      ) {
        continue
      }
      redoxPairs.push([oxC, redC])
    }
  }

  redoxPairs.sort(
    (p1, p2) =>
      effectiveE0(p2[0]) - effectiveE0(p2[1]) - (effectiveE0(p1[0]) - effectiveE0(p1[1])),
  )
  for (const [oxC, redC] of redoxPairs.slice(0, 4)) {
    const nElec = lcm(oxC.electrons, redC.electrons)
    const mOx = nElec / oxC.electrons
    const mRed = nElec / redC.electrons

    const terms = new Map<string, number>()
    const addTerm = (formula: string, delta: number) => {
      if (delta === 0) return
      terms.set(formula, (terms.get(formula) ?? 0) + delta)
    }

    // Forward oxidation half-reaction for oxC (ox + e- -> red)
    addTerm(oxC.oxFormula, mOx * oxC.oxStoich)
    addTerm(oxC.redFormula, -mOx * oxC.redStoich)
    if (oxC.id === 'rx_h2o_h2') {
      addTerm('OH⁻', -mOx * 2)
    } else if (redoxMode === 'basic') {
      if (oxC.hPlus) {
        addTerm('H₂O', mOx * oxC.hPlus)
        addTerm('OH⁻', -mOx * oxC.hPlus)
      }
      if (oxC.h2o) addTerm('H₂O', -mOx * oxC.h2o)
    } else {
      if (oxC.hPlus) addTerm('H⁺', mOx * oxC.hPlus)
      if (oxC.h2o) addTerm('H₂O', -mOx * oxC.h2o)
    }

    // Reverse reduction half-reaction for redC (red -> ox + e-)
    addTerm(redC.redFormula, mRed * redC.redStoich)
    addTerm(redC.oxFormula, -mRed * redC.oxStoich)
    if (redC.id === 'rx_h2o_h2') {
      addTerm('OH⁻', mRed * 2)
    } else if (redoxMode === 'basic') {
      if (redC.hPlus) {
        addTerm('H₂O', -mRed * redC.hPlus)
        addTerm('OH⁻', mRed * redC.hPlus)
      }
      if (redC.h2o) addTerm('H₂O', mRed * redC.h2o)
    } else {
      if (redC.hPlus) addTerm('H⁺', -mRed * redC.hPlus)
      if (redC.h2o) addTerm('H₂O', mRed * redC.h2o)
    }

    const netHPlus = terms.get('H⁺') ?? 0
    const netOHMinus = terms.get('OH⁻') ?? 0
    const netH2O = terms.get('H₂O') ?? 0

    if (!hasAqueousContext && (netHPlus !== 0 || netOHMinus !== 0 || netH2O !== 0)) {
      continue
    }

    const nonZeroVals = [...terms.values()].filter((v) => v !== 0).map((v) => Math.abs(v))
    const div = nonZeroVals.reduce((acc, v) => gcd(acc, v), nonZeroVals[0] ?? 1)
    if (div > 1) {
      for (const [k, v] of terms.entries()) {
        if (v !== 0) terms.set(k, Math.round(v / div))
      }
    }

    const auxFormulas = new Set(['H⁺', 'OH⁻', 'H₂O'])
    const mainLhsOrder = [oxC.oxFormula, redC.redFormula]
    const mainRhsOrder = [oxC.redFormula, redC.oxFormula]
    const lhs: string[] = []
    const rhs: string[] = []

    for (const f of mainLhsOrder) {
      if (auxFormulas.has(f)) continue
      const v = terms.get(f) ?? 0
      if (v > 0 && !lhs.some((item) => item.endsWith(` ${f}`) || item === f)) {
        lhs.push(coeff(v, f))
      }
    }
    for (const [f, v] of terms.entries()) {
      if (v > 0 && !auxFormulas.has(f) && !mainLhsOrder.includes(f)) {
        lhs.push(coeff(v, f))
      }
    }
    for (const f of ['H⁺', 'OH⁻', 'H₂O']) {
      const v = terms.get(f) ?? 0
      if (v > 0) lhs.push(coeff(v, f))
    }

    for (const f of mainRhsOrder) {
      if (auxFormulas.has(f)) continue
      const v = terms.get(f) ?? 0
      if (v < 0 && !rhs.some((item) => item.endsWith(` ${f}`) || item === f)) {
        rhs.push(coeff(-v, f))
      }
    }
    for (const [f, v] of terms.entries()) {
      if (v < 0 && !auxFormulas.has(f) && !mainRhsOrder.includes(f)) {
        rhs.push(coeff(-v, f))
      }
    }
    for (const f of ['H⁺', 'OH⁻', 'H₂O']) {
      const v = terms.get(f) ?? 0
      if (v < 0) rhs.push(coeff(-v, f))
    }

    const oxCoeff = Math.round((mOx * oxC.oxStoich) / div)
    const redCoeff = Math.round((mRed * redC.redStoich) / div)
    const hPlusLhsCoeff = Math.max(0, terms.get('H⁺') ?? 0)
    const ohMinusLhsCoeff = Math.max(0, terms.get('OH⁻') ?? 0)

    const setupReactants: Array<{ speciesId: string; stoichiometry: number }> = []
    if (oxC.oxSpeciesId) {
      setupReactants.push({ speciesId: oxC.oxSpeciesId, stoichiometry: oxCoeff })
    }
    if (redC.redSpeciesId && redC.redSpeciesId !== oxC.oxSpeciesId) {
      setupReactants.push({ speciesId: redC.redSpeciesId, stoichiometry: redCoeff })
    }
    if (hPlusLhsCoeff > 0 && oxC.oxSpeciesId !== 'h3o_plus') {
      setupReactants.push({ speciesId: 'h3o_plus', stoichiometry: hPlusLhsCoeff })
    }
    if (ohMinusLhsCoeff > 0 && oxC.oxSpeciesId !== 'oh_minus' && redC.redSpeciesId !== 'oh_minus') {
      setupReactants.push({ speciesId: 'oh_minus', stoichiometry: ohMinusLhsCoeff })
    }

    const oxE0 = effectiveE0(oxC)
    const redE0 = effectiveE0(redC)
    const deltaE0 = oxE0 - redE0
    const logK = (nElec * deltaE0) / 0.059
    const eq = `${lhs.join(' + ')} → ${rhs.join(' + ')}`
    const hasBasicTerms = (terms.get('OH⁻') ?? 0) !== 0
    pushUnique({
      category: 'redox',
      titleFr: `Oxydoréduction (${oxC.coupleLabel} / ${redC.coupleLabel})`,
      equationDisplay: eq,
      spontaneous: true,
      equilibriumLabel: `ΔE° = +${deltaE0.toFixed(2).replace('.', ',')} V · ${formatPowerOf10(logK)}`,
      observationsFr:
        redoxMode === 'basic' && hasBasicTerms
          ? 'Réaction spontanée selon la règle du gamma (milieu basique OH⁻).'
          : hPlusLhsCoeff > 0
            ? 'Réaction spontanée selon la règle du gamma (milieu acide H⁺).'
            : 'Réaction spontanée selon la règle du gamma.',
      detailsFr: `E°(${oxC.coupleLabel}) = ${oxE0.toFixed(2).replace('.', ',')} V > E°(${redC.coupleLabel}) = ${redE0.toFixed(2).replace('.', ',')} V (${nElec} e⁻ échangés).`,
      setupReactants: setupReactants.length >= 2 ? setupReactants : undefined,
      setupMedium: 'aqueous',
    })
  }

  // 5. Complete combustion for organic C_xH_yO_z + O2
  const o2Idx = speciesList.findIndex((s) => s.id === 'o2')
  const o2PairIdx =
    o2Idx >= 0 ? speciesList.findIndex((s) => s.id !== 'o2' && s.charge === 0) : -1
  const o2Pair = o2PairIdx >= 0 ? speciesList[o2PairIdx] : null
  if (
    o2Pair &&
    o2Pair.charge === 0 &&
    requiredSlots.every((r) => r === o2Idx || r === o2PairIdx)
  ) {
    const keys = Object.keys(o2Pair.composition)
    const onlyCHO = keys.every((k) => k === 'C' || k === 'H' || k === 'O')
    const c = o2Pair.composition.C ?? 0
    const h = o2Pair.composition.H ?? 0
    const o = o2Pair.composition.O ?? 0
    if (onlyCHO && c >= 1 && h >= 1) {
      const o2Num = 4 * c + h - 2 * o
      if (o2Num > 0) {
        let fuelCoeff = 4
        let o2Coeff = o2Num
        let co2Coeff = 4 * c
        let h2oCoeff = 2 * h
        const d = gcd(gcd(fuelCoeff, o2Coeff), gcd(co2Coeff, h2oCoeff))
        fuelCoeff /= d
        o2Coeff /= d
        co2Coeff /= d
        h2oCoeff /= d

        const eq = `${coeff(fuelCoeff, o2Pair.displayFormula)} + ${coeff(o2Coeff, 'O₂(g)')} → ${coeff(co2Coeff, 'CO₂(g)')} + ${coeff(h2oCoeff, 'H₂O(g)')}`
        pushUnique({
          category: 'combustion',
          titleFr: `Combustion complète (${o2Pair.nameFr.toLowerCase()})`,
          equationDisplay: eq,
          spontaneous: true,
          equilibriumLabel: 'Exothermique (hors aqueux)',
          observationsFr:
            'Combustion vive avec formation de dioxyde de carbone et d’eau.',
          detailsFr:
            'Équation stœchiométrique calculée automatiquement à partir de la composition atomique.',
          setupReactants: [
            { speciesId: o2Pair.id, stoichiometry: fuelCoeff },
            { speciesId: 'o2', stoichiometry: o2Coeff },
          ],
          setupMedium: 'gas',
        })
      }
    }
  }

  return toResponse()
}

function inspectLhsSide(equationDisplay: string): {
  hasAcid: boolean
  hasBase: boolean
  hasWater: boolean
} {
  const lhs = equationDisplay.split(/\s*(?:→|⇌|->|<=>)\s*/)[0] ?? ''
  const terms = lhs
    .split(/\s+\+\s+/)
    .map((t) =>
      t
        .trim()
        .replace(/^\d+\s+/, '')
        .replace(/\((s|l|g|aq)\)/gi, '')
        .replace(/\s+/g, ''),
    )
    .filter(Boolean)
  return {
    hasAcid: terms.some((t) => t === 'H⁺' || t === 'H+' || t === 'H₃O⁺' || t === 'H3O+'),
    hasBase: terms.some((t) => t === 'OH⁻' || t === 'OH-' || t === 'HO⁻' || t === 'HO-'),
    hasWater: terms.some((t) => t === 'H₂O' || t === 'H2O'),
  }
}

export function predictReactionsWithContexts(
  rawSpeciesList: SpeciesRecord[],
  ctx: ReactionEngineContext,
  contextSpecies: ReactionContextSpeciesMap,
): PredictReactionResponse {
  const speciesList: SpeciesRecord[] = []
  const seenInputIds = new Set<string>()
  for (const sp of rawSpeciesList) {
    if (!seenInputIds.has(sp.id)) {
      seenInputIds.add(sp.id)
      speciesList.push(sp)
    }
  }

  const directRes = predictReactionsForSpecies(speciesList, ctx)
  if (speciesList.length === 0) {
    return { ...directRes, contextGroups: [] }
  }

  const userRoleSets = speciesList.map((sp) => collectRoleIds(sp, ctx.getDissolvedIonIds))
  const userCombinedRoles = new Set<string>()
  for (const set of userRoleSets) {
    for (const id of set) userCombinedRoles.add(id)
  }

  const userHasAcid = userCombinedRoles.has('h3o_plus') || userCombinedRoles.has('h_plus')
  const userHasBase = userCombinedRoles.has('oh_minus')
  const userHasWater = userCombinedRoles.has('h2o')
  const userHasO2 = userCombinedRoles.has('o2')

  const nonSolventSlots = speciesList
    .map((sp, i) => (sp.id !== 'h2o' ? i : -1))
    .filter((i) => i >= 0)
  const requiredSlots =
    nonSolventSlots.length > 0 ? nonSolventSlots : speciesList.map((_, i) => i)

  const buckets: Record<'direct' | 'acidic' | 'basic' | 'aqueous' | 'oxygen', PredictedReactionItem[]> = {
    direct: [],
    acidic: [],
    basic: [],
    aqueous: [],
    oxygen: [],
  }
  const seenKeys = new Set<string>()

  for (const item of directRes.reactions) {
    seenKeys.add(normalizeEquationDedupKey(item.equationDisplay))
    const lhs = inspectLhsSide(item.equationDisplay)
    if (!userHasAcid && lhs.hasAcid) {
      buckets.acidic.push(item)
    } else if (!userHasWater && !userHasBase && lhs.hasWater) {
      buckets.aqueous.push(item)
    } else {
      buckets.direct.push(item)
    }
  }

  const collectFromContext = (
    extraSp: SpeciesRecord,
    bucket: PredictedReactionItem[],
    opts?: {
      forcedRedoxMedium?: 'acidic' | 'basic'
      accept?: (item: PredictedReactionItem) => boolean
    },
  ) => {
    if (speciesList.some((sp) => sp.id === extraSp.id)) return
    const res = predictReactionsForSpecies([...speciesList, extraSp], ctx, {
      forcedRedoxMedium: opts?.forcedRedoxMedium,
      requiredSlots,
    })
    for (const item of res.reactions) {
      const key = normalizeEquationDedupKey(item.equationDisplay)
      if (seenKeys.has(key)) continue
      if (opts?.accept && !opts.accept(item)) continue
      seenKeys.add(key)
      bucket.push(item)
    }
  }

  if (!userHasAcid && contextSpecies.acidic) {
    collectFromContext(contextSpecies.acidic, buckets.acidic, {
      forcedRedoxMedium: 'acidic',
    })
  }
  if (!userHasBase && contextSpecies.basic) {
    collectFromContext(contextSpecies.basic, buckets.basic, {
      forcedRedoxMedium: 'basic',
    })
  }
  if (!userHasWater && contextSpecies.aqueous) {
    collectFromContext(contextSpecies.aqueous, buckets.aqueous, {
      accept: (item) => userHasAcid || !inspectLhsSide(item.equationDisplay).hasAcid,
    })
  }
  if (!userHasO2 && contextSpecies.oxygen) {
    collectFromContext(contextSpecies.oxygen, buckets.oxygen, {
      accept: (item) => {
        const lhs = inspectLhsSide(item.equationDisplay)
        return (userHasAcid || !lhs.hasAcid) && (userHasBase || !lhs.hasBase)
      },
    })
  }

  const contextGroups: PredictedReactionGroup[] = []
  if (buckets.direct.length > 0) {
    contextGroups.push({
      context: 'direct',
      labelFr: 'Réactions directes',
      reactions: buckets.direct,
    })
  }
  if (buckets.acidic.length > 0) {
    contextGroups.push({
      context: 'acidic',
      labelFr: 'Milieu acide',
      addedSpeciesFormula: 'H+',
      reactions: buckets.acidic,
    })
  }
  if (buckets.basic.length > 0) {
    contextGroups.push({
      context: 'basic',
      labelFr: 'Milieu basique',
      addedSpeciesFormula: 'OH-',
      reactions: buckets.basic,
    })
  }
  if (buckets.aqueous.length > 0) {
    contextGroups.push({
      context: 'aqueous',
      labelFr: 'Dans l’eau',
      addedSpeciesFormula: 'H2O',
      reactions: buckets.aqueous,
    })
  }
  if (buckets.oxygen.length > 0) {
    contextGroups.push({
      context: 'oxygen',
      labelFr: 'Avec dioxygène',
      addedSpeciesFormula: 'O2',
      reactions: buckets.oxygen,
    })
  }

  return {
    ...directRes,
    contextGroups,
  }
}

export function predictReactionsBetween(
  speciesA: SpeciesRecord,
  speciesB: SpeciesRecord,
  ctx: ReactionEngineContext,
  speciesC?: SpeciesRecord | null,
): PredictReactionResponse {
  return predictReactionsForSpecies(
    [speciesA, speciesB, ...(speciesC ? [speciesC] : [])],
    ctx,
  )
}
