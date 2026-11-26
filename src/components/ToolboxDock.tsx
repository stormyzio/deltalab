import { type PointerEvent, memo } from 'react'
import type { SpeciesRecord, VesselRecord } from '../../shared/chemistry.ts'
import type { ExternalDragItem } from '@/types/drag'
import { STATE_META, formatCapacityMl } from '@/lib/chemistry-ui'
import { ChemFormula } from '@/components/ui/chem-text'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { GasCollectorArtwork, ThermalChamberArtwork } from '@/components/MachineArtwork'
import { VesselArtwork } from '@/components/VesselArtwork'

interface ToolboxDockProps {
  vessels: VesselRecord[]
  essentialSpecies: SpeciesRecord[]
  discoveredSpecies: SpeciesRecord[]
  collapsed: boolean
  onToggleCollapse: () => void
  onStartExternalDrag: (
    item: ExternalDragItem,
    event: PointerEvent<HTMLElement>,
  ) => void
  onKeyboardSpawn: (item: ExternalDragItem) => void
}

function SpeciesDockChip({
  species,
  onStartExternalDrag,
  onKeyboardSpawn,
}: {
  species: SpeciesRecord
  onStartExternalDrag: (
    item: ExternalDragItem,
    event: PointerEvent<HTMLElement>,
  ) => void
  onKeyboardSpawn: (item: ExternalDragItem) => void
}) {
  const isIon = species.kind === 'ion'
  const stateTag = STATE_META[species.standardState].tag
  const dotColor =
    species.solutionColorHex ?? (species.isSolvent ? '#bae6fd' : null)

  return (
    <Tooltip delayDuration={240}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onPointerDown={(e) =>
            onStartExternalDrag({ kind: 'molecule', species }, e)
          }
          onClick={(e) => {
            if (e.detail === 0) {
              onKeyboardSpawn({ kind: 'molecule', species })
            }
          }}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded border border-border/80 bg-card/80 px-1.5 py-0.5 text-[10.5px] font-medium text-foreground hover:border-zinc-600 hover:bg-accent cursor-grab active:cursor-grabbing"
        >
          {dotColor && (
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: dotColor }}
            />
          )}
          <ChemFormula value={species.displayFormula} />
          {!isIon && (
            <span className="text-[9px] text-muted-foreground">{stateTag}</span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <div className="font-medium text-foreground">{species.nameFr}</div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">
          {species.isSolvent ? (
            'Solvant aqueux'
          ) : species.canDissolveInWater ? (
            <>
              Soluble dans <ChemFormula value="H2O" />
            </>
          ) : species.standardState === 'solid' ? (
            'Solide immergeable'
          ) : (
            <>
              Insoluble dans <ChemFormula value="H2O" />
            </>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export const ToolboxDock = memo(function ToolboxDock({
  vessels,
  essentialSpecies,
  discoveredSpecies,
  collapsed,
  onToggleCollapse,
  onStartExternalDrag,
  onKeyboardSpawn,
}: ToolboxDockProps) {
  return (
    <section
      aria-label="Outils"
      className="@container flex min-w-0 flex-1 flex-col border-t border-border bg-panel select-none xl:border-l xl:border-t-0"
    >
      {/* Slim header aligned flush with PeriodicTableDock */}
      <div className="flex h-8 shrink-0 items-center justify-between gap-2 px-2.5">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-[11px] font-medium text-foreground hover:bg-accent"
          aria-expanded={!collapsed}
        >
          <span>Outils</span>
        </button>
      </div>

      {!collapsed && (
        <div className="flex max-h-[296px] min-h-0 flex-1 flex-col divide-y divide-border/70 overflow-y-auto border-t border-border/70 @min-[460px]:flex-row @min-[460px]:divide-x @min-[460px]:divide-y-0">
          {/* Glassware & thermal apparatus pane (3 columns) */}
          <div className="flex min-w-0 flex-[1.9] flex-col p-2.5">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
              <span>Fioles & verrerie</span>
              <span className="text-[10px] tabular-nums">
                {vessels.length}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {vessels.map((vessel) => {
                const maxCap =
                  vessel.availableCapacitiesMl[vessel.availableCapacitiesMl.length - 1] ??
                  vessel.capacityMl
                const minCap = vessel.availableCapacitiesMl[0] ?? vessel.capacityMl
                return (
                  <Tooltip key={vessel.id} delayDuration={240}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onPointerDown={(e) =>
                          onStartExternalDrag({ kind: 'vessel', vessel }, e)
                        }
                        onClick={(e) => {
                          if (e.detail === 0) {
                            onKeyboardSpawn({ kind: 'vessel', vessel })
                          }
                        }}
                        className="group flex items-center gap-1.5 rounded-lg border border-border/80 bg-card/80 px-2 py-1.5 text-left hover:border-zinc-600 hover:bg-accent/60 active:scale-[0.99] cursor-grab active:cursor-grabbing"
                      >
                        <VesselArtwork
                          vesselType={vessel.vesselType}
                          fillRatio={0}
                          liquidColorHex={null}
                          liquidOpacity={0}
                          size="sm"
                          className="h-6 w-5 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[10.5px] font-medium leading-tight text-foreground">
                            {vessel.nameFr}
                          </p>
                          <p className="mt-0.5 truncate text-[9.5px] tabular-nums text-muted-foreground">
                            {minCap !== maxCap
                              ? `${formatCapacityMl(minCap)}–${formatCapacityMl(maxCap)}`
                              : formatCapacityMl(vessel.capacityMl)}
                          </p>
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <div className="font-medium text-foreground">
                        {vessel.nameFr} · défaut {formatCapacityMl(vessel.capacityMl)}
                      </div>
                      <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                        {vessel.descriptionShort}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>

            {/* Thermal apparatus & gas capture (3 columns) */}
            <div className="mt-2.5 border-t border-border/60 pt-2">
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>Appareils thermiques</span>
                <span className="text-[10px] tabular-nums">2</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <Tooltip delayDuration={240}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onPointerDown={(e) =>
                        onStartExternalDrag({ kind: 'gas_collector' }, e)
                      }
                      onClick={(e) => {
                        if (e.detail === 0) {
                          onKeyboardSpawn({ kind: 'gas_collector' })
                        }
                      }}
                      className="group flex items-center gap-1.5 rounded-lg border border-border/80 bg-card/80 px-2 py-1.5 text-left hover:border-zinc-600 hover:bg-accent/60 active:scale-[0.99] cursor-grab active:cursor-grabbing"
                    >
                      <GasCollectorArtwork
                        fillRatio={0.35}
                        gasColorHex="#7dd3fc"
                        size="sm"
                        className="h-5 w-7 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10.5px] font-medium leading-tight text-foreground">
                          Collecteur gaz
                        </p>
                        <p className="mt-0.5 truncate text-[9.5px] text-muted-foreground">
                          Capture vapeur
                        </p>
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <div className="font-medium text-foreground">
                      Collecteur de gaz (1 L)
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                      Reliez-le à une verrerie chauffée pour capturer la vapeur ou les gaz dégagés.
                    </div>
                  </TooltipContent>
                </Tooltip>

                <Tooltip delayDuration={240}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onPointerDown={(e) =>
                        onStartExternalDrag(
                          { kind: 'thermal_chamber', initialTargetC: -20 },
                          e,
                        )
                      }
                      onClick={(e) => {
                        if (e.detail === 0) {
                          onKeyboardSpawn({
                            kind: 'thermal_chamber',
                            initialTargetC: -20,
                          })
                        }
                      }}
                      className="group flex items-center gap-1.5 rounded-lg border border-border/80 bg-card/80 px-2 py-1.5 text-left hover:border-zinc-600 hover:bg-accent/60 active:scale-[0.99] cursor-grab active:cursor-grabbing"
                    >
                      <ThermalChamberArtwork
                        temperatureC={-20}
                        sampleState="solid"
                        sampleColorHex="#bae6fd"
                        powerOn
                        size="sm"
                        className="h-6 w-6 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10.5px] font-medium leading-tight text-foreground">
                          Chambre therm.
                        </p>
                        <p className="mt-0.5 truncate text-[9.5px] tabular-nums text-muted-foreground">
                          −210 à 1 500 °C
                        </p>
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <div className="font-medium text-foreground">
                      Chambre thermique (Cryostat · Four)
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                      Solidifie un liquide, liquéfie un gaz, fond un solide ou vaporise une espèce.
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Narrower right pane: Essentiels (top) + Synthétisées (bottom) */}
          <div className="flex min-w-0 flex-1 flex-col p-2.5">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>Essentiels</span>
                <span className="text-[10px] tabular-nums">
                  {essentialSpecies.length}
                </span>
              </div>

              <div className="flex flex-wrap content-start gap-1">
                {essentialSpecies.map((species) => (
                  <SpeciesDockChip
                    key={species.id}
                    species={species}
                    onStartExternalDrag={onStartExternalDrag}
                    onKeyboardSpawn={onKeyboardSpawn}
                  />
                ))}
              </div>
            </div>

            <div className="mt-2.5 flex min-h-0 flex-1 flex-col border-t border-border/60 pt-2">
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>Synthétisées</span>
                <span className="text-[10px] tabular-nums">
                  {discoveredSpecies.length}
                </span>
              </div>

              {discoveredSpecies.length === 0 ? (
                <p className="flex flex-1 items-center justify-center px-1 py-2 text-center text-[10.5px] leading-snug text-muted-foreground">
                  <span>
                    Fusionnez (<kbd className="text-foreground">V</kbd>) ou ionisez (
                    <kbd className="text-foreground">+</kbd>/
                    <kbd className="text-foreground">−</kbd>) vos atomes pour les retrouver ici.
                  </span>
                </p>
              ) : (
                <div className="flex flex-wrap content-start gap-1 @min-[460px]:overflow-y-auto">
                  {discoveredSpecies.map((species) => (
                    <SpeciesDockChip
                      key={species.id}
                      species={species}
                      onStartExternalDrag={onStartExternalDrag}
                      onKeyboardSpawn={onKeyboardSpawn}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
})
