import type { DissolvedSpeciesItem } from './chemistry.ts'

/**
 * Curated acid-base thermodynamic definitions for exact charge-balance pH solving.
 * Each weak family is represented by its total analytical concentration C_total
 * and its stepwise pKa values [pKa1, pKa2, ...] plus the net ionic charge
 * of the fully protonated form H_nA^(z0).
 */
interface AcidBaseFamilySpec {
  familyKey: string
  pkaList: number[]
  /** Charge of the fully protonated form H_nA */
  maxProtonatedCharge: number
  /** Charge of the species added as a solute (before dissociation) to compute spectator counterion charge */
  addedFormCharge: number
}

/**
 * Maps a solute or dissolved species ID to its exact acid-base contribution:
 * - strongNetH: net strong acid (+) or strong base (-) equivalents per mole
 *   (e.g. HCl -> +1, NaOH -> -1, H2SO4 -> +1 strong + HSO4- weak pKa=1.92, Ca(OH)2 -> -2)
 * - weakFamily: optional weak acid/base polyprotic family
 */
interface SpeciesAcidBaseEntry {
  strongNetH: number
  weakFamily?: AcidBaseFamilySpec
}

const ACETATE_FAMILY: Omit<AcidBaseFamilySpec, 'addedFormCharge'> = {
  familyKey: 'acetate',
  pkaList: [4.76],
  maxProtonatedCharge: 0,
}

const FORMATE_FAMILY: Omit<AcidBaseFamilySpec, 'addedFormCharge'> = {
  familyKey: 'formate',
  pkaList: [3.75],
  maxProtonatedCharge: 0,
}

const FLUORIDE_FAMILY: Omit<AcidBaseFamilySpec, 'addedFormCharge'> = {
  familyKey: 'fluoride',
  pkaList: [3.17],
  maxProtonatedCharge: 0,
}

const AMMONIUM_FAMILY: Omit<AcidBaseFamilySpec, 'addedFormCharge'> = {
  familyKey: 'ammonium',
  pkaList: [9.25],
  maxProtonatedCharge: 1,
}

const CARBONATE_FAMILY: Omit<AcidBaseFamilySpec, 'addedFormCharge'> = {
  familyKey: 'carbonate',
  pkaList: [6.35, 10.33],
  maxProtonatedCharge: 0,
}

const PHOSPHATE_FAMILY: Omit<AcidBaseFamilySpec, 'addedFormCharge'> = {
  familyKey: 'phosphate',
  pkaList: [2.15, 7.2, 12.35],
  maxProtonatedCharge: 0,
}

const SULFATE_HSO4_FAMILY: Omit<AcidBaseFamilySpec, 'addedFormCharge'> = {
  familyKey: 'bisulfate',
  pkaList: [1.92],
  maxProtonatedCharge: -1,
}

const FE3_AQUA_FAMILY: Omit<AcidBaseFamilySpec, 'addedFormCharge'> = {
  familyKey: 'fe3_aqua',
  pkaList: [2.2],
  maxProtonatedCharge: 3,
}

const AL3_AQUA_FAMILY: Omit<AcidBaseFamilySpec, 'addedFormCharge'> = {
  familyKey: 'al3_aqua',
  pkaList: [4.95],
  maxProtonatedCharge: 3,
}

const CU2_AQUA_FAMILY: Omit<AcidBaseFamilySpec, 'addedFormCharge'> = {
  familyKey: 'cu2_aqua',
  pkaList: [7.5],
  maxProtonatedCharge: 2,
}

