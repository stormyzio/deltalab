import type { DissolutionType, PhCharacter, PhysicalState, SpeciesKind } from '../../../shared/chemistry.ts'

export function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/**
 * Validates a CAS Registry Number format AND official checksum digit.
 */
export function isValidCasNumber(raw: string | null | undefined): boolean {
  if (!raw) return false
  const cleaned = raw.trim()
  const match = /^(\d{2,7})-(\d{2})-(\d)$/.exec(cleaned)
  if (!match) return false
  const digits = (match[1] + match[2]).split('').reverse()
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    sum += Number(digits[i]) * (i + 1)
  }
  return sum % 10 === Number(match[3])
}

export function extractValidCasFromStrings(values: string[]): string | null {
  for (const v of values) {
    const matches = v.match(/\b\d{2,7}-\d{2}-\d\b/g)
    if (!matches) continue
    for (const m of matches) {
      if (isValidCasNumber(m)) return m
    }
  }
  return null
}

export interface ParsedTemperature {
  valueC: number | null
  note: 'decomposes' | 'sublimes' | 'explodes' | null
}

function parseSingleTempChunk(text: string): { valueC: number; score: number } | null {
  // Reject clearly non-temperature lines
  if (/flash\s*point|autoignition|critical\s*temp|triple\s*point/i.test(text)) {
    return null
  }
  // Penalize reduced-pressure boiling points (e.g. "125 °C at 2 mm Hg", "at 10 torr")
  const hasReducedPressure =
    /(?:@|at)\s*(?:\d+(?:\.\d+)?)\s*(?:mm\s*hg|torr|mbar|pa|kpa)/i.test(text) &&
    !/(?:760|75\d|77\d|101\.3|1\s*atm)/i.test(text)

  // Match Celsius: "-114.1 °C", "120-122 °C", "800.7 deg C", "100 C"
  const cMatch =
    /(-?\d+(?:[.,]\d+)?)\s*(?:[-–—to]+\s*(-?\d+(?:[.,]\d+)?))?\s*(?:°\s*C|deg\.?\s*C|\bC\b)/i.exec(
      text,
    )
  if (cMatch) {
    const a = Number(cMatch[1].replace(',', '.'))
    const b = cMatch[2] ? Number(cMatch[2].replace(',', '.')) : a
    const val = (a + b) / 2
    if (Number.isFinite(val) && val >= -273.15 && val <= 6000) {
      return { valueC: roundTo(val, 1), score: hasReducedPressure ? 2 : 10 }
    }
  }

  // Match Fahrenheit: "61.9 °F", "-137 to -135 °F"
  const fMatch =
    /(-?\d+(?:[.,]\d+)?)\s*(?:[-–—to]+\s*(-?\d+(?:[.,]\d+)?))?\s*(?:°\s*F|deg\.?\s*F)/i.exec(
      text,
    )
  if (fMatch) {
    const a = Number(fMatch[1].replace(',', '.'))
    const b = fMatch[2] ? Number(fMatch[2].replace(',', '.')) : a
    const fVal = (a + b) / 2
    const cVal = ((fVal - 32) * 5) / 9
    if (Number.isFinite(cVal) && cVal >= -273.15 && cVal <= 6000) {
      return { valueC: roundTo(cVal, 1), score: hasReducedPressure ? 1 : 8 }
    }
  }

  // Match Kelvin: "298.15 K"
  const kMatch = /(-?\d+(?:[.,]\d+)?)\s*K\b/.exec(text)
  if (kMatch) {
    const kVal = Number(kMatch[1].replace(',', '.'))
    const cVal = kVal - 273.15
    if (Number.isFinite(cVal) && cVal >= -273.15 && cVal <= 6000) {
      return { valueC: roundTo(cVal, 1), score: hasReducedPressure ? 1 : 7 }
    }
  }

  // Pure numeric value (some CRC / PubChem Number fields omit unit and are in °C)
  const bareMatch = /^\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text)
  if (bareMatch) {
    const val = Number(bareMatch[1])
    if (Number.isFinite(val) && val >= -273.15 && val <= 5500) {
      return { valueC: roundTo(val, 1), score: 5 }
    }
  }

  return null
}

