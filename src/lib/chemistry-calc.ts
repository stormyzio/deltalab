const SUBSCRIPTS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉']
const SUPERSCRIPTS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹']

function toSub(n: number): string {
  return String(n)
    .split('')
    .map((ch) => SUBSCRIPTS[Number(ch)] ?? ch)
    .join('')
}

function toSup(n: number): string {
  return String(n)
    .split('')
    .map((ch) => SUPERSCRIPTS[Number(ch)] ?? ch)
    .join('')
}

/**
 * Most abundant natural isotope mass number A for elements where Math.round(atomicMass)
 * differs from the principal isotope (IUPAC isotopic abundance tables).
 */
const PRINCIPAL_ISOTOPE_A: Record<number, number> = {
  29: 63, // Cu (63.546 -> 63Cu 69%)
  32: 74, // Ge (72.63 -> 74Ge 36.5%)
  35: 79, // Br (79.904 -> 79Br 50.7%)
  44: 102, // Ru (101.07 -> 102Ru 31.6%)
  47: 107, // Ag (107.87 -> 107Ag 51.8%)
  48: 114, // Cd (112.41 -> 114Cd 28.7%)
  50: 120, // Sn (118.71 -> 120Sn 32.6%)
  51: 121, // Sb (121.76 -> 121Sb 57.2%)
  52: 130, // Te (127.60 -> 130Te 34.1%)
  56: 138, // Ba (137.33 -> 138Ba 71.7%)
  60: 142, // Nd (144.24 -> 142Nd 27.2%)
  62: 152, // Sm (150.36 -> 152Sm 26.8%)
  64: 158, // Gd (157.25 -> 158Gd 24.8%)
  66: 164, // Dy (162.50 -> 164Dy 28.3%)
  68: 166, // Er (167.26 -> 166Er 33.5%)
  70: 174, // Yb (173.05 -> 174Yb 32.0%)
  72: 180, // Hf (178.49 -> 180Hf 35.1%)
  76: 192, // Os (190.23 -> 192Os 40.8%)
  80: 202, // Hg (200.59 -> 202Hg 29.9%)
  81: 205, // Tl (204.38 -> 205Tl 70.5%)
  82: 208, // Pb (207.2 -> 208Pb 52.4%)
}

/** Mass number A (nucleons) of the principal / reference isotope. */
export function getElementMassNumber(atomicNumber: number, atomicMass: number): number {
  return PRINCIPAL_ISOTOPE_A[atomicNumber] ?? Math.round(atomicMass)
}

/** Nuclide symbol notation, e.g. ³⁵₁₇Cl. */
export function formatNuclideSymbol(
  massNumber: number,
  atomicNumber: number,
  symbol: string,
): string {
  return `${toSup(massNumber)}${toSub(atomicNumber)}${symbol}`
}

const NOBLE_CORE_EXPANSION: Record<string, string> = {
  '[He]': '1s²',
  '[Ne]': '1s² 2s² 2p⁶',
  '[Ar]': '1s² 2s² 2p⁶ 3s² 3p⁶',
  '[Kr]': '1s² 2s² 2p⁶ 3s² 3p⁶ 3d¹⁰ 4s² 4p⁶',
  '[Xe]': '1s² 2s² 2p⁶ 3s² 3p⁶ 3d¹⁰ 4s² 4p⁶ 4d¹⁰ 5s² 5p⁶',
  '[Rn]': '1s² 2s² 2p⁶ 3s² 3p⁶ 3d¹⁰ 4s² 4p⁶ 4d¹⁰ 4f¹⁴ 5s² 5p⁶ 5d¹⁰ 6s² 6p⁶',
}

/** Expand a noble-gas shorthand electron configuration (e.g. "[Ne] 3s² 3p⁵") into full subshell form. */
export function expandElectronConfiguration(shortConfig: string): string {
  const trimmed = shortConfig.trim()
  for (const [core, full] of Object.entries(NOBLE_CORE_EXPANSION)) {
    if (trimmed.startsWith(core)) {
      const rest = trimmed.slice(core.length).trim()
      return rest ? `${full} ${rest}` : full
    }
  }
  return trimmed
}

