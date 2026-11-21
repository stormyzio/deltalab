import type {
  ElementBlock,
  ElementCategory,
  ElementRecord,
} from '../../../shared/chemistry.ts'
import {
  CATEGORY_META,
  formatFrNumber,
  getElementStateAtTemperature,
} from '@/lib/chemistry-ui'

export type PeriodicViewMode = 'table' | 'ranking'

export type ColorOverlayMode =
  | 'category'
  | 'state'
  | 'electronegativity'
  | 'radius'
  | 'ionization'
  | 'melting'
  | 'density'
  | 'block'

export type RankingSortKey =
  | 'atomicNumber'
  | 'name'
  | 'atomicMass'
  | 'electronegativity'
  | 'atomicRadiusPm'
  | 'ionizationEnergyKjMol'
  | 'meltingPointC'
  | 'boilingPointC'
  | 'densityGPerCm3'
  | 'discoveryYear'

export type SortDir = 'asc' | 'desc'

export interface MetricRange {
  min: number
  max: number
}

export interface PeriodicMetricRanges {
  electronegativity: MetricRange
  radius: MetricRange
  ionization: MetricRange
  melting: MetricRange
  density: MetricRange
}

export const ELEMENT_CATEGORIES: ElementCategory[] = [
  'alkali-metal',
  'alkaline-earth',
  'transition-metal',
  'post-transition',
  'metalloid',
  'nonmetal',
  'halogen',
  'noble-gas',
  'lanthanide',
  'actinide',
]

export const CATEGORY_SHORT_LABEL: Record<ElementCategory, string> = {
  'alkali-metal': 'Alcalins',
  'alkaline-earth': 'Alc.-terr.',
  'transition-metal': 'Transition',
  'post-transition': 'Pauvres',
  metalloid: 'Métall.',
  nonmetal: 'Non-mét.',
  halogen: 'Halog.',
  'noble-gas': 'Nobles',
  lanthanide: 'Lanth.',
  actinide: 'Actin.',
}

export const BLOCK_META: Record<ElementBlock, { label: string; colorHex: string }> = {
  s: { label: 'Bloc s', colorHex: '#f43f5e' },
  p: { label: 'Bloc p', colorHex: '#38bdf8' },
  d: { label: 'Bloc d', colorHex: '#a78bfa' },
  f: { label: 'Bloc f', colorHex: '#f472b6' },
}

export const COLOR_MODES: Array<{ id: ColorOverlayMode; label: string }> = [
  { id: 'category', label: 'Famille' },
  { id: 'state', label: 'État (T°)' },
  { id: 'electronegativity', label: 'Électronégativité' },
  { id: 'radius', label: 'Rayon' },
  { id: 'ionization', label: 'Ionisation' },
  { id: 'melting', label: 'Fusion' },
  { id: 'density', label: 'Densité' },
  { id: 'block', label: 'Bloc s/p/d/f' },
]

export const STATE_COLOR_HEX: Record<'solid' | 'liquid' | 'gas' | 'unknown', string> = {
  solid: '#a1a1aa',
  liquid: '#38bdf8',
  gas: '#f59e0b',
  unknown: '#3f3f46',
}

export function computeMetricRanges(elements: ElementRecord[]): PeriodicMetricRanges {
  const minMax = (vals: Array<number | null>): MetricRange => {
    let min = Infinity
    let max = -Infinity
    for (const v of vals) {
      if (v === null || !Number.isFinite(v)) continue
      if (v < min) min = v
      if (v > max) max = v
    }
    return { min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 1 }
  }

  return {
    electronegativity: minMax(elements.map((e) => e.electronegativity)),
    radius: minMax(elements.map((e) => e.atomicRadiusPm)),
    ionization: minMax(elements.map((e) => e.ionizationEnergyKjMol)),
    melting: minMax(elements.map((e) => e.meltingPointC)),
    density: minMax(
      elements.map((e) =>
        e.densityGPerCm3 !== null && e.densityGPerCm3 > 0
          ? Math.log10(e.densityGPerCm3 + 0.001)
          : null,
      ),
    ),
  }
}

