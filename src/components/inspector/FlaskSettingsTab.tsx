import type { CanvasFlaskNode } from '../../../shared/chemistry.ts'
import { formatCapacityMl, formatVolumeMl } from '@/lib/chemistry-ui'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { VOLUME_UNITS } from '@/lib/quantity-units'
import { ScrubNumberInput } from '@/components/ui/scrub-number-input'
import { Switch } from '@/components/ui/switch'
import { MetricCell } from './InspectorPrimitives'

export function FlaskSettingsTab({
  node,
  stoppered,
  fillPercent,
  customCapInput,
  onCustomCapInputChange,
  onSetLabel,
  onToggleStopper,
  onResize,
  onSubmitCustomCapacity,
}: {
  node: CanvasFlaskNode
  stoppered: boolean
  fillPercent: number
  customCapInput: string
  onCustomCapInputChange: (v: string) => void
  onSetLabel: (label: string) => void
  onToggleStopper: () => void
  onResize: (cap: number) => void
  onSubmitCustomCapacity: () => void
}) {
  const { vessel, solution } = node

  return (
    <div className="space-y-4">
      <section className="space-y-1.5">
        <label className="block text-[11px] font-medium text-muted-foreground">
          Étiquette personnalisée
        </label>
        <input
          type="text"
          value={node.customLabel ?? ''}
          onChange={(e) => onSetLabel(e.target.value)}
          maxLength={32}
          placeholder="ex. S₀ mère, Arbre de Diane, Témoin…"
          aria-label="Étiquette de la verrerie"
          className="h-8 w-full rounded-md border border-border bg-card px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:border-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </section>

      <section className="space-y-2.5 border-t border-border/60 pt-3.5">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-medium text-muted-foreground">Capacité nominale</span>
          <span className="shrink-0 whitespace-nowrap font-mono tabular-nums text-foreground">
            {formatCapacityMl(vessel.capacityMl)}
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          {vessel.availableCapacitiesMl.map((cap) => {
            const active = Math.abs(vessel.capacityMl - cap) < 0.1
            const tooSmall = cap < solution.totalVolumeMl - 0.05
            return (
              <button
                key={cap}
                type="button"
                disabled={tooSmall}
                onClick={() => {
                  onResize(cap)
                  onCustomCapInputChange(String(cap))
                }}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded px-2 py-1 font-mono text-[10.5px] font-medium tabular-nums',
                  active
                    ? 'bg-accent text-foreground'
                    : tooSmall
                      ? 'text-muted-foreground/35'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                {formatCapacityMl(cap)}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <ScrubNumberInput
            prefixLabel="Cap"
            value={Number.parseFloat(customCapInput.replace(',', '.')) || vessel.capacityMl}
            units={VOLUME_UNITS}
            defaultUnitId="mL"
            min={Math.max(5, Math.ceil(solution.totalVolumeMl))}
            max={5000}
            step={5}
            ariaLabel="Capacité personnalisée"
            onChange={(ml) => onCustomCapInputChange(String(Math.round(ml)))}
            onScrubEnd={(ml) => onResize(Math.round(ml))}
            className="w-36 shrink-0"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={onSubmitCustomCapacity}
            className="h-7 flex-1 text-[11px]"
          >
            Appliquer (max 5 L)
          </Button>
        </div>
      </section>

      {vessel.stopperable && (
        <section className="flex items-center justify-between gap-2 border-t border-border/60 pt-3.5">
          <div>
            <p className="text-[11.5px] font-medium text-foreground">Bouchon</p>
            <p className="text-[10.5px] text-muted-foreground">
              {stoppered ? 'Verrerie fermée hermétiquement' : 'Verrerie ouverte'}
            </p>
          </div>
          <Switch
            checked={stoppered}
            onCheckedChange={onToggleStopper}
            ariaLabel="Boucher la verrerie"
          />
        </section>
      )}

      <section className="space-y-2 border-t border-border/70 pt-3.5">
        <p className="text-[11px] font-medium text-zinc-200">Caractéristiques</p>
        <dl className="grid grid-cols-2 gap-2 text-[11px]">
          <MetricCell label="Précision" value={vessel.precisionLabel} />
          <MetricCell
            label="Chauffage"
            value={vessel.supportsHeating ? 'Autorisé (0–100 °C)' : 'Déconseillé (20 °C)'}
          />
          <MetricCell
            label="Bouchage"
            value={
              vessel.stopperable
                ? stoppered
                  ? 'Fermée (bouchon posé)'
                  : 'Ouverte (bouchable)'
                : 'Non bouchable'
            }
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
