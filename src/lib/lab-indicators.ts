import type { PhIndicatorId } from '../../shared/chemistry.ts'

export interface PhIndicatorSpec {
  id: PhIndicatorId
  nameFr: string
  shortLabel: string
  /** Lower and upper pH bounds of the main color transition */
  transitionLow: number
  transitionHigh: number
  /** Acid color, midpoint (if distinct), and base color */
  acidHex: string
  baseHex: string
  acidLabelFr: string
  baseLabelFr: string
  /** Colorless in acid form (e.g. phenolphthalein) */
  colorlessAcid?: boolean
  /** Multi-stop color scale for universal indicator */
  stops?: Array<{ ph: number; hex: string }>
}

export const PH_INDICATORS: PhIndicatorSpec[] = [
  {
    id: 'bbt',
    nameFr: 'Bleu de bromothymol',
    shortLabel: 'BBT',
    transitionLow: 6.0,
    transitionHigh: 7.6,
    acidHex: '#eab308',
    baseHex: '#2563eb',
    acidLabelFr: 'Jaune',
    baseLabelFr: 'Bleu',
    stops: [
      { ph: 0, hex: '#eab308' },
      { ph: 6.0, hex: '#eab308' },
      { ph: 6.8, hex: '#22c55e' },
      { ph: 7.6, hex: '#2563eb' },
      { ph: 14, hex: '#2563eb' },
    ],
  },
  {
    id: 'phenolphthalein',
    nameFr: 'Phénolphtaléine',
    shortLabel: 'Phénolpht.',
    transitionLow: 8.2,
    transitionHigh: 10.0,
    acidHex: '#bae6fd',
    baseHex: '#ec4899',
    acidLabelFr: 'Incolore',
    baseLabelFr: 'Rose magenta',
    colorlessAcid: true,
  },
  {
    id: 'methyl_orange',
    nameFr: 'Hélianthine',
    shortLabel: 'Hélianthine',
    transitionLow: 3.1,
    transitionHigh: 4.4,
    acidHex: '#ef4444',
    baseHex: '#facc15',
    acidLabelFr: 'Rouge',
    baseLabelFr: 'Jaune',
    stops: [
      { ph: 0, hex: '#ef4444' },
      { ph: 3.1, hex: '#ef4444' },
      { ph: 3.75, hex: '#f97316' },
      { ph: 4.4, hex: '#facc15' },
      { ph: 14, hex: '#facc15' },
    ],
  },
  {
    id: 'phenol_red',
    nameFr: 'Rouge de phénol',
    shortLabel: 'Rouge phénol',
    transitionLow: 6.8,
    transitionHigh: 8.4,
    acidHex: '#facc15',
    baseHex: '#e11d48',
    acidLabelFr: 'Jaune',
    baseLabelFr: 'Rouge',
    stops: [
      { ph: 0, hex: '#facc15' },
      { ph: 6.8, hex: '#facc15' },
      { ph: 7.6, hex: '#fb923c' },
      { ph: 8.4, hex: '#e11d48' },
      { ph: 14, hex: '#e11d48' },
    ],
  },
  {
    id: 'universal',
    nameFr: 'Indicateur universel',
    shortLabel: 'Universel',
    transitionLow: 1.0,
    transitionHigh: 13.0,
    acidHex: '#ef4444',
    baseHex: '#7c3aed',
    acidLabelFr: 'Rouge → Vert → Violet',
    baseLabelFr: 'pH 1–14',
    stops: [
      { ph: 1, hex: '#dc2626' },
      { ph: 3, hex: '#f97316' },
      { ph: 5, hex: '#eab308' },
      { ph: 7, hex: '#22c55e' },
      { ph: 9, hex: '#06b6d4' },
      { ph: 11, hex: '#2563eb' },
      { ph: 13, hex: '#7c3aed' },
    ],
  },
]

