import { useId } from 'react'
import type { FlaskProbeType, VesselType } from '../../shared/chemistry.ts'
import { cn } from '@/lib/utils'

interface VesselArtworkProps {
  vesselType: VesselType
  fillRatio: number // 0..1
  liquidColorHex: string | null
  liquidOpacity: number
  hasSediment?: boolean
  sedimentColorHex?: string | null
  sedimentRatio?: number // 0..1
  precipitating?: boolean
  bubbling?: boolean
  continuousBubbling?: boolean
  stoppered?: boolean
  temperatureC?: number
  stirrerOn?: boolean
  heatingActive?: boolean
  dripping?: boolean
  probes?: FlaskProbeType[]
  size?: 'sm' | 'md'
  className?: string
}

interface VesselGeometry {
  viewBox: string
  outlinePath: string
  extraOutlinePath?: string
  innerClipPath: string
  ticks: Array<{ y: number; x1: number; x2: number; accent?: boolean }>
  glossPath: string
  stopperPath?: string
  liquidBottomY: number
  liquidTopY: number
  meniscusX: number
  meniscusRx: number
}

const GEOMETRIES: Record<VesselType, VesselGeometry> = {
  volumetric_flask: {
    viewBox: '0 0 80 96',
    outlinePath:
      'M32 10 H48 M34 10 V39 C34 46 14 55 14 71 C14 82 22 88 40 88 C58 88 66 82 66 71 C66 55 46 46 46 39 V10',
    innerClipPath:
      'M35.5 14 V39.5 C35.5 47 16 55.5 16 71 C16 80.5 23.5 86 40 86 C56.5 86 64 80.5 64 71 C64 55.5 44.5 47 44.5 39.5 V14 Z',
    ticks: [{ y: 25, x1: 31, x2: 49, accent: true }],
    glossPath: 'M21 67 C21 60 25 55 29 52',
    stopperPath: 'M34 4 H46 L44.5 13 H35.5 Z',
    liquidBottomY: 86,
    liquidTopY: 25,
    meniscusX: 40,
    meniscusRx: 23,
  },
  erlenmeyer: {
    viewBox: '0 0 80 96',
    outlinePath:
      'M29 11 H51 M32 11 V31 L14 78 C12.5 82 15.5 87 20 87 H60 C64.5 87 67.5 82 66 78 L48 31 V11',
    innerClipPath:
      'M33.5 15 V31.5 L16 78 C15 81 17 85 20.5 85 H59.5 C63 85 65 81 64 78 L46.5 31.5 V15 Z',
    ticks: [
      { y: 48, x1: 42, x2: 49 },
      { y: 61, x1: 44, x2: 53 },
      { y: 74, x1: 47, x2: 57 },
    ],
    glossPath: 'M33 35 L20 74',
    stopperPath: 'M32.5 5 H47.5 L46 14 H34 Z',
    liquidBottomY: 85,
    liquidTopY: 36,
    meniscusX: 40,
    meniscusRx: 24,
  },
  beaker: {
    viewBox: '0 0 80 96',
    outlinePath:
      'M14 16 L18 20 V80 C18 84 21 87 25 87 H57 C61 87 64 84 64 80 V18 H66',
    innerClipPath:
      'M20 20 V79.5 C20 82.8 22.5 85 25.5 85 H56.5 C59.5 85 62 82.8 62 79.5 V20 Z',
    ticks: [
      { y: 36, x1: 48, x2: 58 },
      { y: 52, x1: 50, x2: 58 },
      { y: 68, x1: 48, x2: 58 },
    ],
    glossPath: 'M24 27 V76',
    liquidBottomY: 85,
    liquidTopY: 26,
    meniscusX: 41,
    meniscusRx: 21,
  },
  test_tube: {
    viewBox: '0 0 80 96',
    outlinePath:
      'M28 11 H52 M31 11 V72 C31 80.5 35 87 40 87 C45 87 49 80.5 49 72 V11',
    innerClipPath:
      'M32.5 15 V72 C32.5 79.5 35.8 85 40 85 C44.2 85 47.5 79.5 47.5 72 V15 Z',
    ticks: [
      { y: 40, x1: 41, x2: 47 },
      { y: 56, x1: 41, x2: 47 },
      { y: 70, x1: 41, x2: 47 },
    ],
    glossPath: 'M35.5 22 V68',
    stopperPath: 'M31.5 5 H48.5 L47 14 H33 Z',
    liquidBottomY: 85,
    liquidTopY: 24,
    meniscusX: 40,
    meniscusRx: 8,
  },
  graduated_cylinder: {
    viewBox: '0 0 80 96',
    outlinePath:
      'M26 11 L29 14 V83 H51 V13 H53 M20 88 H60 L55 83 H25 Z',
    innerClipPath: 'M30.5 15 V81.5 H49.5 V15 Z',
    ticks: [
      { y: 24, x1: 40, x2: 48 },
      { y: 34, x1: 42, x2: 48 },
      { y: 44, x1: 39, x2: 48, accent: true },
      { y: 54, x1: 42, x2: 48 },
      { y: 64, x1: 40, x2: 48 },
      { y: 74, x1: 42, x2: 48 },
    ],
    glossPath: 'M34 20 V77',
    liquidBottomY: 81.5,
    liquidTopY: 19,
    meniscusX: 40,
    meniscusRx: 9.5,
  },
  pipette: {
    viewBox: '0 0 80 96',
    outlinePath:
      'M35 8 H45 M37 8 V26 C31 32 31 52 37 58 V77 L39.2 89 H40.8 L43 77 V58 C49 52 49 32 43 26 V8',
    innerClipPath:
      'M38.2 12 V26.5 C32.6 32.5 32.6 51.5 38.2 57.5 V77 L39.8 87 H40.2 L41.8 77 V57.5 C47.4 51.5 47.4 32.5 41.8 26.5 V12 Z',
    ticks: [{ y: 17, x1: 34.5, x2: 45.5, accent: true }],
    glossPath: 'M35.5 34 C34.5 39 34.5 45 35.5 50',
    liquidBottomY: 84,
    liquidTopY: 17,
    meniscusX: 40,
    meniscusRx: 6,
  },
  burette: {
    viewBox: '0 0 80 96',
    outlinePath:
      'M31 8 H49 M33.5 8 V66 L38 71 V77 L39.4 89 H40.6 L42 77 V71 L46.5 66 V8',
    extraOutlinePath: 'M27 74 H53 M51 71 V77',
    innerClipPath:
      'M35 12 V65.5 L39 70 H41 L45 65.5 V12 Z',
    ticks: [
      { y: 18, x1: 38.5, x2: 44.5, accent: true },
      { y: 27, x1: 40, x2: 44.5 },
      { y: 36, x1: 38.5, x2: 44.5 },
      { y: 45, x1: 40, x2: 44.5 },
      { y: 54, x1: 38.5, x2: 44.5 },
      { y: 62, x1: 40, x2: 44.5 },
    ],
    glossPath: 'M37.5 16 V62',
    liquidBottomY: 69,
    liquidTopY: 18,
    meniscusX: 40,
    meniscusRx: 5,
  },
  round_bottom_flask: {
    viewBox: '0 0 80 96',
    outlinePath:
      'M31 10 H49 M33.5 10 V32 A27.5 27.5 0 1 0 46.5 32 V10',
    innerClipPath:
      'M35 14 V33.2 A25.8 25.8 0 1 0 45 33.2 V14 Z',
    ticks: [],
    glossPath: 'M21 56 A21 21 0 0 1 28 42',
    stopperPath: 'M33.5 4 H46.5 L45 13 H35 Z',
    liquidBottomY: 84.5,
    liquidTopY: 36,
    meniscusX: 40,
    meniscusRx: 25,
  },
}