const SPECIES_ACID_BASE: Record<string, SpeciesAcidBaseEntry> = {
  // Strong acids
  hcl: { strongNetH: 1 },
  hno3: { strongNetH: 1 },
  hbr: { strongNetH: 1 },
  hi: { strongNetH: 1 },
  hclo4: { strongNetH: 1 },
  h3o_plus: { strongNetH: 1 },
  h_plus: { strongNetH: 1 },
  h2so4: {
    strongNetH: 1,
    weakFamily: { ...SULFATE_HSO4_FAMILY, addedFormCharge: -1 },
  },

  // Strong bases
  naoh: { strongNetH: -1 },
  koh: { strongNetH: -1 },
  lioh: { strongNetH: -1 },
  caoh2: { strongNetH: -2 },
  baoh2: { strongNetH: -2 },
  oh_minus: { strongNetH: -1 },
  o2_minus: { strongNetH: -2 },

  // Weak acids & their salts
  ch3cooh: {
    strongNetH: 0,
    weakFamily: { ...ACETATE_FAMILY, addedFormCharge: 0 },
  },
  ch3coona: {
    strongNetH: -1,
    weakFamily: { ...ACETATE_FAMILY, addedFormCharge: -1 },
  },
  ch3coo_minus: {
    strongNetH: -1,
    weakFamily: { ...ACETATE_FAMILY, addedFormCharge: -1 },
  },
  hcooh: {
    strongNetH: 0,
    weakFamily: { ...FORMATE_FAMILY, addedFormCharge: 0 },
  },
  hf: {
    strongNetH: 0,
    weakFamily: { ...FLUORIDE_FAMILY, addedFormCharge: 0 },
  },

  // Polyprotic acids & salts
  h3po4: {
    strongNetH: 0,
    weakFamily: { ...PHOSPHATE_FAMILY, addedFormCharge: 0 },
  },
  h2po4_minus: {
    strongNetH: -1,
    weakFamily: { ...PHOSPHATE_FAMILY, addedFormCharge: -1 },
  },
  hpo4_2minus: {
    strongNetH: -2,
    weakFamily: { ...PHOSPHATE_FAMILY, addedFormCharge: -2 },
  },
  po4_3minus: {
    strongNetH: -3,
    weakFamily: { ...PHOSPHATE_FAMILY, addedFormCharge: -3 },
  },
  h2co3: {
    strongNetH: 0,
    weakFamily: { ...CARBONATE_FAMILY, addedFormCharge: 0 },
  },
  nahco3: {
    strongNetH: -1,
    weakFamily: { ...CARBONATE_FAMILY, addedFormCharge: -1 },
  },
  hco3_minus: {
    strongNetH: -1,
    weakFamily: { ...CARBONATE_FAMILY, addedFormCharge: -1 },
  },
  na2co3: {
    strongNetH: -2,
    weakFamily: { ...CARBONATE_FAMILY, addedFormCharge: -2 },
  },
  k2co3: {
    strongNetH: -2,
    weakFamily: { ...CARBONATE_FAMILY, addedFormCharge: -2 },
  },
  co3_2minus: {
    strongNetH: -2,
    weakFamily: { ...CARBONATE_FAMILY, addedFormCharge: -2 },
  },

  // Weak bases & conjugate acids
  nh3: {
    strongNetH: -1,
    weakFamily: { ...AMMONIUM_FAMILY, addedFormCharge: 0 },
  },
  nh4cl: {
    strongNetH: 0,
    weakFamily: { ...AMMONIUM_FAMILY, addedFormCharge: 1 },
  },
  nh4no3: {
    strongNetH: 0,
    weakFamily: { ...AMMONIUM_FAMILY, addedFormCharge: 1 },
  },
  nh4_plus: {
    strongNetH: 0,
    weakFamily: { ...AMMONIUM_FAMILY, addedFormCharge: 1 },
  },

  // Mildly acidic metal aqua salts
  fecl3: {
    strongNetH: 0,
    weakFamily: { ...FE3_AQUA_FAMILY, addedFormCharge: 3 },
  },
  alcl3: {
    strongNetH: 0,
    weakFamily: { ...AL3_AQUA_FAMILY, addedFormCharge: 3 },
  },
  cuso4: {
    strongNetH: 0,
    weakFamily: { ...CU2_AQUA_FAMILY, addedFormCharge: 2 },
  },
}

/**
 * Water autoprotolysis constant Kw(T) approximated from 0 to 100 °C.
 * Kw(25 °C) = 1.0e-14, Kw(20 °C) ≈ 0.68e-14, Kw(60 °C) ≈ 9.5e-14.
 * We keep Kw = 1e-14 at standard 20–25 °C for clean classroom pH = 7.00 neutrality,
 * and drift gently above 30 °C.
 */
