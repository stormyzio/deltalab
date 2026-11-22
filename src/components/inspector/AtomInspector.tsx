import type {
  CanvasAtomNode,
  ElementRecord,
  FullCatalogResponse,
} from '../../../shared/chemistry.ts'
import { getElementMassNumber } from '@/lib/chemistry-calc'
import { CATEGORY_META, STATE_META } from '@/lib/chemistry-ui'
import { ElementDetailsBody } from '@/components/ElementDetailsBody'
import { type CatalogJumpTarget, QuickActions } from './InspectorPrimitives'

export function AtomInspector({
  node,
  element,
  catalog,
  onConvertToSolid,
  onOpenInCatalog,
}: {
  node: CanvasAtomNode
  element: ElementRecord | null
  catalog: FullCatalogResponse | null
  onConvertToSolid?: () => void
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
              <span className="text-[9px] leading-none tabular-nums text-muted-foreground">
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
              <span className="text-[9px] tabular-nums text-muted-foreground">
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
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
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
        />
      </div>

      {element && (
        <ElementDetailsBody
          element={element}
          catalog={catalog}
          onJumpToSpecies={(id) => onOpenInCatalog({ section: 'species', id })}
          solidAction={
            onConvertToSolid
              ? { label: 'Convertir en bloc (S)', onClick: onConvertToSolid }
              : undefined
          }
        />
      )}
    </div>
  )
}
