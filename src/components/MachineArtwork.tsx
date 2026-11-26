import type { PhysicalState } from '../../shared/chemistry.ts'
import { cn } from '@/lib/utils'

/**
 * Compact geometric phase glyph for canvas species tiles & drag ghosts so
 * solids (faceted crystal), liquids (droplet), gases (floating particles)
 * and ions (polarized ring) are visually distinct at a glance.
 */
export function SpeciesPhaseGlyph({
  phase,
  isIon = false,
  charge = 0,
  colorHex,
  className,
}: {
  phase: PhysicalState
  isIon?: boolean
  charge?: number
  colorHex?: string | null
  className?: string
}) {
  const tint = colorHex || (phase === 'liquid' ? '#bae6fd' : '#d4d4d8')

  if (isIon) {
    const sign = charge > 0 ? '+' : charge < 0 ? '−' : '·'
    return (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={cn('shrink-0', className)}
      >
        <circle
          cx="12"
          cy="12"
          r="8.5"
          stroke={colorHex || '#71717a'}
          strokeOpacity={colorHex ? 0.75 : 0.6}
          strokeWidth="1.3"
          strokeDasharray="3 2"
        />
        <circle
          cx="12"
          cy="12"
          r="5"
          fill={colorHex || '#a1a1aa'}
          fillOpacity={colorHex ? 0.35 : 0.16}
        />
        <text
          x="12"
          y="15"
          textAnchor="middle"
          fontSize="10"
          fontWeight="600"
          fill={colorHex || '#e4e4e7'}
        >
          {sign}
        </text>
      </svg>
    )
  }

  if (phase === 'solid') {
    return (
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className={cn('shrink-0', className)}
      >
        {/* Crisp enlarged isometric 3D solid cube */}
        <polygon points="16,3 28,9.5 16,16 4,9.5" fill={tint} fillOpacity="0.95" />
        <polygon points="4,9.5 16,16 16,29 4,22.5" fill={tint} fillOpacity="0.65" />
        <polygon points="16,16 28,9.5 28,22.5 16,29" fill={tint} fillOpacity="0.4" />
        <polyline
          points="4,9.5 16,16 28,9.5"
          stroke="white"
          strokeOpacity="0.34"
          strokeWidth="1"
        />
        <line
          x1="16"
          y1="16"
          x2="16"
          y2="29"
          stroke="white"
          strokeOpacity="0.24"
          strokeWidth="1"
        />
      </svg>
    )
  }

  if (phase === 'liquid') {
    return (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={cn('shrink-0', className)}
      >
        {/* Realistic fluid droplet */}
        <path
          d="M12 3.2 C12 3.2 5.6 10.7 5.6 14.8 A6.4 6.4 0 0 0 18.4 14.8 C18.4 10.7 12 3.2 12 3.2 Z"
          fill={tint}
          fillOpacity="0.52"
          stroke={tint}
          strokeOpacity="0.88"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path
          d="M9.1 14.6 A3.2 3.2 0 0 1 10.8 11.4"
          stroke="white"
          strokeOpacity="0.65"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  // Gas: floating dispersed vapor particles
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <circle cx="8" cy="9" r="3" fill={tint} fillOpacity="0.32" stroke={tint} strokeOpacity="0.7" strokeWidth="1" />
      <circle cx="16.2" cy="7.5" r="2.2" fill={tint} fillOpacity="0.24" stroke={tint} strokeOpacity="0.65" strokeWidth="1" />
      <circle cx="15" cy="15.8" r="3.4" fill={tint} fillOpacity="0.26" stroke={tint} strokeOpacity="0.65" strokeWidth="1" />
      <circle cx="7.4" cy="16.5" r="1.6" fill={tint} fillOpacity="0.55" />
    </svg>
  )
}

export function GasCollectorArtwork({
  fillRatio = 0,
  gasColorHex = '#cbd5e1',
  collecting = false,
  size = 'md',
  className,
}: {
  fillRatio?: number
  gasColorHex?: string
  collecting?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const clamped = Math.max(0, Math.min(1, fillRatio))
  const px = size === 'sm' ? 28 : 54
  // Horizontal graduated gas syringe barrel (x: 14..52, y: 18..46)
  const barrelX = 15
  const barrelW = 36
  const fillW = Math.round(barrelW * clamped)
  const plungerX = barrelX + fillW

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      {/* Left intake nozzle port */}
      <path
        d="M5 32 H15"
        stroke={collecting ? '#38bdf8' : '#71717a'}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <rect
        x="11"
        y="28.5"
        width="4"
        height="7"
        rx="1"
        fill="#27272a"
        stroke="#52525b"
        strokeWidth="1"
      />

      {/* Glass barrel background */}
      <rect
        x={barrelX}
        y="19"
        width={barrelW}
        height="26"
        rx="3"
        fill="#141418"
        stroke="#52525b"
        strokeWidth="1.3"
      />

      {/* Captured gas fill inside barrel */}
      {fillW > 1 && (
        <rect
          x={barrelX + 1}
          y="20"
          width={Math.max(0, fillW - 1)}
          height="24"
          rx="2"
          fill={gasColorHex}
          fillOpacity={0.28}
        />
      )}

      {/* Subtle gas particles when filled */}
      {clamped > 0.04 && (
        <g fill={gasColorHex} fillOpacity={0.7}>
          <circle cx={barrelX + Math.min(fillW - 3, 7)} cy="27" r="1.2" />
          {fillW > 12 && <circle cx={barrelX + fillW * 0.55} cy="36" r="1.1" />}
          {fillW > 20 && <circle cx={barrelX + fillW * 0.78} cy="29" r="1" />}
        </g>
      )}

      {/* Plunger head */}
      <rect
        x={Math.min(barrelX + barrelW - 3, Math.max(barrelX + 1, plungerX - 1.5))}
        y="20.5"
        width="3"
        height="23"
        rx="1"
        fill="#a1a1aa"
      />
      {/* Plunger rod & thumb tab extending right */}
      <line
        x1={Math.min(barrelX + barrelW, plungerX + 1.5)}
        y1="32"
        x2="58"
        y2="32"
        stroke="#71717a"
        strokeWidth="2"
      />
      <line
        x1="58"
        y1="25"
        x2="58"
        y2="39"
        stroke="#a1a1aa"
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* Graduation marks along top edge of barrel */}
      {[0.25, 0.5, 0.75].map((frac) => {
        const gx = barrelX + barrelW * frac
        return (
          <line
            key={frac}
            x1={gx}
            y1="19.5"
            x2={gx}
            y2="23.5"
            stroke="#71717a"
            strokeWidth="1"
          />
        )
      })}

      {/* Specular highlight line on glass */}
      <line
        x1={barrelX + 3}
        y1="22.5"
        x2={barrelX + barrelW - 3}
        y2="22.5"
        stroke="white"
        strokeOpacity="0.16"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ThermalChamberArtwork({
  temperatureC = 20,
  sampleState = null,
  sampleColorHex = '#cbd5e1',
  powerOn = true,
  size = 'md',
  className,
}: {
  temperatureC?: number
  sampleState?: PhysicalState | null
  sampleColorHex?: string
  powerOn?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const px = size === 'sm' ? 28 : 54
  const isCold = temperatureC < 5
  const isHot = temperatureC > 60
  const accent = !powerOn
    ? '#52525b'
    : isCold
      ? '#38bdf8'
      : isHot
        ? '#f97316'
        : '#71717a'

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      {/* Insulated laboratory chamber chassis */}
      <rect
        x="10"
        y="10"
        width="44"
        height="44"
        rx="8"
        fill="#141418"
        stroke={accent}
        strokeOpacity={powerOn ? 0.8 : 0.4}
        strokeWidth="1.5"
      />

      {/* Inner viewing chamber */}
      <rect
        x="17"
        y="16"
        width="30"
        height="26"
        rx="4"
        fill={isCold ? '#0c1f2e' : isHot ? '#27140d' : '#18181d'}
        stroke="#3f3f46"
        strokeWidth="1"
      />

      {/* Thermal coils at bottom of chamber */}
      <path
        d="M20 40 Q23 37 26 40 T32 40 T38 40 T44 40"
        stroke={accent}
        strokeOpacity={powerOn ? 0.75 : 0.25}
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />

      {/* Sample representation inside the chamber according to its live physical phase */}
      {sampleState === 'solid' && (
        <g>
          {/* Crisp crystalline cube */}
          <polygon
            points="32,21 40,25 32,29 24,25"
            fill={sampleColorHex}
            fillOpacity="0.95"
          />
          <polygon
            points="24,25 32,29 32,37 24,33"
            fill={sampleColorHex}
            fillOpacity="0.72"
          />
          <polygon
            points="32,29 40,25 40,33 32,37"
            fill={sampleColorHex}
            fillOpacity="0.5"
          />
        </g>
      )}

      {sampleState === 'liquid' && (
        <g>
          <path
            d="M19 31 Q25 29.5 32 31 T45 31 V40 A2 2 0 0 1 43 41 H21 A2 2 0 0 1 19 40 Z"
            fill={sampleColorHex}
            fillOpacity="0.6"
          />
          <path
            d="M19 31 Q25 29.5 32 31 T45 31"
            stroke="white"
            strokeOpacity="0.4"
            strokeWidth="1"
            fill="none"
          />
        </g>
      )}

      {sampleState === 'gas' && (
        <g fill={sampleColorHex} fillOpacity="0.72">
          <circle cx="24" cy="24" r="1.8" />
          <circle cx="34" cy="22" r="1.5" />
          <circle cx="40" cy="28" r="1.9" />
          <circle cx="28" cy="31" r="1.6" />
          <circle cx="36" cy="34" r="1.4" />
        </g>
      )}

      {/* Subtle status LED bar on bottom chassis */}
      <rect
        x="22"
        y="47"
        width="20"
        height="2.5"
        rx="1.25"
        fill={accent}
        fillOpacity={powerOn ? 0.85 : 0.25}
      />
    </svg>
  )
}
