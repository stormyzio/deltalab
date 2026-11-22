import {
  ELEMENT_SYMBOL_TO_SOLID_SPECIES_ID,
  type CanvasFlaskNode,
  type CanvasNode,
  type CatalogSpeciesRecord,
  type ElementRecord,
  type FlaskProbeType,
  type FullCatalogResponse,
  type PhIndicatorId,
  type SpeciesRecord,
} from '../../shared/chemistry.ts'
import { cn } from '@/lib/utils'
import { type CatalogJumpTarget } from '@/components/inspector/InspectorPrimitives'
import { AtomInspector } from '@/components/inspector/AtomInspector'
import { SpeciesInspector } from '@/components/inspector/SpeciesInspector'
import { FlaskInspector } from '@/components/inspector/FlaskInspector'
import { MultiSelectionInspector } from '@/components/inspector/MultiSelectionInspector'

export type { CatalogJumpTarget }

interface InspectorPanelProps {
  selectedNodes: CanvasNode[]
  allFlasks: CanvasFlaskNode[]
  totalNodeCount: number
  catalog: FullCatalogResponse | null
  elementsBySymbol: Map<string, ElementRecord>
  speciesById: Map<string, CatalogSpeciesRecord>
  onMergeSelected: () => void
  onIonizeSelected: (direction: 1 | -1) => void
  canIonizeMinus?: boolean
  canIonizePlus?: boolean
  onUpdateMoleculeAmount: (nodeId: string, amountMol: number) => void
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
  onOpenTitration: (buretteId?: string, analyteId?: string) => void
  onOpenInCatalog: (target: CatalogJumpTarget) => void
  onOpenInLewisBuilder: (species: SpeciesRecord) => void
  className?: string
}

export function InspectorPanel({
  selectedNodes,
  allFlasks,
  totalNodeCount,
  catalog,
  elementsBySymbol,
  speciesById,
  onMergeSelected,
  onIonizeSelected,
  canIonizeMinus = true,
  canIonizePlus = true,
  onUpdateMoleculeAmount,
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
                : singleNode?.kind === 'flask'
                  ? 'Verrerie'
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
              solidSpecies={
                ELEMENT_SYMBOL_TO_SOLID_SPECIES_ID[singleNode.symbol]
                  ? (speciesById.get(
                      ELEMENT_SYMBOL_TO_SOLID_SPECIES_ID[singleNode.symbol],
                    ) ?? null)
                  : null
              }
              catalog={catalog}
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