export function parseTemperatureC(rawValues: string[]): ParsedTemperature {
  let best: { valueC: number; score: number } | null = null
  let note: ParsedTemperature['note'] = null

  for (const raw of rawValues) {
    if (!raw) continue
    if (!note) {
      if (/\bsublim/i.test(raw)) note = 'sublimes'
      else if (/\bexplod/i.test(raw)) note = 'explodes'
      else if (/\bdecompos|decomp\.?\b/i.test(raw)) note = 'decomposes'
    }

    // Split multi-clause strings so we can prefer normal-pressure values
    const parts = raw.split(/[;\n]/).map((s) => s.trim()).filter(Boolean)
    for (const part of parts) {
      const parsed = parseSingleTempChunk(part)
      if (!parsed) continue
      if (!best || parsed.score > best.score) {
        best = parsed
      }
    }
  }

  return {
    valueC: best ? best.valueC : null,
    note,
  }
}

/**
 * Parses experimental density in g/cm³ (which equals g/mL).
 * Carefully rejects vapor density relative to air (air = 1) and nonsensical numbers.
 */
export function parseDensityGPerCm3(
  rawValues: string[],
  isGasHint = false,
): number | null {
  let best: { val: number; score: number } | null = null

  for (const raw of rawValues) {
    if (!raw) continue
    const clauses = raw.split(/[;\n]/).map((s) => s.trim()).filter(Boolean)
    for (const clause of clauses) {
      // Skip vapor density relative to air (e.g., "2.5 (Air = 1)") or bulk/tap density noise
      if (/\b(?:air\s*=\s*1|vapor\s*density|relative\s*vapor)\b/i.test(clause)) {
        continue
      }
      if (/heat\s*of\s*formation|detonation|viscosity/i.test(clause)) {
        continue
      }

      // 1. Explicit kg/m³ or g/L (1 g/L = 1 kg/m³ = 0.001 g/cm³)
      const kgM3 =
        /(\d+(?:[.,]\d+)?)\s*(?:[-–—to]+\s*(\d+(?:[.,]\d+)?))?\s*(?:kg\s*\/\s*m3|kg\/m³|kg\s*m-3|g\s*\/\s*L|g\/l|g\s*l-1)/i.exec(
          clause,
        )
      if (kgM3) {
        const a = Number(kgM3[1].replace(',', '.'))
        const b = kgM3[2] ? Number(kgM3[2].replace(',', '.')) : a
        const gPerCm3 = (a + b) / 2 / 1000
        if (gPerCm3 >= 0.00005 && gPerCm3 <= 24) {
          const score = isGasHint && gPerCm3 < 0.05 ? 10 : gPerCm3 >= 0.05 ? 9 : 5
          if (!best || score > best.score) {
            best = { val: roundTo(gPerCm3, gPerCm3 < 0.05 ? 5 : 3), score }
          }
          continue
        }
      }

      // 2. Explicit g/cm³ or g/mL or g/cc
      const gCm3 =
        /(\d+(?:[.,]\d+)?)\s*(?:[-–—to]+\s*(\d+(?:[.,]\d+)?))?\s*(?:g\s*\/\s*(?:cm3|cm³|cu\s*cm|cc|mL|ml)|g\s*cm-3)/i.exec(
          clause,
        )
      if (gCm3) {
        const a = Number(gCm3[1].replace(',', '.'))
        const b = gCm3[2] ? Number(gCm3[2].replace(',', '.')) : a
        const val = (a + b) / 2
        if (val >= 0.00005 && val <= 24) {
          const nearRoom = /(?:15|18|20|22|25)\s*°?\s*C|(?:68|70|72|77)\s*°?\s*F/i.test(clause)
          const score = nearRoom ? 11 : 9
          if (!best || score > best.score) {
            best = { val: roundTo(val, val < 0.05 ? 5 : 3), score }
          }
          continue
        }
      }

      // 3. Relative density / specific gravity (e.g. "2.17 at 25 °C/4 °C", "0.791 at 68 °F (USCG)")
      const rel =
        /^(?:density[:\s]*|specific\s*gravity[:\s]*|d\s*=?\s*)?(\d+(?:[.,]\d+)?)\s*(?:[-–—to]+\s*(\d+(?:[.,]\d+)?))?(?:\s*(?:at|@|\(|g|water|\/4|-|$))/i.exec(
          clause,
        )
      if (rel) {
        const a = Number(rel[1].replace(',', '.'))
        const b = rel[2] ? Number(rel[2].replace(',', '.')) : a
        const val = (a + b) / 2
        // Guard against picking up a year or temperature like "20 °C"
        if (val >= 0.05 && val <= 23.5) {
          const nearRoom = /(?:15|18|20|22|25)\s*°?\s*C|(?:68|70|72|77)\s*°?\s*F/i.test(clause)
          const score = nearRoom ? 8 : 6
          if (!best || score > best.score) {
            best = { val: roundTo(val, 3), score }
          }
        }
      }
    }
  }

  return best ? best.val : null
}

export interface ParsedSolubility {
  solubilityGPerL: number | null
  miscible: boolean
  insoluble: boolean
  source: 'pubchem' | 'aqsoldb' | 'table' | null
}

function clauseMentionsNonWaterOnly(clause: string): boolean {
  const hasWater = /\b(?:water|aqueous|h2o|eau)\b/i.test(clause)
  if (hasWater) return false
  return /\b(?:ethanol|alcohol|ether|acetone|benzene|chloroform|methanol|toluene|xylene|hexane|dmso|dmf|oil|glycerol|acid|alkali|pyridine|petrolatum|carbon\s*disulfide|acetic)\b/i.test(
    clause,
  )
}

export function parseSolubilityWater(
  rawValues: string[],
  molarMass: number,
  aqSolLogS?: number | null,
  table20C?: number | null,
): ParsedSolubility {
  // Highest-precision tabulated solubility curve at 20°C (e.g. inorganic salts CRC table)
  if (typeof table20C === 'number' && Number.isFinite(table20C) && table20C >= 0) {
    return {
      solubilityGPerL: roundTo(table20C, table20C < 1 ? 4 : 1),
      miscible: false,
      insoluble: table20C < 0.1,
      source: 'table',
    }
  }

  let bestNum: { gPerL: number; score: number } | null = null
  let sawMiscible = false
  let sawInsoluble = false

  for (const raw of rawValues) {
    if (!raw) continue
    const clauses = raw.split(/[;\n]/).map((s) => s.trim()).filter(Boolean)
    for (const clause of clauses) {
      if (clauseMentionsNonWaterOnly(clause)) continue

      const mentionsWater = /\b(?:water|aqueous|h2o)\b/i.test(clause)
      const nearRoom = /(?:15|18|20|22|25)\s*°?\s*C|(?:68|70|72|73|77)\s*°?\s*F/i.test(clause)
      const isHotWater = /(?:80|90|95|100)\s*°?\s*C|boiling|hot\s*water/i.test(clause)
      const baseScore = (mentionsWater ? 6 : 2) + (nearRoom ? 3 : 0) - (isHotWater ? 4 : 0)

      // Check miscible with water
      if (
        /\b(?:miscible\s+(?:with|in)\s+water|completely\s+miscible|water[:\s]*miscible|infinitely\s+soluble\s+in\s+water)\b/i.test(
          clause,
        ) ||
        (/^\s*miscible\b/i.test(clause) && !clauseMentionsNonWaterOnly(clause))
      ) {
        sawMiscible = true
      }

      // Check explicitly insoluble in water
      if (
        /\b(?:insoluble\s+in\s+water|practically\s+insoluble(?:\s+in\s+water)?|immiscible\s+(?:with|in)\s+water|none\s*\(\s*insoluble|negligible)\b/i.test(
          clause,
        ) ||
        /^\s*(?:insoluble|immiscible)\b/i.test(clause)
      ) {
        sawInsoluble = true
      }

      // Pattern 1: "1 g in X mL water" or "1 g dissolves in X mL"
      const oneInX =
        /1\s*g\s*(?:dissolves\s*)?in\s*(?:about\s*)?(\d+(?:[.,]\d+)?)\s*(mL|ml|L|l)\b/i.exec(
          clause,
        )
      if (oneInX && (mentionsWater || !clauseMentionsNonWaterOnly(clause))) {
        const vol = Number(oneInX[1].replace(',', '.'))
        if (vol > 0) {
          const gPerL = oneInX[2].toLowerCase() === 'l' ? 1 / vol : 1000 / vol
          if (gPerL >= 0 && gPerL <= 10000) {
            const score = baseScore + 4
            if (!bestNum || score > bestNum.score) {
              bestNum = { gPerL, score }
            }
          }
        }
      }

      // Pattern 2: X g/100 mL or g/100 g or g/100g water
      const gPer100 =
        /(\d+(?:[.,]\d+)?)\s*(?:[-–—to]+\s*(\d+(?:[.,]\d+)?))?\s*g\s*(?:\/|per)\s*100\s*(?:mL|ml|g|cc)/i.exec(
          clause,
        )
      if (gPer100) {
        const a = Number(gPer100[1].replace(',', '.'))
        const b = gPer100[2] ? Number(gPer100[2].replace(',', '.')) : a
        const gPerL = ((a + b) / 2) * 10
        if (gPerL >= 0 && gPerL <= 10000) {
          const score = baseScore + 5
          if (!bestNum || score > bestNum.score) {
            bestNum = { gPerL, score }
          }
        }
      }

      // Pattern 3: X g/L
      const gPerLMatch =
        /(\d+(?:[.,]\d+)?)\s*(?:[-–—to]+\s*(\d+(?:[.,]\d+)?))?\s*g\s*(?:\/|per)\s*(?:L|l|dm3|dm³)\b/i.exec(
          clause,
        )
      if (gPerLMatch) {
        const a = Number(gPerLMatch[1].replace(',', '.'))
        const b = gPerLMatch[2] ? Number(gPerLMatch[2].replace(',', '.')) : a
        const gPerL = (a + b) / 2
        if (gPerL >= 0 && gPerL <= 10000) {
          const score = baseScore + 5
          if (!bestNum || score > bestNum.score) {
            bestNum = { gPerL, score }
          }
        }
      }

      // Pattern 4: X mg/mL (1 mg/mL = 1 g/L)
      const mgPerMl =
        /(?:greater\s+than\s+or\s+equal\s+to\s+|less\s+than\s+|<\s*|>\s*)?(\d+(?:[.,]\d+)?)\s*(?:[-–—to]+\s*(\d+(?:[.,]\d+)?))?\s*mg\s*(?:\/|per)\s*mL\b/i.exec(
          clause,
        )
      if (mgPerMl) {
        const isLowerBound = /greater\s+than|>=|>/i.test(mgPerMl[0])
        const isUpperBound = /less\s+than|<=|</i.test(mgPerMl[0])
        const a = Number(mgPerMl[1].replace(',', '.'))
        const b = mgPerMl[2] ? Number(mgPerMl[2].replace(',', '.')) : a
        const gPerL = isUpperBound ? a * 0.5 : (a + b) / 2
        if (gPerL >= 0 && gPerL <= 10000) {
          // NTP "greater than or equal to 100 mg/mL" is a coarse lower bound -> score slightly lower
          const score = baseScore + (isLowerBound ? 1 : 4)
          if (!bestNum || score > bestNum.score) {
            bestNum = { gPerL, score }
          }
        }
      }

      // Pattern 5: X mg/L (1 mg/L = 0.001 g/L) or ppm
      const mgPerL =
        /(\d+(?:[.,]\d+)?(?:\s*[x×]\s*10\^?-?\d+|e-?\d+)?)\s*mg\s*(?:\/|per)\s*L\b/i.exec(
          clause,
        )
      if (mgPerL) {
        const norm = mgPerL[1].replace(',', '.').replace(/\s*[x×]\s*10\^?/, 'e')
        const val = Number(norm)
        if (Number.isFinite(val) && val >= 0) {
          const gPerL = val / 1000
          if (gPerL <= 10000) {
            const score = baseScore + 5
            if (!bestNum || score > bestNum.score) {
              bestNum = { gPerL, score }
            }
          }
        }
      }

      // Pattern 6: X % (weight % in water, e.g. NIOSH "34 %")
      const pct =
        /^\s*(?:about\s*|approx\.?\s*)?(\d+(?:[.,]\d+)?)\s*%(?:\s*(?:\(|at|in\s*water|$))/i.exec(
          clause,
        )
      if (pct && !isHotWater) {
        const val = Number(pct[1].replace(',', '.'))
        if (val > 0 && val <= 90) {
          const gPerL = (val / (100 - val)) * 1000
          const score = baseScore + 3
          if (!bestNum || score > bestNum.score) {
            bestNum = { gPerL, score }
          }
        }
      }

      // Pattern 7: X mol/L
      const molL = /(\d+(?:[.,]\d+)?(?:e-?\d+)?)\s*mol\s*\/\s*L\b/i.exec(clause)
      if (molL && molarMass > 0) {
        const val = Number(molL[1].replace(',', '.'))
        if (Number.isFinite(val) && val >= 0) {
          const gPerL = val * molarMass
          if (gPerL <= 10000) {
            const score = baseScore + 4
            if (!bestNum || score > bestNum.score) {
              bestNum = { gPerL, score }
            }
          }
        }
      }
    }
  }

  if (sawMiscible) {
    return { solubilityGPerL: null, miscible: true, insoluble: false, source: 'pubchem' }
  }

  // Prefer AqSolDB exact experimental LogS over coarse NTP bounds or pure text when available
  if (
    typeof aqSolLogS === 'number' &&
    Number.isFinite(aqSolLogS) &&
    molarMass > 0 &&
    (!bestNum || bestNum.score <= 6)
  ) {
    const gPerL = 10 ** aqSolLogS * molarMass
    if (Number.isFinite(gPerL) && gPerL >= 0 && gPerL <= 10000) {
      return {
        solubilityGPerL: roundTo(gPerL, gPerL < 1 ? 4 : gPerL < 20 ? 2 : 1),
        miscible: false,
        insoluble: gPerL < 0.1,
        source: 'aqsoldb',
      }
    }
  }

  if (bestNum) {
    const g = bestNum.gPerL
    return {
      solubilityGPerL: roundTo(g, g < 1 ? 4 : g < 20 ? 2 : 1),
      miscible: false,
      insoluble: g < 0.1,
      source: 'pubchem',
    }
  }

  if (sawInsoluble) {
    return { solubilityGPerL: 0, miscible: false, insoluble: true, source: 'pubchem' }
  }

  return { solubilityGPerL: null, miscible: false, insoluble: false, source: null }
}

/**
 * Parses aqueous pKa values from IUPAC dataset (preferred) + PubChem Dissociation Constants.
 */
export function parsePkaValues(
  pubchemStrings: string[],
  iupacValues: number[] = [],
): number[] {
  const collected: number[] = []

  for (const v of iupacValues) {
    if (Number.isFinite(v) && v >= -15 && v <= 25) {
      collected.push(roundTo(v, 2))
    }
  }

  if (collected.length === 0) {
    for (const raw of pubchemStrings) {
      if (!raw) continue
      // Skip non-aqueous solvent pKa (DMSO, acetonitrile, ethanol)
      if (/\b(?:dmso|acetonitrile|ethanol|methanol|thf|dmf)\b/i.test(raw)) continue

      // Match explicit pKa values: "pKa = 4.76", "pKa1 = 2.15, pKa2 = 7.20", "4.756"
      const pkaMatches = raw.matchAll(/pKa\d?\s*[=:]?\s*(-?\d+(?:[.,]\d+)?)/gi)
      let foundExplicit = false
      for (const m of pkaMatches) {
        const val = Number(m[1].replace(',', '.'))
        if (Number.isFinite(val) && val >= -15 && val <= 25) {
          collected.push(roundTo(val, 2))
          foundExplicit = true
        }
      }

      // Match pKb and convert to conjugate acid pKa = 14 - pKb
      if (!foundExplicit) {
        const pkbMatch = /pKb\d?\s*[=:]?\s*(-?\d+(?:[.,]\d+)?)/i.exec(raw)
        if (pkbMatch) {
          const pkb = Number(pkbMatch[1].replace(',', '.'))
          const pka = 14 - pkb
          if (Number.isFinite(pka) && pka >= -15 && pka <= 25) {
            collected.push(roundTo(pka, 2))
            foundExplicit = true
          }
        }
      }

      // Bare numeric value (like "4.756" in HSDB/PubChem)
      if (!foundExplicit) {
        const bare = /^\s*(-?\d+(?:\.\d+)?)\s*$/.exec(raw)
        if (bare) {
          const val = Number(bare[1])
          if (Number.isFinite(val) && val >= -15 && val <= 25) {
            collected.push(roundTo(val, 2))
          }
        }
      }
    }
  }

  // Sort & deduplicate within ±0.2
  collected.sort((a, b) => a - b)
  const deduped: number[] = []
  for (const v of collected) {
    if (deduped.length === 0 || Math.abs(v - deduped[deduped.length - 1]) > 0.2) {
      deduped.push(v)
    }
  }
  return deduped.slice(0, 4)
}

export interface ParsedAppearance {
  appearanceFr: string | null
  colorHex: string | null
}

const COLOR_MAP: Array<{ pattern: RegExp; fr: string; hex: string }> = [
  { pattern: /\b(?:colorless|colourless|water-white|clear)\b/i, fr: 'incolore', hex: '#e4e4e7' },
  { pattern: /\b(?:off-white|ivory|cream|whitish)\b/i, fr: 'blanc cassé', hex: '#f5f5f4' },
  { pattern: /\b(?:white|snowy)\b/i, fr: 'blanc', hex: '#f4f4f5' },
  { pattern: /\b(?:pale[\s-]yellow|light[\s-]yellow|straw|yellowish)\b/i, fr: 'jaune pâle', hex: '#fef08a' },
  { pattern: /\b(?:greenish[\s-]yellow|yellow[\s-]green)\b/i, fr: 'jaune-vert', hex: '#bef264' },
  { pattern: /\b(?:yellow|golden|lemon|canary|amber)\b/i, fr: 'jaune', hex: '#eab308' },
  { pattern: /\b(?:reddish[\s-]orange|orange[\s-]red)\b/i, fr: 'rouge-orangé', hex: '#ea580c' },
  { pattern: /\b(?:orange)\b/i, fr: 'orange', hex: '#f97316' },
  { pattern: /\b(?:dark[\s-]red|crimson|ruby|reddish[\s-]brown|rust)\b/i, fr: 'rouge brun', hex: '#b91c1c' },
  { pattern: /\b(?:pink|rose|pale[\s-]red)\b/i, fr: 'rose', hex: '#f472b6' },
  { pattern: /\b(?:red|scarlet)\b/i, fr: 'rouge', hex: '#dc2626' },
  { pattern: /\b(?:violet|purple|magenta|lilac)\b/i, fr: 'violet', hex: '#9333ea' },
  { pattern: /\b(?:blue[\s-]green|turquoise|cyan|teal)\b/i, fr: 'bleu-vert', hex: '#06b6d4' },
  { pattern: /\b(?:light[\s-]blue|pale[\s-]blue|sky[\s-]blue)\b/i, fr: 'bleu clair', hex: '#60a5fa' },
  { pattern: /\b(?:blue|azure|navy)\b/i, fr: 'bleu', hex: '#3b82f6' },
  { pattern: /\b(?:pale[\s-]green|light[\s-]green|greenish)\b/i, fr: 'vert pâle', hex: '#86efac' },
  { pattern: /\b(?:green|emerald)\b/i, fr: 'vert', hex: '#22c55e' },
  { pattern: /\b(?:tan|beige|buff|ochre)\b/i, fr: 'beige', hex: '#d6d3d1' },
  { pattern: /\b(?:brown|brownish)\b/i, fr: 'brun', hex: '#92400e' },
  { pattern: /\b(?:silvery|silver|metallic|lustrous)\b/i, fr: 'gris métallique', hex: '#a1a1aa' },
  { pattern: /\b(?:gray|grey|grayish|greyish)\b/i, fr: 'gris', hex: '#9ca3af' },
  { pattern: /\b(?:black|blackish|charcoal)\b/i, fr: 'noir', hex: '#27272a' },
]

const FORM_MAP: Array<{ pattern: RegExp; fr: string; fem: boolean }> = [
  { pattern: /\b(?:crystalline\s+powder|crystal\s+powder)\b/i, fr: 'Poudre cristalline', fem: true },
  { pattern: /\b(?:powder|dust)\b/i, fr: 'Poudre', fem: true },
  { pattern: /\b(?:needles|prisms|plates|leaflets|scales|flakes)\b/i, fr: 'Cristaux', fem: false },
  { pattern: /\b(?:crystals?|crystalline)\b/i, fr: 'Cristaux', fem: false },
  { pattern: /\b(?:granules?|granular|beads|pellets)\b/i, fr: 'Granulés', fem: false },
  { pattern: /\b(?:oily\s+liquid|viscous\s+liquid|syrupy)\b/i, fr: 'Liquide visqueux', fem: false },
  { pattern: /\b(?:volatile\s+liquid)\b/i, fr: 'Liquide volatil', fem: false },
  { pattern: /\b(?:liquid|oil)\b/i, fr: 'Liquide', fem: false },
  { pattern: /\b(?:gas|vapor|vapour)\b/i, fr: 'Gaz', fem: false },
  { pattern: /\b(?:waxy|wax)\b/i, fr: 'Solide cireux', fem: false },
  { pattern: /\b(?:solid|chunks|lumps|mass|metal)\b/i, fr: 'Solide', fem: false },
]

function agreeFrenchColor(colorFr: string, fem: boolean, plural: boolean): string {
  if (!fem && !plural) return colorFr
  if (colorFr === 'blanc') return fem ? 'blanche' : plural ? 'blancs' : 'blanc'
  if (colorFr === 'incolore') return plural ? 'incolores' : 'incolore'
  if (colorFr === 'gris') return fem ? 'grise' : 'gris'
  if (colorFr === 'vert') return fem ? 'verte' : plural ? 'verts' : 'vert'
  if (colorFr === 'bleu') return fem ? 'bleue' : plural ? 'bleus' : 'bleu'
  if (colorFr === 'noir') return fem ? 'noire' : plural ? 'noirs' : 'noir'
  if (colorFr === 'brun') return fem ? 'brune' : plural ? 'bruns' : 'brun'
  if (colorFr === 'violet') return fem ? 'violette' : plural ? 'violets' : 'violet'
  if (colorFr === 'jaune' || colorFr === 'rouge' || colorFr === 'rose' || colorFr === 'beige') {
    return plural ? `${colorFr}s` : colorFr
  }
  return colorFr
}

/**
 * Extracts a concise, clean French appearance label & pure color hex from PubChem
 * Color/Form & Physical Description annotations.
 */
export function parseAppearanceAndColor(
  rawValues: string[],
  standardState: PhysicalState,
): ParsedAppearance {
  let detectedColor: { fr: string; hex: string } | null = null
  let detectedForm: { fr: string; fem: boolean } | null = null

  for (const raw of rawValues) {
    if (!raw || raw.length < 3) continue
    // Ignore boilerplate generic tags like "DryPowder; Liquid; OtherSolid"
    if (/^(?:DryPowder|Liquid|OtherSolid|NKRA)(?:;\s*(?:DryPowder|Liquid|OtherSolid|NKRA))*$/i.test(raw.trim())) {
      continue
    }
    const text = raw.slice(0, 220)
    if (!detectedColor) {
      for (const entry of COLOR_MAP) {
        if (entry.pattern.test(text)) {
          detectedColor = { fr: entry.fr, hex: entry.hex }
          break
        }
      }
    }
    if (!detectedForm) {
      for (const entry of FORM_MAP) {
        if (entry.pattern.test(text)) {
          detectedForm = { fr: entry.fr, fem: entry.fem }
          break
        }
      }
    }
    if (detectedColor && detectedForm) break
  }

  if (!detectedColor && !detectedForm) {
    return { appearanceFr: null, colorHex: null }
  }

  const form =
    detectedForm ??
    (standardState === 'gas'
      ? { fr: 'Gaz', fem: false }
      : standardState === 'liquid'
        ? { fr: 'Liquide', fem: false }
        : { fr: 'Solide', fem: false })

  const color = detectedColor ?? {
    fr: standardState === 'solid' ? 'blanc' : 'incolore',
    hex: standardState === 'solid' ? '#e4e4e7' : '#d4d4d8',
  }

  const plural = form.fr === 'Cristaux' || form.fr === 'Granulés'
  const colorLabel = agreeFrenchColor(color.fr, form.fem, plural)
  return {
    appearanceFr: `${form.fr} ${colorLabel}`,
    colorHex: color.hex,
  }
}

export function deriveStandardState(
  meltingPointC: number | null,
  boilingPointC: number | null,
  fallback: PhysicalState = 'solid',
): PhysicalState {
  if (boilingPointC !== null && boilingPointC < 20) return 'gas'
  if (meltingPointC !== null && meltingPointC < 20) {
    if (boilingPointC === null || boilingPointC >= 20) return 'liquid'
  }
  if (meltingPointC !== null && meltingPointC >= 20) return 'solid'
  if (boilingPointC !== null && boilingPointC >= 20) return fallback
  return fallback
}

export function deriveDissolutionType(
  kind: SpeciesKind,
  sol: ParsedSolubility,
  pkaValues: number[],
): DissolutionType {
  if (sol.miscible) return 'miscible'
  if (sol.insoluble || (sol.solubilityGPerL !== null && sol.solubilityGPerL < 0.1)) {
    return 'none'
  }
  if (kind === 'ionic_compound') {
    return sol.solubilityGPerL !== null && sol.solubilityGPerL < 5
      ? 'ionic_partial'
      : 'ionic_complete'
  }
  if (pkaValues.length > 0 && pkaValues[0] <= 0) {
    return 'ionic_complete'
  }
  if (pkaValues.length > 0 && pkaValues[0] <= 6.5) {
    return 'ionic_partial'
  }
  return 'molecular'
}

export function derivePhCharacter(
  pkaValues: number[],
  families: string[],
  smiles: string,
): PhCharacter {
  if (pkaValues.length > 0) {
    const pka1 = pkaValues[0]
    if (pka1 <= 0) return 'acidic_strong'
    if (pka1 < 6.8) return 'acidic_weak'
    if (pka1 > 12.5 && /\[OH-\]/.test(smiles)) return 'basic_strong'
    if (families.includes('Amine') && pka1 >= 7.5 && pka1 <= 12.5) return 'basic_weak'
    if (pka1 >= 8 && pka1 <= 12 && families.includes('Phénol')) return 'acidic_weak'
  }
  if (/\[OH-\]/.test(smiles)) return 'basic_strong'
  if (families.includes('Acide carboxylique')) return 'acidic_weak'
  if (families.includes('Amine')) return 'basic_weak'
  return 'neutral'
}

/**
 * Simple RFC-4180 CSV parser handling quoted fields & escaped quotes.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
        rows.push(row)
      }
      row = []
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  if (rows.length < 2) return []
  const headers = rows[0].map((h) => h.trim())
  const out: Record<string, string>[] = []
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i]
    const obj: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = cols[j] ?? ''
    }
    out.push(obj)
  }
  return out
}
