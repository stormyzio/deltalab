import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Maximize2, Pencil, X } from 'lucide-react'
import type { LewisStructure } from '../../shared/chemistry.ts'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ChemFormula } from '@/components/ui/chem-text'
import { LewisDiagram } from '@/components/LewisDiagram'
import { Molecule3DViewer } from '@/components/Molecule3DViewer'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const lewisCache = new Map<string, LewisStructure | null>()

export interface MolecularIsomerLink {
  id: string
  nameFr: string
  displayFormula: string
}

interface MolecularRepresentationSectionProps {
  speciesId?: string
  structure: LewisStructure | null | undefined
  formula: string
  nameFr: string
  onOpenInLewisBuilder?: () => void
  isomers?: MolecularIsomerLink[]
  onJumpToIsomer?: (speciesId: string) => void
  maxIsomers?: number
  lewisHeightClassName?: string
  className?: string
}

export function MolecularRepresentationSection({
  speciesId,
  structure,
  formula,
  nameFr,
  onOpenInLewisBuilder,
  isomers = [],
  onJumpToIsomer,
  maxIsomers = 6,
  lewisHeightClassName = 'h-40',
  className,
}: MolecularRepresentationSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const [fetched, setFetched] = useState<{
    id: string
    lewis: LewisStructure | null
  } | null>(null)

  const cachedLewis =
    speciesId && lewisCache.has(speciesId) ? lewisCache.get(speciesId) : undefined
  const resolvedStructure =
    structure ??
    (fetched && fetched.id === speciesId ? fetched.lewis : cachedLewis) ??
    null
  const isResolved =
    Boolean(structure) ||
    !speciesId ||
    cachedLewis !== undefined ||
    fetched?.id === speciesId

  useEffect(() => {
    if (structure || !speciesId) return
    if (lewisCache.has(speciesId)) return
    let cancelled = false
    api
      .getSpeciesById(speciesId)
      .then((res) => {
        const lewis = res.species.lewis ?? null
        lewisCache.set(speciesId, lewis)
        if (!cancelled) setFetched({ id: speciesId, lewis })
      })
      .catch(() => {
        if (!cancelled) setFetched({ id: speciesId, lewis: null })
      })
    return () => {
      cancelled = true
    }
  }, [speciesId, structure])

  useEffect(() => {
    if (!expanded) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setExpanded(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [expanded])

  return (
    <>
      <section className={cn('space-y-2', className)}>
        {/* Section header with 2 floating ghost icon buttons */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">
            Représentation moléculaire
            {resolvedStructure?.ionic && (
              <span className="ml-1.5 text-[10px] font-normal text-muted-foreground/80">
                · ionique
              </span>
            )}
          </span>

          <div className="flex items-center gap-0.5">
            {resolvedStructure && (
              <Tooltip delayDuration={240}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    aria-label="Agrandir le schéma de Lewis et la géométrie 3D"
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Agrandir Lewis & 3D</TooltipContent>
              </Tooltip>
            )}

            {onOpenInLewisBuilder && (
              <Tooltip delayDuration={240}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onOpenInLewisBuilder}
                    aria-label="Ouvrir dans l’éditeur Lewis"
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.6} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Ouvrir dans l’éditeur Lewis</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Inline Lewis 2D diagram */}
        <div className={cn('w-full rounded-lg bg-background/55 p-2', lewisHeightClassName)}>
          {resolvedStructure ? (
            <LewisDiagram
              structure={resolvedStructure}
              ariaLabel={`Schéma de Lewis de ${nameFr}`}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
              {isResolved ? 'Schéma de Lewis indisponible.' : 'Chargement du schéma…'}
            </div>
          )}
        </div>

        {/* Inline 3D viewer (no redundant fullscreen button) */}
        {resolvedStructure &&
          (expanded ? (
            <div className="h-44 w-full rounded-lg bg-background/65" aria-hidden="true" />
          ) : (
            <Molecule3DViewer
              structure={resolvedStructure}
              title={nameFr}
              formula={formula}
              compact
              allowExpand={false}
              ariaLabel={`Modèle 3D de ${nameFr}`}
            />
          ))}

        {/* Optional isomers links */}
        {isomers.length > 0 && onJumpToIsomer && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/50 pt-2">
            <span className="text-[10.5px] text-muted-foreground">
              Isomère{isomers.length > 1 ? 's' : ''} ({isomers.length}) :
            </span>
            {isomers.slice(0, maxIsomers).map((iso) => (
              <button
                key={iso.id}
                type="button"
                onClick={() => onJumpToIsomer(iso.id)}
                className="inline-flex items-baseline gap-1 rounded px-1.5 py-0.5 text-[10.5px] text-zinc-200 hover:bg-accent hover:text-foreground"
              >
                <span>{iso.nameFr}</span>
                <span className="text-[9.5px] text-muted-foreground">
                  <ChemFormula value={iso.displayFormula} />
                </span>
              </button>
            ))}
            {isomers.length > maxIsomers && (
              <span className="text-[10px] text-muted-foreground">
                +{isomers.length - maxIsomers} autres
              </span>
            )}
          </div>
        )}
      </section>

      {/* Side-by-side fullscreen modal: Lewis (left) + 3D geometry (right) */}
      {expanded &&
        resolvedStructure &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Représentation moléculaire — ${nameFr}`}
            onClick={() => setExpanded(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-2xl"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5">
                <div className="flex min-w-0 items-baseline gap-2.5">
                  <span className="shrink-0 text-sm font-semibold text-foreground">
                    <ChemFormula value={formula} />
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{nameFr}</span>
                  {resolvedStructure.ionic && (
                    <span className="shrink-0 text-[10px] text-muted-foreground/80">
                      · ionique
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  {onOpenInLewisBuilder && (
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => {
                            setExpanded(false)
                            onOpenInLewisBuilder()
                          }}
                          aria-label="Ouvrir dans l’éditeur Lewis"
                          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.6} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Ouvrir dans l’éditeur Lewis</TooltipContent>
                    </Tooltip>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpanded(false)}
                    aria-label="Fermer la représentation moléculaire"
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.7} />
                  </button>
                </div>
              </div>

              {/* Dual side-by-side split */}
              <div className="grid h-[min(74vh,560px)] grid-cols-1 divide-y divide-border/70 md:grid-cols-2 md:divide-x md:divide-y-0">
                {/* Left: Lewis 2D diagram */}
                <div className="relative flex min-h-0 flex-col bg-background/80">
                  <span className="pointer-events-none absolute left-3 top-2.5 text-[11px] font-medium text-muted-foreground">
                    Schéma de Lewis
                  </span>
                  <div className="flex min-h-0 flex-1 items-center justify-center p-6 pt-9">
                    <LewisDiagram
                      structure={resolvedStructure}
                      className="h-full w-full"
                      ariaLabel={`Schéma de Lewis de ${nameFr}`}
                    />
                  </div>
                </div>

                {/* Right: 3D molecular geometry */}
                <div className="relative min-h-0 bg-background">
                  <Molecule3DViewer
                    structure={resolvedStructure}
                    allowExpand={false}
                    className="h-full rounded-none bg-background"
                    ariaLabel={`Modèle 3D de ${nameFr}`}
                  />
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