export function getWaterKw(temperatureC = 20): number {
  if (temperatureC <= 26 && temperatureC >= 18) return 1e-14
  const t = Math.max(0, Math.min(100, temperatureC))
  const pKw = 14.0 - 0.031 * (t - 25) + 0.00018 * (t - 25) * (t - 25)
  return 10 ** -Math.max(12.2, Math.min(14.95, pKw))
}

/**
 * Computes the average charge <z> of a polyprotic family H_nA^(z0) at given [H+].
 * Fractions alpha_k correspond to H_{n-k}A^(z0 - k).
 */
function familyAverageCharge(
  h: number,
  pkaList: number[],
  maxProtonatedCharge: number,
): number {
  const n = pkaList.length
  const kaList = pkaList.map((p) => 10 ** -p)

  // Compute unnormalized weights relative to H_nA: w_0 = h^n, w_1 = h^(n-1)*Ka1, ...
  // Work in log-space or normalized steps to prevent underflow for triprotic acids
  const terms: number[] = [1]
  let prod = 1
  for (let k = 0; k < n; k++) {
    prod *= kaList[k] / Math.max(1e-18, h)
    terms.push(prod)
  }
  let denom = 0
  let weightedCharge = 0
  for (let k = 0; k <= n; k++) {
    denom += terms[k]
    weightedCharge += terms[k] * (maxProtonatedCharge - k)
  }
  return denom > 0 ? weightedCharge / denom : maxProtonatedCharge
}

export interface ExactPhInput {
  solutesMol: Record<string, number>
  totalVolumeL: number
  temperatureC?: number
  /** Fallback weak solutes from catalog when not in curated table */
  extraWeakSolutes?: Array<{
    concentrationMolPerL: number
    phCharacter: 'acidic_weak' | 'basic_weak'
    pka: number
  }>
}

/**
 * Solves exact aqueous pH by bisection on the charge-balance (electroneutrality) equation:
 *   [H+] - Kw/[H+] + (spectator_net_charge) + sum_i C_i * <z_i([H+])> = 0
 * Works accurately for strong acids/bases, weak acids/bases, buffers, and polyprotic titrations!
 */