function computeHeatRgba(ratio: number): { bg: string; border: string } {
  const t = Math.max(0, Math.min(1, ratio))
  let r: number
  let g: number
  let b: number
  if (t < 0.5) {
    const u = t / 0.5
    r = Math.round(30 + (14 - 30) * u)
    g = Math.round(58 + (165 - 58) * u)
    b = Math.round(115 + (233 - 115) * u)
  } else {
    const u = (t - 0.5) / 0.5
    r = Math.round(14 + (245 - 14) * u)
    g = Math.round(165 + (158 - 165) * u)
    b = Math.round(233 + (11 - 233) * u)
  }
  const alpha = 0.14 + t * 0.24
  return {
    bg: `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`,
    border: `rgba(${r}, ${g}, ${b}, ${(0.35 + t * 0.3).toFixed(2)})`,
  }
}

export function getElementTileVisual(
  el: ElementRecord,
  colorMode: ColorOverlayMode,
  temperatureC: number,
  metricRanges: PeriodicMetricRanges,
): {
  bg?: string
  border?: string
  dotColor: string
  metricText: string
} {
  const catColor = CATEGORY_META[el.category].accentHex

  if (colorMode === 'category') {
    return {
      dotColor: catColor,
      metricText: formatFrNumber(el.atomicMass, el.atomicMass >= 100 ? 1 : 2),
    }
  }

  if (colorMode === 'block') {
    const bm = BLOCK_META[el.block]
    return {
      bg: `${bm.colorHex}18`,
      border: `${bm.colorHex}55`,
      dotColor: bm.colorHex,
      metricText: `bloc ${el.block}`,
    }
  }

  if (colorMode === 'state') {
    const st = getElementStateAtTemperature(el, temperatureC)
    const col = STATE_COLOR_HEX[st]
    return {
      bg: st === 'unknown' ? undefined : `${col}1c`,
      border: st === 'unknown' ? undefined : `${col}55`,
      dotColor: col,
      metricText:
        st === 'solid' ? '(s)' : st === 'liquid' ? '(l)' : st === 'gas' ? '(g)' : '?',
    }
  }

  if (colorMode === 'electronegativity') {
    if (el.electronegativity === null) return { dotColor: '#3f3f46', metricText: '—' }
    const { min, max } = metricRanges.electronegativity
    const heat = computeHeatRgba((el.electronegativity - min) / Math.max(0.01, max - min))
    return {
      bg: heat.bg,
      border: heat.border,
      dotColor: catColor,
      metricText: formatFrNumber(el.electronegativity, 2),
    }
  }

  if (colorMode === 'radius') {
    if (el.atomicRadiusPm === null) return { dotColor: '#3f3f46', metricText: '—' }
    const { min, max } = metricRanges.radius
    const heat = computeHeatRgba((el.atomicRadiusPm - min) / Math.max(1, max - min))
    return {
      bg: heat.bg,
      border: heat.border,
      dotColor: catColor,
      metricText: `${el.atomicRadiusPm} pm`,
    }
  }

  if (colorMode === 'ionization') {
    if (el.ionizationEnergyKjMol === null) return { dotColor: '#3f3f46', metricText: '—' }
    const { min, max } = metricRanges.ionization
    const heat = computeHeatRgba(
      (el.ionizationEnergyKjMol - min) / Math.max(1, max - min),
    )
    return {
      bg: heat.bg,
      border: heat.border,
      dotColor: catColor,
      metricText: `${Math.round(el.ionizationEnergyKjMol)}`,
    }
  }

  if (colorMode === 'melting') {
    if (el.meltingPointC === null) return { dotColor: '#3f3f46', metricText: '—' }
    const { min, max } = metricRanges.melting
    const heat = computeHeatRgba((el.meltingPointC - min) / Math.max(1, max - min))
    return {
      bg: heat.bg,
      border: heat.border,
      dotColor: catColor,
      metricText: `${Math.round(el.meltingPointC)}°`,
    }
  }

  if (el.densityGPerCm3 === null || el.densityGPerCm3 <= 0) {
    return { dotColor: '#3f3f46', metricText: '—' }
  }
  const { min, max } = metricRanges.density
  const logVal = Math.log10(el.densityGPerCm3 + 0.001)
  const heat = computeHeatRgba((logVal - min) / Math.max(0.01, max - min))
  return {
    bg: heat.bg,
    border: heat.border,
    dotColor: catColor,
    metricText:
      el.densityGPerCm3 < 0.05
        ? `${formatFrNumber(el.densityGPerCm3 * 1000, 1)} g/L`
        : formatFrNumber(el.densityGPerCm3, el.densityGPerCm3 >= 10 ? 1 : 2),
  }
}
