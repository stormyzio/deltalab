import type {
  AlloyRecord,
  CanvasFlaskNode,
  CanvasGasCollectorNode,
  CanvasNode,
  CanvasThermalChamberNode,
  CatalogSpeciesRecord,
  ElementRecord,
  FlaskProbeType,
  FullCatalogResponse,
  PhIndicatorId,
  SpeciesRecord,
} from '../../shared/chemistry.ts'
import { cn } from '@/lib/utils'
import { type CatalogJumpTarget } from '@/components/inspector/InspectorPrimitives'
import { AtomInspector } from '@/components/inspector/AtomInspector'
import { SpeciesInspector } from '@/components/inspector/SpeciesInspector'
import { SolidInspector } from '@/components/inspector/SolidInspector'
import { FlaskInspector } from '@/components/inspector/FlaskInspector'
import { GasCollectorInspector } from '@/components/inspector/GasCollectorInspector'
import { ThermalChamberInspector } from '@/components/inspector/ThermalChamberInspector'
import { MultiSelectionInspector } from '@/components/inspector/MultiSelectionInspector'

export type { CatalogJumpTarget }

interface InspectorPanelProps {
  selectedNodes: CanvasNode[]
  allFlasks: CanvasFlaskNode[]
  allGasCollectors: CanvasGasCollectorNode[]
  allThermalChambers: CanvasThermalChamberNode[]
  totalNodeCount: number
  catalog: FullCatalogResponse | null
  elementsBySymbol: Map<string, ElementRecord>
  speciesById: Map<string, CatalogSpeciesRecord>
  onMergeSelected: () => void
  onIonizeSelected: (direction: 1 | -1) => void
  canIonizeMinus?: boolean
  canIonizePlus?: boolean
  onUpdateMoleculeAmount: (nodeId: string, amountMol: number) => void
  onConvertAtomToSolid: (atomId: string) => void
  onSetSolidMass: (nodeId: string, nextMassG: number) => void
  onSetSolidVolume: (nodeId: string, nextVolumeCm3: number) => void
  onSetSolidComponentMass: (nodeId: string, symbol: string, nextMassG: number) => void
  onReproportionSolidToAlloy: (nodeId: string, alloy: AlloyRecord) => void
  onAddWaterToFlask: (flaskId: string, volumeMl: number) => void
  onResizeFlask: (flaskId: string, newCapacityMl: number) => void
  onSetFlaskTemperature: (flaskId: string, temperatureC: number) => void
  onToggleFlaskFilter: (flaskId: string) => void
  onSetFlaskLabel: (flaskId: string, label: string) => void
  onEvaporateFlaskWater: (flaskId: string, volumeMl: number) => void
  onSetFlaskSoluteAmount: (flaskId: string, speciesId: string, amountMol: number) => void
  onSetFlaskWaterVolume: (flaskId: string, volumeMl: number) => void
  onChangeFlaskReactionExtent: (flaskId: string, xMol: number) => void
  onSelectFlaskReaction: (flaskId: string, reactionId: string) => void
  onCommitFlaskReaction: (flaskId: string) => void
  onBalanceFlaskStoichiometry?: (flaskId: string) => void
  onExtractFilteredSolid?: (flaskId: string, speciesId: string) => void
  onClearFilterCake?: (flaskId: string) => void
  onSetFlaskIndicator: (flaskId: string, indicatorId: PhIndicatorId | null) => void
  onToggleFlaskProbe: (flaskId: string, probe: FlaskProbeType) => void
  onToggleFlaskStirrer: (flaskId: string) => void
  onSetFlaskHeaterTarget: (flaskId: string, targetC: number | null) => void
  onLinkGasCollectorToFlask: (collectorId: string, flaskId: string | null) => void
  onExtractGasFromCollector: (collectorId: string, speciesId: string) => void
  onSendGasToChamber: (collectorId: string, speciesId: string, chamberId: string) => void
  onClearGasCollector: (collectorId: string) => void
  onSetChamberTargetTemp: (chamberId: string, tempC: number) => void
  onToggleChamberPower: (chamberId: string) => void
  onExtractSampleFromChamber: (chamberId: string) => void
  onClearChamberSample: (chamberId: string) => void
  onOpenTitration: (buretteId?: string, analyteId?: string) => void
  onOpenInCatalog: (target: CatalogJumpTarget) => void
  onOpenInLewisBuilder: (species: SpeciesRecord) => void
  className?: string
}

