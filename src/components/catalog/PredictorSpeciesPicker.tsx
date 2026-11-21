import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import type { CatalogSpeciesRecord } from '../../../shared/chemistry.ts'
import { STATE_META } from '@/lib/chemistry-ui'
import { cn } from '@/lib/utils'

type PredictorPickerCategory =
  | 'all'
  | 'curated'
  | 'acid_base'
  | 'salts_ions'
  | 'elements'
  | 'organic'

interface PredictorSpeciesPickerProps {
  label: string
  selectedId: string
  onSelect: (id: string) => void
  speciesList: CatalogSpeciesRecord[]
  quickIds?: string[]
  allowClear?: boolean
  placeholder?: string
}

export function PredictorSpeciesPicker({
  label,
  selectedId,
  onSelect,
  speciesList,
  quickIds,
  allowClear = false,
  placeholder = 'Chercher formule ou nom…',
}: PredictorSpeciesPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<PredictorPickerCategory>('all')
  const [highlightIdx, setHighlightIdx] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const selectedSpecies = useMemo(
    () => speciesList.find((s) => s.id === selectedId) ?? null,
    [speciesList, selectedId],
  )

  const quickSpecies = useMemo(() => {
    if (!quickIds || quickIds.length === 0) return []
    const byId = new Map(speciesList.map((s) => [s.id, s]))
    return quickIds
      .map((id) => byId.get(id))
      .filter((s): s is CatalogSpeciesRecord => Boolean(s))
  }, [quickIds, speciesList])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = speciesList.filter((sp) => {
      if (category === 'curated' && sp.source !== 'curated') return false
      if (
        category === 'acid_base' &&
        sp.phCharacter === 'neutral' &&
        sp.pkaValues.length === 0
      ) {
        return false
      }
      if (
        category === 'salts_ions' &&
        sp.kind !== 'ionic_compound' &&
        sp.kind !== 'ion'
      ) {
        return false
      }
      if (category === 'elements' && sp.kind !== 'element_substance') return false
      if (
        category === 'organic' &&
        !((sp.composition.C ?? 0) > 0 && (sp.composition.H ?? 0) > 0)
      ) {
        return false
      }
      if (!q) return true
      return (
        sp.displayFormula.toLowerCase().includes(q) ||
        sp.formula.toLowerCase().includes(q) ||
        sp.nameFr.toLowerCase().includes(q) ||
        sp.id.toLowerCase().includes(q)
      )
    })
    return rows.slice(0, 60)
  }, [speciesList, query, category])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const openPicker = () => {
    setOpen(true)
    setQuery('')
    setHighlightIdx(0)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const pickSpecies = (id: string) => {
    onSelect(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative min-w-0 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        {allowClear && selectedSpecies && (
          <button
            type="button"
            onClick={() => onSelect('')}
            className="whitespace-nowrap text-[10.5px] text-muted-foreground hover:text-foreground"
          >
            Retirer
          </button>
        )}
      </div>

      {!open ? (
        <button
          type="button"
          onClick={openPicker}
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 text-left hover:border-zinc-500"
        >
          {selectedSpecies ? (
            <div className="flex min-w-0 items-baseline gap-2">
              {(selectedSpecies.solutionColorHex || selectedSpecies.colorHex) && (
                <span
                  className="h-2 w-2 shrink-0 self-center rounded-full"
                  style={{
                    backgroundColor:
                      selectedSpecies.solutionColorHex ??
                      selectedSpecies.colorHex ??
                      '#bae6fd',
                  }}
                />
              )}
              <span className="shrink-0 font-mono text-xs font-semibold text-foreground">
                {selectedSpecies.displayFormula}
              </span>
              <span className="truncate text-xs text-zinc-300">
                {selectedSpecies.nameFr}
              </span>
              {selectedSpecies.kind !== 'ion' && (
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {STATE_META[selectedSpecies.standardState].tag}
                </span>
              )}
            </div>
          ) : (
            <span className="truncate text-xs text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
            strokeWidth={1.6}
          />
        </button>
      ) : (
        <div className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground"
            strokeWidth={1.6}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setHighlightIdx(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setHighlightIdx((i) => Math.min(Math.max(0, filtered.length - 1), i + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setHighlightIdx((i) => Math.max(0, i - 1))
              } else if (e.key === 'Enter' && filtered[highlightIdx]) {
                e.preventDefault()
                pickSpecies(filtered[highlightIdx].id)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setOpen(false)
              }
            }}
            placeholder={placeholder}
            className="h-9 w-full rounded-md border border-zinc-400 bg-card pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fermer"
            className="absolute right-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-[58px] z-30 overflow-hidden rounded-lg border border-border bg-panel shadow-2xl">
          <div className="flex flex-wrap items-center gap-0.5 border-b border-border/70 px-2 py-1.5">
            {(
              [
                ['all', 'Tous'],
                ['curated', 'Usuels'],
                ['acid_base', 'Acides/Bases'],
                ['salts_ions', 'Sels & Ions'],
                ['elements', 'Corps simples'],
                ['organic', 'Organiques'],
              ] as const
            ).map(([catId, catLabel]) => (
              <button
                key={catId}
                type="button"
                onClick={() => {
                  setCategory(catId)
                  setHighlightIdx(0)
                  inputRef.current?.focus()
                }}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10.5px] font-medium',
                  category === catId
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                )}
              >
                {catLabel}
              </button>
            ))}
          </div>

          <div className="max-h-60 divide-y divide-border/40 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="py-5 text-center text-xs text-muted-foreground">
                Aucune espèce trouvée
              </p>
            ) : (
              filtered.map((sp, idx) => {
                const isCurrent = sp.id === selectedId
                const isHighlighted = idx === highlightIdx
                return (
                  <button
                    key={sp.id}
                    type="button"
                    onMouseEnter={() => setHighlightIdx(idx)}
                    onClick={() => pickSpecies(sp.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs',
                      isHighlighted
                        ? 'bg-accent text-foreground'
                        : isCurrent
                          ? 'bg-accent/50 text-foreground'
                          : 'hover:bg-accent/50',
                    )}
                  >
                    <div className="flex min-w-0 items-baseline gap-2">
                      {(sp.solutionColorHex || sp.colorHex) && (
                        <span
                          className="h-2 w-2 shrink-0 self-center rounded-full"
                          style={{
                            backgroundColor:
                              sp.solutionColorHex ?? sp.colorHex ?? '#bae6fd',
                          }}
                        />
                      )}
                      <span className="shrink-0 font-mono font-semibold text-foreground">
                        {sp.displayFormula}
                      </span>
                      <span className="truncate text-zinc-300">{sp.nameFr}</span>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {sp.kind === 'ion' ? 'Ion' : STATE_META[sp.standardState].tag}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}

      {quickSpecies.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          {quickSpecies.map((sp) => {
            const active = sp.id === selectedId
            return (
              <button
                key={sp.id}
                type="button"
                onClick={() => onSelect(sp.id)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[10.5px] font-medium',
                  active
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                )}
              >
                {sp.displayFormula}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
