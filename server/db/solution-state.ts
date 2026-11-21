import type {
  DissolvedSpeciesItem,
  FlaskSolutionState,
  SoluteSummaryItem,
  SpeciesKind,
  SpeciesRecord,
} from '../../shared/chemistry.ts'
import { solveExactPh } from '../../shared/ph-solver.ts'
import { buildSolutionSignatureKey } from '../data/types.ts'
import { detectFlaskReactions } from '../lib/flask-reactions.ts'
import { WATER_MOLAR_MASS, blendHexColors, roundTo } from '../lib/math-format.ts'
import { getReactionConstants, getSpeciesById } from './catalog.ts'
import { getDb } from './connection.ts'

interface RawRuleJoinRow {
  product_species_id: string
  stoichiometry: number
  state_in_solution: string
  display_formula: string
  name_fr: string
  kind: string
  charge: number
  molar_mass: number
  color_hex: string | null
  solution_color_hex: string | null
}

interface RawSolutionRow {
  id: string
  name_fr: string
  formula_label: string
  color_hex: string | null
  ph_estimate: number | null
}

const OPTICAL_STRENGTH: Record<string, number> = {
  mno4_minus: 22,
  cu_nh3_4_2plus: 9.0,
  cr2o7_2minus: 8,
  fe3_plus: 4.5,
  cu2_plus: 3.5,
  co2_plus: 3.0,
  cr3_plus: 3.2,
  ni2_plus: 2.5,
  fe2_plus: 1.8,
  cl2: 3.0,
  no2: 4.0,
  i2: 6.0,
}

export function getDefaultAmountMol(species: SpeciesRecord): number {
  if (species.isSolvent) return roundTo(50 / WATER_MOLAR_MASS, 4)
  if (species.standardState === 'liquid') return 0.05
  return 0.01
}

export function getLiquidDensity(species: SpeciesRecord): number | null {
  if (
    typeof species.densityGPerCm3 === 'number' &&
    Number.isFinite(species.densityGPerCm3) &&
    species.densityGPerCm3 > 0
  ) {
    return species.densityGPerCm3
  }
  const d = species.behaviors.densityGPerMl
  return typeof d === 'number' && Number.isFinite(d) && d > 0 ? d : null
}

const CURATED_SOLVER_IDS = new Set([
  'hcl',
  'hno3',
  'hbr',
  'hi',
  'hclo4',
  'h3o_plus',
  'h_plus',
  'h2so4',
  'naoh',
  'koh',
  'lioh',
  'caoh2',
  'baoh2',
  'oh_minus',
  'o2_minus',
  'ch3cooh',
  'ch3coona',
  'ch3coo_minus',
  'hcooh',
  'hf',
  'h3po4',
  'h2po4_minus',
  'hpo4_2minus',
  'po4_3minus',
  'h2co3',
  'nahco3',
  'hco3_minus',
  'na2co3',
  'k2co3',
  'co3_2minus',
  'nh3',
  'nh4cl',
  'nh4no3',
  'nh4_plus',
  'fecl3',
  'alcl3',
  'cuso4',
])

