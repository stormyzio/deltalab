import { useMemo } from 'react'
import type { LewisStructure } from '../../shared/chemistry.ts'
import {
  computeBondSegments,
  computeChargeBadgePos,
  computeLonePairBars,
  extractComponents,
  formatLewisCharge,
  getLewisAtomColor,
} from '@/lib/lewis-geometry'
import { cn } from '@/lib/utils'

interface LewisDiagramProps {
  structure: LewisStructure
  className?: string
  compact?: boolean
  ariaLabel?: string
}

export function LewisDiagram({
  structure,
  className,
  compact = false,
  ariaLabel = 'Schéma de Lewis',
}: LewisDiagramProps) {
  const layout = useMemo(() => {
    const { atoms } = structure
    if (atoms.length === 0) {
      return {
        viewBox: '-60 -40 120 80',
        atomById: new Map(),
        components: [],
      }
    }

    const atomById = new Map(atoms.map((a) => [a.id, a]))
    const components = extractComponents(structure)

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    for (const a of atoms) {
      const margin = a.charge !== 0 && a.lonePairs > 0 ? 29 : a.lonePairs > 0 ? 24 : 18
      minX = Math.min(minX, a.x - margin)
      maxX = Math.max(maxX, a.x + margin)
      minY = Math.min(minY, a.y - margin)
      maxY = Math.max(maxY, a.y + margin)
    }

    const totalCharge =
      structure.totalCharge ?? atoms.reduce((sum, a) => sum + a.charge, 0)
    const hasOuterIonBrackets =
      !structure.ionic && totalCharge !== 0 && atoms.length > 1
    const hasIonicBrackets = Boolean(structure.ionic)

    const padX = hasOuterIonBrackets ? 30 : hasIonicBrackets ? 24 : 16
    const padRightExtra = hasOuterIonBrackets || hasIonicBrackets ? 14 : 6
    const padY = hasOuterIonBrackets ? 18 : 14

    minX -= padX
    maxX += padX + padRightExtra
    minY -= padY
    maxY += padY

    const rawW = maxX - minX
    const rawH = maxY - minY
    const minW = compact ? 124 : 148
    const minH = compact ? 76 : 92

    const w = Math.max(rawW, minW)
    const h = Math.max(rawH, minH)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2

    return {
      viewBox: `${(cx - w / 2).toFixed(1)} ${(cy - h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`,
      atomById,
      components,
      totalCharge,
      hasOuterIonBrackets,
    }
  }, [structure, compact])

  const { atoms, bonds } = structure
  if (atoms.length === 0) return null

  return (
    <svg
      viewBox={layout.viewBox}
      role="img"
      aria-label={ariaLabel}
      className={cn('block h-full w-full select-none', className)}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Brackets for ionic compound fragments */}
      {structure.ionic &&
        layout.components.map((comp, idx) => {
          const isPoly = comp.atoms.length > 1
          const hasLonePairs = comp.atoms.some((a) => a.lonePairs > 0)
          if (!isPoly && !hasLonePairs) return null
          const pad = isPoly ? 26 : 21
          const x1 = comp.minX - pad
          const x2 = comp.maxX + pad
          const y1 = comp.minY - pad
          const y2 = comp.maxY + pad
          const tick = 7
          const qText = formatLewisCharge(comp.totalCharge)
          return (
            <g key={`ion-bracket-${idx}`}>
              <path
                d={`M ${x1 + tick} ${y1} H ${x1} V ${y2} H ${x1 + tick}`}
                fill="none"
                stroke="#52525b"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={`M ${x2 - tick} ${y1} H ${x2} V ${y2} H ${x2 - tick}`}
                fill="none"
                stroke="#52525b"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {qText && (
                <text
                  x={x2 + 4}
                  y={y1 + 5}
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="var(--font-mono)"
                  fill={comp.totalCharge > 0 ? '#7dd3fc' : '#fda4af'}
                >
                  {qText}
                </text>
              )}
            </g>
          )
        })}

      {/* Outer brackets for standalone polyatomic ions */}
      {layout.hasOuterIonBrackets &&
        layout.components.length === 1 &&
        (() => {
          const comp = layout.components[0]
          const pad = 31
          const x1 = comp.minX - pad
          const x2 = comp.maxX + pad
          const y1 = comp.minY - pad
          const y2 = comp.maxY + pad
          const tick = 8
          const qText = formatLewisCharge(layout.totalCharge ?? 0)
          return (
            <g>
              <path
                d={`M ${x1 + tick} ${y1} H ${x1} V ${y2} H ${x1 + tick}`}
                fill="none"
                stroke="#52525b"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={`M ${x2 - tick} ${y1} H ${x2} V ${y2} H ${x2 - tick}`}
                fill="none"
                stroke="#52525b"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {qText && (
                <text
                  x={x2 + 5}
                  y={y1 + 6}
                  fontSize="12"
                  fontWeight="600"
                  fontFamily="var(--font-mono)"
                  fill={(layout.totalCharge ?? 0) > 0 ? '#7dd3fc' : '#fda4af'}
                >
                  {qText}
                </text>
              )}
            </g>
          )
        })()}

      {/* Covalent bonds (clipped neatly outside atom labels) */}
      <g>
        {bonds.map((bond, idx) => {
          const a = layout.atomById.get(bond.from)
          const b = layout.atomById.get(bond.to)
          if (!a || !b) return null
          const segments = computeBondSegments(a, b, bond.order)
          return (
            <g key={`b-${bond.from}-${bond.to}-${idx}`}>
              {segments.map((seg, sIdx) => (
                <line
                  key={sIdx}
                  x1={seg.x1}
                  y1={seg.y1}
                  x2={seg.x2}
                  y2={seg.y2}
                  stroke="#d4d4d8"
                  strokeWidth="1.85"
                  strokeLinecap="round"
                />
              ))}
            </g>
          )
        })}
      </g>

      {/* Non-bonding lone pairs (French textbook bar style) */}
      <g>
        {atoms.map((atom) => {
          const bars = computeLonePairBars(atom, atoms, bonds)
          if (bars.length === 0) return null
          return (
            <g key={`lp-${atom.id}`}>
              {bars.map((bar, bIdx) => (
                <line
                  key={bIdx}
                  x1={bar.x1}
                  y1={bar.y1}
                  x2={bar.x2}
                  y2={bar.y2}
                  stroke="#7dd3fc"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              ))}
            </g>
          )
        })}
      </g>

      {/* Atom symbols & formal charges */}
      <g>
        {atoms.map((atom) => {
          const isMonoatomicInBracket =
            Boolean(structure.ionic) &&
            atom.lonePairs > 0 &&
            !bonds.some((b) => b.from === atom.id || b.to === atom.id)
          const showAtomCharge = atom.charge !== 0 && !isMonoatomicInBracket
          const chargePos = showAtomCharge
            ? computeChargeBadgePos(atom, atoms, bonds)
            : null
          const chargeLabel = showAtomCharge ? formatLewisCharge(atom.charge) : ''

          return (
            <g key={`a-${atom.id}`}>
              <text
                x={atom.x}
                y={atom.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={atom.symbol.length > 1 ? '13.5' : '15'}
                fontWeight="600"
                fontFamily="var(--font-sans)"
                fill={getLewisAtomColor(atom.symbol)}
              >
                {atom.symbol}
              </text>

              {chargePos && chargeLabel && (
                <g>
                  <circle
                    cx={chargePos.x}
                    cy={chargePos.y}
                    r={chargeLabel.length > 1 ? 8 : 6.5}
                    fill="#131317"
                    stroke={atom.charge > 0 ? '#38bdf8' : '#fb7185'}
                    strokeOpacity="0.65"
                    strokeWidth="1"
                  />
                  <text
                    x={chargePos.x}
                    y={chargePos.y + 0.4}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={chargeLabel.length > 1 ? '8.5' : '10'}
                    fontWeight="700"
                    fontFamily="var(--font-mono)"
                    fill={atom.charge > 0 ? '#7dd3fc' : '#fda4af'}
                  >
                    {chargeLabel}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </g>
    </svg>
  )
}
