import type { ReactionCategory } from '../../../shared/chemistry.ts'
import {
  type AddCandidateFn,
  type FlaskReactionDetectorContext,
  type InventoryEntry,
  type MakeParticipantFn,
  finalizeReaction,
  formatDeNomFr,
  gcd,
} from './helpers.ts'

interface NonAqueousReactionRule {
  id: string
  nameFr: string
  category: ReactionCategory
  equilibriumLabel: string | null
  observationsFr: string
  arrow?: string
  allowWithWater?: boolean
  priority: number
  reactants: Array<{
    id: string
    stoich: number
    formula: string
    nameFr: string
    state: 'solid' | 'liquid' | 'gas'
  }>
  products: Array<{
    id: string
    stoich: number
    formula: string
    nameFr: string
    state: 'solid' | 'liquid' | 'gas'
    colorHex?: string | null
    molarMass?: number
  }>
}

const NON_AQUEOUS_RULES: NonAqueousReactionRule[] = [
  {
    id: 'flask_fumee_nh3_hcl',
    nameFr: 'Fumée blanche (NH₃ + HCl gazeux)',
    category: 'acid_base',
    equilibriumLabel: 'Phase gazeuse · Totale',
    observationsFr:
      'Formation instantanée d’une fumée blanche de cristaux de chlorure d’ammonium NH₄Cl(s).',
    priority: 100,
    reactants: [
      { id: 'nh3', stoich: 1, formula: 'NH₃', nameFr: 'Ammoniac', state: 'gas' },
      { id: 'hcl', stoich: 1, formula: 'HCl', nameFr: 'Chlorure d’hydrogène', state: 'gas' },
    ],
    products: [
      { id: 'nh4cl', stoich: 1, formula: 'NH₄Cl', nameFr: 'Chlorure d’ammonium', state: 'solid', colorHex: '#f4f4f5', molarMass: 53.49 },
    ],
  },
  {
    id: 'flask_synthese_eau_h2_o2',
    nameFr: 'Synthèse de l’eau (combustion de H₂)',
    category: 'combustion',
    equilibriumLabel: 'Exothermique',
    observationsFr: 'Combustion vive du dihydrogène produisant de l’eau liquide.',
    priority: 98,
    reactants: [
      { id: 'h2', stoich: 2, formula: 'H₂', nameFr: 'Dihydrogène', state: 'gas' },
      { id: 'o2', stoich: 1, formula: 'O₂', nameFr: 'Dioxygène', state: 'gas' },
    ],
    products: [
      { id: 'h2o', stoich: 2, formula: 'H₂O', nameFr: 'Eau', state: 'liquid', colorHex: '#bae6fd', molarMass: 18.015 },
    ],
  },
  {
    id: 'flask_haber_bosch',
    nameFr: 'Synthèse de l’ammoniac (Haber-Bosch)',
    category: 'synthesis',
    equilibriumLabel: 'Équilibre gazeux',
    observationsFr: 'Synthèse directe de l’ammoniac gazeux à partir de diazote et de dihydrogène.',
    arrow: '⇌',
    priority: 90,
    reactants: [
      { id: 'n2', stoich: 1, formula: 'N₂', nameFr: 'Diazote', state: 'gas' },
      { id: 'h2', stoich: 3, formula: 'H₂', nameFr: 'Dihydrogène', state: 'gas' },
    ],
    products: [
      { id: 'nh3', stoich: 2, formula: 'NH₃', nameFr: 'Ammoniac', state: 'gas', molarMass: 17.03 },
    ],
  },
  {
    id: 'flask_esterification_ethyle',
    nameFr: 'Estérification de Fischer (éthanoate d’éthyle)',
    category: 'organic',
    equilibriumLabel: 'K ≈ 4 (rendement 67 %)',
    observationsFr: 'Formation d’éthanoate d’éthyle à l’odeur fruitée caractéristique et d’eau.',
    arrow: '⇌',
    allowWithWater: true,
    priority: 92,
    reactants: [
      { id: 'ch3cooh', stoich: 1, formula: 'CH₃COOH', nameFr: 'Acide éthanoïque', state: 'liquid' },
      { id: 'c2h6o', stoich: 1, formula: 'C₂H₅OH', nameFr: 'Éthanol', state: 'liquid' },
    ],
    products: [
      { id: 'c4h8o2', stoich: 1, formula: 'CH₃COOC₂H₅', nameFr: 'Acétate d’éthyle', state: 'liquid', molarMass: 88.11 },
      { id: 'h2o', stoich: 1, formula: 'H₂O', nameFr: 'Eau', state: 'liquid', molarMass: 18.015 },
    ],
  },
  {
    id: 'flask_synthese_fes',
    nameFr: 'Synthèse du sulfure de fer(II)',
    category: 'synthesis',
    equilibriumLabel: 'Voie sèche · Exothermique',
    observationsFr: 'Incandescence formant un solide gris-noir de sulfure de fer(II) FeS(s).',
    priority: 94,
    reactants: [
      { id: 'fe_solid', stoich: 8, formula: 'Fe', nameFr: 'Fer métallique', state: 'solid' },
      { id: 's8', stoich: 1, formula: 'S₈', nameFr: 'Octasoufre', state: 'solid' },
    ],
    products: [
      { id: 'fes', stoich: 8, formula: 'FeS', nameFr: 'Sulfure de fer(II)', state: 'solid', colorHex: '#3f3f46', molarMass: 87.91 },
    ],
  },
  {
    id: 'flask_synthese_fes_simple',
    nameFr: 'Synthèse du sulfure de fer(II)',
    category: 'synthesis',
    equilibriumLabel: 'Voie sèche · Exothermique',
    observationsFr: 'Incandescence formant un solide gris-noir de sulfure de fer(II) FeS(s).',
    priority: 94,
    reactants: [
      { id: 'fe_solid', stoich: 1, formula: 'Fe', nameFr: 'Fer métallique', state: 'solid' },
      { id: 's_solid', stoich: 1, formula: 'S', nameFr: 'Soufre solide', state: 'solid' },
    ],
    products: [
      { id: 'fes', stoich: 1, formula: 'FeS', nameFr: 'Sulfure de fer(II)', state: 'solid', colorHex: '#3f3f46', molarMass: 87.91 },
    ],
  },
  {
    id: 'flask_aluminothermie',
    nameFr: 'Aluminothermie (réaction thermite)',
    category: 'redox',
    equilibriumLabel: 'Voie sèche · Très exothermique',
    observationsFr: 'Réduction de l’oxyde de fer(III) par l’aluminium avec formation de fer métallique.',
    priority: 95,
    reactants: [
      { id: 'al_solid', stoich: 2, formula: 'Al', nameFr: 'Aluminium métallique', state: 'solid' },
      { id: 'fe2o3', stoich: 1, formula: 'Fe₂O₃', nameFr: 'Oxyde de fer(III)', state: 'solid' },
    ],
    products: [
      { id: 'fe_solid', stoich: 2, formula: 'Fe', nameFr: 'Fer métallique', state: 'solid', colorHex: '#71717a', molarMass: 55.85 },
      { id: 'al2o3', stoich: 1, formula: 'Al₂O₃', nameFr: 'Oxyde d’aluminium', state: 'solid', colorHex: '#f4f4f5', molarMass: 101.96 },
    ],
  },
  {
    id: 'flask_reduction_cuo_carbone',
    nameFr: 'Réduction de l’oxyde de cuivre(II) par le carbone',
    category: 'redox',
    equilibriumLabel: 'Voie sèche · Dégagement CO₂(g)',
    observationsFr: 'La poudre noire de CuO laisse place à du cuivre rouge-brun Cu(s) avec dégagement de CO₂.',
    priority: 93,
    reactants: [
      { id: 'cuo', stoich: 2, formula: 'CuO', nameFr: 'Oxyde de cuivre(II)', state: 'solid' },
      { id: 'c_solid', stoich: 1, formula: 'C', nameFr: 'Carbone', state: 'solid' },
    ],
    products: [
      { id: 'cu_solid', stoich: 2, formula: 'Cu', nameFr: 'Cuivre métallique', state: 'solid', colorHex: '#d97706', molarMass: 63.55 },
      { id: 'co2', stoich: 1, formula: 'CO₂', nameFr: 'Dioxyde de carbone', state: 'gas', molarMass: 44.01 },
    ],
  },
  {
    id: 'flask_combustion_carbone',
    nameFr: 'Combustion du carbone',
    category: 'combustion',
    equilibriumLabel: 'Exothermique · CO₂(g)',
    observationsFr: 'Incandescence vive du carbone dans le dioxygène produisant du CO₂(g).',
    priority: 94,
    reactants: [
      { id: 'c_solid', stoich: 1, formula: 'C', nameFr: 'Carbone', state: 'solid' },
      { id: 'o2', stoich: 1, formula: 'O₂', nameFr: 'Dioxygène', state: 'gas' },
    ],
    products: [
      { id: 'co2', stoich: 1, formula: 'CO₂', nameFr: 'Dioxyde de carbone', state: 'gas', molarMass: 44.01 },
    ],
  },
  {
    id: 'flask_combustion_magnesium',
    nameFr: 'Combustion vive du magnésium',
    category: 'combustion',
    equilibriumLabel: 'Flamme blanche · MgO(s)',
    observationsFr: 'Combustion éblouissante formant une poudre blanche d’oxyde de magnésium MgO(s).',
    priority: 96,
    reactants: [
      { id: 'mg_solid', stoich: 2, formula: 'Mg', nameFr: 'Magnésium métallique', state: 'solid' },
      { id: 'o2', stoich: 1, formula: 'O₂', nameFr: 'Dioxygène', state: 'gas' },
    ],
    products: [
      { id: 'mgo', stoich: 2, formula: 'MgO', nameFr: 'Oxyde de magnésium', state: 'solid', colorHex: '#f4f4f5', molarMass: 40.3 },
    ],
  },
  {
    id: 'flask_combustion_cuivre',
    nameFr: 'Oxydation du cuivre par le dioxygène',
    category: 'combustion',
    equilibriumLabel: 'Solide noir CuO(s)',
    observationsFr: 'Le cuivre rouge-brun noircit en formant de l’oxyde de cuivre(II) CuO(s).',
    priority: 89,
    reactants: [
      { id: 'cu_solid', stoich: 2, formula: 'Cu', nameFr: 'Cuivre métallique', state: 'solid' },
      { id: 'o2', stoich: 1, formula: 'O₂', nameFr: 'Dioxygène', state: 'gas' },
    ],
    products: [
      { id: 'cuo', stoich: 2, formula: 'CuO', nameFr: 'Oxyde de cuivre(II)', state: 'solid', colorHex: '#27272a', molarMass: 79.55 },
    ],
  },
  {
    id: 'flask_combustion_fer',
    nameFr: 'Combustion du fer dans le dioxygène',
    category: 'combustion',
    equilibriumLabel: 'Exothermique · Fe₂O₃(s)',
    observationsFr: 'Projection d’étincelles incandescentes et formation d’oxyde de fer.',
    priority: 90,
    reactants: [
      { id: 'fe_solid', stoich: 4, formula: 'Fe', nameFr: 'Fer métallique', state: 'solid' },
      { id: 'o2', stoich: 3, formula: 'O₂', nameFr: 'Dioxygène', state: 'gas' },
    ],
    products: [
      { id: 'fe2o3', stoich: 2, formula: 'Fe₂O₃', nameFr: 'Oxyde de fer(III)', state: 'solid', colorHex: '#9a3412', molarMass: 159.69 },
    ],
  },
  {
    id: 'flask_combustion_soufre',
    nameFr: 'Combustion du soufre dans le dioxygène',
    category: 'combustion',
    equilibriumLabel: 'Flamme bleue · SO₂(g)',
    observationsFr: 'Flamme bleue caractéristique avec dégagement irritant de dioxyde de soufre SO₂(g).',
    priority: 92,
    reactants: [
      { id: 's8', stoich: 1, formula: 'S₈', nameFr: 'Octasoufre', state: 'solid' },
      { id: 'o2', stoich: 8, formula: 'O₂', nameFr: 'Dioxygène', state: 'gas' },
    ],
    products: [
      { id: 'so2', stoich: 8, formula: 'SO₂', nameFr: 'Dioxyde de soufre', state: 'gas', molarMass: 64.07 },
    ],
  },
  {
    id: 'flask_combustion_soufre_simple',
    nameFr: 'Combustion du soufre dans le dioxygène',
    category: 'combustion',
    equilibriumLabel: 'Flamme bleue · SO₂(g)',
    observationsFr: 'Flamme bleue caractéristique avec dégagement irritant de dioxyde de soufre SO₂(g).',
    priority: 92,
    reactants: [
      { id: 's_solid', stoich: 1, formula: 'S', nameFr: 'Soufre solide', state: 'solid' },
      { id: 'o2', stoich: 1, formula: 'O₂', nameFr: 'Dioxygène', state: 'gas' },
    ],
    products: [
      { id: 'so2', stoich: 1, formula: 'SO₂', nameFr: 'Dioxyde de soufre', state: 'gas', molarMass: 64.07 },
    ],
  },
  {
    id: 'flask_synthese_nacl_chlore',
    nameFr: 'Combustion du sodium dans le dichlore',
    category: 'redox',
    equilibriumLabel: 'Flamme jaune · NaCl(s)',
    observationsFr: 'Réaction très vive formant une fumée blanche de cristaux de chlorure de sodium NaCl(s).',
    priority: 96,
    reactants: [
      { id: 'na_solid', stoich: 2, formula: 'Na', nameFr: 'Sodium métallique', state: 'solid' },
      { id: 'cl2', stoich: 1, formula: 'Cl₂', nameFr: 'Dichlore', state: 'gas' },
    ],
    products: [
      { id: 'nacl', stoich: 2, formula: 'NaCl', nameFr: 'Chlorure de sodium', state: 'solid', colorHex: '#f4f4f5', molarMass: 58.44 },
    ],
  },
  {
    id: 'flask_synthese_fecl3_chlore',
    nameFr: 'Combustion du fer dans le dichlore',
    category: 'redox',
    equilibriumLabel: 'Fumées rousses · FeCl₃(s)',
    observationsFr: 'Incandescence et formation d’une fumée brun-roux de chlorure de fer(III) FeCl₃(s).',
    priority: 95,
    reactants: [
      { id: 'fe_solid', stoich: 2, formula: 'Fe', nameFr: 'Fer métallique', state: 'solid' },
      { id: 'cl2', stoich: 3, formula: 'Cl₂', nameFr: 'Dichlore', state: 'gas' },
    ],
    products: [
      { id: 'fecl3', stoich: 2, formula: 'FeCl₃', nameFr: 'Chlorure de fer(III)', state: 'solid', colorHex: '#b45309', molarMass: 162.2 },
    ],
  },
  {
    id: 'flask_synthese_cucl2_chlore',
    nameFr: 'Combustion du cuivre dans le dichlore',
    category: 'redox',
    equilibriumLabel: 'Voie sèche · CuCl₂(s)',
    observationsFr: 'Formation de fumées jaunâtres de chlorure de cuivre(II) anhydre.',
    priority: 93,
    reactants: [
      { id: 'cu_solid', stoich: 1, formula: 'Cu', nameFr: 'Cuivre métallique', state: 'solid' },
      { id: 'cl2', stoich: 1, formula: 'Cl₂', nameFr: 'Dichlore', state: 'gas' },
    ],
    products: [
      { id: 'cucl2', stoich: 1, formula: 'CuCl₂', nameFr: 'Chlorure de cuivre(II)', state: 'solid', colorHex: '#a16207', molarMass: 134.45 },
    ],
  },
  {
    id: 'flask_synthese_hcl_gaz',
    nameFr: 'Synthèse photochimique du chlorure d’hydrogène',
    category: 'synthesis',
    equilibriumLabel: 'Phase gazeuse · HCl(g)',
    observationsFr: 'Réaction explosive à la lumière formant du chlorure d’hydrogène gazeux.',
    priority: 94,
    reactants: [
      { id: 'h2', stoich: 1, formula: 'H₂', nameFr: 'Dihydrogène', state: 'gas' },
      { id: 'cl2', stoich: 1, formula: 'Cl₂', nameFr: 'Dichlore', state: 'gas' },
    ],
    products: [
      { id: 'hcl', stoich: 2, formula: 'HCl', nameFr: 'Chlorure d’hydrogène', state: 'gas', molarMass: 36.46 },
    ],
  },
]