function computeQuantitativePh(
  dissolvedSpecies: DissolvedSpeciesItem[],
  soluteDetails: Array<{ species: SpeciesRecord; concentrationMolPerL: number }>,
  totalVolumeL: number,
  temperatureC: number,
): number {
  const solutesMol: Record<string, number> = {}
  const extraWeakSolutes: Array<{
    concentrationMolPerL: number
    phCharacter: 'acidic_weak' | 'basic_weak'
    pka: number
  }> = []

  let hasCuratedSolute = false
  for (const { species, concentrationMolPerL } of soluteDetails) {
    if (concentrationMolPerL <= 1e-12) continue
    if (CURATED_SOLVER_IDS.has(species.id)) {
      solutesMol[species.id] =
        (solutesMol[species.id] ?? 0) + concentrationMolPerL * totalVolumeL
      hasCuratedSolute = true
      continue
    }

    if (species.phCharacter === 'acidic_strong') {
      solutesMol.h3o_plus =
        (solutesMol.h3o_plus ?? 0) + concentrationMolPerL * totalVolumeL
    } else if (species.phCharacter === 'basic_strong') {
      solutesMol.oh_minus =
        (solutesMol.oh_minus ?? 0) + concentrationMolPerL * totalVolumeL
    } else if (
      species.phCharacter === 'acidic_weak' ||
      species.phCharacter === 'basic_weak'
    ) {
      const positivePkas = species.pkaValues.filter((v) => Number.isFinite(v) && v > 0 && v < 14)
      const rawPka =
        positivePkas.length > 0
          ? positivePkas[0]
          : typeof species.behaviors.pKa === 'number'
            ? species.behaviors.pKa
            : null
      const pka = rawPka ?? (species.phCharacter === 'acidic_weak' ? 5.0 : 9.25)
      extraWeakSolutes.push({
        concentrationMolPerL,
        phCharacter: species.phCharacter,
        pka,
      })
    }
  }

  // Fallback for direct ion-only states if no parent solute was recorded
  if (!hasCuratedSolute && extraWeakSolutes.length === 0) {
    for (const item of dissolvedSpecies) {
      if (item.amountMol <= 1e-12) continue
      if (CURATED_SOLVER_IDS.has(item.speciesId)) {
        solutesMol[item.speciesId] = (solutesMol[item.speciesId] ?? 0) + item.amountMol
      }
    }
  }

  return solveExactPh({
    solutesMol,
    totalVolumeL,
    temperatureC,
    extraWeakSolutes,
  })
}

function getTemperatureAdjustedSolubility(
  solute: SpeciesRecord,
  temperatureC: number,
): number | null {
  if (solute.solubilityByTempC) {
    const pts = Object.entries(solute.solubilityByTempC)
      .map(([tStr, val]) => [Number(tStr), val] as const)
      .filter(([t, v]) => Number.isFinite(t) && Number.isFinite(v))
      .sort((a, b) => a[0] - b[0])
    if (pts.length >= 2) {
      if (temperatureC <= pts[0][0]) return pts[0][1]
      if (temperatureC >= pts[pts.length - 1][0]) return pts[pts.length - 1][1]
      for (let i = 0; i < pts.length - 1; i++) {
        const [t0, s0] = pts[i]
        const [t1, s1] = pts[i + 1]
        if (temperatureC >= t0 && temperatureC <= t1) {
          const ratio = (temperatureC - t0) / (t1 - t0)
          return roundTo(s0 + (s1 - s0) * ratio, 4)
        }
      }
    }
  }

  if (solute.solubilityGPerL === null) return null
  const deltaT = temperatureC - 20
  if (Math.abs(deltaT) < 0.1) return solute.solubilityGPerL

  if (solute.standardState === 'gas') {
    return roundTo(solute.solubilityGPerL * Math.exp(-0.024 * deltaT), 4)
  }

  if (solute.standardState === 'solid') {
    let coeff = 0.012
    if (solute.id === 'nacl') coeff = 0.0014
    else if (solute.id === 'kno3') coeff = 0.032
    else if (solute.id === 'cuso4') coeff = 0.02
    else if (solute.id === 'k2cr2o7') coeff = 0.026
    else if (solute.id === 'c6h12o6' || solute.id === 'c12h22o11') coeff = 0.016
    else if (solute.id === 'caoh2') coeff = -0.008
    return roundTo(
      Math.max(0.001, solute.solubilityGPerL * Math.exp(coeff * deltaT)),
      4,
    )
  }

  return solute.solubilityGPerL
}

