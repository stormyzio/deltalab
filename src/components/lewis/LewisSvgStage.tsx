import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { LocateFixed, Minus, Plus } from 'lucide-react'
import type { LewisAtom, LewisBond } from '../../../shared/chemistry.ts'
import {
  computeBondSegments,
  computeChargeBadgePos,
  computeLonePairBars,
  formatLewisCharge,
  getLewisAtomColor,
} from '@/lib/lewis-geometry'
import { cn } from '@/lib/utils'
import {
  type BuilderTool,
  type LewisViewport,
  normalizeBondKey,
} from '@/components/lewis/lewis-editor-utils'
import type { LewisAtomDiagnostic } from '@/components/lewis/lewis-validation'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export interface BondPreviewState {
  fromId: string
  toX: number
  toY: number
  hoverAtomId: string | null
  sproutSymbol: string | null
}

export interface LiveIonBracket {
  x1: number
  x2: number
  y1: number
  y2: number
  qText: string
  positive: boolean
}

interface LewisSvgStageProps {
  svgRef: RefObject<SVGSVGElement | null>
  viewport: LewisViewport
  spacePressed: boolean
  isPanning: boolean
  strictMode: boolean
  diagnosticsByAtomId: Map<string, LewisAtomDiagnostic>
  tool: BuilderTool
  activeSymbol: string
  atoms: LewisAtom[]
  bonds: LewisBond[]
  atomById: Map<string, LewisAtom>
  selectedAtomId: string | null
  selectedBondKey: string | null
  pendingBondFromId: string | null
  bondPreview: BondPreviewState | null
  liveIonBracket: LiveIonBracket | null
  onZoomStep: (delta: number) => void
  onResetViewport: () => void
  onSvgBackgroundDown: (e: ReactPointerEvent<SVGSVGElement>) => void
  onSvgPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void
  onSvgPointerUp: (e: ReactPointerEvent<SVGSVGElement>) => void
  onSvgPointerCancel: () => void
  onAtomPointerDown: (e: ReactPointerEvent<SVGGElement>, atom: LewisAtom) => void
  onBondPointerDown: (e: ReactPointerEvent<SVGGElement>, bond: LewisBond, bondKey: string) => void
}