export function solveExactPh({
  solutesMol,
  totalVolumeL,
  temperatureC = 20,
  extraWeakSolutes = [],
}: ExactPhInput): number {
  const volL = Math.max(1e-6, totalVolumeL)
  const kw = getWaterKw(temperatureC)

  // Spectator net charge = sum(z_counterions)
  // For any neutral salt/acid/base added: counterion charge = -addedFormCharge,
  // EXCEPT strong acids (HCl: Cl- has -1 -> spectator = -strongNetH) and strong bases (NaOH: Na+ has +1 -> spectator = -strongNetH).
  // Let's track:
  //   netFixedCharge = sum of fixed spectator ion charges (e.g. Na+ = +1, Cl- = -1)
  //   weakFamilies = map of familyKey -> { pkaList, maxProtonatedCharge, conc }
  let netFixedCharge = 0
  const families = new Map<
    string,
    { pkaList: number[]; maxProtonatedCharge: number; conc: number }
  >()

  for (const [speciesId, rawMol] of Object.entries(solutesMol)) {
    if (!Number.isFinite(rawMol) || rawMol <= 1e-12) continue
    const conc = rawMol / volL
    const entry = SPECIES_ACID_BASE[speciesId]
    if (!entry) continue

    if (entry.weakFamily) {
      const wf = entry.weakFamily
      const existing = families.get(wf.familyKey)
      if (existing) {
        existing.conc += conc
      } else {
        families.set(wf.familyKey, {
          pkaList: wf.pkaList,
          maxProtonatedCharge: wf.maxProtonatedCharge,
          conc,
        })
      }
      // For a neutral solute (e.g. Na2CO3 -> 2 Na+ + CO3^2-), counterion charge = -addedFormCharge.
      // For H2SO4: 1st H+ is strong, remaining HSO4- has maxProtonatedCharge = -1 and addedFormCharge = -1 -> counterion charge is 0!
      // Wait: check H2SO4: H2SO4 -> H+ + HSO4-. Charge balance: [H+] - [OH-] + [HSO4-]*(-1) + [SO4^2-]*(-2) = 0 -> netFixedCharge = 0!
      // Check CH3COOH: addedFormCharge=0 -> netFixedCharge += 0.
      // Check CH3COONa: addedFormCharge=-1 -> Na+ gives +1 -> netFixedCharge += +1.
      // Check NH3: addedFormCharge=0 -> netFixedCharge += 0. Wait: in NH3, maxProtonatedCharge = +1 (NH4+). At pH=7, <z> ≈ +1, so [NH4+] = +C -> balanced by [OH-] = -C! So netFixedCharge = 0!
      // Check NH4Cl: Cl- gives -1! maxProtonatedCharge = +1, addedFormCharge = +1 -> counterion is -1 -> netFixedCharge += -1!
      // Check Na2CO3: 2 Na+ gives +2! addedFormCharge = -2 -> counterion is +2 -> netFixedCharge += +2!
      // Check H2SO4 specifically: no counterion, so netFixedCharge += 0!
      if (speciesId === 'h2so4') {
        // No spectator counterion; HSO4-/SO4^2- carries the negative charge directly
      } else if (speciesId === 'fecl3') {
        netFixedCharge -= 3 * conc // 3 Cl-
      } else if (speciesId === 'alcl3') {
        netFixedCharge -= 3 * conc // 3 Cl-
      } else if (speciesId === 'cuso4') {
        netFixedCharge -= 2 * conc // SO4^2-
      } else {
        netFixedCharge -= wf.addedFormCharge * conc
      }
    } else {
      // Pure strong acid (+1 -> Cl- spectator = -1) or strong base (-1 -> Na+ spectator = +1)
      netFixedCharge -= entry.strongNetH * conc
    }
  }

  for (let i = 0; i < extraWeakSolutes.length; i++) {
    const extra = extraWeakSolutes[i]
    if (extra.concentrationMolPerL <= 1e-12) continue
    if (extra.phCharacter === 'acidic_weak') {
      families.set(`extra_a_${i}`, {
        pkaList: [extra.pka],
        maxProtonatedCharge: 0,
        conc: extra.concentrationMolPerL,
      })
    } else {
      families.set(`extra_b_${i}`, {
        pkaList: [extra.pka],
        maxProtonatedCharge: 1,
        conc: extra.concentrationMolPerL,
      })
    }
  }

  if (Math.abs(netFixedCharge) < 1e-12 && families.size === 0) {
    return Math.round((-0.5 * Math.log10(kw)) * 100) / 100
  }

  const chargeBalance = (ph: number): number => {
    const h = 10 ** -ph
    const oh = kw / h
    let total = h - oh + netFixedCharge
    for (const fam of families.values()) {
      total += fam.conc * familyAverageCharge(h, fam.pkaList, fam.maxProtonatedCharge)
    }
    return total
  }

  // Note: chargeBalance(ph) is strictly monotonically DECREASING with pH
  // (as pH increases, [H+] drops, [OH-] rises, and every <z> decreases).
  let lo = -1.0
  let hi = 15.0
  for (let iter = 0; iter < 54; iter++) {
    const mid = (lo + hi) * 0.5
    if (chargeBalance(mid) > 0) {
      lo = mid
    } else {
      hi = mid
    }
  }
  const ph = (lo + hi) * 0.5
  return Math.round(Math.max(0, Math.min(14, ph)) * 100) / 100
}

/**
 * Standard limiting molar ionic conductivities λ° at 25 °C in mS·m²·mol⁻¹
 * (numerically equal to mS·cm⁻¹ per mol/L * 10 -> actually 1 mS·m²/mol * 1 mol/L = 10 mS/cm!).
 * Standard values (mS·m²·mol⁻¹):
 *   H3O+ : 34.96    OH- : 19.83    Na+ : 5.01     K+ : 7.35
 *   Cl-  : 7.63     NO3-: 7.14     SO4^2-: 16.00  CH3COO-: 4.09
 *   NH4+ : 7.35     Cu2+: 10.72    Fe2+: 10.8     Fe3+: 20.4
 *   Ag+  : 6.19     Ca2+: 11.90    Mg2+: 10.60    CO3^2-: 13.86
 *   HCO3-: 4.45     I-  : 7.68     Br- : 7.81     Zn2+: 10.56
 */
