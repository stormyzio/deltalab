import type {
  CanvasAtomNode,
  CatalogSpeciesRecord,
  ElementRecord,
  FullCatalogResponse,
} from '../../../shared/chemistry.ts'
import { getElementMassNumber } from '@/lib/chemistry-calc'
import { CATEGORY_META, STATE_META, formatFrNumber } from '@/lib/chemistry-ui'
import { ChemFormula } from '@/components/ui/chem-text'
import { ElementDetailsBody } from '@/components/ElementDetailsBody'
import { type CatalogJumpTarget, QuickActions } from './InspectorPrimitives'

export function AtomInspector({
  node,
  element,
  solidSpecies,
  catalog,
  onDuplicate,
  onDelete,
  onOpenInCatalog,
}: {
  node: CanvasAtomNode
  element: ElementRecord | null
  solidSpecies: CatalogSpeciesRecord | null
  catalog: FullCatalogResponse | null
  onDuplicate: () => void
  onDelete: () => void
  onOpenInCatalog: (target: CatalogJumpTarget) => void
}) {
  const cat = CATEGORY_META[node.category]
  const massNumber = element
    ? getElementMassNumber(element.atomicNumber, element.atomicMass)
    : null

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex h-14 w-14 shrink-0 flex-col items-center justify-between rounded-xl border border-border bg-card px-1.5 py-1">
            <div className="flex w-full items-center justify-between leading-none">
              <span className="font-mono text-[9px] leading-none tabular-nums text-muted-foreground">
                {node.atomicNumber}
              </span>
            </div>
            <span
              className="text-lg font-semibold leading-none"
              style={{ color: cat.accentHex }}
            >
              {node.symbol}
            </span>
            <div className="flex w-full items-baseline justify-between leading-none">
              <span className="font-mono text-[9px] tabular-nums text-muted-foreground">
                {massNumber ?? ''}
              </span>
            </div>
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
              {node.nameFr}
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {cat.labelFr}
              {element ? ` · Bloc ${element.block}` : ''}
            </p>
            {element && (
              <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                {STATE_META[element.defaultState].labelFr} (20 °C)
                {element.radioactive ? ' · Radioactif' : ''}
                {element.synthetic ? ' · Synthétique' : ''}
              </p>
            )}
          </div>
        </div>

        <QuickActions
          onOpenCatalog={() =>
            onOpenInCatalog({ section: 'elements', id: String(node.atomicNumber) })
          }
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      </div>

      {solidSpecies && (
        <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full border border-white/20"
              style={{ backgroundColor: solidSpecies.colorHex ?? '#d4d4d8' }}
            />
            <div className="min-w-0">
              <p className="truncate text-[11px] text-zinc-200">
                {solidSpecies.nameFr}{' '}
                <span className="font-mono text-muted-foreground">
                  <ChemFormula value={node.symbol} state="s" />
                </span>
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                Déposable en verrerie par glisser-déposer (10 mmol)
              </p>
            </div>
          </div>
          {solidSpecies.densityGPerCm3 !== null && (
            <span className="shrink-0 whitespace-nowrap font-mono text-[10.5px] tabular-nums text-muted-foreground">
              {formatFrNumber(solidSpecies.densityGPerCm3, 2)} g/cm³
            </span>
          )}
        </div>
      )}

      {element && (
        <ElementDetailsBody
          element={element}
          catalog={catalog}
          onJumpToSpecies={(id) => onOpenInCatalog({ section: 'species', id })}
        />
      )}
    </div>
  )
}