export function LewisSvgStage({
  svgRef,
  viewport,
  spacePressed,
  isPanning,
  strictMode,
  diagnosticsByAtomId,
  tool,
  activeSymbol,
  atoms,
  bonds,
  atomById,
  selectedAtomId,
  selectedBondKey,
  pendingBondFromId,
  bondPreview,
  liveIonBracket,
  onZoomStep,
  onResetViewport,
  onSvgBackgroundDown,
  onSvgPointerMove,
  onSvgPointerUp,
  onSvgPointerCancel,
  onAtomPointerDown,
  onBondPointerDown,
}: LewisSvgStageProps) {
  return (
    <>
      {atoms.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="flex max-w-sm flex-col items-center text-center">
            <p className="text-xs font-medium text-zinc-200">
              Atome sélectionné : {activeSymbol}
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Cliquez sur le canevas pour poser {activeSymbol}. Sélectionnez ensuite un autre atome (ex. H) dans la palette et glissez ou cliquez sur un atome existant pour l’ajouter directement lié.
            </p>
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        aria-label="Zone de dessin de Lewis"
        onPointerDown={onSvgBackgroundDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={onSvgPointerUp}
        onPointerCancel={onSvgPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          'h-full w-full touch-none',
          isPanning
            ? 'cursor-grabbing'
            : spacePressed || tool === 'move'
              ? 'cursor-grab'
              : 'cursor-crosshair',
        )}
      >
        <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
        {/* Automatic outer brackets for polyatomic ions */}
        {liveIonBracket && (
          <g pointerEvents="none">
            <path
              d={`M ${liveIonBracket.x1 + 9} ${liveIonBracket.y1} H ${liveIonBracket.x1} V ${liveIonBracket.y2} H ${liveIonBracket.x1 + 9}`}
              fill="none"
              stroke="#52525b"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={`M ${liveIonBracket.x2 - 9} ${liveIonBracket.y1} H ${liveIonBracket.x2} V ${liveIonBracket.y2} H ${liveIonBracket.x2 - 9}`}
              fill="none"
              stroke="#52525b"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text
              x={liveIonBracket.x2 + 6}
              y={liveIonBracket.y1 + 6}
              fontSize="13"
              fontWeight="700"
              fontFamily="var(--font-mono)"
              fill={liveIonBracket.positive ? '#7dd3fc' : '#fda4af'}
            >
              {liveIonBracket.qText}
            </text>
          </g>
        )}

        {/* Live bond + sprouted ghost atom preview while dragging */}
        {bondPreview &&
          (() => {
            const fromAtom = atomById.get(bondPreview.fromId)
            if (!fromAtom) return null
            return (
              <g pointerEvents="none">
                <line
                  x1={fromAtom.x}
                  y1={fromAtom.y}
                  x2={bondPreview.toX}
                  y2={bondPreview.toY}
                  stroke={bondPreview.hoverAtomId ? '#7dd3fc' : '#a1a1aa'}
                  strokeWidth="2"
                  strokeDasharray={bondPreview.sproutSymbol ? undefined : '5 4'}
                  strokeOpacity={bondPreview.sproutSymbol ? 0.65 : 1}
                  strokeLinecap="round"
                />
                {bondPreview.sproutSymbol && !bondPreview.hoverAtomId && (
                  <g>
                    <circle
                      cx={bondPreview.toX}
                      cy={bondPreview.toY}
                      r={16}
                      fill="#131317"
                      fillOpacity={0.92}
                      stroke="#7dd3fc"
                      strokeWidth="1.25"
                      strokeDasharray="3 2.5"
                    />
                    <text
                      x={bondPreview.toX}
                      y={bondPreview.toY}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={bondPreview.sproutSymbol.length > 1 ? '14' : '16'}
                      fontWeight="600"
                      fontFamily="var(--font-sans)"
                      fill={getLewisAtomColor(bondPreview.sproutSymbol)}
                    >
                      {bondPreview.sproutSymbol}
                    </text>
                  </g>
                )}
              </g>
            )
          })()}

        {/* Drawn covalent bonds */}
        <g>
          {bonds.map((bond) => {
            const a = atomById.get(bond.from)
            const b = atomById.get(bond.to)
            if (!a || !b) return null
            const bKey = normalizeBondKey(bond.from, bond.to)
            const isSelected = selectedBondKey === bKey
            const segments = computeBondSegments(a, b, bond.order)
            return (
              <g
                key={bKey}
                onPointerDown={(e) => onBondPointerDown(e, bond, bKey)}
              >
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="transparent"
                  strokeWidth="16"
                />
                {segments.map((seg, idx) => (
                  <line
                    key={idx}
                    x1={seg.x1}
                    y1={seg.y1}
                    x2={seg.x2}
                    y2={seg.y2}
                    stroke={isSelected ? '#7dd3fc' : '#e4e4e7'}
                    strokeWidth={isSelected ? '2.4' : '2'}
                    strokeLinecap="round"
                  />
                ))}
              </g>
            )
          })}
        </g>

        {/* Non-bonding lone pair bars */}
        <g pointerEvents="none">
          {atoms.map((atom) => {
            const bars = computeLonePairBars(atom, atoms, bonds)
            if (bars.length === 0) return null
            return (
              <g key={`lp-${atom.id}`}>
                {bars.map((bar, idx) => (
                  <line
                    key={idx}
                    x1={bar.x1}
                    y1={bar.y1}
                    x2={bar.x2}
                    y2={bar.y2}
                    stroke="#7dd3fc"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                  />
                ))}
              </g>
            )
          })}
        </g>

        {/* Atoms */}
        <g>
          {atoms.map((atom) => {
            const isSelected = selectedAtomId === atom.id
            const isPendingBond = pendingBondFromId === atom.id
            const isBondHoverTarget = bondPreview?.hoverAtomId === atom.id
            const diagnostic = strictMode ? diagnosticsByAtomId.get(atom.id) : undefined
            const chargePos =
              atom.charge !== 0 ? computeChargeBadgePos(atom, atoms, bonds) : null
            const chargeLabel = formatLewisCharge(atom.charge)

            return (
              <g
                key={atom.id}
                onPointerDown={(e) => onAtomPointerDown(e, atom)}
                className={
                  tool === 'move' && !spacePressed
                    ? 'cursor-grab active:cursor-grabbing'
                    : undefined
                }
              >
                {diagnostic && <title>{`${atom.symbol} — ${diagnostic.detailsFr.join(' · ')}`}</title>}

                {/* Strict mode diagnostic ring (non-blocking visual feedback) */}
                {diagnostic && (
                  <circle
                    cx={atom.x}
                    cy={atom.y}
                    r={21}
                    fill={
                      diagnostic.severity === 'error'
                        ? 'rgba(248, 113, 113, 0.12)'
                        : 'rgba(251, 191, 36, 0.08)'
                    }
                    stroke={diagnostic.severity === 'error' ? '#f87171' : '#fbbf24'}
                    strokeWidth="1.35"
                    strokeDasharray={diagnostic.severity === 'error' ? undefined : '3.5 2.5'}
                    pointerEvents="none"
                  />
                )}

                <circle
                  cx={atom.x}
                  cy={atom.y}
                  r={18}
                  fill={
                    isBondHoverTarget
                      ? 'rgba(56, 189, 248, 0.14)'
                      : isSelected || isPendingBond
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'transparent'
                  }
                  stroke={
                    isBondHoverTarget
                      ? '#38bdf8'
                      : isPendingBond
                        ? '#7dd3fc'
                        : isSelected
                          ? '#a1a1aa'
                          : 'transparent'
                  }
                  strokeWidth="1.25"
                  strokeDasharray={isPendingBond ? '3 2.5' : undefined}
                />

                <text
                  x={atom.x}
                  y={atom.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={atom.symbol.length > 1 ? '14.5' : '16.5'}
                  fontWeight="600"
                  fontFamily="var(--font-sans)"
                  fill={getLewisAtomColor(atom.symbol)}
                >
                  {atom.symbol}
                </text>

                {/* Strict mode tiny diagnostic indicator pill */}
                {diagnostic && (
                  <g pointerEvents="none">
                    <rect
                      x={atom.x - 24}
                      y={atom.y - 24}
                      width={diagnostic.shortBadge.length > 1 ? 18 : 13}
                      height={13}
                      rx={6.5}
                      fill="#131317"
                      stroke={diagnostic.severity === 'error' ? '#f87171' : '#fbbf24'}
                      strokeWidth="1.1"
                    />
                    <text
                      x={atom.x - 24 + (diagnostic.shortBadge.length > 1 ? 9 : 6.5)}
                      y={atom.y - 17.3}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="8.5"
                      fontWeight="700"
                      fontFamily="var(--font-mono)"
                      fill={diagnostic.severity === 'error' ? '#fca5a5' : '#fde68a'}
                    >
                      {diagnostic.shortBadge}
                    </text>
                  </g>
                )}

                {chargePos && chargeLabel && (
                  <g pointerEvents="none">
                    <circle
                      cx={chargePos.x}
                      cy={chargePos.y}
                      r={chargeLabel.length > 1 ? 8.5 : 7}
                      fill="#131317"
                      stroke={atom.charge > 0 ? '#38bdf8' : '#fb7185'}
                      strokeWidth="1.15"
                    />
                    <text
                      x={chargePos.x}
                      y={chargePos.y + 0.5}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={chargeLabel.length > 1 ? '9' : '10.5'}
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
        </g>
      </svg>

      {/* Subtle bottom-left status bar */}
      <div className="pointer-events-none absolute bottom-3 left-3 right-36 truncate font-mono text-[10px] text-muted-foreground/80">
        <span>
          {tool === 'build' &&
            `Construire (${activeSymbol}) · Clic : poser/lier · Molette : zoom · Espace+glisser : naviguer`}
          {tool === 'move' &&
            'Déplacer · Glisser le fond : naviguer · Shift+glisser : lier · Alt+glisser : dupliquer'}
          {tool === 'bond' &&
            'Glisser A → B (ou cliquer A puis B) · Clic liaison : 1 → 2 → 3 · Molette : zoom'}
          {tool === 'lonepair' &&
            'Cliquer un atome : +1 doublet · Clic droit / Shift : −1'}
          {tool === 'charge' &&
            'Cliquer un atome : +1 charge · Clic droit / Shift : −1'}
        </span>
      </div>

      {/* Compact bottom-right zoom & recenter HUD */}
      <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-0.5 rounded-md border border-border bg-panel/90 p-0.5 shadow-sm">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onZoomStep(-0.18)}
              aria-label="Dézoomer"
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Minus className="h-3 w-3" strokeWidth={1.7} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Dézoomer</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onResetViewport}
              aria-label="Ajuster et centrer la vue"
              className="h-6 min-w-[42px] whitespace-nowrap rounded px-1.5 font-mono text-[10px] font-medium tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {Math.round(viewport.zoom * 100)} %
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Centrer le schéma (0)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onZoomStep(0.18)}
              aria-label="Zoomer"
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-3 w-3" strokeWidth={1.7} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Zoomer</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onResetViewport}
              aria-label="Recentrer le schéma"
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <LocateFixed className="h-3 w-3" strokeWidth={1.7} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Recentrer (0)</TooltipContent>
        </Tooltip>
      </div>
    </>
  )
}