export function InspectorPanel({
  selectedNodes,
  allFlasks,
  allGasCollectors,
  allThermalChambers,
  totalNodeCount,
  catalog,
  elementsBySymbol,
  speciesById,
  onMergeSelected,
  onIonizeSelected,
  canIonizeMinus = true,
  canIonizePlus = true,
  onUpdateMoleculeAmount,
  onConvertAtomToSolid,
  onSetSolidMass,
  onSetSolidVolume,
  onSetSolidComponentMass,
  onReproportionSolidToAlloy,
  onAddWaterToFlask,
  onResizeFlask,
  onSetFlaskTemperature,
  onToggleFlaskFilter,
  onSetFlaskLabel,
  onEvaporateFlaskWater,
  onSetFlaskSoluteAmount,
  onSetFlaskWaterVolume,
  onChangeFlaskReactionExtent,
  onSelectFlaskReaction,
  onCommitFlaskReaction,
  onBalanceFlaskStoichiometry,
  onExtractFilteredSolid,
  onClearFilterCake,
  onSetFlaskIndicator,
  onToggleFlaskProbe,
  onToggleFlaskStirrer,
  onSetFlaskHeaterTarget,
  onLinkGasCollectorToFlask,
  onExtractGasFromCollector,
  onSendGasToChamber,
  onClearGasCollector,
  onSetChamberTargetTemp,
  onToggleChamberPower,
  onExtractSampleFromChamber,
  onClearChamberSample,
  onOpenTitration,
  onOpenInCatalog,
  onOpenInLewisBuilder,
  className,
}: InspectorPanelProps) {
  const singleNode = selectedNodes.length === 1 ? selectedNodes[0] : null

  return (
    <aside
      aria-label="Inspecteur"
      className={cn(
        'flex h-full w-full shrink-0 flex-col border-l border-border bg-panel select-none',
        className,
      )}
    >
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <span className="truncate text-xs font-semibold tracking-tight text-foreground">
          Inspecteur
        </span>
        {selectedNodes.length > 0 && (
          <span className="shrink-0 whitespace-nowrap text-[10.5px] tabular-nums text-muted-foreground">
            {selectedNodes.length === 1
              ? singleNode?.kind === 'atom'
                ? 'Atome'
                : singleNode?.kind === 'solid'
                  ? singleNode.isAlloy
                    ? 'Alliage'
                    : 'Bloc solide'
                  : singleNode?.kind === 'flask'
                    ? 'Verrerie'
                    : singleNode?.kind === 'gas_collector'
                      ? 'Collecteur de gaz'
                      : singleNode?.kind === 'thermal_chamber'
                        ? 'Chambre thermique'
                        : singleNode?.species.kind === 'ion'
                          ? 'Ion'
                          : 'Espèce'
              : `${selectedNodes.length} éléments`}
          </span>
        )}
      </div>

      {selectedNodes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <p className="text-xs font-medium text-foreground">Aucune sélection</p>
          <p className="mt-1.5 max-w-[260px] text-[11.5px] leading-relaxed text-muted-foreground">
            Cliquez sur un atome, une espèce ou une verrerie pour afficher sa fiche.
          </p>
          {totalNodeCount > 0 && (
            <p className="mt-4 text-[10.5px] tabular-nums text-muted-foreground">
              {totalNodeCount} élément{totalNodeCount > 1 ? 's' : ''} sur la paillasse
            </p>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
          {singleNode?.kind === 'atom' && (
            <AtomInspector
              node={singleNode}
              element={elementsBySymbol.get(singleNode.symbol) ?? null}
              catalog={catalog}
              onConvertToSolid={() => onConvertAtomToSolid(singleNode.id)}
              onOpenInCatalog={onOpenInCatalog}
            />
          )}

          {singleNode?.kind === 'solid' && (
            <SolidInspector
              key={singleNode.id}
              node={singleNode}
              elementsBySymbol={elementsBySymbol}
              alloys={catalog?.alloys ?? []}
              onSetMass={(g) => onSetSolidMass(singleNode.id, g)}
              onSetVolume={(cm3) => onSetSolidVolume(singleNode.id, cm3)}
              onSetComponentMass={(sym, g) =>
                onSetSolidComponentMass(singleNode.id, sym, g)
              }
              onReproportionToAlloy={(alloy) =>
                onReproportionSolidToAlloy(singleNode.id, alloy)
              }
              onOpenInCatalog={onOpenInCatalog}
            />
          )}

          {singleNode?.kind === 'molecule' && (
            <SpeciesInspector
              key={singleNode.id}
              node={singleNode}
              enriched={speciesById.get(singleNode.species.id) ?? null}
              catalog={catalog}
              elementsBySymbol={elementsBySymbol}
              onIonize={onIonizeSelected}
              canIonizeMinus={canIonizeMinus}
              canIonizePlus={canIonizePlus}
              onUpdateAmount={(mol) => onUpdateMoleculeAmount(singleNode.id, mol)}
              onOpenInCatalog={onOpenInCatalog}
              onOpenInLewisBuilder={onOpenInLewisBuilder}
            />
          )}

          {singleNode?.kind === 'flask' && (
            <FlaskInspector
              key={singleNode.id}
              node={singleNode}
              otherFlasks={allFlasks.filter((f) => f.id !== singleNode.id)}
              gasCollectors={allGasCollectors}
              catalog={catalog}
              onAddWater={(ml) => onAddWaterToFlask(singleNode.id, ml)}
              onResize={(cap) => onResizeFlask(singleNode.id, cap)}
              onSetTemperature={(t) => onSetFlaskTemperature(singleNode.id, t)}
              onToggleFilter={() => onToggleFlaskFilter(singleNode.id)}
              onSetLabel={(lbl) => onSetFlaskLabel(singleNode.id, lbl)}
              onEvaporate={(ml) => onEvaporateFlaskWater(singleNode.id, ml)}
              onChangeReactionExtent={(xMol) =>
                onChangeFlaskReactionExtent(singleNode.id, xMol)
              }
              onSelectReaction={(rxnId) =>
                onSelectFlaskReaction(singleNode.id, rxnId)
              }
              onCommitReaction={() => onCommitFlaskReaction(singleNode.id)}
              onBalanceStoichiometry={
                onBalanceFlaskStoichiometry
                  ? () => onBalanceFlaskStoichiometry(singleNode.id)
                  : undefined
              }
              onOpenInCatalog={onOpenInCatalog}
              onSetIndicator={(ind) => onSetFlaskIndicator(singleNode.id, ind)}
              onToggleProbe={(probe) => onToggleFlaskProbe(singleNode.id, probe)}
              onToggleStirrer={() => onToggleFlaskStirrer(singleNode.id)}
              onSetHeaterTarget={(target) =>
                onSetFlaskHeaterTarget(singleNode.id, target)
              }
              onLinkGasCollector={(collectorId) => {
                if (collectorId) {
                  onLinkGasCollectorToFlask(collectorId, singleNode.id)
                } else {
                  const current = allGasCollectors.find(
                    (c) => c.sourceFlaskId === singleNode.id,
                  )
                  if (current) onLinkGasCollectorToFlask(current.id, null)
                }
              }}
              onOpenTitration={onOpenTitration}
              onSetSoluteAmount={(spId, mol) =>
                onSetFlaskSoluteAmount(singleNode.id, spId, mol)
              }
              onSetWaterVolume={(ml) => onSetFlaskWaterVolume(singleNode.id, ml)}
              onExtractFilteredSolid={
                onExtractFilteredSolid
                  ? (spId) => onExtractFilteredSolid(singleNode.id, spId)
                  : undefined
              }
              onClearFilterCake={
                onClearFilterCake ? () => onClearFilterCake(singleNode.id) : undefined
              }
            />
          )}

          {singleNode?.kind === 'gas_collector' && (
            <GasCollectorInspector
              key={singleNode.id}
              node={singleNode}
              flasks={allFlasks}
              thermalChambers={allThermalChambers}
              onLinkSourceFlask={(flaskId) =>
                onLinkGasCollectorToFlask(singleNode.id, flaskId)
              }
              onExtractGasToCanvas={(spId) =>
                onExtractGasFromCollector(singleNode.id, spId)
              }
              onSendGasToChamber={(spId, chamberId) =>
                onSendGasToChamber(singleNode.id, spId, chamberId)
              }
              onClearCollector={() => onClearGasCollector(singleNode.id)}
            />
          )}

          {singleNode?.kind === 'thermal_chamber' && (
            <ThermalChamberInspector
              key={singleNode.id}
              node={singleNode}
              onSetTargetTemperature={(t) =>
                onSetChamberTargetTemp(singleNode.id, t)
              }
              onTogglePower={() => onToggleChamberPower(singleNode.id)}
              onExtractSample={() => onExtractSampleFromChamber(singleNode.id)}
              onClearSample={() => onClearChamberSample(singleNode.id)}
            />
          )}

          {selectedNodes.length >= 2 && (
            <MultiSelectionInspector
              nodes={selectedNodes}
              catalog={catalog}
              elementsBySymbol={elementsBySymbol}
              onMerge={onMergeSelected}
              onIonize={onIonizeSelected}
            />
          )}
        </div>
      )}
    </aside>
  )
}
