import type {
  AcidBaseCoupleRecord,
  CatalogReactionRecord,
  PredictedReactionItem,
  PredictReactionResponse,
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

function collectRoleIds(species: SpeciesRecord, getDissolvedIonIds: (id: string) => string[]): Set<string> {
  const ids = new Set<string>([species.id])
  for (const ionId of getDissolvedIonIds(species.id)) {
    ids.add(ionId)
  }
  return ids
}

export function predictReactionsBetween(
  speciesA: SpeciesRecord,
  speciesB: SpeciesRecord,
  ctx: ReactionEngineContext,
  speciesC?: SpeciesRecord | null,
): PredictReactionResponse {
  const reactions: PredictedReactionItem[] = []
  const seenEquations = new Set<string>()

  const rolesA = collectRoleIds(speciesA, ctx.getDissolvedIonIds)
  const rolesB = collectRoleIds(speciesB, ctx.getDissolvedIonIds)
  const rolesC = speciesC ? collectRoleIds(speciesC, ctx.getDissolvedIonIds) : new Set<string>()
  // Normalize bare H+ <-> H3O+
  for (const set of [rolesA, rolesB, rolesC]) {
    if (set.has('h_plus')) set.add('h3o_plus')
    if (set.has('h3o_plus')) set.add('h_plus')
  }
  const combinedRoles = new Set<string>([...rolesA, ...rolesB, ...rolesC])

  const pushUnique = (item: PredictedReactionItem) => {
    const key = item.equationDisplay.replace(/\s+/g, '')
    if (seenEquations.has(key)) return
    seenEquations.add(key)
    reactions.push(item)
  }

  // 1. Named curated reactions matching the selected species (or their dissociated ions)
  for (const rxn of ctx.curatedReactions) {
    const rIds = rxn.reactants.map((r) => r.speciesId)
    if (rIds.length < 2) continue
    const matchesA = rIds.some((id) => rolesA.has(id))
    const matchesB = rIds.some((id) => rolesB.has(id))
    const matchesC = !speciesC || rIds.some((id) => rolesC.has(id))
    const allCovered = rIds.every(
      (id) => combinedRoles.has(id) || id === 'h3o_plus' || id === 'h2o',
    )
    const distinctContribution =
      rIds.some((id) => rolesA.has(id) && !rolesB.has(id)) ||
      rIds.some((id) => rolesB.has(id) && !rolesA.has(id)) ||
      speciesA.id === speciesB.id
    if (matchesA && matchesB && matchesC && allCovered && distinctContribution) {
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
  }

  // 2. Precipitation (pKs) between ions brought by A, B (and C)
  for (const ks of ctx.solubilityProducts) {
    if (!ks.cationSpeciesId || !ks.anionSpeciesId) continue
    const hasCat = combinedRoles.has(ks.cationSpeciesId)
    const hasAn = combinedRoles.has(ks.anionSpeciesId)
    if (!hasCat || !hasAn) continue
    const bothFromSame =
      (rolesA.has(ks.cationSpeciesId) && rolesA.has(ks.anionSpeciesId) && !rolesB.has(ks.cationSpeciesId) && !rolesB.has(ks.anionSpeciesId)) ||
      (rolesB.has(ks.cationSpeciesId) && rolesB.has(ks.anionSpeciesId) && !rolesA.has(ks.cationSpeciesId) && !rolesA.has(ks.anionSpeciesId))
    if (bothFromSame) continue
    if (
      speciesA.id === ks.solidSpeciesId ||
      speciesB.id === ks.solidSpeciesId ||
      speciesC?.id === ks.solidSpeciesId
    )
      continue

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
      // Ensure acid and base come from at least two different reactant slots
      const acidInA = Boolean(ac.acidSpeciesId && rolesA.has(ac.acidSpeciesId))
      const baseInB = Boolean(bs.baseSpeciesId && rolesB.has(bs.baseSpeciesId))
      const acidInB = Boolean(ac.acidSpeciesId && rolesB.has(ac.acidSpeciesId))
      const baseInA = Boolean(bs.baseSpeciesId && rolesA.has(bs.baseSpeciesId))
      const involvesC = Boolean(
        speciesC &&
          ((ac.acidSpeciesId && rolesC.has(ac.acidSpeciesId)) ||
            (bs.baseSpeciesId && rolesC.has(bs.baseSpeciesId))),
      )
      if ((acidInA && baseInB) || (acidInB && baseInA) || involvesC) {
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
    const eq = `${acidC.acidFormula}(aq) + ${baseC.baseFormula}(aq) ${arrow} ${acidC.baseFormula}(aq) + ${baseC.acidFormula}(aq)`
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

  // 4. Redox (Gamma rule ΔE° = E°_ox - E°_red > 0.05 V)
  const speciesList = [speciesA, speciesB, ...(speciesC ? [speciesC] : [])]
  const oxCouples = ctx.redoxCouples.filter(
    (c) =>
      c.oxSpeciesId !== 'h2o' &&
      ((c.oxSpeciesId && combinedRoles.has(c.oxSpeciesId)) ||
        speciesList.some(
          (sp) => sp.kind === 'element_substance' && c.oxFormula === sp.displayFormula,
        )),
  )
  const redCouples = ctx.redoxCouples.filter(
    (c) =>
      c.id !== 'rx_cu1_cu' &&
      c.redSpeciesId !== 'h2o' &&
      ((c.redSpeciesId && combinedRoles.has(c.redSpeciesId)) ||
        speciesList.some(
          (sp) => sp.kind === 'element_substance' && c.redFormula === sp.displayFormula,
        )),
  )

  const redoxPairs: Array<[RedoxCoupleRecord, RedoxCoupleRecord]> = []
  for (const oxC of oxCouples) {
    for (const redC of redCouples) {
      if (oxC.id === redC.id || oxC.e0V - redC.e0V <= 0.05) continue
      if (oxC.oxSpeciesId && oxC.oxSpeciesId === redC.redSpeciesId && speciesA.id !== speciesB.id) continue
      redoxPairs.push([oxC, redC])
    }
  }

  redoxPairs.sort((p1, p2) => p2[0].e0V - p2[1].e0V - (p1[0].e0V - p1[1].e0V))
  for (const [oxC, redC] of redoxPairs.slice(0, 4)) {
    const nElec = lcm(oxC.electrons, redC.electrons)
    const mOx = nElec / oxC.electrons
    const mRed = nElec / redC.electrons

    const netHPlus = mOx * oxC.hPlus - mRed * redC.hPlus
    const netH2O = mOx * oxC.h2o - mRed * redC.h2o

    let oxCoeff = mOx * oxC.oxStoich
    let redCoeff = mRed * redC.redStoich
    let oxProdCoeff = mOx * oxC.redStoich
    let redProdCoeff = mRed * redC.oxStoich
    let hPlusCoeff = Math.abs(netHPlus)
    let h2oCoeff = Math.abs(netH2O)

    const allNums = [oxCoeff, redCoeff, oxProdCoeff, redProdCoeff]
    if (hPlusCoeff > 0) allNums.push(hPlusCoeff)
    if (h2oCoeff > 0) allNums.push(h2oCoeff)
    const div = allNums.reduce((acc, v) => gcd(acc, v), allNums[0] ?? 1)
    if (div > 1) {
      oxCoeff = Math.round(oxCoeff / div)
      redCoeff = Math.round(redCoeff / div)
      oxProdCoeff = Math.round(oxProdCoeff / div)
      redProdCoeff = Math.round(redProdCoeff / div)
      hPlusCoeff = Math.round(hPlusCoeff / div)
      h2oCoeff = Math.round(h2oCoeff / div)
    }

    const lhs: string[] = [
      coeff(oxCoeff, oxC.oxFormula),
      coeff(redCoeff, redC.redFormula),
    ]
    const rhs: string[] = [
      coeff(oxProdCoeff, oxC.redFormula),
      coeff(redProdCoeff, redC.oxFormula),
    ]

    if (netHPlus > 0) lhs.push(coeff(hPlusCoeff, 'H⁺'))
    else if (netHPlus < 0) rhs.push(coeff(hPlusCoeff, 'H⁺'))
    if (netH2O > 0) rhs.push(coeff(h2oCoeff, 'H₂O'))
    else if (netH2O < 0) lhs.push(coeff(h2oCoeff, 'H₂O'))

    const setupReactants: Array<{ speciesId: string; stoichiometry: number }> = []
    if (oxC.oxSpeciesId) {
      setupReactants.push({ speciesId: oxC.oxSpeciesId, stoichiometry: oxCoeff })
    }
    if (redC.redSpeciesId) {
      setupReactants.push({ speciesId: redC.redSpeciesId, stoichiometry: redCoeff })
    }
    if (netHPlus > 0 && oxC.oxSpeciesId !== 'h3o_plus') {
      setupReactants.push({ speciesId: 'h3o_plus', stoichiometry: hPlusCoeff })
    }

    const deltaE0 = oxC.e0V - redC.e0V
    const logK = (nElec * deltaE0) / 0.059
    const eq = `${lhs.join(' + ')} → ${rhs.join(' + ')}`
    pushUnique({
      category: 'redox',
      titleFr: `Oxydoréduction (${oxC.coupleLabel} / ${redC.coupleLabel})`,
      equationDisplay: eq,
      spontaneous: true,
      equilibriumLabel: `ΔE° = +${deltaE0.toFixed(2).replace('.', ',')} V · ${formatPowerOf10(logK)}`,
      observationsFr:
        netHPlus > 0
          ? 'Réaction spontanée selon la règle du gamma (milieu acide H⁺).'
          : 'Réaction spontanée selon la règle du gamma.',
      detailsFr: `E°(${oxC.coupleLabel}) = ${oxC.e0V.toFixed(2).replace('.', ',')} V > E°(${redC.coupleLabel}) = ${redC.e0V.toFixed(2).replace('.', ',')} V (${nElec} e⁻ échangés).`,
      setupReactants: setupReactants.length >= 2 ? setupReactants : undefined,
      setupMedium: 'aqueous',
    })
  }

  // 5. Complete combustion for organic C_xH_yO_z + O2
  const hasO2 = speciesList.some((s) => s.id === 'o2')
  const o2Pair = hasO2 ? speciesList.find((s) => s.id !== 'o2' && s.charge === 0) ?? null : null
  if (o2Pair && o2Pair.charge === 0) {
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
          observationsFr: 'Combustion vive avec formation de dioxyde de carbone et d’eau.',
          detailsFr: 'Équation stœchiométrique calculée automatiquement à partir de la composition atomique.',
          setupReactants: [
            { speciesId: o2Pair.id, stoichiometry: fuelCoeff },
            { speciesId: 'o2', stoichiometry: o2Coeff },
          ],
          setupMedium: 'gas',
        })
      }
    }
  }

  return {
    speciesA: {
      id: speciesA.id,
      displayFormula: speciesA.displayFormula,
      nameFr: speciesA.nameFr,
    },
    speciesB: {
      id: speciesB.id,
      displayFormula: speciesB.displayFormula,
      nameFr: speciesB.nameFr,
    },
    speciesC: speciesC
      ? {
          id: speciesC.id,
          displayFormula: speciesC.displayFormula,
          nameFr: speciesC.nameFr,
        }
      : null,
    reactions,
  }
}
