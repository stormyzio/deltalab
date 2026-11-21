export const WATER_MOLAR_MASS = 18.015

const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉']

export function toSubscript(n: number): string {
  return String(n)
    .split('')
    .map((ch) => SUBSCRIPT_DIGITS[Number(ch)] ?? ch)
    .join('')
}

export function roundTo(value: number, decimals = 6): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function formatQtyFr(value: number, maxDecimals = 2): string {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  })
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const cleaned = hex.replace('#', '')
  if (cleaned.length !== 6) return null
  const r = Number.parseInt(cleaned.slice(0, 2), 16)
  const g = Number.parseInt(cleaned.slice(2, 4), 16)
  const b = Number.parseInt(cleaned.slice(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
  return [r, g, b]
}

export function blendHexColors(
  weighted: Array<{ hex: string; weight: number }>,
): string | null {
  if (weighted.length === 0) return null
  let totalWeight = 0
  let rAcc = 0
  let gAcc = 0
  let bAcc = 0
  for (const item of weighted) {
    const rgb = hexToRgb(item.hex)
    if (!rgb) continue
    rAcc += rgb[0] * item.weight
    gAcc += rgb[1] * item.weight
    bAcc += rgb[2] * item.weight
    totalWeight += item.weight
  }
  if (totalWeight <= 0) return null
  const r = Math.round(rAcc / totalWeight)
  const g = Math.round(gAcc / totalWeight)
  const b = Math.round(bAcc / totalWeight)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
