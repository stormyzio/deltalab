import { useMemo, useState } from 'react'
import { Pause, Play, RotateCcw, X } from 'lucide-react'
import type {
  CanvasFlaskNode,
  PhIndicatorId,
} from '../../../shared/chemistry.ts'
import { formatConcMolL, formatFrNumber } from '@/lib/chemistry-ui'
import { cn } from '@/lib/utils'
import {
  PH_INDICATORS,
  PH_INDICATOR_BY_ID,
  evaluateIndicatorVisual,
} from '@/lib/lab-indicators'
import {
  type TitrationPoint,
  computeDerivativesAndEquivalences,
  getPrimarySoluteConcentration,
} from '@/lib/titration-engine'
import { Button } from '@/components/ui/button'
import { ChemVar } from '@/components/ui/chem-text'
import { DualSwitch, Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export interface TitrationSessionState {
  buretteId: string
  analyteId: string
  initialAnalyteVolumeMl: number
  initialAnalyteSolutesMol: Record<string, number>
  initialBuretteVolumeMl: number
  initialBuretteSolutesMol: Record<string, number>
  volumeAddedMl: number
  running: boolean
  speedMultiplier: 1 | 2 | 4
  points: Array<{
    volumeAddedMl: number
    ph: number
    conductivityMsCm: number
    indicatorColorHex: string | null
  }>
}

interface TitrationDrawerProps {
  session: TitrationSessionState
  burettes: CanvasFlaskNode[]
  analytes: CanvasFlaskNode[]
  burette: CanvasFlaskNode | null
  analyte: CanvasFlaskNode | null
  onChangePair: (buretteId: string, analyteId: string) => void
  onDispenseMl: (volumeMl: number) => void
  onToggleRunning: () => void
  onCycleSpeed: () => void
  onResetSession: () => void
  onSetAnalyteIndicator: (indicatorId: PhIndicatorId | null) => void
  onClose: () => void
}

export function TitrationDrawer({
  session,
  burettes,
  analytes,
  burette,
  analyte,
  onChangePair,
  onDispenseMl,
  onToggleRunning,
  onCycleSpeed,
  onResetSession,
  onSetAnalyteIndicator,
  onClose,
}: TitrationDrawerProps) {
  const [chartMode, setChartMode] = useState<'ph' | 'conductivity'>('ph')
  const [showDerivative, setShowDerivative] = useState(true)

  const { points, equivalences } = useMemo(
    () => computeDerivativesAndEquivalences(session.points),
    [session.points],
  )

  const latestPoint: TitrationPoint | null =
    points.length > 0 ? points[points.length - 1] : null

  const buretteRemainingMl = burette?.solution.totalVolumeMl ?? 0
  const buretteEmpty = !burette || buretteRemainingMl < 0.08
  const titrantConc = burette ? getPrimarySoluteConcentration(burette) : null
  const firstEq = equivalences[0] ?? null
  const estimatedAnalyteConc =
    firstEq && titrantConc && session.initialAnalyteVolumeMl > 0
      ? (titrantConc * firstEq.volumeMl) / session.initialAnalyteVolumeMl
      : null

  const activeIndicator = analyte?.indicatorId
    ? PH_INDICATOR_BY_ID[analyte.indicatorId]
    : null
  const liveColorHex =
    analyte?.indicatorId && latestPoint
      ? evaluateIndicatorVisual(analyte.indicatorId, latestPoint.ph).hex
      : null

  // SVG chart dimensions
  const W = 380
  const H = 152
  const padL = 32
  const padR = 14
  const padT = 10
  const padB = 22
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const maxV = Math.max(
    25,
    Math.ceil((Math.max(session.volumeAddedMl + 4, session.initialBuretteVolumeMl)) / 5) * 5,
  )
  const xForV = (v: number) => padL + (Math.min(maxV, Math.max(0, v)) / maxV) * plotW

  const yForPh = (ph: number) => padT + (1 - Math.max(0, Math.min(14, ph)) / 14) * plotH

  const maxSigma = useMemo(() => {
    let m = 2
    for (const p of points) if (p.conductivityMsCm > m) m = p.conductivityMsCm
    return Math.ceil(m * 1.15 * 2) / 2
  }, [points])
  const yForSigma = (s: number) => padT + (1 - Math.max(0, Math.min(maxSigma, s)) / maxSigma) * plotH

  const maxAbsDeriv = useMemo(() => {
    let m = 1
    for (const p of points) {
      const a = Math.abs(p.dpHdV)
      if (a > m) m = a
    }
    return m
  }, [points])
  const yForDeriv = (d: number) =>
    padT + (1 - Math.min(1, Math.abs(d) / maxAbsDeriv) * 0.85) * plotH

  const mainPolyline =
    points.length === 0
      ? ''
      : points
          .map((p) => {
            const x = xForV(p.volumeAddedMl)
            const y = chartMode === 'ph' ? yForPh(p.ph) : yForSigma(p.conductivityMsCm)
            return `${x.toFixed(1)},${y.toFixed(1)}`
          })
          .join(' ')

  const derivPolyline =
    chartMode !== 'ph' || !showDerivative || points.length < 3
      ? ''
      : points
          .map(
            (p) =>
              `${xForV(p.volumeAddedMl).toFixed(1)},${yForDeriv(p.dpHdV).toFixed(1)}`,
          )
          .join(' ')

  return (
    <section
      aria-label="Suivi de titrage"
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute bottom-3 right-3 z-20 flex w-[412px] max-w-[calc(100%-1.5rem)] flex-col rounded-xl border border-border bg-panel/95 shadow-2xl select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-medium text-foreground">Titrage</span>
          <span className="inline-block min-w-[82px] shrink-0 whitespace-nowrap text-[10.5px] tabular-nums text-muted-foreground">
            V = {formatFrNumber(session.volumeAddedMl, 1)} mL
          </span>
          <span
            aria-hidden={!liveColorHex}
            className={cn(
              'h-2.5 w-2.5 shrink-0 rounded-full border border-white/15',
              !liveColorHex && 'invisible',
            )}
            style={liveColorHex ? { backgroundColor: liveColorHex } : undefined}
            title={activeIndicator?.nameFr}
          />
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onResetSession}
                aria-label="Réinitialiser le titrage"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.6} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Réinitialiser le titrage</TooltipContent>
          </Tooltip>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Fermer le suivi de titrage"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.6} />
          </Button>
        </div>
      </div>

      {/* Pair selector (only shown if user has multiple burettes or analytes) */}
      {(burettes.length > 1 || analytes.length > 1) && (
        <div className="grid grid-cols-2 gap-1.5 border-b border-border/60 px-3 py-1.5">
          <select
            value={session.buretteId}
            onChange={(e) => onChangePair(e.target.value, session.analyteId)}
            aria-label="Burette titrante"
            className="h-6 min-w-0 rounded border border-border bg-card px-1.5 text-[10.5px] text-foreground focus-visible:outline-none"
          >
            {burettes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.customLabel || b.solution.labelFr || b.vessel.nameFr}
              </option>
            ))}
          </select>
          <select
            value={session.analyteId}
            onChange={(e) => onChangePair(session.buretteId, e.target.value)}
            aria-label="Solution titrée"
            className="h-6 min-w-0 rounded border border-border bg-card px-1.5 text-[10.5px] text-foreground focus-visible:outline-none"
          >
            {analytes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.customLabel || a.solution.labelFr || a.vessel.nameFr}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Burette stopcock controls */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-border/60 px-3 py-2">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={session.running ? 'secondary' : 'ghost'}
                size="icon-sm"
                disabled={buretteEmpty}
                onClick={onToggleRunning}
                aria-label={session.running ? 'Fermer le robinet' : 'Ouvrir le robinet'}
                className="h-7 w-7"
              >
                {session.running ? (
                  <Pause className="h-3.5 w-3.5" strokeWidth={1.8} />
                ) : (
                  <Play className="h-3.5 w-3.5" strokeWidth={1.8} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {session.running ? 'Fermer le robinet' : 'Versement continu'}
            </TooltipContent>
          </Tooltip>

          <button
            type="button"
            onClick={onCycleSpeed}
            title="Changer le débit continu"
            className="h-6 shrink-0 whitespace-nowrap rounded px-1.5 text-[10px] tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            ×{session.speedMultiplier}
          </button>
        </div>

        <div className="flex items-center gap-0.5">
          {[0.1, 0.5, 1, 5].map((step) => (
            <button
              key={step}
              type="button"
              disabled={buretteEmpty}
              onClick={() => onDispenseMl(step)}
              className="h-6 shrink-0 whitespace-nowrap rounded px-2 text-[10.5px] tabular-nums text-zinc-200 hover:bg-accent disabled:opacity-40"
            >
              +{formatFrNumber(step, step < 1 ? 1 : 0)}
            </button>
          ))}
          <span className="ml-0.5 text-[10px] text-muted-foreground">mL</span>
        </div>
      </div>

      {/* Live readout strip */}
      <dl className="grid grid-cols-3 divide-x divide-border/60 border-b border-border/60 py-1.5 text-center">
        <div className="min-w-0 px-1.5">
          <dt className="text-[9.5px] text-muted-foreground">pH</dt>
          <dd className="text-xs font-medium tabular-nums text-foreground">
            {latestPoint ? formatFrNumber(latestPoint.ph, 2) : '—'}
          </dd>
        </div>
        <div className="min-w-0 px-1.5">
          <dt className="text-[9.5px] text-muted-foreground">Conductivité</dt>
          <dd className="text-xs font-medium tabular-nums text-foreground">
            {latestPoint ? `${formatFrNumber(latestPoint.conductivityMsCm, 2)} mS` : '—'}
          </dd>
        </div>
        <div className="min-w-0 px-1.5">
          <dt className="text-[9.5px] text-muted-foreground">Burette</dt>
          <dd className="text-xs font-medium tabular-nums text-zinc-300">
            {formatFrNumber(buretteRemainingMl, 1)} mL
          </dd>
        </div>
      </dl>

      {/* Chart mode + Indicator strip */}
      <div className="flex items-center justify-between gap-2 px-3 pt-2">
        <div className="flex items-center gap-2.5">
          <DualSwitch
            leftLabel="pH(V)"
            rightLabel="σ(V)"
            checked={chartMode === 'conductivity'}
            onCheckedChange={(isCond) => setChartMode(isCond ? 'conductivity' : 'ph')}
            ariaLabel="Basculer entre pH et conductivité"
          />
          {chartMode === 'ph' && (
            <div className="inline-flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">dpH/dV</span>
              <Switch
                checked={showDerivative}
                onCheckedChange={setShowDerivative}
                ariaLabel="Afficher la dérivée dpH/dV"
              />
            </div>
          )}
        </div>

        <select
          value={analyte?.indicatorId ?? ''}
          onChange={(e) =>
            onSetAnalyteIndicator((e.target.value || null) as PhIndicatorId | null)
          }
          aria-label="Indicateur coloré"
          className="h-6 max-w-[138px] rounded border border-border bg-card px-1.5 text-[10.5px] text-foreground focus-visible:outline-none"
        >
          <option value="">Sans indicateur</option>
          {PH_INDICATORS.map((ind) => (
            <option key={ind.id} value={ind.id}>
              {ind.shortLabel}
            </option>
          ))}
        </select>
      </div>

      {/* SVG Plot */}
      <div className="px-2.5 pb-2 pt-1.5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[146px] w-full overflow-visible"
          role="img"
          aria-label={
            chartMode === 'ph'
              ? 'Courbe de titrage pH en fonction du volume versé'
              : 'Courbe conductimétrique en fonction du volume versé'
          }
        >
          {/* Indicator transition band on pH plot */}
          {chartMode === 'ph' &&
            activeIndicator &&
            activeIndicator.id !== 'universal' && (
              <rect
                x={padL}
                y={yForPh(activeIndicator.transitionHigh)}
                width={plotW}
                height={Math.max(
                  2,
                  yForPh(activeIndicator.transitionLow) -
                    yForPh(activeIndicator.transitionHigh),
                )}
                fill={activeIndicator.baseHex}
                fillOpacity="0.12"
              />
            )}

          {/* Horizontal grid lines */}
          {chartMode === 'ph'
            ? [0, 4, 7, 10, 14].map((val) => {
                const y = yForPh(val)
                return (
                  <g key={val}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={W - padR}
                      y2={y}
                      stroke={val === 7 ? '#52525b' : '#27272a'}
                      strokeDasharray={val === 7 ? '3 3' : undefined}
                      strokeWidth="0.9"
                    />
                    <text
                      x={padL - 5}
                      y={y + 3}
                      textAnchor="end"
                      fill="#71717a"
                      fontSize="9"
                      fontFamily="var(--font-sans)"
                    >
                      {val}
                    </text>
                  </g>
                )
              })
            : [0, 0.5, 1].map((frac) => {
                const val = maxSigma * frac
                const y = yForSigma(val)
                return (
                  <g key={frac}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={W - padR}
                      y2={y}
                      stroke="#27272a"
                      strokeWidth="0.9"
                    />
                    <text
                      x={padL - 5}
                      y={y + 3}
                      textAnchor="end"
                      fill="#71717a"
                      fontSize="9"
                      fontFamily="var(--font-sans)"
                    >
                      {formatFrNumber(val, 1)}
                    </text>
                  </g>
                )
              })}

          {/* X-axis ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const v = Math.round(maxV * frac)
            const x = xForV(v)
            return (
              <g key={frac}>
                <line
                  x1={x}
                  y1={padT}
                  x2={x}
                  y2={padT + plotH}
                  stroke="#1f1f23"
                  strokeWidth="0.8"
                />
                <text
                  x={x}
                  y={H - 5}
                  textAnchor="middle"
                  fill="#71717a"
                  fontSize="9"
                  fontFamily="var(--font-sans)"
                >
                  {v}
                </text>
              </g>
            )
          })}

          {/* Derivative curve (subtle) */}
          {derivPolyline && (
            <polyline
              fill="none"
              stroke="#71717a"
              strokeOpacity="0.65"
              strokeWidth="1.15"
              strokeDasharray="2 2"
              points={derivPolyline}
            />
          )}

          {/* Equivalence vertical markers */}
          {equivalences.map((eq, idx) => {
            const x = xForV(eq.volumeMl)
            const y = chartMode === 'ph' ? yForPh(eq.ph) : padT + plotH * 0.5
            return (
              <g key={`${eq.volumeMl}-${idx}`}>
                <line
                  x1={x}
                  y1={padT}
                  x2={x}
                  y2={padT + plotH}
                  stroke="#38bdf8"
                  strokeOpacity="0.7"
                  strokeDasharray="3 2"
                  strokeWidth="1"
                />
                {chartMode === 'ph' && (
                  <circle cx={x} cy={y} r="3" fill="#38bdf8" />
                )}
                <text
                  x={Math.min(W - padR - 14, x + 3)}
                  y={padT + 9 + idx * 11}
                  fill="#7dd3fc"
                  fontSize="8.5"
                  fontFamily="var(--font-sans)"
                >
                  V
                  <tspan dy="2" fontSize="6.5">
                    E{equivalences.length > 1 ? idx + 1 : ''}
                  </tspan>
                  <tspan dy="-2">={formatFrNumber(eq.volumeMl, 1)}</tspan>
                </text>
              </g>
            )
          })}

          {/* Main curve */}
          {mainPolyline && (
            <polyline
              fill="none"
              stroke={chartMode === 'ph' ? '#e4e4e7' : '#38bdf8'}
              strokeWidth="1.8"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={mainPolyline}
            />
          )}

          {/* Current tip point */}
          {latestPoint && (
            <circle
              cx={xForV(latestPoint.volumeAddedMl)}
              cy={
                chartMode === 'ph'
                  ? yForPh(latestPoint.ph)
                  : yForSigma(latestPoint.conductivityMsCm)
              }
              r="3.2"
              fill={liveColorHex ?? '#fafafa'}
              stroke="#09090b"
              strokeWidth="1.2"
            />
          )}
        </svg>
      </div>

      {/* Fixed-height equivalence footer so dispense buttons never jump vertically */}
      <div className="flex h-7 shrink-0 flex-nowrap items-center justify-between gap-2 overflow-hidden border-t border-border/60 px-3 text-[10.5px] tabular-nums">
        {equivalences.length > 0 ? (
          <>
            <span className="min-w-0 truncate text-zinc-300">
              {equivalences.map((eq, i) => (
                <span key={`${eq.volumeMl}-${i}`} className={i > 0 ? 'ml-2' : undefined}>
                  <ChemVar base="V" sub={equivalences.length > 1 ? `E${i + 1}` : 'E'} /> ={' '}
                  {formatFrNumber(eq.volumeMl, 1)} mL (pH {formatFrNumber(eq.ph, 1)})
                </span>
              ))}
            </span>
            {estimatedAnalyteConc !== null && (
              <span className="shrink-0 whitespace-nowrap text-sky-300">
                C ≈ {formatConcMolL(estimatedAnalyteConc)}
              </span>
            )}
          </>
        ) : (
          <span className="truncate font-sans text-[10.5px] text-muted-foreground/75">
            Équivalence : en attente
          </span>
        )}
      </div>
    </section>
  )
}