function computeAnhydrousState(
  cleanSolutes: Record<string, number>,
  soluteIds: string[],
): FlaskSolutionState {
  let liquidVolumeMl = 0
  let solidVolumeMl = 0
  let totalMassG = 0
  let hasUndissolvedSolid = false
  const sedimentColors: Array<{ hex: string; weight: number }> = []
  const liquidColors: Array<{ hex: string; weight: number }> = []
  const soluteSummaries: SoluteSummaryItem[] = []
  const dissolvedSpecies: DissolvedSpeciesItem[] = []

  for (const soluteId of soluteIds) {
    const addedMol = cleanSolutes[soluteId]
    const solute = getSpeciesById(soluteId)
    if (!solute) continue
    const addedMassG = addedMol * solute.molarMass
    totalMassG += addedMassG

    if (solute.standardState === 'solid') {
      hasUndissolvedSolid = true
      const density = solute.densityGPerCm3 ?? 2.5
      solidVolumeMl += addedMassG / Math.max(0.5, density)
      sedimentColors.push({
        hex: solute.colorHex ?? '#d4d4d8',
        weight: Math.max(0.01, addedMassG),
      })
      soluteSummaries.push({
        speciesId: solute.id,
        displayFormula: solute.displayFormula,
        nameFr: solute.nameFr,
        molarMass: solute.molarMass,
        addedMol: roundTo(addedMol, 6),
        addedMassG: roundTo(addedMassG, 4),
        dissolvedMol: 0,
        dissolvedMassG: 0,
        undissolvedMol: roundTo(addedMol, 6),
        undissolvedMassG: roundTo(addedMassG, 4),
        concentrationMolPerL: 0,
        massConcentrationGPerL: 0,
        solubilityGPerL: 0,
        saturationRatio: null,
        isSaturated: false,
        colorHex: solute.colorHex ?? null,
        isImmersedSolid: true,
      })
    } else if (solute.standardState === 'liquid') {
      const density = getLiquidDensity(solute) ?? 0.9
      const volMl = addedMassG / Math.max(0.4, density)
      liquidVolumeMl += volMl
      const liqHex = solute.colorHex ?? solute.solutionColorHex ?? '#e2e8f0'
      liquidColors.push({ hex: liqHex, weight: Math.max(0.1, volMl) })
      soluteSummaries.push({
        speciesId: solute.id,
        displayFormula: solute.displayFormula,
        nameFr: solute.nameFr,
        molarMass: solute.molarMass,
        addedMol: roundTo(addedMol, 6),
        addedMassG: roundTo(addedMassG, 4),
        dissolvedMol: roundTo(addedMol, 6),
        dissolvedMassG: roundTo(addedMassG, 4),
        undissolvedMol: 0,
        undissolvedMassG: 0,
        concentrationMolPerL: 0,
        massConcentrationGPerL: 0,
        solubilityGPerL: null,
        saturationRatio: null,
        isSaturated: false,
        colorHex: liqHex,
        isImmersedSolid: false,
      })
      dissolvedSpecies.push({
        speciesId: solute.id,
        displayFormula: solute.displayFormula,
        nameFr: solute.nameFr,
        kind: solute.kind,
        charge: solute.charge,
        state: 'aqueous',
        amountMol: roundTo(addedMol, 6),
        concentrationMolPerL: 0,
        massConcentrationGPerL: 0,
        colorHex: liqHex,
      })
    } else {
      const gasHex = solute.colorHex ?? solute.solutionColorHex ?? null
      if (gasHex && gasHex !== '#f4f4f5' && gasHex !== '#e4e4e7') {
        liquidColors.push({ hex: gasHex, weight: 0.35 })
      }
      soluteSummaries.push({
        speciesId: solute.id,
        displayFormula: solute.displayFormula,
        nameFr: solute.nameFr,
        molarMass: solute.molarMass,
        addedMol: roundTo(addedMol, 6),
        addedMassG: roundTo(addedMassG, 4),
        dissolvedMol: roundTo(addedMol, 6),
        dissolvedMassG: roundTo(addedMassG, 4),
        undissolvedMol: 0,
        undissolvedMassG: 0,
        concentrationMolPerL: 0,
        massConcentrationGPerL: 0,
        solubilityGPerL: null,
        saturationRatio: null,
        isSaturated: false,
        colorHex: gasHex,
        isImmersedSolid: false,
      })
      dissolvedSpecies.push({
        speciesId: solute.id,
        displayFormula: solute.displayFormula,
        nameFr: solute.nameFr,
        kind: solute.kind,
        charge: solute.charge,
        state: 'gas',
        amountMol: roundTo(addedMol, 6),
        concentrationMolPerL: 0,
        massConcentrationGPerL: 0,
        colorHex: gasHex,
      })
    }
  }

  const totalVolumeMl = roundTo(liquidVolumeMl + solidVolumeMl, 2)
  const totalVolumeL = Math.max(0.05, totalVolumeMl / 1000)
  for (const d of dissolvedSpecies) {
    d.concentrationMolPerL = roundTo(d.amountMol / totalVolumeL, 5)
  }

  const allGases =
    soluteSummaries.length > 0 &&
    dissolvedSpecies.length === soluteSummaries.length &&
    dissolvedSpecies.every((d) => d.state === 'gas')
  const allSolids =
    soluteSummaries.length > 0 && soluteSummaries.every((s) => s.isImmersedSolid)
  const formulas = soluteSummaries.map((s) => s.displayFormula)
  const labelFr =
    soluteSummaries.length === 1
      ? soluteSummaries[0].nameFr
      : allGases
        ? `Mélange gazeux (${formulas.join(' + ')})`
        : allSolids
          ? `Mélange solide (${formulas.join(' + ')})`
          : `Mélange anhydre (${formulas.join(' + ')})`
  const blendedLiq = blendHexColors(liquidColors)
  const liquidColorHex = liquidVolumeMl > 0 ? blendedLiq ?? '#e2e8f0' : blendedLiq
  const liquidOpacity = liquidVolumeMl > 0 ? 0.3 : blendedLiq ? 0.16 : 0
  const sedimentColorHex = hasUndissolvedSolid
    ? blendHexColors(sedimentColors) ?? '#d4d4d8'
    : null

  const constants = getReactionConstants()
  const availableReactions = detectFlaskReactions(
    0,
    totalVolumeL,
    dissolvedSpecies,
    soluteSummaries,
    {
      redoxCouples: constants.redoxCouples,
      solubilityProducts: constants.solubilityProducts,
      acidBaseCouples: constants.acidBaseCouples,
      getSpeciesById,
    },
  )

  return {
    hasWater: false,
    waterVolumeMl: 0,
    waterMol: 0,
    totalVolumeMl,
    totalMassG: roundTo(totalMassG, 3),
    solutesMol: cleanSolutes,
    solutes: soluteSummaries,
    hasUndissolvedSolid,
    sedimentColorHex,
    recognizedSolutionId: null,
    labelFr,
    formulaLabel: formulas.join(' + '),
    liquidColorHex,
    liquidOpacity,
    dissolvedSpecies,
    phEstimate: null,
    activeReaction: availableReactions[0] ?? null,
    availableReactions,
  }
}