const LAMBDA_ION_MS_M2_MOL: Record<string, number> = {
  h3o_plus: 34.96,
  h_plus: 34.96,
  oh_minus: 19.83,
  na_plus: 5.01,
  k_plus: 7.35,
  li_plus: 3.87,
  nh4_plus: 7.35,
  ag_plus: 6.19,
  cl_minus: 7.63,
  br_minus: 7.81,
  i_minus: 7.68,
  f_minus: 5.54,
  no3_minus: 7.14,
  ch3coo_minus: 4.09,
  hco3_minus: 4.45,
  h2po4_minus: 3.3,
  mno4_minus: 6.13,
  so4_2minus: 16.0,
  co3_2minus: 13.86,
  hpo4_2minus: 11.4,
  cr2o7_2minus: 14.0,
  cu2_plus: 10.72,
  fe2_plus: 10.8,
  fe3_plus: 20.4,
  ca2_plus: 11.9,
  mg2_plus: 10.6,
  zn2_plus: 10.56,
  al3_plus: 18.3,
  po4_3minus: 20.7,
}

/**
 * Computes approximate aqueous electrical conductivity σ in mS/cm.
 * Includes exact [H3O+] and [OH-] from pH + dissolved ions, with Kohlrausch
 * slight high-concentration damping and +2%/°C temperature compensation.
 */
export function computeSolutionConductivityMsCm(
  dissolvedSpecies: DissolvedSpeciesItem[],
  phEstimate: number | null,
  temperatureC = 20,
): number {
  let sigma = 0
  let hasH3O = false
  let hasOH = false

  for (const item of dissolvedSpecies) {
    if (item.charge === 0 || item.concentrationMolPerL <= 0) continue
    if (item.speciesId === 'h3o_plus' || item.speciesId === 'h_plus') hasH3O = true
    if (item.speciesId === 'oh_minus') hasOH = true
    const lam = LAMBDA_ION_MS_M2_MOL[item.speciesId] ?? Math.abs(item.charge) * 6.0
    // 1 (mS·m²/mol) * (mol/L) = 10 mS/cm (since 1 mol/L = 1000 mol/m³ and 1 S/m = 10 mS/cm)
    // Apply mild Kohlrausch damping sqrt(c) for realistic concentrated solutions
    const c = item.concentrationMolPerL
    const activityFactor = 1 / (1 + 0.28 * Math.sqrt(c))
    sigma += lam * 10 * c * activityFactor
  }

  if (phEstimate !== null) {
    const h = 10 ** -phEstimate
    const oh = getWaterKw(temperatureC) / h
    if (!hasH3O) sigma += LAMBDA_ION_MS_M2_MOL.h3o_plus * 10 * h
    if (!hasOH) sigma += LAMBDA_ION_MS_M2_MOL.oh_minus * 10 * oh
  }

  // Temperature correction (~2% per °C around 25 °C)
  const tempFactor = Math.max(0.45, 1 + 0.02 * (temperatureC - 25))
  return Math.round(sigma * tempFactor * 100) / 100
}

/**
 * Computes relative reaction speed factor k(T)/k(20°C) using Arrhenius law
 * with a representative aqueous activation energy Ea ≈ 48 kJ/mol (~×2 per +10 °C).
 */
export function computeArrheniusSpeedFactor(temperatureC: number): number {
  const eaOverR = 5800 // ~48 kJ/mol / 8.314
  const tK = Math.max(273.15, temperatureC + 273.15)
  const factor = Math.exp(eaOverR * (1 / 293.15 - 1 / tK))
  return Math.round(Math.max(0.25, Math.min(25, factor)) * 10) / 10
}