export const PH_INDICATOR_BY_ID: Record<PhIndicatorId, PhIndicatorSpec> =
  Object.fromEntries(PH_INDICATORS.map((ind) => [ind.id, ind])) as Record<
    PhIndicatorId,
    PhIndicatorSpec
  >

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '')
  return [
    Number.parseInt(c.slice(0, 2), 16),
    Number.parseInt(c.slice(2, 4), 16),
    Number.parseInt(c.slice(4, 6), 16),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${f(r)}${f(g)}${f(b)}`
}

function lerpHex(hexA: string, hexB: string, t: number): string {
  const k = Math.max(0, Math.min(1, t))
  const [r1, g1, b1] = hexToRgb(hexA)
  const [r2, g2, b2] = hexToRgb(hexB)
  return rgbToHex(r1 + (r2 - r1) * k, g1 + (g2 - g1) * k, b1 + (b2 - b1) * k)
}

/**
 * Evaluates the exact RGB hex color & opacity of an indicator at a given pH,
 * smoothly interpolated via Henderson-Hasselbalch sigmoid across its transition zone.
 */
export function evaluateIndicatorVisual(
  indicatorId: PhIndicatorId,
  ph: number,
): { hex: string; opacity: number } {
  const spec = PH_INDICATOR_BY_ID[indicatorId]
  const clampedPh = Math.max(0, Math.min(14, ph))

  if (spec.stops && spec.stops.length >= 2) {
    const stops = spec.stops
    if (clampedPh <= stops[0].ph) return { hex: stops[0].hex, opacity: 0.64 }
    if (clampedPh >= stops[stops.length - 1].ph) {
      return { hex: stops[stops.length - 1].hex, opacity: 0.64 }
    }
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i]
      const b = stops[i + 1]
      if (clampedPh >= a.ph && clampedPh <= b.ph) {
        const t = (clampedPh - a.ph) / Math.max(0.01, b.ph - a.ph)
        return { hex: lerpHex(a.hex, b.hex, t), opacity: 0.64 }
      }
    }
  }

  // Classic two-form indicator: fraction of base form alpha = 1 / (1 + 10^(pKi - pH))
  const pKi = (spec.transitionLow + spec.transitionHigh) * 0.5
  const alpha = 1 / (1 + 10 ** (pKi - clampedPh))

  if (spec.colorlessAcid) {
    // Phenolphthalein: colorless below ~8.2, intense magenta-pink above 10.0
    const intensity = Math.max(0, Math.min(1, alpha))
    if (intensity < 0.03) {
      return { hex: '#bae6fd', opacity: 0.28 }
    }
    return {
      hex: lerpHex('#f9a8d4', spec.baseHex, Math.min(1, intensity * 1.15)),
      opacity: Math.round((0.28 + intensity * 0.44) * 100) / 100,
    }
  }

  return {
    hex: lerpHex(spec.acidHex, spec.baseHex, alpha),
    opacity: 0.62,
  }
}

/**
 * Applies a pH indicator tint on top of a flask's aqueous liquid visual if water & pH exist.
 */
export function applyIndicatorToLiquidVisual(
  baseColorHex: string | null,
  baseOpacity: number,
  phEstimate: number | null,
  hasWater: boolean,
  indicatorId?: PhIndicatorId | null,
): { liquidColorHex: string | null; liquidOpacity: number } {
  if (!indicatorId || !hasWater || phEstimate === null) {
    return { liquidColorHex: baseColorHex, liquidOpacity: baseOpacity }
  }
  const ind = evaluateIndicatorVisual(indicatorId, phEstimate)
  const isClearBase =
    !baseColorHex ||
    baseColorHex === '#bae6fd' ||
    baseColorHex === '#e0f2fe' ||
    baseOpacity <= 0.34
  if (isClearBase) {
    return { liquidColorHex: ind.hex, liquidOpacity: ind.opacity }
  }
  // If solution already has strong intrinsic color (e.g. Cu2+ or MnO4-), blend softly
  return {
    liquidColorHex: lerpHex(baseColorHex, ind.hex, 0.55),
    liquidOpacity: Math.max(baseOpacity, ind.opacity),
  }
}
