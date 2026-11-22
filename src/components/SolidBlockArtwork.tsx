import { cn } from '@/lib/utils'

function adjustHexBrightness(hex: string, factor: number): string {
  const clean = hex.replace('#', '')
  const n = Number.parseInt(
    clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean,
    16,
  )
  if (!Number.isFinite(n)) return hex
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * factor)))
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * factor)))
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * factor)))
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

export function SolidBlockArtwork({
  colorHex,
  volumeCm3 = 1,
  size = 'md',
  className,
}: {
  colorHex: string
  volumeCm3?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const topColor = adjustHexBrightness(colorHex, 1.24)
  const leftColor = colorHex
  const rightColor = adjustHexBrightness(colorHex, 0.7)
  const edgeHighlight = adjustHexBrightness(colorHex, 1.45)

  // Subtle cube-root scaling for canvas blocks so larger volumes feel heftier without overflowing
  const basePx = size === 'sm' ? 28 : size === 'lg' ? 54 : 44
  const scaleFactor =
    size === 'md'
      ? Math.max(0.84, Math.min(1.22, 0.96 + Math.log10(Math.max(0.05, volumeCm3)) * 0.12))
      : 1
  const px = Math.round(basePx * scaleFactor)

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0 drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]', className)}
    >
      {/* Top isometric face */}
      <polygon
        points="32,8 56,20 32,32 8,20"
        fill={topColor}
        stroke={edgeHighlight}
        strokeOpacity="0.45"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      {/* Left front face */}
      <polygon
        points="8,20 32,32 32,56 8,44"
        fill={leftColor}
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* Right shaded face */}
      <polygon
        points="32,32 56,20 56,44 32,56"
        fill={rightColor}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* Crisp metallic bevel highlight along front top ridge */}
      <polyline
        points="9,20.5 32,32 55,20.5"
        stroke={edgeHighlight}
        strokeOpacity="0.65"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Isometric specular square aligned parallel to the top corner edges */}
      <polygon
        points="32,11 41,15.5 32,20 23,15.5"
        fill="white"
        fillOpacity="0.16"
      />
    </svg>
  )
}
