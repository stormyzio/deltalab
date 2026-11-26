import { ArrowUpRight, Link2Off, ThermometerSnowflake, Trash2 } from 'lucide-react'
import type {
  CanvasFlaskNode,
  CanvasGasCollectorNode,
  CanvasThermalChamberNode,
} from '../../../shared/chemistry.ts'
import { formatMol, formatVolumeMl } from '@/lib/chemistry-ui'
import {
  getCollectedGasTotalMol,
  getCollectedGasVolumeMl,
  getDominantGasColor,
} from '@/lib/phase-changes'
import { Button } from '@/components/ui/button'
import { ChemFormula, ChemText, StateTag } from '@/components/ui/chem-text'
import { GasCollectorArtwork } from '@/components/MachineArtwork'

export function GasCollectorInspector({
  node,
  flasks,
  thermalChambers,
  onLinkSourceFlask,
  onExtractGasToCanvas,
  onSendGasToChamber,
  onClearCollector,
}: {
  node: CanvasGasCollectorNode
  flasks: CanvasFlaskNode[]
  thermalChambers: CanvasThermalChamberNode[]
  onLinkSourceFlask: (flaskId: string | null) => void
  onExtractGasToCanvas: (speciesId: string) => void
  onSendGasToChamber: (speciesId: string, chamberId: string) => void
  onClearCollector: () => void
}) {
  const totalVolMl = getCollectedGasVolumeMl(node.gases, node.temperatureC)
  const totalMol = getCollectedGasTotalMol(node.gases)
  const fillRatio = Math.min(1, totalVolMl / Math.max(100, node.capacityMl))
  const dominantColor = getDominantGasColor(node.gases)
  const linkedFlask = flasks.find((f) => f.id === node.sourceFlaskId) ?? null
  const isCollecting =
    Boolean(linkedFlask) &&
    typeof linkedFlask?.heaterTargetC === 'number' &&
    (linkedFlask.temperatureC ?? 20) >= 55

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <GasCollectorArtwork
            fillRatio={fillRatio}
            gasColorHex={dominantColor}
            collecting={isCollecting}
            size="md"
          />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
              {node.label || 'Collecteur de gaz'}
            </h2>
            <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
              {formatVolumeMl(totalVolMl)} / {formatVolumeMl(node.capacityMl)} ·{' '}
              {formatMol(totalMol)}
            </p>
          </div>
        </div>

        {node.gases.length > 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClearCollector}
            aria-label="Purger le collecteur"
            className="text-muted-foreground hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
          </Button>
        )}
      </div>

      {/* Source flask connection */}
      <section className="space-y-2 border-t border-border/60 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">
            Raccordement tuyau
          </span>
          {linkedFlask && (
            <button
              type="button"
              onClick={() => onLinkSourceFlask(null)}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Link2Off className="h-3 w-3" strokeWidth={1.6} />
              <span>Débrancher</span>
            </button>
          )}
        </div>

        {flasks.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Posez une verrerie sur la paillasse pour la relier et capturer ses vapeurs ou gaz.
          </p>
        ) : (
          <select
            value={node.sourceFlaskId ?? ''}
            onChange={(e) => onLinkSourceFlask(e.target.value || null)}
            aria-label="Verrerie source reliée au collecteur"
            className="h-7 w-full rounded-md border border-border bg-card px-2 text-[11.5px] text-foreground focus-visible:border-zinc-500 focus-visible:outline-none"
          >
            <option value="">Aucune verrerie reliée</option>
            {flasks.map((f) => (
              <option key={f.id} value={f.id}>
                {f.customLabel || f.solution.labelFr || f.vessel.nameFr} (
                {Math.round(f.temperatureC ?? 20)} °C)
              </option>
            ))}
          </select>
        )}

        {linkedFlask && (
          <p className="text-[10.5px] leading-snug text-muted-foreground">
            Relié à{' '}
            <span className="text-zinc-200">
              <ChemText
                value={
                  linkedFlask.customLabel ||
                  linkedFlask.solution.labelFr ||
                  linkedFlask.vessel.nameFr
                }
              />
            </span>
            . Chauffez au-delà du point d’ébullition ou déclenchez une réaction gazeuse pour
            capturer le gaz.
          </p>
        )}
      </section>

      {/* Captured gases inventory */}
      <section className="space-y-2 border-t border-border/60 pt-3.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-medium">Gaz capturés</span>
          <span className="tabular-nums">{node.gases.length}</span>
        </div>

        {node.gases.length === 0 ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Collecteur vide. Reliez-le à une verrerie chauffée (ex. eau à 100 °C) ou glissez un
            gaz directement dessus.
          </p>
        ) : (
          <ul className="divide-y divide-border/40">
            {node.gases.map((gas) => {
              const gasVolMl = getCollectedGasVolumeMl([gas], node.temperatureC)
              return (
                <li key={gas.speciesId} className="space-y-1.5 py-2 first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="shrink-0 text-xs font-semibold text-foreground">
                        <ChemFormula value={gas.displayFormula} />
                        <StateTag state="g" />
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {gas.nameFr}
                      </span>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-[10.5px] tabular-nums text-zinc-300">
                      {formatVolumeMl(gasVolMl)} · {formatMol(gas.amountMol)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onExtractGasToCanvas(gas.speciesId)}
                      className="h-6 gap-1 px-2 text-[10.5px]"
                    >
                      <ArrowUpRight className="h-3 w-3" strokeWidth={1.7} />
                      <span>Extraire (g)</span>
                    </Button>

                    {thermalChambers.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          onSendGasToChamber(gas.speciesId, thermalChambers[0].id)
                        }
                        className="h-6 gap-1 px-2 text-[10.5px] text-muted-foreground hover:text-foreground"
                      >
                        <ThermometerSnowflake className="h-3 w-3" strokeWidth={1.6} />
                        <span>Vers chambre thermique</span>
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <p className="border-t border-border/60 pt-3 text-[10.5px] leading-relaxed text-muted-foreground">
        Glissez ce collecteur sur une verrerie pour le raccorder, ou sur une chambre thermique pour
        condenser le gaz en liquide ou solide.
      </p>
    </div>
  )
}
