import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { SpeciesRecord } from '../../../shared/chemistry.ts'
import { normalizeChemSearch, normalizeFormulaSearch } from '@/lib/chemistry-calc'
import { STATE_META } from '@/lib/chemistry-ui'
import { Button } from '@/components/ui/button'
import { ChemFormula } from '@/components/ui/chem-text'
import { LewisDiagram } from '@/components/LewisDiagram'

export interface PendingMergeIsomers {
  compositionFormula: string
  candidates: SpeciesRecord[]
  totalCandidatesCount?: number
}

export function IsomerPickerDialog({
  pending,
  onPick,
  onCancel,
}: {
  pending: PendingMergeIsomers
  onPick: (species: SpeciesRecord) => void
  onCancel: () => void
}) {
  const [filter, setFilter] = useState('')
  const [showAll, setShowAll] = useState(false)

  const q = normalizeChemSearch(filter)
  const qCompact = normalizeFormulaSearch(filter)
  const filtered = useMemo(() => {
    if (!q) return pending.candidates
    return pending.candidates.filter(
      (c) =>
        normalizeChemSearch(c.nameFr).includes(q) ||
        normalizeFormulaSearch(c.displayFormula).includes(qCompact) ||
        c.families.some((f) => normalizeChemSearch(f).includes(q)),
    )
  }, [pending.candidates, q, qCompact])

  const INITIAL_VISIBLE = 4
  const displayed = q || showAll ? filtered : filtered.slice(0, INITIAL_VISIBLE)
  const hiddenCount = Math.max(0, filtered.length - displayed.length)
  const totalCount = pending.totalCandidatesCount ?? pending.candidates.length

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="Choisir l’isomère à former"
      className="absolute left-1/2 top-14 z-30 flex max-h-[calc(100%-4.5rem)] w-[min(92vw,580px)] -translate-x-1/2 flex-col rounded-xl border border-zinc-700 bg-panel/98 p-3.5 shadow-2xl animate-dl-pop"
    >
      <div className="mb-2.5 flex shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-xs font-semibold text-foreground">
            Choisir l’isomère
          </span>
          <span className="truncate text-[11px] text-zinc-300">
            <ChemFormula value={pending.compositionFormula} />
          </span>
          <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground">
            · {totalCount} en base
          </span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Fermer le choix d’isomère"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {pending.candidates.length > 4 && (
        <div className="relative mb-2.5 flex shrink-0 items-center">
          <Search
            className="pointer-events-none absolute left-2.5 h-3 w-3 text-muted-foreground"
            strokeWidth={1.6}
          />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Filtrer parmi ${pending.candidates.length} isomères…`}
            aria-label="Filtrer les isomères"
            className="h-7 w-full rounded-md border border-border bg-card pl-7 pr-6 text-[11px] text-foreground placeholder:text-muted-foreground focus-visible:border-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter('')}
              aria-label="Effacer le filtre"
              className="absolute right-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {displayed.map((cand, idx) => (
            <button
              key={cand.id}
              type="button"
              onClick={() => onPick(cand)}
              className="group flex flex-col rounded-lg border border-border/80 bg-card/70 p-2.5 text-left hover:border-zinc-500 hover:bg-accent/50"
            >
              <div className="h-28 w-full p-1">
                {cand.lewis ? (
                  <LewisDiagram
                    structure={cand.lewis}
                    compact
                    ariaLabel={`Schéma de Lewis de ${cand.nameFr}`}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-foreground">
                    <ChemFormula value={cand.displayFormula} />
                  </div>
                )}
              </div>
              <div className="mt-2 flex items-start justify-between gap-2 border-t border-border/60 pt-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {cand.nameFr}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    <ChemFormula value={cand.displayFormula} /> ·{' '}
                    {STATE_META[cand.standardState].tag}
                  </p>
                </div>
                {!q && idx < 9 && (
                  <kbd className="shrink-0 text-[10px] text-muted-foreground">
                    {idx + 1}
                  </kbd>
                )}
              </div>
            </button>
          ))}
        </div>

        {displayed.length === 0 && (
          <p className="py-6 text-center text-[11px] text-muted-foreground">
            Aucun isomère ne correspond à « {filter} ».
          </p>
        )}
      </div>

      {hiddenCount > 0 && (
        <div className="mt-2.5 flex shrink-0 justify-center border-t border-border/70 pt-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowAll(true)}
            className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Voir les {hiddenCount} autre{hiddenCount > 1 ? 's' : ''} isomère
            {hiddenCount > 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </div>
  )
}
