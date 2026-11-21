import type {
  FlaskReactionParticipant,
  SpeciesRecord,
} from '../../../shared/chemistry.ts'
import {
  type AddCandidateFn,
  type FlaskReactionDetectorContext,
  type InventoryEntry,
  type MakeParticipantFn,
  finalizeReaction,
  formatDeNomFr,
  gcd,
  lcm,
} from './helpers.ts'

const WATER_REACTIVE_METALS: Array<{
  metalId: string
  ionId: string
  ionFormula: string
  charge: number
  label: string
}> = [
  { metalId: 'na_solid', ionId: 'na_plus', ionFormula: 'Na⁺', charge: 1, label: 'sodium' },
  { metalId: 'k_solid', ionId: 'k_plus', ionFormula: 'K⁺', charge: 1, label: 'potassium' },
  { metalId: 'li_solid', ionId: 'li_plus', ionFormula: 'Li⁺', charge: 1, label: 'lithium' },
  { metalId: 'ca_solid', ionId: 'ca2_plus', ionFormula: 'Ca²⁺', charge: 2, label: 'calcium' },
]

export function detectAqueousAndSolutionReactions(
  hasWater: boolean,
  totalVolumeL: number,
  inv: Map<string, InventoryEntry>,
  ctx: FlaskReactionDetectorContext,
  makeParticipant: MakeParticipantFn,
  addCandidate: AddCandidateFn,
): void {
  const h3o = inv.get('h3o_plus')
  const oh = inv.get('oh_minus')

  // 1. Strong acid + strong base neutralization: H3O+ + OH- -> 2 H2O
  if (h3o && oh && h3o.amountMol > 1e-7 && oh.amountMol > 1e-7) {
    addCandidate(
      finalizeReaction(
        {
          id: 'flask_neutralisation_h3o_oh',
          nameFr: 'Neutralisation acide-base',
          category: 'acid_base',
          equilibriumLabel: 'K = 10¹⁴ (totale)',
          observationsFr: 'Neutralisation exothermique : le pH tend vers 7.',
          priority: 105,
        },
        [
          makeParticipant('h3o_plus', 1, { displayFormula: 'H₃O⁺', nameFr: 'Ion oxonium', state: 'aqueous' }),
          makeParticipant('oh_minus', 1, { displayFormula: 'OH⁻', nameFr: 'Ion hydroxyde', state: 'aqueous' }),
        ],
        [
          makeParticipant('h2o', 2, { displayFormula: 'H₂O', nameFr: 'Eau', state: 'liquid', molarMass: 18.015 }),
        ],
      ),
    )
  }

  // 2. Precipitations from solubility_products table (pKs)
  for (const ks of hasWater ? ctx.solubilityProducts : []) {
    if (!ks.cationSpeciesId || !ks.anionSpeciesId) continue
    const cat = inv.get(ks.cationSpeciesId)
    const an = inv.get(ks.anionSpeciesId)
    if (!cat || !an || cat.state !== 'aqueous' || an.state !== 'aqueous') continue
    if (cat.amountMol <= 1e-7 || an.amountMol <= 1e-7) continue

    const cCat = cat.amountMol / totalVolumeL
    const cAn = an.amountMol / totalVolumeL
    const qr = cCat ** ks.cationStoich * cAn ** ks.anionStoich
    if (qr <= ks.ks * 1.1) continue

    const solidId = ks.solidSpeciesId ?? `precip_${ks.id}`
    addCandidate(
      finalizeReaction(
        {
          id: `flask_precip_${ks.id}`,
          nameFr: `Précipitation ${formatDeNomFr(ks.solidNameFr)}`,
          category: 'precipitation',
          equilibriumLabel: `pKs = ${ks.pKs.toFixed(2).replace('.', ',')}`,
          observationsFr: `Formation d’un précipité ${ks.precipitateColorFr.toLowerCase()}.`,
          precipitateColorHex: ks.precipitateColorHex,
          priority: 92 + Math.min(8, ks.pKs * 0.2),
        },
        [
          makeParticipant(ks.cationSpeciesId, ks.cationStoich, {
            displayFormula: ks.cationFormula,
            nameFr: cat.nameFr,
            state: 'aqueous',
          }),
          makeParticipant(ks.anionSpeciesId, ks.anionStoich, {
            displayFormula: ks.anionFormula,
            nameFr: an.nameFr,
            state: 'aqueous',
          }),
        ],
        [
          makeParticipant(solidId, 1, {
            displayFormula: ks.solidFormula,
            nameFr: ks.solidNameFr,
            state: 'solid',
            colorHex: ks.precipitateColorHex ?? '#f4f4f5',
            molarMass:
              cat.molarMass * ks.cationStoich + an.molarMass * ks.anionStoich,
          }),
        ],
      ),
    )
  }

  // 3. Carbonate / bicarbonate + acid effervescence
  if (h3o && h3o.amountMol > 1e-7) {
    const caco3 = inv.get('caco3')
    if (caco3 && caco3.state === 'solid' && caco3.amountMol > 1e-7) {
      addCandidate(
        finalizeReaction(
          {
            id: 'flask_caco3_acide',
            nameFr: 'Attaque acide du carbonate de calcium',
            category: 'acid_base',
            equilibriumLabel: 'Dégagement CO₂(g)',
            observationsFr: 'Vive effervescence : dissolution du solide CaCO₃ et dégagement de CO₂.',
            priority: 90,
          },
          [
            makeParticipant('caco3', 1, { displayFormula: 'CaCO₃', nameFr: 'Carbonate de calcium', state: 'solid', colorHex: '#f4f4f5' }),
            makeParticipant('h3o_plus', 2, { displayFormula: 'H₃O⁺', nameFr: 'Ion oxonium', state: 'aqueous' }),
          ],
          [
            makeParticipant('ca2_plus', 1, { displayFormula: 'Ca²⁺', nameFr: 'Ion calcium', state: 'aqueous' }),
            makeParticipant('co2', 1, { displayFormula: 'CO₂', nameFr: 'Dioxyde de carbone', state: 'gas', molarMass: 44.01 }),
            makeParticipant('h2o', 3, { displayFormula: 'H₂O', nameFr: 'Eau', state: 'liquid', molarMass: 18.015 }),
          ],
        ),
      )
    }

    const co3 = inv.get('co3_2minus')
    if (co3 && co3.amountMol > 1e-7) {
      addCandidate(
        finalizeReaction(
          {
            id: 'flask_co3_acide',
            nameFr: 'Effervescence des ions carbonate',
            category: 'acid_base',
            equilibriumLabel: 'Dégagement CO₂(g)',
            observationsFr: 'Vive effervescence avec dégagement de dioxyde de carbone.',
            priority: 89,
          },
          [
            makeParticipant('co3_2minus', 1, { displayFormula: 'CO₃²⁻', nameFr: 'Ion carbonate', state: 'aqueous' }),
            makeParticipant('h3o_plus', 2, { displayFormula: 'H₃O⁺', nameFr: 'Ion oxonium', state: 'aqueous' }),
          ],
          [
            makeParticipant('co2', 1, { displayFormula: 'CO₂', nameFr: 'Dioxyde de carbone', state: 'gas', molarMass: 44.01 }),
            makeParticipant('h2o', 3, { displayFormula: 'H₂O', nameFr: 'Eau', state: 'liquid', molarMass: 18.015 }),
          ],
        ),
      )
    }

    const hco3 = inv.get('hco3_minus')
    if (hco3 && hco3.amountMol > 1e-7) {
      addCandidate(
        finalizeReaction(
          {
            id: 'flask_hco3_acide',
            nameFr: 'Réaction du bicarbonate avec un acide',
            category: 'acid_base',
            equilibriumLabel: 'Dégagement CO₂(g)',
            observationsFr: 'Effervescence immédiate avec bulles de CO₂.',
            priority: 88,
          },
          [
            makeParticipant('hco3_minus', 1, { displayFormula: 'HCO₃⁻', nameFr: 'Ion hydrogénocarbonate', state: 'aqueous' }),
            makeParticipant('h3o_plus', 1, { displayFormula: 'H₃O⁺', nameFr: 'Ion oxonium', state: 'aqueous' }),
          ],
          [
            makeParticipant('co2', 1, { displayFormula: 'CO₂', nameFr: 'Dioxyde de carbone', state: 'gas', molarMass: 44.01 }),
            makeParticipant('h2o', 2, { displayFormula: 'H₂O', nameFr: 'Eau', state: 'liquid', molarMass: 18.015 }),
          ],
        ),
      )
    }
  }

  // 4. Reactive alkali / alkaline-earth metals + water
  for (const wm of hasWater ? WATER_REACTIVE_METALS : []) {
    const mEntry = inv.get(wm.metalId)
    if (!mEntry || mEntry.amountMol <= 1e-7) continue
    const mStoich = wm.charge === 1 ? 2 : 1
    addCandidate(
      finalizeReaction(
        {
          id: `flask_water_${wm.metalId}`,
          nameFr: `Réaction du ${wm.label} avec l’eau`,
          category: 'redox',
          equilibriumLabel: 'Vive · Dégagement H₂(g)',
          observationsFr: 'Dégagement vif de dihydrogène H₂(g) et alcalinisation du milieu (ions OH⁻).',
          priority: 86,
        },
        [
          makeParticipant(wm.metalId, mStoich, { displayFormula: mEntry.displayFormula, nameFr: mEntry.nameFr, state: 'solid' }),
          makeParticipant('h2o', 2, { displayFormula: 'H₂O', nameFr: 'Eau', state: 'liquid', molarMass: 18.015 }),
        ],
        [
          makeParticipant(wm.ionId, mStoich, { displayFormula: wm.ionFormula, nameFr: `Ion ${wm.label}`, state: 'aqueous' }),
          makeParticipant('oh_minus', 2, { displayFormula: 'OH⁻', nameFr: 'Ion hydroxyde', state: 'aqueous' }),
          makeParticipant('h2', 1, { displayFormula: 'H₂', nameFr: 'Dihydrogène', state: 'gas', molarMass: 2.016 }),
        ],
      ),
    )
  }

  // 5. Aqueous redox reactions (Gamma rule ΔE° > 0.05 V)
  const activeOxCouples = hasWater
    ? ctx.redoxCouples.filter((c) => {
        if (!c.oxSpeciesId || !c.redSpeciesId || c.oxSpeciesId === 'h2o') return false
        const entry = inv.get(c.oxSpeciesId)
        return Boolean(entry && entry.amountMol > 1e-7)
      })
    : []
  const activeRedCouples = hasWater
    ? ctx.redoxCouples.filter((c) => {
        if (
          !c.oxSpeciesId ||
          !c.redSpeciesId ||
          c.redSpeciesId === 'h2o' ||
          c.redSpeciesId === 'h2' ||
          c.id === 'rx_cu1_cu'
        ) {
          return false
        }
        const entry = inv.get(c.redSpeciesId)
        return Boolean(entry && entry.amountMol > 1e-7)
      })
    : []

  const bestRedoxByPath = new Map<
    string,
    {
      oxC: (typeof activeOxCouples)[number]
      redC: (typeof activeRedCouples)[number]
      deltaE0: number
    }
  >()
  for (const oxC of activeOxCouples) {
    for (const redC of activeRedCouples) {
      if (oxC.id === redC.id) continue
      const deltaE0 = oxC.e0V - redC.e0V
      if (deltaE0 <= 0.05) continue
      const nElec = lcm(oxC.electrons, redC.electrons)
      const mOx = nElec / oxC.electrons
      const mRed = nElec / redC.electrons
      const netHPlus = mOx * oxC.hPlus - mRed * redC.hPlus
      if (netHPlus > 0 && (!h3o || h3o.amountMol <= 1e-7)) continue
      const pathKey = `${oxC.oxSpeciesId}:${oxC.redSpeciesId}:${redC.redSpeciesId}:${redC.oxSpeciesId}`
      const prev = bestRedoxByPath.get(pathKey)
      if (!prev || deltaE0 > prev.deltaE0) {
        bestRedoxByPath.set(pathKey, { oxC, redC, deltaE0 })
      }
    }
  }

  for (const { oxC, redC, deltaE0 } of bestRedoxByPath.values()) {
    const nElec = lcm(oxC.electrons, redC.electrons)
    const mOx = nElec / oxC.electrons
    const mRed = nElec / redC.electrons
    const netHPlus = mOx * oxC.hPlus - mRed * redC.hPlus
    const netH2O = mOx * oxC.h2o - mRed * redC.h2o

    const oxSp = ctx.getSpeciesById(oxC.oxSpeciesId!)
    const redSp = ctx.getSpeciesById(redC.redSpeciesId!)
    const oxProdSp = ctx.getSpeciesById(oxC.redSpeciesId!)
    const redProdSp = ctx.getSpeciesById(redC.oxSpeciesId!)

    const toState = (sp: SpeciesRecord | null): 'aqueous' | 'solid' | 'liquid' | 'gas' => {
      if (!sp) return 'aqueous'
      if (sp.id === 'h2o') return 'liquid'
      if (sp.kind === 'ion') return 'aqueous'
      if (sp.standardState === 'solid' && !sp.canDissolveInWater) return 'solid'
      if (sp.standardState === 'gas') return 'gas'
      return 'aqueous'
    }

    const reactants: FlaskReactionParticipant[] = [
      makeParticipant(oxC.oxSpeciesId!, mOx * oxC.oxStoich, {
        displayFormula: oxC.oxFormula,
        nameFr: oxSp?.nameFr ?? oxC.oxFormula,
        state: toState(oxSp),
      }),
      makeParticipant(redC.redSpeciesId!, mRed * redC.redStoich, {
        displayFormula: redC.redFormula,
        nameFr: redSp?.nameFr ?? redC.redFormula,
        state: toState(redSp),
      }),
    ]
    const products: FlaskReactionParticipant[] = [
      makeParticipant(oxC.redSpeciesId!, mOx * oxC.redStoich, {
        displayFormula: oxC.redFormula,
        nameFr: oxProdSp?.nameFr ?? oxC.redFormula,
        state: toState(oxProdSp),
      }),
      makeParticipant(redC.oxSpeciesId!, mRed * redC.oxStoich, {
        displayFormula: redC.oxFormula,
        nameFr: redProdSp?.nameFr ?? redC.oxFormula,
        state: toState(redProdSp),
      }),
    ]

    let extraH2O = netH2O
    if (oxC.oxSpeciesId === 'h3o_plus') extraH2O += mOx * oxC.oxStoich
    if (netHPlus > 0) {
      reactants.push(
        makeParticipant('h3o_plus', netHPlus, {
          displayFormula: 'H₃O⁺',
          nameFr: 'Ion oxonium',
          state: 'aqueous',
        }),
      )
      extraH2O += netHPlus
    }
    if (extraH2O > 0) {
      products.push(
        makeParticipant('h2o', extraH2O, {
          displayFormula: 'H₂O',
          nameFr: 'Eau',
          state: 'liquid',
          molarMass: 18.015,
        }),
      )
    }

    const allStoich = [...reactants, ...products].map((p) => p.stoichiometry)
    const commonDiv = allStoich.reduce((acc, n) => gcd(acc, n), allStoich[0] ?? 1)
    if (commonDiv > 1) {
      for (const r of reactants) r.stoichiometry = Math.round(r.stoichiometry / commonDiv)
      for (const p of products) p.stoichiometry = Math.round(p.stoichiometry / commonDiv)
    }

    let title = `Oxydoréduction (${oxC.coupleLabel} / ${redC.coupleLabel})`
    let obs = `Réaction spontanée selon la règle du gamma (ΔE° = +${deltaE0.toFixed(2).replace('.', ',')} V).`
    if (oxC.oxSpeciesId === 'ag_plus' && redC.redSpeciesId === 'cu_solid') {
      title = 'Arbre de Diane (Cu + Ag⁺)'
      obs = 'Dépôt métallique argenté d’Ag(s) et coloration bleue progressive de la solution (Cu²⁺).'
    } else if (oxC.oxSpeciesId === 'cu2_plus' && redC.redSpeciesId === 'zn_solid') {
      title = 'Réaction de la pile Daniell (Zn + Cu²⁺)'
      obs = 'Décoloration progressive de la solution bleue et dépôt rouge-brun de cuivre Cu(s).'
    } else if (oxC.oxSpeciesId === 'h3o_plus' && redSp?.kind === 'element_substance') {
      title = `Attaque acide (${redC.redFormula} + H₃O⁺)`
      obs = `Dissolution du métal ${redC.redFormula} avec dégagement de bulles de dihydrogène H₂(g).`
    } else if (oxC.oxSpeciesId === 'mno4_minus' && redC.redSpeciesId === 'fe2_plus') {
      title =
        oxC.redSpeciesId === 'mno2'
          ? 'Oxydation du fer(II) par MnO₄⁻ (→ MnO₂)'
          : 'Titrage permanganate / fer(II)'
      obs =
        oxC.redSpeciesId === 'mno2'
          ? 'Formation d’un précipité brun de MnO₂(s) et d’ions fer(III).'
          : 'Décoloration du violet intense (MnO₄⁻) au profit des ions fer(III) jaune-ambre.'
    } else if (oxC.oxSpeciesId === 'clo_minus' && redC.redSpeciesId === 'fe2_plus') {
      title =
        oxC.redSpeciesId === 'cl2'
          ? 'Oxydation du fer(II) par ClO⁻ (→ Cl₂)'
          : 'Oxydation du fer(II) par ClO⁻ (→ Cl⁻)'
      obs =
        oxC.redSpeciesId === 'cl2'
          ? 'Formation d’ions fer(III) jaune-ambre avec dégagement de dichlore Cl₂(g).'
          : 'Les ions hypochlorite oxydent Fe²⁺ en ions fer(III) jaune-ambre (Cl⁻ formé).'
    } else if (oxC.oxSpeciesId === 'clo_minus' && redC.redSpeciesId === 'cl_minus') {
      title = 'Médiamutation de l’eau de Javel (→ Cl₂)'
      obs = 'Dégagement toxique de dichlore Cl₂(g) en milieu acide.'
    } else if (oxC.oxSpeciesId === 'i2' && redC.redSpeciesId === 's2o3_2minus') {
      title = 'Titrage iodométrique (I₂ + S₂O₃²⁻)'
      obs = 'Décoloration complète de la solution de diiode.'
    }

    addCandidate(
      finalizeReaction(
        {
          id: `flask_redox_${oxC.id}_${redC.id}`,
          nameFr: title,
          category: 'redox',
          equilibriumLabel: `ΔE° = +${deltaE0.toFixed(2).replace('.', ',')} V`,
          observationsFr: obs,
          priority: 82 + Math.min(12, deltaE0 * 6),
        },
        reactants,
        products,
      ),
    )
  }

  // 6. Complexation: Eau céleste Cu²⁺ + 4 NH₃ -> [Cu(NH₃)₄]²⁺
  const cu2 = inv.get('cu2_plus')
  const nh3 = inv.get('nh3')
  if (cu2 && nh3 && cu2.amountMol > 1e-7 && nh3.amountMol > 1e-7) {
    addCandidate(
      finalizeReaction(
        {
          id: 'flask_complex_cu_nh3',
          nameFr: 'Complexation « eau céleste »',
          category: 'complexation',
          equilibriumLabel: 'log β₄ = 12,6',
          observationsFr: 'La solution bleu clair vire au bleu roi intense ([Cu(NH₃)₄]²⁺).',
          arrow: '⇌',
          priority: 84,
        },
        [
          makeParticipant('cu2_plus', 1, { displayFormula: 'Cu²⁺', nameFr: 'Ion cuivre(II)', state: 'aqueous', colorHex: '#0284c7' }),
          makeParticipant('nh3', 4, { displayFormula: 'NH₃', nameFr: 'Ammoniac', state: 'aqueous' }),
        ],
        [
          makeParticipant('cu_nh3_4_2plus', 1, {
            displayFormula: '[Cu(NH₃)₄]²⁺',
            nameFr: 'Ion tétraamminecuivre(II)',
            state: 'aqueous',
            colorHex: '#1d4ed8',
            molarMass: 131.67,
          }),
        ],
      ),
    )
  }

  // 7. Aqueous weak/strong acid-base transfers from acid_base_couples (ΔpKa > 1)
  const activeAcids = hasWater
    ? ctx.acidBaseCouples.filter(
        (c) =>
          c.acidSpeciesId &&
          c.baseSpeciesId &&
          c.acidSpeciesId !== 'h2o' &&
          c.acidSpeciesId !== 'h3o_plus' &&
          (inv.get(c.acidSpeciesId)?.amountMol ?? 0) > 1e-7,
      )
    : []
  const activeBases = hasWater
    ? ctx.acidBaseCouples.filter(
        (c) =>
          c.acidSpeciesId &&
          c.baseSpeciesId &&
          c.baseSpeciesId !== 'h2o' &&
          (inv.get(c.baseSpeciesId)?.amountMol ?? 0) > 1e-7,
      )
    : []

  for (const ac of activeAcids) {
    for (const bs of activeBases) {
      if (ac.id === bs.id) continue
      const deltaPka = bs.pKa - ac.pKa
      if (deltaPka < 1.0) continue
      const isTotal = deltaPka >= 3
      addCandidate(
        finalizeReaction(
          {
            id: `flask_ab_${ac.id}_${bs.id}`,
            nameFr: isTotal ? 'Réaction acide-base totale' : 'Équilibre acide-base',
            category: 'acid_base',
            equilibriumLabel: `ΔpKa = +${deltaPka.toFixed(1).replace('.', ',')}`,
            observationsFr: isTotal
              ? `Transfert quasi-total de proton de ${ac.acidFormula} vers ${bs.baseFormula}.`
              : `Transfert partiel de proton entre ${ac.acidFormula}/${ac.baseFormula} et ${bs.acidFormula}/${bs.baseFormula}.`,
            arrow: isTotal ? '→' : '⇌',
            priority: 76 + Math.min(10, deltaPka),
          },
          [
            makeParticipant(ac.acidSpeciesId!, 1, { displayFormula: ac.acidFormula, nameFr: ac.acidNameFr, state: 'aqueous' }),
            makeParticipant(bs.baseSpeciesId!, 1, { displayFormula: bs.baseFormula, nameFr: bs.baseFormula, state: 'aqueous' }),
          ],
          [
            makeParticipant(ac.baseSpeciesId!, 1, { displayFormula: ac.baseFormula, nameFr: ac.baseFormula, state: 'aqueous' }),
            makeParticipant(bs.acidSpeciesId!, 1, { displayFormula: bs.acidFormula, nameFr: bs.acidNameFr, state: 'aqueous' }),
          ],
        ),
      )
    }
  }

  // 8. Catalytic decomposition of H2O2
  const h2o2 = inv.get('h2o2')
  const hasCatalyst = inv.has('fe3_plus') || inv.has('mno2') || inv.has('i_minus')
  if (h2o2 && h2o2.amountMol > 1e-7 && (hasCatalyst || !hasWater)) {
    addCandidate(
      finalizeReaction(
        {
          id: 'flask_decomp_h2o2',
          nameFr: 'Dismutation de l’eau oxygénée',
          category: 'decomposition',
          equilibriumLabel: hasCatalyst ? 'Catalysée · O₂(g)' : 'Dégagement O₂(g)',
          observationsFr: 'Dégagement vigoureux de dioxygène O₂(g).',
          priority: 78,
        },
        [makeParticipant('h2o2', 2, { displayFormula: 'H₂O₂', nameFr: 'Peroxyde d’hydrogène', state: hasWater ? 'aqueous' : 'liquid' })],
        [
          makeParticipant('h2o', 2, { displayFormula: 'H₂O', nameFr: 'Eau', state: 'liquid', molarMass: 18.015 }),
          makeParticipant('o2', 1, { displayFormula: 'O₂', nameFr: 'Dioxygène', state: 'gas', molarMass: 31.998 }),
        ],
      ),
    )
  }

  // 9. Aqueous limewater carbonation
  const ca2 = inv.get('ca2_plus')
  const co2 = inv.get('co2')
  if (
    hasWater &&
    ca2 &&
    oh &&
    co2 &&
    ca2.amountMol > 1e-7 &&
    oh.amountMol > 1e-7 &&
    co2.amountMol > 1e-7
  ) {
    addCandidate(
      finalizeReaction(
        {
          id: 'flask_eau_de_chaux_co2',
          nameFr: 'Test à l’eau de chaux (détection du CO₂)',
          category: 'precipitation',
          equilibriumLabel: 'Trouble blanc CaCO₃(s)',
          observationsFr: 'L’eau de chaux limpide se trouble par précipitation blanche de carbonate de calcium.',
          precipitateColorHex: '#f4f4f5',
          priority: 95,
        },
        [
          makeParticipant('ca2_plus', 1, { displayFormula: 'Ca²⁺', nameFr: 'Ion calcium', state: 'aqueous' }),
          makeParticipant('oh_minus', 2, { displayFormula: 'OH⁻', nameFr: 'Ion hydroxyde', state: 'aqueous' }),
          makeParticipant('co2', 1, { displayFormula: 'CO₂', nameFr: 'Dioxyde de carbone', state: 'gas' }),
        ],
        [
          makeParticipant('caco3', 1, { displayFormula: 'CaCO₃', nameFr: 'Carbonate de calcium', state: 'solid', colorHex: '#f4f4f5', molarMass: 100.09 }),
          makeParticipant('h2o', 1, { displayFormula: 'H₂O', nameFr: 'Eau', state: 'liquid', molarMass: 18.015 }),
        ],
      ),
    )
  }
}
