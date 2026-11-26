import type {
  CanvasFlaskNode,
  CanvasGasCollectorNode,
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
import { ChemFormula } from '@/components/ui/chem-text'
import {
  InlineNumberInput,
  type InlineUnitOption,
} from '@/components/ui/inline-number-input'
import { ScrubNumberInput } from '@/components/ui/scrub-number-input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { MetricCell } from './InspectorPrimitives'

const CAPACITY_INLINE_UNITS: InlineUnitOption[] = [
  { id: 'mL', label: 'mL', toBase: 1, decimals: 0 },
  { id: 'L', label: 'L', toBase: 1000, decimals: 2 },
]

export function FlaskSettingsTab({
  node,
  otherFlasks,
  gasCollectors,
  hasFilter,
  temperatureC,
  fillPercent,
  remainingMl,
  dilutionFactor,
  waterInput,
  onWaterInputChange,
  onSubmitWater,
  onAddWater,
  quickWaterSteps,
  onSetLabel,
  onToggleFilter,
  onResize,
  onSetTemperature,
  onEvaporate,
  onSetIndicator,
  onToggleProbe,
  onToggleStirrer,
  onSetHeaterTarget,
  onLinkGasCollector,
  onOpenTitration,
}: {
  node: CanvasFlaskNode
  otherFlasks: CanvasFlaskNode[]
  gasCollectors: CanvasGasCollectorNode[]
  hasFilter: boolean
  temperatureC: number
  fillPercent: number
  remainingMl: number
  dilutionFactor: number | null
  waterInput: string
  onWaterInputChange: (v: string) => void
  onSubmitWater: () => void
  onAddWater: (volumeMl: number) => void
  quickWaterSteps: number[]
  onSetLabel: (label: string) => void
  onToggleFilter: () => void
  onResize: (cap: number) => void
  onSetTemperature: (t: number) => void
  onEvaporate: (ml: number) => void
  onSetIndicator: (indicatorId: PhIndicatorId | null) => void
  onToggleProbe: (probe: FlaskProbeType) => void
  onToggleStirrer: () => void
  onSetHeaterTarget: (targetC: number | null) => void
  onLinkGasCollector: (collectorId: string | null) => void
  onOpenTitration: (buretteId?: string, analyteId?: string) => void
}) {
  const { vessel, solution } = node
  const caps = vessel.availableCapacitiesMl
  const minCap = caps[0] ?? 5
  const maxCap = caps[caps.length - 1] ?? 2000
  const minAllowed = Math.min(maxCap, Math.max(minCap, Math.ceil(solution.totalVolumeMl)))

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
      {/* 1. Capacité */}
      <section className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-medium text-muted-foreground">Capacité</span>
          <InlineNumberInput
            value={vessel.capacityMl}
            onChange={(ml) => onResize(Math.round(ml))}
            min={minAllowed}
            max={maxCap}
            step={1}
            units={CAPACITY_INLINE_UNITS}
            defaultUnitId={vessel.capacityMl >= 1000 ? 'L' : 'mL'}
            inputWidthClass="w-[5.5ch]"
            ariaLabel="Capacité de la verrerie"
          />
        </div>

        <Slider
          min={minCap}
          max={maxCap}
          minSelectable={minAllowed}
          step={1}
          snapPoints={caps}
          snapThresholdRatio={0.032}
          value={vessel.capacityMl}
          onChange={(ml) => onResize(Math.round(ml))}
          ariaLabel="Capacité de la verrerie"
        />

        <div className="flex items-center justify-between text-[9.5px] tabular-nums text-muted-foreground">
          <span>{formatCapacityMl(minCap)}</span>
          <span>{formatCapacityMl(maxCap)}</span>
        </div>
      </section>

      {/* 2. Eau & dilution */}
      <section className="space-y-2.5 border-t border-border/60 pt-3.5">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-medium text-muted-foreground">Eau & dilution</span>
          <span className="shrink-0 whitespace-nowrap text-[10.5px] tabular-nums text-muted-foreground">
            Libre : {formatVolumeMl(remainingMl)}
          </span>
        </div>

        {remainingMl <= 0.1 ? (
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
                {solution.hasWater ? (
                  <>
                    Diluer (+<ChemFormula value="H2O" />)
                  </>
                ) : (
                  <>
                    Ajouter <ChemFormula value="H2O" />
                  </>
                )}
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
                    className="shrink-0 whitespace-nowrap rounded px-2 py-0.5 text-[10.5px] tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground"
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

      {/* 3. Chauffage & évaporation */}
      <section className="space-y-2.5 border-t border-border/60 pt-3.5">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-medium text-muted-foreground">
            Chauffage & évaporation
          </span>
          <div className="flex shrink-0 items-center whitespace-nowrap text-[11px] tabular-nums text-foreground">
            <InlineNumberInput
              value={Math.round(
                heaterOn ? (node.heaterTargetC ?? temperatureC) : temperatureC,
              )}
              onChange={(v) => {
                const rounded = Math.round(v)
                if (heaterOn) onSetHeaterTarget(rounded)
                else onSetTemperature(rounded)
              }}
              min={0}
              max={200}
              step={1}
              unit="°C"
              disabled={!vessel.supportsHeating}
              inputWidthClass="w-[3.5ch]"
              ariaLabel="Température en degrés Celsius"
            />
            <span
              aria-hidden={arrheniusFactor === 1}
              className={cn(
                'ml-1 inline-block w-[6.5ch] text-right text-[10px] text-muted-foreground',
                arrheniusFactor === 1 && 'invisible',
              )}
            >
              · ×{formatFrNumber(arrheniusFactor, 1)}
            </span>
          </div>
        </div>

        {vessel.supportsHeating ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11.5px] text-foreground">
                Plaque chauffante
                {heaterOn && (
                  <span className="ml-1.5 text-[10.5px] tabular-nums text-muted-foreground">
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
              max={200}
              step={1}
              snapPoints={[4, 20, 37, 60, 100, 150, 200]}
              value={Math.round(heaterOn ? (node.heaterTargetC ?? temperatureC) : temperatureC)}
              onChange={(v) => {
                const rounded = Math.round(v)
                if (heaterOn) onSetHeaterTarget(rounded)
                else onSetTemperature(rounded)
              }}
              ariaLabel="Température en degrés Celsius"
            />

            {solution.waterVolumeMl > 2 && (
              <div
                className={cn(
                  'flex flex-nowrap items-center justify-between gap-2 pt-1',
                  temperatureC < 45 && 'opacity-40',
                )}
              >
                <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                  Évaporer <ChemFormula value="H2O" />
                </span>
                <div className="flex flex-nowrap items-center gap-1">
                  {[10, 25, 50]
                    .filter((v) => v < solution.waterVolumeMl)
                    .map((v) => (
                      <button
                        key={v}
                        type="button"
                        disabled={temperatureC < 45}
                        onClick={() => onEvaporate(v)}
                        title={
                          temperatureC < 45
                            ? 'Chauffer à au moins 45 °C pour évaporer'
                            : `Évaporer ${v} mL d’eau`
                        }
                        className="shrink-0 whitespace-nowrap rounded px-2 py-0.5 text-[10.5px] tabular-nums text-zinc-200 hover:bg-accent hover:text-foreground disabled:pointer-events-none"
                      >
                        −{v} mL
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Sortie vapeur : Collecteur de gaz */}
            {gasCollectors.length > 0 && (() => {
              const linkedCol = gasCollectors.find((c) => c.sourceFlaskId === node.id)
              return (
                <div className="space-y-2 border-t border-border/50 pt-2.5">
                  <span className="block text-[10.5px] font-medium text-muted-foreground">
                    Sortie vapeur & gaz
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="shrink-0 text-[11px] text-foreground">
                      Collecteur gaz
                    </span>
                    <select
                      value={linkedCol?.id ?? ''}
                      onChange={(e) => onLinkGasCollector(e.target.value || null)}
                      aria-label="Relier à un collecteur de gaz"
                      className="h-7 min-w-0 max-w-[180px] flex-1 rounded-md border border-border bg-card px-2 text-[11px] text-foreground focus-visible:border-zinc-500 focus-visible:outline-none"
                    >
                      <option value="">Non raccordé</option>
                      {gasCollectors.map((col, idx) => (
                        <option key={col.id} value={col.id}>
                          {col.label || `Collecteur #${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )
            })()}
          </>
        ) : (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Verrerie de mesure étalonnée à 20 °C : ne pas chauffer pour préserver la précision.
          </p>
        )}
      </section>

      {/* 4. Équipement, sondes & indicateur coloré */}
      <section className="space-y-2.5 border-t border-border/60 pt-3.5">
        <span className="block text-[11px] font-medium text-muted-foreground">
          Équipement & sondes
        </span>

        <div className="divide-y divide-border/40">
          <div className="flex items-center justify-between gap-2 py-1.5">
            <span className="text-[11.5px] text-foreground">Filtre (entonnoir)</span>
            <Switch
              checked={hasFilter}
              onCheckedChange={onToggleFilter}
              ariaLabel="Poser un filtre au-dessus de la verrerie"
            />
          </div>

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
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between gap-2 text-[10.5px] text-muted-foreground">
            <span>Indicateur coloré</span>
            {activeIndicator && (
              <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums">
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

      {/* 5. Étiquette */}
      <section className="space-y-1.5 border-t border-border/60 pt-3.5">
        <label className="block text-[11px] font-medium text-muted-foreground">
          Étiquette personnalisée
        </label>
        <input
          type="text"
          value={node.customLabel ?? ''}
          onChange={(e) => onSetLabel(e.target.value)}
          maxLength={32}
          placeholder="ex. Solution mère, Arbre de Diane, Témoin…"
          aria-label="Étiquette de la verrerie"
          className="h-8 w-full rounded-md border border-border bg-card px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:border-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </section>

      {/* 6. Caractéristiques */}
      <section className="space-y-2 border-t border-border/70 pt-3.5">
        <p className="text-[11px] font-medium text-zinc-200">Caractéristiques</p>
        <dl className="grid grid-cols-2 gap-2 text-[11px]">
          <MetricCell label="Précision" value={vessel.precisionLabel} />
          <MetricCell
            label="Chauffage"
            value={vessel.supportsHeating ? 'Autorisé (0–200 °C)' : 'Déconseillé (20 °C)'}
          />
          <MetricCell
            label="Remplissage"
            value={`${fillPercent} % (${formatVolumeMl(solution.totalVolumeMl)})`}
            mono
          />
        </dl>
        {vessel.descriptionShort && (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {vessel.descriptionShort}
          </p>
        )}
      </section>
    </div>
  )
}