export function VesselArtwork({
  vesselType,
  fillRatio,
  liquidColorHex,
  liquidOpacity,
  hasSediment = false,
  sedimentColorHex = null,
  sedimentRatio = 0.55,
  precipitating = false,
  bubbling = false,
  continuousBubbling = false,
  stoppered = false,
  temperatureC = 20,
  stirrerOn = false,
  heatingActive = false,
  dripping = false,
  probes = [],
  size = 'md',
  className,
}: VesselArtworkProps) {
  const clipId = useId()
  const geo = GEOMETRIES[vesselType] ?? GEOMETRIES.beaker
  const clampedRatio = Math.max(0, Math.min(1, fillRatio))
  const usableHeight = geo.liquidBottomY - geo.liquidTopY
  const liquidHeight = clampedRatio > 0 ? Math.max(6, usableHeight * clampedRatio) : 0
  const liquidY = geo.liquidBottomY - liquidHeight
  const fillColor = liquidColorHex ?? '#bae6fd'
  const isHeated = temperatureC >= 35 || heatingActive
  const isSteaming = temperatureC >= 70 && !stoppered && clampedRatio > 0
  const isBoiling = temperatureC >= 95
  const isChilled = temperatureC <= 10
  const showBubbles = (bubbling || continuousBubbling || isBoiling) && clampedRatio > 0
  const bubbleClass =
    continuousBubbling || isBoiling ? 'animate-dl-bubble-loop' : 'animate-dl-bubble'
  const showProbes = size === 'md' && probes.length > 0 && !stoppered

  return (
    <svg
      viewBox={geo.viewBox}
      fill="none"
      aria-hidden="true"
      className={cn(
        'shrink-0 select-none overflow-visible',
        size === 'sm' ? 'h-9 w-8' : 'h-[116px] w-[100px]',
        className,
      )}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={geo.innerClipPath} />
        </clipPath>
      </defs>

      {/* Hotplate / stirrer base indicator beneath vessel */}
      {(isHeated || stirrerOn) && size === 'md' && (
        <g>
          <rect
            x="16"
            y="90.5"
            width="48"
            height="4"
            rx="1.5"
            fill="#27272a"
            stroke="#52525b"
            strokeWidth="0.9"
          />
          {isHeated && (
            <line
              x1="22"
              y1="92.5"
              x2="58"
              y2="92.5"
              stroke={isBoiling || heatingActive ? '#f97316' : '#f59e0b'}
              strokeOpacity={isBoiling || heatingActive ? '0.9' : '0.6'}
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
        </g>
      )}
      {isHeated && size === 'sm' && (
        <line
          x1="20"
          y1="92"
          x2="60"
          y2="92"
          stroke={isBoiling ? '#f97316' : '#f59e0b'}
          strokeOpacity={isBoiling ? '0.85' : '0.55'}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      )}
      {isChilled && !isHeated && (
        <line
          x1="22"
          y1="92"
          x2="58"
          y2="92"
          stroke="#38bdf8"
          strokeOpacity="0.65"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}

      {/* Subtle steam / vapor wisps above hot vessel */}
      {isSteaming && size === 'md' && (
        <g stroke="#d4d4d8" strokeLinecap="round" fill="none">
          <path
            d="M35 8 C33 4 37 2 35 -2"
            strokeWidth="1.2"
            strokeOpacity={isBoiling ? '0.55' : '0.32'}
            className="animate-dl-vapor"
          />
          <path
            d="M44 9 C46 5 42 3 44 -1"
            strokeWidth="1.15"
            strokeOpacity={isBoiling ? '0.5' : '0.28'}
            className="animate-dl-vapor"
            style={{ animationDelay: '750ms' }}
          />
          {isBoiling && (
            <path
              d="M40 7 C38 3 42 0 40 -4"
              strokeWidth="1.1"
              strokeOpacity="0.45"
              className="animate-dl-vapor"
              style={{ animationDelay: '1350ms' }}
            />
          )}
        </g>
      )}

      {/* Subtle glass interior tint */}
      <path d={geo.innerClipPath} fill="rgba(255,255,255,0.025)" />

      {/* Liquid body clipped precisely to inner vessel contour */}
      <g clipPath={`url(#${clipId})`}>
        <g
          style={{
            transform: `translateY(${clampedRatio > 0 ? liquidY - geo.liquidTopY : usableHeight + 12}px)`,
            opacity: clampedRatio > 0 ? 1 : 0,
            transition:
              'transform 320ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease',
          }}
        >
          <rect
            x="0"
            y={geo.liquidTopY}
            width="80"
            height={usableHeight + 14}
            fill={fillColor}
            fillOpacity={liquidOpacity}
            style={{ transition: 'fill 90ms ease, fill-opacity 90ms ease' }}
          />
          {/* Top meniscus rim */}
          <ellipse
            cx={geo.meniscusX}
            cy={geo.liquidTopY}
            rx={geo.meniscusRx}
            ry={2.1}
            fill={fillColor}
            fillOpacity={Math.min(0.95, liquidOpacity + 0.22)}
            style={{ transition: 'fill 90ms ease' }}
          />
          <line
            x1="10"
            y1={geo.liquidTopY}
            x2="70"
            y2={geo.liquidTopY}
            stroke="#ffffff"
            strokeOpacity="0.22"
            strokeWidth="0.9"
          />
        </g>

        {/* Falling precipitate suspension flakes */}
        {precipitating && clampedRatio > 0 && size === 'md' && (
          <g fill={sedimentColorHex ?? '#f4f4f5'}>
            {[
              { dx: -9, dy: 24, r: 1.4, delay: '0ms' },
              { dx: 3, dy: 28, r: 1.2, delay: '280ms' },
              { dx: -2, dy: 19, r: 1.5, delay: '560ms' },
              { dx: 8, dy: 22, r: 1.3, delay: '840ms' },
              { dx: -5, dy: 30, r: 1.1, delay: '1120ms' },
            ].map((flake, i) => (
              <circle
                key={i}
                cx={geo.meniscusX + Math.max(-geo.meniscusRx * 0.65, Math.min(geo.meniscusRx * 0.65, flake.dx))}
                cy={Math.max(liquidY + 4, geo.liquidBottomY - flake.dy)}
                r={flake.r}
                className="animate-dl-precipitate"
                style={{ animationDelay: flake.delay }}
              />
            ))}
          </g>
        )}

        {/* Immersed solid / precipitate / crystalline deposit at vessel bottom */}
        {hasSediment && clampedRatio > 0 && (
          <g>
            {(() => {
              const sHeight = 3.5 + Math.max(0.15, Math.min(1, sedimentRatio)) * 5.5
              const sColor = sedimentColorHex ?? '#e4e4e7'
              return (
                <>
                  <rect
                    x="10"
                    y={geo.liquidBottomY - sHeight}
                    width="60"
                    height={sHeight + 2}
                    fill={sColor}
                    fillOpacity="0.82"
                    style={{ transition: 'fill 90ms ease, y 90ms ease, height 90ms ease' }}
                  />
                  <ellipse
                    cx={geo.meniscusX}
                    cy={geo.liquidBottomY - sHeight}
                    rx={geo.meniscusRx * 0.78}
                    ry="2.0"
                    fill={sColor}
                    fillOpacity="0.94"
                    style={{ transition: 'fill 90ms ease, cy 90ms ease' }}
                  />
                  {size === 'md' && (
                    <g fill="#ffffff" fillOpacity="0.28">
                      <circle cx={geo.meniscusX - 6} cy={geo.liquidBottomY - sHeight * 0.45} r="1" />
                      <circle cx={geo.meniscusX + 5} cy={geo.liquidBottomY - sHeight * 0.55} r="0.9" />
                      <circle cx={geo.meniscusX + 1} cy={geo.liquidBottomY - sHeight * 0.3} r="0.8" />
                    </g>
                  )}
                </>
              )
            })()}
          </g>
        )}

        {/* Magnetic PTFE stir bar spinning at vessel bottom */}
        {stirrerOn && size === 'md' && vesselType !== 'burette' && vesselType !== 'pipette' && (
          <rect
            x={geo.meniscusX - 7}
            y={geo.liquidBottomY - 4.2}
            width="14"
            height="3"
            rx="1.5"
            fill="#f4f4f5"
            stroke="#71717a"
            strokeWidth="0.6"
            className="animate-dl-stir"
          />
        )}

        {/* Effervescence, dissolution, or boiling bubbles */}
        {showBubbles && (
          <g>
            <circle
              cx={geo.meniscusX - Math.min(7, geo.meniscusRx * 0.45)}
              cy={geo.liquidBottomY - 12}
              r="2"
              fill="#ffffff"
              fillOpacity="0.6"
              className={bubbleClass}
            />
            <circle
              cx={geo.meniscusX + Math.min(5, geo.meniscusRx * 0.35)}
              cy={geo.liquidBottomY - 16}
              r="1.5"
              fill="#ffffff"
              fillOpacity="0.55"
              className={bubbleClass}
              style={{ animationDelay: '180ms' }}
            />
            <circle
              cx={geo.meniscusX}
              cy={geo.liquidBottomY - 9}
              r="1.8"
              fill="#ffffff"
              fillOpacity="0.5"
              className={bubbleClass}
              style={{ animationDelay: '420ms' }}
            />
            {(continuousBubbling || isBoiling) && (
              <>
                <circle
                  cx={geo.meniscusX - Math.min(3, geo.meniscusRx * 0.2)}
                  cy={geo.liquidBottomY - 20}
                  r="1.3"
                  fill="#ffffff"
                  fillOpacity="0.5"
                  className={bubbleClass}
                  style={{ animationDelay: '650ms' }}
                />
                <circle
                  cx={geo.meniscusX + Math.min(8, geo.meniscusRx * 0.5)}
                  cy={geo.liquidBottomY - 11}
                  r="1.6"
                  fill="#ffffff"
                  fillOpacity="0.45"
                  className={bubbleClass}
                  style={{ animationDelay: '880ms' }}
                />
              </>
            )}
          </g>
        )}
      </g>

      {/* Immersed laboratory probes (pH electrode, thermometer, conductivity cell) */}
      {showProbes && (
        <g>
          {probes.includes('ph') && (
            <g>
              <line
                x1={geo.meniscusX - 4}
                y1="3"
                x2={geo.meniscusX - 4}
                y2={Math.min(geo.liquidBottomY - 9, Math.max(liquidY + 12, 46))}
                stroke="#d4d4d8"
                strokeWidth="1.9"
                strokeLinecap="round"
              />
              <circle
                cx={geo.meniscusX - 4}
                cy={Math.min(geo.liquidBottomY - 8, Math.max(liquidY + 13, 47))}
                r="2"
                fill="#38bdf8"
                fillOpacity="0.85"
              />
            </g>
          )}
          {probes.includes('thermometer') && (
            <g>
              <line
                x1={geo.meniscusX + 4}
                y1="2"
                x2={geo.meniscusX + 4}
                y2={Math.min(geo.liquidBottomY - 10, Math.max(liquidY + 10, 44))}
                stroke="#a1a1aa"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <circle
                cx={geo.meniscusX + 4}
                cy={Math.min(geo.liquidBottomY - 9, Math.max(liquidY + 11, 45))}
                r="1.8"
                fill={temperatureC >= 40 ? '#ef4444' : '#f87171'}
              />
            </g>
          )}
          {probes.includes('conductimeter') && (
            <g>
              <line
                x1={geo.meniscusX}
                y1="4"
                x2={geo.meniscusX}
                y2={Math.min(geo.liquidBottomY - 11, Math.max(liquidY + 11, 45))}
                stroke="#a1a1aa"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <rect
                x={geo.meniscusX - 2}
                y={Math.min(geo.liquidBottomY - 12, Math.max(liquidY + 10, 44))}
                width="4"
                height="3.5"
                rx="0.6"
                fill="#e4e4e7"
              />
            </g>
          )}
        </g>
      )}

      {/* Active dripping droplet beneath burette tip */}
      {dripping && vesselType === 'burette' && clampedRatio > 0 && (
        <ellipse
          cx="40"
          cy="90"
          rx="1.6"
          ry="2.2"
          fill={fillColor}
          fillOpacity="0.9"
          className="animate-dl-drip"
        />
      )}

      {/* Optional lab stopper */}
      {stoppered && geo.stopperPath && (
        <path
          d={geo.stopperPath}
          fill="#27272a"
          stroke="#d4d4d8"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      )}

      {/* Graduation / calibration marks */}
      {geo.ticks.map((t, idx) => (
        <line
          key={idx}
          x1={t.x1}
          y1={t.y}
          x2={t.x2}
          y2={t.y}
          stroke={t.accent ? '#a1a1aa' : '#52525b'}
          strokeWidth={t.accent ? '1.3' : '1'}
          strokeLinecap="round"
        />
      ))}

      {/* Subtle glass specular stroke */}
      <path
        d={geo.glossPath}
        stroke="#ffffff"
        strokeOpacity="0.14"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      {/* Crisp vessel glass outline */}
      <path
        d={geo.outlinePath}
        stroke="#a1a1aa"
        strokeWidth={size === 'sm' ? '2.1' : '1.65'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Extra mechanical feature (e.g. burette stopcock) */}
      {geo.extraOutlinePath && (
        <path
          d={geo.extraOutlinePath}
          stroke="#d4d4d8"
          strokeWidth={size === 'sm' ? '2.2' : '1.8'}
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}