export function computeSolutionState(
  waterVolumeMl: number,
  solutesMol: Record<string, number>,
  temperatureC = 20,
): FlaskSolutionState {
  const cleanWaterMl = Math.max(0, roundTo(waterVolumeMl, 2))
  const cleanSolutes: Record<string, number> = {}
  for (const [id, mol] of Object.entries(solutesMol)) {
    if (Number.isFinite(mol) && mol > 1e-9) cleanSolutes[id] = roundTo(mol, 6)
  }
  const soluteIds = Object.keys(cleanSolutes)

  if (cleanWaterMl <= 0 && soluteIds.length === 0) {
    return {
      hasWater: false,
      waterVolumeMl: 0,
      waterMol: 0,
      totalVolumeMl: 0,
      totalMassG: 0,
      solutesMol: {},
      solutes: [],
      hasUndissolvedSolid: false,
      recognizedSolutionId: null,
      labelFr: 'Vide',
      formulaLabel: '',
      liquidColorHex: null,
      liquidOpacity: 0,
      dissolvedSpecies: [],
      phEstimate: null,
    }
  }

  if (cleanWaterMl <= 0) {
    return computeAnhydrousState(cleanSolutes, soluteIds)
  }

  const waterMol = roundTo(cleanWaterMl / WATER_MOLAR_MASS, 4)

  if (soluteIds.length === 0) {
    return {
      hasWater: true,
      waterVolumeMl: cleanWaterMl,
      waterMol,
      totalVolumeMl: cleanWaterMl,
      totalMassG: cleanWaterMl,
      solutesMol: {},
      solutes: [],
      hasUndissolvedSolid: false,
      recognizedSolutionId: null,
      labelFr: 'Eau distillée',
      formulaLabel: 'H₂O(l)',
      liquidColorHex: '#bae6fd',
      liquidOpacity: 0.24,
      dissolvedSpecies: [],
      phEstimate: 7.0,
    }
  }

  const db = getDb()
  const sig = buildSolutionSignatureKey(soluteIds)
  const matchedSolution = db
    .prepare(
      'SELECT id, name_fr, formula_label, color_hex, ph_estimate FROM solutions WHERE signature_key = ?',
    )
    .get(sig) as unknown as RawSolutionRow | undefined

  const ruleQuery = db.prepare(`
    SELECT
      r.product_species_id,
      r.stoichiometry,
      r.state_in_solution,
      s.display_formula,
      s.name_fr,
      s.kind,
      s.charge,
      s.molar_mass,
      s.color_hex,
      s.solution_color_hex
    FROM dissolution_rules r
    JOIN species s ON s.id = r.product_species_id
    WHERE r.solute_id = ? AND r.solvent_id = 'h2o'
  `)

  let liquidSoluteMl = 0
  let solutesMassG = 0
  const loadedSolutes: Array<{ species: SpeciesRecord; addedMol: number }> = []

  for (const soluteId of soluteIds) {
    const addedMol = cleanSolutes[soluteId]
    let solute = getSpeciesById(soluteId)
    if (!solute && soluteId.startsWith('precip_')) {
      const ksId = soluteId.slice('precip_'.length)
      const ks = getReactionConstants().solubilityProducts.find(
        (item) => item.id === ksId,
      )
      if (ks) {
        const catSp = ks.cationSpeciesId ? getSpeciesById(ks.cationSpeciesId) : null
        const anSp = ks.anionSpeciesId ? getSpeciesById(ks.anionSpeciesId) : null
        const estMass =
          (catSp?.molarMass ?? 50) * ks.cationStoich +
          (anSp?.molarMass ?? 50) * ks.anionStoich
        solute = {
          id: soluteId,
          formula: ks.solidFormula,
          displayFormula: ks.solidFormula,
          nameFr: ks.solidNameFr,
          iupacName: null,
          casNumber: null,
          kind: 'ionic_compound',
          charge: 0,
          molarMass: roundTo(estMass, 2),
          standardState: 'solid',
          meltingPointC: null,
          boilingPointC: null,
          thermalNote: null,
          densityGPerCm3: 3.5,
          appearanceFr: `Précipité ${ks.precipitateColorFr.toLowerCase()}`,
          colorHex: ks.precipitateColorHex ?? '#f4f4f5',
          composition: {},
          compositionKey: null,
          isSolvent: false,
          canDissolveInWater: false,
          solubilityGPerL: 0,
          solubilityByTempC: null,
          dissolutionType: 'none',
          solutionColorHex: null,
          phCharacter: 'neutral',
          pkaValues: [],
          ghsPictograms: [],
          ghsSignalWord: null,
          source: 'curated',
          popularity: 0,
          smiles: null,
          inchikey: null,
          pubchemCid: null,
          families: ['Précipité'],
          lewis: null,
          behaviors: {},
        }
      }
    }
    if (!solute) continue
    loadedSolutes.push({ species: solute, addedMol })
    const massG = addedMol * solute.molarMass
    solutesMassG += massG
    if (solute.standardState === 'liquid') {
      const density = getLiquidDensity(solute) ?? 1.0
      liquidSoluteMl += massG / density
    }
  }

  const totalVolumeMl = roundTo(cleanWaterMl + liquidSoluteMl, 2)
  const totalVolumeL = totalVolumeMl / 1000
  const waterVolumeL = cleanWaterMl / 1000
  const totalMassG = roundTo(cleanWaterMl + solutesMassG, 3)

  const dissolvedMap = new Map<
    string,
    {
      speciesId: string
      displayFormula: string
      nameFr: string
      kind: SpeciesKind
      charge: number
      molarMass: number
      state: 'aqueous' | 'precipitate' | 'gas'
      amountMol: number
      colorHex: string | null
    }
  >()
  const soluteSummaries: SoluteSummaryItem[] = []
  const phSoluteInputs: Array<{ species: SpeciesRecord; concentrationMolPerL: number }> = []
  const colorSamples: Array<{ hex: string; weight: number }> = []
  let absorbanceProxy = 0
  let hasUndissolvedSolid = false
  const sedimentColors: Array<{ hex: string; weight: number }> = []

  for (const { species: solute, addedMol } of loadedSolutes) {
    const addedMassG = addedMol * solute.molarMass
    const isImmersedSolid = !solute.canDissolveInWater && solute.standardState === 'solid'
    let dissolvedMassG = isImmersedSolid ? 0 : addedMassG
    let undissolvedMassG = isImmersedSolid ? addedMassG : 0
    let saturationRatio: number | null = null
    let isSaturated = false

    const effectiveSolubility = isImmersedSolid
      ? 0
      : getTemperatureAdjustedSolubility(solute, temperatureC)

    if (isImmersedSolid) {
      hasUndissolvedSolid = true
      sedimentColors.push({
        hex: solute.colorHex ?? '#d4d4d8',
        weight: Math.max(0.01, addedMassG),
      })
    } else if (effectiveSolubility !== null && effectiveSolubility >= 0) {
      const maxMassG = effectiveSolubility * waterVolumeL
      if (maxMassG > 0) saturationRatio = roundTo(addedMassG / maxMassG, 4)
      if (addedMassG > maxMassG + 1e-6) {
        dissolvedMassG = maxMassG
        undissolvedMassG = addedMassG - maxMassG
        isSaturated = true
        if (solute.standardState === 'solid') {
          hasUndissolvedSolid = true
          sedimentColors.push({
            hex: solute.colorHex ?? '#f4f4f5',
            weight: Math.max(0.01, undissolvedMassG),
          })
        }
      } else if (maxMassG > 0 && addedMassG / maxMassG >= 0.999) {
        isSaturated = true
      }
    }

    const dissolvedMol = solute.molarMass > 0 ? dissolvedMassG / solute.molarMass : 0
    const undissolvedMol =
      solute.molarMass > 0 ? undissolvedMassG / solute.molarMass : 0
    const concentrationMolPerL = totalVolumeL > 0 ? dissolvedMol / totalVolumeL : 0
    const massConcentrationGPerL = totalVolumeL > 0 ? dissolvedMassG / totalVolumeL : 0

    soluteSummaries.push({
      speciesId: solute.id,
      displayFormula: solute.displayFormula,
      nameFr: solute.nameFr,
      molarMass: solute.molarMass,
      addedMol: roundTo(addedMol, 6),
      addedMassG: roundTo(addedMassG, 4),
      dissolvedMol: roundTo(dissolvedMol, 6),
      dissolvedMassG: roundTo(dissolvedMassG, 4),
      undissolvedMol: roundTo(undissolvedMol, 6),
      undissolvedMassG: roundTo(undissolvedMassG, 4),
      concentrationMolPerL: roundTo(concentrationMolPerL, 5),
      massConcentrationGPerL: roundTo(massConcentrationGPerL, 3),
      solubilityGPerL: effectiveSolubility,
      saturationRatio,
      isSaturated,
      colorHex: solute.colorHex ?? null,
      isImmersedSolid,
    })

    phSoluteInputs.push({ species: solute, concentrationMolPerL })

    if (solute.solutionColorHex && concentrationMolPerL > 0) {
      const strength = OPTICAL_STRENGTH[solute.id] ?? 3.0
      const weight = concentrationMolPerL * strength
      colorSamples.push({ hex: solute.solutionColorHex, weight })
      absorbanceProxy += weight
    }

    if (dissolvedMol <= 0) continue

    const rules = ruleQuery.all(solute.id) as unknown as RawRuleJoinRow[]
    if (rules.length > 0) {
      for (const r of rules) {
        const addMol = r.stoichiometry * dissolvedMol
        const existing = dissolvedMap.get(r.product_species_id)
        if (existing) {
          existing.amountMol += addMol
        } else {
          dissolvedMap.set(r.product_species_id, {
            speciesId: r.product_species_id,
            displayFormula: r.display_formula,
            nameFr: r.name_fr,
            kind: r.kind as SpeciesKind,
            charge: r.charge,
            molarMass: r.molar_mass,
            state: r.state_in_solution as 'aqueous' | 'precipitate' | 'gas',
            amountMol: addMol,
            colorHex: r.solution_color_hex ?? r.color_hex,
          })
        }
      }
    } else {
      const existing = dissolvedMap.get(solute.id)
      if (existing) {
        existing.amountMol += dissolvedMol
      } else {
        dissolvedMap.set(solute.id, {
          speciesId: solute.id,
          displayFormula: solute.displayFormula,
          nameFr: solute.nameFr,
          kind: solute.kind,
          charge: solute.charge,
          molarMass: solute.molarMass,
          state: 'aqueous',
          amountMol: dissolvedMol,
          colorHex: solute.solutionColorHex,
        })
      }
    }
  }

  const dissolvedSpecies: DissolvedSpeciesItem[] = [...dissolvedMap.values()]
    .map((item) => {
      const conc = totalVolumeL > 0 ? item.amountMol / totalVolumeL : 0
      const cm = conc * item.molarMass
      if (
        item.colorHex &&
        item.colorHex !== '#bae6fd' &&
        item.colorHex !== '#e0f2fe' &&
        colorSamples.length === 0
      ) {
        const strength = OPTICAL_STRENGTH[item.speciesId] ?? 2.8
        const weight = conc * strength
        colorSamples.push({ hex: item.colorHex, weight })
        absorbanceProxy += weight
      }
      return {
        speciesId: item.speciesId,
        displayFormula: item.displayFormula,
        nameFr: item.nameFr,
        kind: item.kind,
        charge: item.charge,
        state: item.state,
        amountMol: roundTo(item.amountMol, 6),
        concentrationMolPerL: roundTo(conc, 5),
        massConcentrationGPerL: roundTo(cm, 3),
        colorHex: item.colorHex,
      }
    })
    .sort((a, b) => {
      if (b.charge !== a.charge) return b.charge - a.charge
      return a.displayFormula.localeCompare(b.displayFormula)
    })

  const blendedColor = blendHexColors(colorSamples)
  const hasChromaticColor = Boolean(blendedColor)
  const liquidColorHex = matchedSolution?.color_hex ?? blendedColor ?? '#bae6fd'
  const liquidOpacity = hasChromaticColor
    ? roundTo(0.28 + 0.6 * (1 - Math.exp(-absorbanceProxy)), 3)
    : 0.28
  const phEstimate = computeQuantitativePh(
    dissolvedSpecies,
    phSoluteInputs,
    totalVolumeL,
    temperatureC,
  )

  const dynamicFormulaLabel =
    dissolvedSpecies.length === 1
      ? `${dissolvedSpecies[0].displayFormula}(aq)`
      : dissolvedSpecies.length > 1
        ? `(${dissolvedSpecies.map((d) => d.displayFormula).join(' + ')})(aq)`
        : 'H₂O(l)'

  const singleSolute = soluteIds.length === 1 ? getSpeciesById(soluteIds[0]) : null
  const immersedOnly =
    soluteSummaries.length > 0 && soluteSummaries.every((s) => s.isImmersedSolid)
  const fallbackLabel = immersedOnly
    ? `Eau + ${soluteSummaries.map((s) => `${s.displayFormula}(s)`).join(' + ')}`
    : singleSolute
      ? singleSolute.kind === 'ion'
        ? `Solution d’ions ${singleSolute.displayFormula}`
        : `Solution de ${singleSolute.nameFr.toLowerCase()}`
      : 'Mélange aqueux'

  const sedimentColorHex = hasUndissolvedSolid
    ? blendHexColors(sedimentColors) ?? '#e4e4e7'
    : null

  const constants = getReactionConstants()
  const availableReactions = detectFlaskReactions(
    waterMol,
    totalVolumeL,
    dissolvedSpecies,
    soluteSummaries,
    {
      redoxCouples: constants.redoxCouples,
      solubilityProducts: constants.solubilityProducts,
      acidBaseCouples: constants.acidBaseCouples,
      getSpeciesById,
    },
  )

  return {
    hasWater: true,
    waterVolumeMl: cleanWaterMl,
    waterMol,
    totalVolumeMl,
    totalMassG,
    solutesMol: cleanSolutes,
    solutes: soluteSummaries,
    hasUndissolvedSolid,
    sedimentColorHex,
    recognizedSolutionId: matchedSolution?.id ?? null,
    labelFr: matchedSolution?.name_fr ?? fallbackLabel,
    formulaLabel: matchedSolution?.formula_label ?? dynamicFormulaLabel,
    liquidColorHex,
    liquidOpacity,
    dissolvedSpecies,
    phEstimate,
    activeReaction: availableReactions[0] ?? null,
    availableReactions,
  }
}
