import type {
  CanvasFlaskNode,
  FlaskProbeType,
  PhIndicatorId,
} from '../../../shared/chemistry.ts'
import { computeArrheniusSpeedFactor } from '../../../shared/ph-solver.ts'
import {
  formatCapacityMl,
  formatFrNumber,
  formatVolumeMl,
} from '@/lib/chemistry-ui'
import { PH_INDICATORS, PH_INDICATOR_BY_ID } from '@/lib/lab-indicators'
import { VOLUME_UNITS } from '@/lib/quantity-units'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrubNumberInput } from '@/components/ui/scrub-number-input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'

export function FlaskActionsTab({
  node,
  otherFlasks,
  stoppered,
  temperatureC,
  remainingMl,
  dilutionFactor,
  waterInput,
  onWaterInputChange,
  onSubmitWater,
  onAddWater,
  quickWaterSteps,
  onSetTemperature,
  onEvaporate,
  onSetIndicator,
  onToggleProbe,
  onToggleStirrer,
  onSetHeaterTarget,
  onOpenTitration,
}: {
  node: CanvasFlaskNode
  otherFlasks: CanvasFlaskNode[]
  stoppered: boolean
  temperatureC: number
  remainingMl: number
  dilutionFactor: number | null
  waterInput: string
  onWaterInputChange: (v: string) => void
  onSubmitWater: () => void
  onAddWater: (volumeMl: number) => void
  quickWaterSteps: number[]
  onSetTemperature: (t: number) => void
  onEvaporate: (ml: number) => void
  onSetIndicator: (indicatorId: PhIndicatorId | null) => void
  onToggleProbe: (probe: FlaskProbeType) => void
  onToggleStirrer: () => void
  onSetHeaterTarget: (targetC: number | null) => void
  onOpenTitration: (buretteId?: string, analyteId?: string) => void
}) {
  const { vessel, solution } = node
  const probes = node.probes ?? []
  const activeIndicator = node.indicatorId ? PH_INDICATOR_BY_ID[node.indicatorId] : null
  const heaterOn = typeof node.heaterTargetC === 'number'
  const arrheniusFactor = computeArrheniusSpeedFactor(temperatureC)
  const canStir = vessel.vesselType !== 'burette' && vessel.vesselType !== 'pipette'
  const titrationPartner =
    vessel.vesselType === 'burette'
      ? otherFlasks.find(
          (f) =>
            f.vessel.vesselType === 'beaker' ||
            f.vessel.vesselType === 'erlenmeyer' ||
            f.vessel.vesselType === 'round_bottom_flask',
        )
      : vessel.vesselType === 'beaker' ||
          vessel.vesselType === 'erlenmeyer' ||
          vessel.vesselType === 'round_bottom_flask'
        ? otherFlasks.find((f) => f.vessel.vesselType === 'burette')
        : null

  return (
    <div className="space-y-4">
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-medium text-muted-foreground">Eau & dilution</span>
          <span className="shrink-0 whitespace-nowrap font-mono text-[10.5px] tabular-nums text-muted-foreground">
            Libre : {formatVolumeMl(remainingMl)}
          </span>
        </div>

        {stoppered ? (
          <p className="text-[11px] text-muted-foreground">
            Verrerie bouchée : retirez le bouchon pour ajouter de l’eau.
          </p>
        ) : remainingMl <= 0.1 ? (
          <p className="text-[11px] text-muted-foreground">
            Capacité maximale atteinte ({formatCapacityMl(vessel.capacityMl)}).
          </p>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <ScrubNumberInput
                prefixLabel="V"
                value={Number.parseFloat(waterInput.replace(',', '.')) || 0}
                units={VOLUME_UNITS}
                defaultUnitId="mL"
                min={0.5}
                max={remainingMl}
                ariaLabel="Volume d’eau à ajouter"
                onChange={(ml) => onWaterInputChange(String(Math.round(ml * 10) / 10))}
                className="w-32 shrink-0"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={onSubmitWater}
                className="h-7 flex-1 text-[11px]"
              >
                {solution.hasWater ? 'Diluer (+H₂O)' : 'Ajouter H₂O'}
              </Button>
            </div>

            <div className="flex flex-wrap gap-1">
              {quickWaterSteps
                .filter((v) => v <= remainingMl + 0.05)
                .map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onAddWater(v)}
                    className="shrink-0 whitespace-nowrap rounded px-2 py-0.5 font-mono text-[10.5px] tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    +{v} mL
                  </button>
                ))}
            </div>

            {vessel.vesselType === 'volumetric_flask' && solution.hasWater && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAddWater(remainingMl)}
                className="h-7 w-full text-[11px] text-zinc-200"
              >
                Ajuster au trait ({formatCapacityMl(vessel.capacityMl)}
                {dilutionFactor && dilutionFactor > 1.05
                  ? ` · ×${formatFrNumber(dilutionFactor, 1)}`
                  : ''}
                )
              </Button>
            )}
          </>
        )}
      </section>

      {/* Sondes, agitation & indicateur coloré */}
      <section className="space-y-2.5 border-t border-border/60 pt-3.5">
        <span className="block text-[11px] font-medium text-muted-foreground">
          Sondes & équipement
        </span>

        <div className="divide-y divide-border/40">
          {(
            [
              { id: 'ph', label: 'pH-mètre' },
              { id: 'thermometer', label: 'Thermomètre' },
              { id: 'conductimeter', label: 'Conductimètre' },
            ] as const
          ).map((item) => {
            const active = probes.includes(item.id)
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 py-1.5"
              >
                <span className="text-[11.5px] text-foreground">{item.label}</span>
                <Switch
                  checked={active}
                  onCheckedChange={() => onToggleProbe(item.id)}
                  ariaLabel={item.label}
                />
              </div>
            )
          })}
          {canStir && (
            <div className="flex items-center justify-between gap-2 py-1.5">
              <span className="text-[11.5px] text-foreground">Agitateur magnétique</span>
              <Switch
                checked={Boolean(node.stirrerOn)}
                onCheckedChange={onToggleStirrer}
                ariaLabel="Agitateur magnétique"
              />
            </div>
          )}
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between gap-2 text-[10.5px] text-muted-foreground">
            <span>Indicateur coloré</span>
            {activeIndicator && (
              <span className="shrink-0 whitespace-nowrap font-mono text-[10px] tabular-nums">
                pH {formatFrNumber(activeIndicator.transitionLow, 1)}–
                {formatFrNumber(activeIndicator.transitionHigh, 1)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => onSetIndicator(null)}
              className={cn(
                'shrink-0 whitespace-nowrap rounded px-2 py-0.5 text-[10.5px] font-medium',
                !node.indicatorId
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              Aucun
            </button>
            {PH_INDICATORS.map((ind) => {
              const active = node.indicatorId === ind.id
              return (
                <button
                  key={ind.id}
                  type="button"
                  onClick={() => onSetIndicator(ind.id)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2 py-0.5 text-[10.5px] font-medium',
                    active
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: ind.baseHex }}
                  />
                  <span>{ind.shortLabel}</span>
                </button>
              )
            })}
          </div>
        </div>

        {titrationPartner && (
          <div className="pt-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                vessel.vesselType === 'burette'
                  ? onOpenTitration(node.id, titrationPartner.id)
                  : onOpenTitration(titrationPartner.id, node.id)
              }
              className="h-7 w-full text-[11px]"
            >
              Ouvrir le suivi de titrage
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-2.5 border-t border-border/60 pt-3.5">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-medium text-muted-foreground">
            Chauffage & évaporation
          </span>
          <span className="shrink-0 whitespace-nowrap font-mono text-[11px] tabular-nums text-foreground">
            {Math.round(temperatureC)} °C
            {arrheniusFactor !== 1 && (
              <span className="ml-1 text-[10px] text-muted-foreground">
                · ×{formatFrNumber(arrheniusFactor, 1)}
              </span>
            )}
          </span>
        </div>

        {vessel.supportsHeating ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11.5px] text-foreground">
                Plaque chauffante
                {heaterOn && (
                  <span className="ml-1.5 font-mono text-[10.5px] tabular-nums text-muted-foreground">
                    → {node.heaterTargetC} °C
                  </span>
                )}
              </span>
              <Switch
                checked={heaterOn}
                onCheckedChange={(checked) =>
                  onSetHeaterTarget(
                    checked ? Math.max(60, Math.round(temperatureC)) : null,
                  )
                }
                ariaLabel="Activer la plaque chauffante"
              />
            </div>

            <Slider
              min={0}
              max={100}
              step={1}
              snapPoints={[4, 20, 37, 60, 80, 100]}
              value={Math.round(heaterOn ? (node.heaterTargetC ?? temperatureC) : temperatureC)}
              onChange={(v) => {
                const rounded = Math.round(v)
                if (heaterOn) onSetHeaterTarget(rounded)
                else onSetTemperature(rounded)
              }}
              ariaLabel="Température en degrés Celsius"
            />
            <div className="flex items-center gap-1">
              {[
                { label: '4 °C', t: 4 },
                { label: '20 °C', t: 20 },
                { label: '60 °C', t: 60 },
                { label: '100 °C', t: 100 },
              ].map((preset) => (
                <button
                  key={preset.t}
                  type="button"
                  onClick={() =>
                    heaterOn ? onSetHeaterTarget(preset.t) : onSetTemperature(preset.t)
                  }
                  className={cn(
                    'flex-1 whitespace-nowrap rounded py-1 font-mono text-[10.5px] font-medium tabular-nums',
                    Math.round(heaterOn ? (node.heaterTargetC ?? temperatureC) : temperatureC) ===
                      preset.t
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {temperatureC >= 45 && solution.waterVolumeMl > 2 && !stoppered && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                  Évaporer H₂O
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  {[10, 25, 50]
                    .filter((v) => v < solution.waterVolumeMl)
                    .map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => onEvaporate(v)}
                        className="shrink-0 whitespace-nowrap rounded px-2 py-0.5 font-mono text-[10.5px] tabular-nums text-zinc-200 hover:bg-accent hover:text-foreground"
                      >
                        −{v} mL
                      </button>
                    ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Verrerie de mesure étalonnée à 20 °C : ne pas chauffer pour préserver la précision.
          </p>
        )}
      </section>
    </div>
  )
}