export function detectNonAqueousAndCombustionReactions(
  hasWater: boolean,
  inv: Map<string, InventoryEntry>,
  ctx: FlaskReactionDetectorContext,
  makeParticipant: MakeParticipantFn,
  addCandidate: AddCandidateFn,
): void {
  for (const rule of NON_AQUEOUS_RULES) {
    if (hasWater && !rule.allowWithWater) continue
    const allPresent = rule.reactants.every((r) => {
      const entry = inv.get(r.id)
      return Boolean(entry && entry.amountMol > 1e-7)
    })
    if (!allPresent) continue

    addCandidate(
      finalizeReaction(
        {
          id: rule.id,
          nameFr: rule.nameFr,
          category: rule.category,
          equilibriumLabel: rule.equilibriumLabel,
          observationsFr: rule.observationsFr,
          arrow: rule.arrow,
          priority: rule.priority,
        },
        rule.reactants.map((r) =>
          makeParticipant(r.id, r.stoich, {
            displayFormula: r.formula,
            nameFr: r.nameFr,
            state: r.state,
          }),
        ),
        rule.products.map((p) =>
          makeParticipant(p.id, p.stoich, {
            displayFormula: p.formula,
            nameFr: p.nameFr,
            state: p.state,
            colorHex: p.colorHex,
            molarMass: p.molarMass,
          }),
        ),
      ),
    )
  }

  // Automatic Complete Combustion Engine for organic fuels C_c H_h O_o + O2
  const o2Entry = inv.get('o2')
  if (!o2Entry || o2Entry.amountMol <= 1e-7) return

  for (const [spId, entry] of inv.entries()) {
    if (spId === 'o2' || spId === 'h2o' || spId === 'co2' || entry.amountMol <= 1e-7) {
      continue
    }
    const sp = ctx.getSpeciesById(spId)
    if (!sp || sp.charge !== 0) continue
    const keys = Object.keys(sp.composition)
    const onlyCHO =
      keys.length > 0 && keys.every((k) => k === 'C' || k === 'H' || k === 'O')
    const c = sp.composition.C ?? 0
    const h = sp.composition.H ?? 0
    const o = sp.composition.O ?? 0
    if (!onlyCHO || c < 1 || h < 1) continue

    const o2Num = 4 * c + h - 2 * o
    if (o2Num <= 0) continue
    let fuelCoeff = 4
    let o2Coeff = o2Num
    let co2Coeff = 4 * c
    let h2oCoeff = 2 * h
    const div = gcd(gcd(fuelCoeff, o2Coeff), gcd(co2Coeff, h2oCoeff))
    fuelCoeff /= div
    o2Coeff /= div
    co2Coeff /= div
    h2oCoeff /= div

    addCandidate(
      finalizeReaction(
        {
          id: `flask_combustion_${sp.id}`,
          nameFr: `Combustion complète ${formatDeNomFr(sp.nameFr)}`,
          category: 'combustion',
          equilibriumLabel: 'Exothermique · CO₂(g) + H₂O',
          observationsFr: `Combustion vive ${formatDeNomFr(sp.nameFr)} produisant du dioxyde de carbone et de l’eau.`,
          priority: 95,
        },
        [
          makeParticipant(sp.id, fuelCoeff, {
            displayFormula: sp.displayFormula,
            nameFr: sp.nameFr,
            state: entry.state,
          }),
          makeParticipant('o2', o2Coeff, {
            displayFormula: 'O₂',
            nameFr: 'Dioxygène',
            state: 'gas',
          }),
        ],
        [
          makeParticipant('co2', co2Coeff, {
            displayFormula: 'CO₂',
            nameFr: 'Dioxyde de carbone',
            state: 'gas',
            molarMass: 44.01,
          }),
          makeParticipant('h2o', h2oCoeff, {
            displayFormula: 'H₂O',
            nameFr: 'Eau',
            state: 'liquid',
            colorHex: '#bae6fd',
            molarMass: 18.015,
          }),
        ],
      ),
    )
  }
}
