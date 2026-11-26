import { ArrowUpRight, Power, Trash2 } from 'lucide-react'
import type { CanvasThermalChamberNode } from '../../../shared/chemistry.ts'
import { STATE_META, formatFrNumber, formatMol } from '@/lib/chemistry-ui'
import {
  MAX_CHAMBER_TEMP_C,
  MIN_CHAMBER_TEMP_C,
  THERMAL_PRESETS,
  describePhaseTransition,
  getPhaseContextualNameFr,
} from '@/lib/phase-changes'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChemFormula, StateTag } from '@/components/ui/chem-text'
import { Slider } from '@/components/ui/slider'
import { ThermalChamberArtwork } from '@/components/MachineArtwork'

export function ThermalChamberInspector({
  node,
  onSetTargetTemperature,
  onTogglePower,
  onExtractSample,
  onClearSample,
}: {
  node: CanvasThermalChamberNode
  onSetTargetTemperature: (tempC: number) => void
  onTogglePower: () => void
  onExtractSample: () => void
  onClearSample: () => void
}) {
  const sample = node.sample
  const curState = sample?.currentState ?? null
  const stdState = sample?.species.standardState ?? null
  const transitionLabel =
    curState && stdState ? describePhaseTransition(stdState, curState) : null
  const stateTag =
    curState === 'solid'
      ? 's'
      : curState === 'liquid'
        ? 'l'
        : curState === 'gas'
          ? 'g'
          : 'aq'

  const mp = sample?.solidBlock?.meltingPointC ?? sample?.species.meltingPointC ?? null
  const bp = sample?.species.boilingPointC ?? null
  const isSubliming =
    sample?.species.thermalNote === 'sublimes' ||
    (mp !== null && bp !== null && bp < mp)

  const tempColor =
    node.temperatureC < 5
      ? 'text-sky-300'
      : node.temperatureC > 80
        ? 'text-orange-300'
        : 'text-foreground'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <ThermalChamberArtwork
            temperatureC={node.temperatureC}
            sampleState={curState}
            sampleColorHex={
              sample?.solidBlock?.colorHex ??
              sample?.species.colorHex ??
              sample?.species.solutionColorHex ??
              '#bae6fd'
            }
            powerOn={node.powerOn}
            size="md"
          />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
              {node.label || 'Chambre thermique'}
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Cryostat · Condenseur · Four
            </p>
            <p className={cn('mt-0.5 text-xs font-semibold tabular-nums', tempColor)}>
              {formatFrNumber(node.temperatureC, 0)} °C
              {node.powerOn && Math.abs(node.temperatureC - node.targetTemperatureC) >= 1 && (
                <span className="ml-1.5 text-[10.5px] font-normal text-muted-foreground">
                  → {formatFrNumber(node.targetTemperatureC, 0)} °C
                </span>
              )}
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onTogglePower}
          aria-label={node.powerOn ? 'Mettre en veille' : 'Allumer la chambre'}
          className={cn(
            node.powerOn
              ? 'text-foreground hover:bg-accent'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Power className="h-3.5 w-3.5" strokeWidth={1.7} />
        </Button>
      </div>

      {/* Temperature target control */}
      <section className="space-y-2.5 border-t border-border/60 pt-3.5">
        <div className="flex items-baseline justify-between gap-2 text-[11px]">
          <span className="font-medium text-muted-foreground">Consigne thermique</span>
          <span className="tabular-nums text-foreground">
            {formatFrNumber(node.targetTemperatureC, 0)} °C
          </span>
        </div>

        <Slider
          min={MIN_CHAMBER_TEMP_C}
          max={MAX_CHAMBER_TEMP_C}
          step={1}
          snapPoints={[-196, -78, -20, 0, 20, 100, 350, 1200]}
          scaleStops={[
            { value: -210, position: 0 },
            { value: -100, position: 0.18 },
            { value: 0, position: 0.36 },
            { value: 120, position: 0.58 },
            { value: 400, position: 0.78 },
            { value: 1500, position: 1 },
          ]}
          value={node.targetTemperatureC}
          onChange={(val) => onSetTargetTemperature(Math.round(val))}
          ariaLabel="Température cible de la chambre thermique"
        />

        <div className="flex flex-wrap gap-1">
          {THERMAL_PRESETS.map((preset) => {
            const active = Math.abs(node.targetTemperatureC - preset.tempC) < 1
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSetTargetTemperature(preset.tempC)}
                title={preset.labelFr}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums',
                  active
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                {formatFrNumber(preset.tempC, 0)} °C
              </button>
            )
          })}
        </div>
      </section>

      {/* Loaded sample & phase state */}
      <section className="space-y-2.5 border-t border-border/60 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">
            Échantillon dans la chambre
          </span>
          {sample && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClearSample}
              aria-label="Vider la chambre"
              className="h-6 w-6 text-muted-foreground hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" strokeWidth={1.6} />
            </Button>
          )}
        </div>

        {!sample ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Glissez une espèce (solide, liquide, gaz), un bloc solide ou un collecteur de gaz sur
            cette chambre pour changer son état physique.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">
                  {sample.solidBlock
                    ? sample.solidBlock.nameFr
                    : getPhaseContextualNameFr(sample.species, sample.currentState)}{' '}
                  <span className="font-normal text-muted-foreground">
                    <ChemFormula value={sample.species.displayFormula} />
                    <StateTag state={stateTag} />
                  </span>
                </p>
                <p className="mt-0.5 text-[10.5px] tabular-nums text-muted-foreground">
                  {formatMol(sample.amountMol)} · État actuel :{' '}
                  <span className="text-zinc-200">
                    {STATE_META[sample.currentState].labelFr}
                  </span>
                  {transitionLabel ? ` (${transitionLabel})` : ''}
                </p>
              </div>
            </div>

            {/* Real phase thresholds from DB */}
            <dl className="grid grid-cols-2 gap-x-3 text-[11px]">
              <div>
                <dt className="text-muted-foreground">
                  {isSubliming ? 'Sublimation' : 'T° fusion'}
                </dt>
                <dd className="mt-0.5 font-medium tabular-nums text-foreground">
                  {isSubliming && bp !== null
                    ? `${formatFrNumber(bp, 1)} °C`
                    : mp !== null
                      ? `${formatFrNumber(mp, 1)} °C`
                      : '—'}
                </dd>
              </div>
              {!isSubliming && (
                <div>
                  <dt className="text-muted-foreground">T° ébullition</dt>
                  <dd className="mt-0.5 font-medium tabular-nums text-foreground">
                    {bp !== null
                      ? `${formatFrNumber(bp, 1)} °C`
                      : sample.species.thermalNote === 'decomposes'
                        ? 'Décomp.'
                        : '—'}
                  </dd>
                </div>
              )}
            </dl>

            {/* Quick jump buttons to trigger exact phase changes for THIS sample */}
            <div className="flex flex-wrap gap-1">
              {mp !== null && !isSubliming && (
                <button
                  type="button"
                  onClick={() =>
                    onSetTargetTemperature(Math.max(MIN_CHAMBER_TEMP_C, Math.floor(mp - 15)))
                  }
                  className="rounded px-2 py-0.5 text-[10.5px] text-sky-300 hover:bg-accent"
                >
                  Solidifier (&lt; {formatFrNumber(mp, 0)} °C)
                </button>
              )}
              {!isSubliming && (mp !== null || bp !== null) && (
                <button
                  type="button"
                  onClick={() => {
                    const target =
                      mp !== null && bp !== null
                        ? Math.round((mp + bp) / 2)
                        : mp !== null
                          ? Math.min(MAX_CHAMBER_TEMP_C, Math.ceil(mp + 20))
                          : Math.max(MIN_CHAMBER_TEMP_C, Math.floor((bp ?? 20) - 20))
                    onSetTargetTemperature(target)
                  }}
                  className="rounded px-2 py-0.5 text-[10.5px] text-zinc-200 hover:bg-accent"
                >
                  Phase liquide
                </button>
              )}
              {bp !== null && (
                <button
                  type="button"
                  onClick={() =>
                    onSetTargetTemperature(Math.min(MAX_CHAMBER_TEMP_C, Math.ceil(bp + 15)))
                  }
                  className="rounded px-2 py-0.5 text-[10.5px] text-orange-300 hover:bg-accent"
                >
                  Vaporiser (&gt; {formatFrNumber(bp, 0)} °C)
                </button>
              )}
              {isSubliming && bp !== null && (
                <button
                  type="button"
                  onClick={() =>
                    onSetTargetTemperature(Math.max(MIN_CHAMBER_TEMP_C, Math.floor(bp - 15)))
                  }
                  className="rounded px-2 py-0.5 text-[10.5px] text-sky-300 hover:bg-accent"
                >
                  Condenser solide (&lt; {formatFrNumber(bp, 0)} °C)
                </button>
              )}
            </div>

            <Button size="sm" variant="secondary" onClick={onExtractSample} className="w-full gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.7} />
              <span>
                Extraire en {STATE_META[sample.currentState].labelFr.toLowerCase()} (
                {stateTag})
              </span>
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