export function buildCanonicalSignature(composition: Record<string, number>): string {
  return Object.entries(composition)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sym, count]) => `${sym}:${count}`)
    .join('|')
}

export function formatFormulaFromComposition(composition: Record<string, number>): string {
  const entries = Object.entries(composition).filter(([, c]) => c > 0)
  const hasCarbon = entries.some(([sym]) => sym === 'C')
  entries.sort(([a], [b]) => {
    if (hasCarbon) {
      if (a === 'C') return -1
      if (b === 'C') return 1
      if (a === 'H') return -1
      if (b === 'H') return 1
    }
    return a.localeCompare(b)
  })
  return entries
    .map(([sym, count]) => (count === 1 ? sym : `${sym}${toSub(count)}`))
    .join('')
}

export function formatChargeLabel(charge: number): string {
  if (charge > 0) return charge === 1 ? '+' : `${charge}+`
  if (charge < 0) return charge === -1 ? '−' : `${Math.abs(charge)}−`
  return '0'
}

const BEHAVIOR_LABELS_FR: Record<string, string> = {
  boilingPointC: 'Ébullition',
  meltingPointC: 'Fusion',
  densityGPerMl: 'Masse volumique',
  wikidataId: 'Wikidata',
  pubchemCid: 'PubChem CID',
  iupacName: 'Nom IUPAC',
  polarSolvent: 'Solvant polaire',
  strongAcid: 'Acide fort',
  strongBase: 'Base forte',
  pKa: 'pKa',
  exothermicDilution: 'Dilution exothermique',
  anhydrousWaterTest: 'Test d’identification de l’eau',
  strongOxidizer: 'Oxydant fort',
  chlorideTestReagent: 'Réactif des ions Cl⁻',
  chalkMineral: 'Minéral calcaire',
  reactsWithWater: 'Réagit vivement avec l’eau',
  conductive: 'Conductrice',
  electrolyte: 'Électrolyte',
  oxidizer: 'Oxydant',
  effervescent: 'Effervescente',
  molecularSolution: 'Solution moléculaire',
  miscible: 'Miscible',
  coloredIon: 'Ion coloré',
  acidStrength: 'Force acide',
  baseStrength: 'Force basique',
}

/**
 * Keys already displayed in dedicated species sheet sections or internal metadata.
 * Excluded from the qualitative "Particularités" strip to avoid duplicating information.
 */
const REDUNDANT_BEHAVIOR_KEYS = new Set([
  'families',
  'boilingPointC',
  'meltingPointC',
  'densityGPerMl',
  'pKa',
  'pKb',
  'solubilitySource',
  'wikidataId',
  'pubchemCid',
  'iupacName',
  'strongAcid',
  'strongBase',
  'acidStrength',
  'baseStrength',
  'metal',
  'miscible',
  'coloredIon',
  'conductive',
  'electrolyte',
  'molecularSolution',
])

export function extractNotableBehaviors(
  behaviors: Record<string, unknown>,
): Array<{ key: string; text: string }> {
  const out: Array<{ key: string; text: string }> = []
  for (const [key, value] of Object.entries(behaviors)) {
    if (REDUNDANT_BEHAVIOR_KEYS.has(key)) continue
    if (value === false || value === null || value === undefined) continue
    const label = BEHAVIOR_LABELS_FR[key]
    if (!label) continue
    if (value === true) {
      out.push({ key, text: label })
    } else {
      out.push({ key, text: `${label} : ${String(value)}` })
    }
  }
  return out
}

export function formatBehaviorEntry(key: string, value: unknown): {
  label: string
  display: string
} {
  const label = BEHAVIOR_LABELS_FR[key] ?? key
  if (key === 'boilingPointC' || key === 'meltingPointC') {
    return { label, display: `${String(value)} °C` }
  }
  if (key === 'densityGPerMl') {
    return { label, display: `${String(value)} g/mL` }
  }
  if (typeof value === 'boolean') {
    return { label, display: value ? 'Oui' : 'Non' }
  }
  if (value === 'strong') return { label, display: 'Fort' }
  if (value === 'weak') return { label, display: 'Faible' }
  return { label, display: String(value) }
}
