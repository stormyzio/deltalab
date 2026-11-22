import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { Search, X } from 'lucide-react'
import type { ElementRecord, SpeciesRecord } from '../../../shared/chemistry.ts'
import { CLIENT_VALENCE_ELECTRONS, getLewisAtomColor } from '@/lib/lewis-geometry'
import { cn } from '@/lib/utils'
import { ChemFormula, ChemVar } from '@/components/ui/chem-text'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function LewisElementPalette({
  activeSymbol,
  paletteQuery,
  onPaletteQueryChange,
  paletteSearchRef,
  filteredElements,
  quickTemplates,
  onSelectSymbol,
  onStartDrag,
  onDoubleClickAdd,
  onLoadTemplate,
}: {
  activeSymbol: string
  paletteQuery: string
  onPaletteQueryChange: (q: string) => void
  paletteSearchRef: RefObject<HTMLInputElement | null>
  filteredElements: ElementRecord[]
  quickTemplates: SpeciesRecord[]
  onSelectSymbol: (symbol: string) => void
  onStartDrag: (el: ElementRecord, e: ReactPointerEvent<HTMLButtonElement>) => void
  onDoubleClickAdd: (symbol: string) => void
  onLoadTemplate: (tpl: SpeciesRecord) => void
}) {
  return (
    <aside
      aria-label="Palette d’atomes"
      className="flex w-52 shrink-0 flex-col border-r border-border bg-panel md:w-56"
    >
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <span className="truncate text-xs font-medium text-foreground">Atomes</span>
        <span className="shrink-0 whitespace-nowrap text-[10.5px] text-muted-foreground">
          Actif :{' '}
          <strong
            className="inline-block w-[2ch] text-right font-semibold"
            style={{ color: getLewisAtomColor(activeSymbol) }}
          >
            {activeSymbol}
          </strong>
        </span>
      </div>

      <div className="border-b border-border/70 p-2">
        <div className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-2 h-3 w-3 text-muted-foreground"
            strokeWidth={1.6}
          />
          <input
            ref={paletteSearchRef}
            type="text"
            value={paletteQuery}
            onChange={(e) => onPaletteQueryChange(e.target.value)}
            placeholder="Chercher un élément…"
            aria-label="Chercher un élément chimique"
            className="h-7 w-full rounded-md border border-border bg-card pl-7 pr-9 text-[11px] text-foreground placeholder:text-muted-foreground focus-visible:border-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {paletteQuery ? (
            <button
              type="button"
              onClick={() => onPaletteQueryChange('')}
              aria-label="Effacer"
              className="absolute right-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2 text-[9.5px] text-muted-foreground/60">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-4 gap-1">
          {filteredElements.map((el) => {
            const valence = CLIENT_VALENCE_ELECTRONS[el.symbol]
            const isActiveBrush = activeSymbol === el.symbol
            return (
              <Tooltip key={el.atomicNumber} delayDuration={280}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-pressed={isActiveBrush}
                    onPointerDown={(e) => onStartDrag(el, e)}
                    onDoubleClick={() => onDoubleClickAdd(el.symbol)}
                    onClick={(e) => {
                      if (e.detail === 0) onSelectSymbol(el.symbol)
                    }}
                    className={cn(
                      'relative flex h-11 flex-col items-center justify-center rounded-md border cursor-grab active:cursor-grabbing',
                      isActiveBrush
                        ? 'border-zinc-300 bg-accent ring-1 ring-zinc-400/70'
                        : 'border-border bg-card hover:border-zinc-500 hover:bg-accent/70',
                    )}
                  >
                    <span className="absolute left-1 top-0.5 text-[8px] tabular-nums text-muted-foreground">
                      {el.atomicNumber}
                    </span>
                    <span
                      className="mt-1 text-[13px] font-semibold leading-none"
                      style={{ color: getLewisAtomColor(el.symbol) }}
                    >
                      {el.symbol}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="font-medium text-foreground">
                    {el.nameFr} ({el.symbol})
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    Z = {el.atomicNumber}
                    {valence !== undefined && (
                      <>
                        {' '}
                        · {valence} <ChemVar base="e" sup="−" /> valence
                      </>
                    )}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    Clic : sélectionner · Glisser : poser sur le canevas
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>

        {filteredElements.length === 0 && (
          <p className="py-6 text-center text-[11px] text-muted-foreground">
            Aucun élément trouvé.
          </p>
        )}
      </div>

      {quickTemplates.length > 0 && (
        <div className="shrink-0 border-t border-border p-2.5">
          <p className="mb-1.5 text-[10.5px] font-medium text-muted-foreground">Modèles</p>
          <div className="flex flex-wrap gap-1">
            {quickTemplates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onLoadTemplate(tpl)}
                className="shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10.5px] text-zinc-300 hover:bg-accent hover:text-foreground"
              >
                <ChemFormula value={tpl.displayFormula} />
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
