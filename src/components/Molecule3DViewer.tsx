import { useEffect, useMemo, useState } from 'react'
import { Maximize2, Pause, Play, RotateCcw, X } from 'lucide-react'
import type { LewisStructure } from '../../shared/chemistry.ts'
import { buildMolecule3DModel } from '@/lib/molecule-3d'
import { formatFrNumber } from '@/lib/chemistry-ui'
import { cn } from '@/lib/utils'
import { ChemFormula } from '@/components/ui/chem-text'
import { Molecule3DStage, type Molecule3DStyle } from '@/components/Molecule3DStage'

export type { Molecule3DStyle }

interface Molecule3DViewerProps {
  structure: LewisStructure
  title?: string
  formula?: string
  className?: string
  compact?: boolean
  allowExpand?: boolean
  defaultStyle?: Molecule3DStyle
  ariaLabel?: string
}

export function Molecule3DViewer({
  structure,
  title,
  formula,
  className,
  compact = false,
  allowExpand = true,
  defaultStyle = 'ball-stick',
  ariaLabel = 'Modèle moléculaire 3D',
}: Molecule3DViewerProps) {
  const [style, setStyle] = useState<Molecule3DStyle>(defaultStyle)
  const [autoRotate, setAutoRotate] = useState(true)
  const [resetSignal, setResetSignal] = useState(0)
  const [pxPerAngstrom, setPxPerAngstrom] = useState(0)
  const [webglError, setWebglError] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const model = useMemo(() => buildMolecule3DModel(structure), [structure])

  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  const scaleBar = useMemo(() => {
    if (pxPerAngstrom <= 0) return null
    const candidates = [0.5, 1, 2, 5, 10]
    let best = 1
    for (const c of candidates) {
      const px = c * pxPerAngstrom
      if (px >= 24 && px <= 92) {
        best = c
        break
      }
      if (px < 24) best = c
    }
    const widthPx = Math.max(16, Math.min(110, Math.round(best * pxPerAngstrom)))
    const pm = Math.round(best * 100)
    return {
      widthPx,
      label: best === 1 ? '1 Å (100 pm)' : `${formatFrNumber(best, best < 1 ? 1 : 0)} Å (${pm} pm)`,
    }
  }, [pxPerAngstrom])

  if (model.atoms.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-[11px] text-muted-foreground',
          compact ? 'h-40' : 'h-56',
          className,
        )}
      >
        Ajoutez des atomes pour visualiser le modèle 3D.
      </div>
    )
  }

  return (
    <>
      <div
        className={cn(
          'group relative w-full overflow-hidden rounded-lg bg-background/65 select-none',
          compact ? 'h-44' : 'h-56',
          className,
        )}
      >
        {webglError ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-[11px] text-muted-foreground">
            Rendu WebGL indisponible sur cet environnement.
          </div>
        ) : (
          <Molecule3DStage
            model={model}
            style={style}
            compact={compact}
            autoRotate={autoRotate}
            resetSignal={resetSignal}
            onScaleBarChange={setPxPerAngstrom}
            onWebglError={() => setWebglError(true)}
            ariaLabel={ariaLabel}
          />
        )}

        <div className="absolute left-2 top-2 flex items-center gap-0.5 text-[10.5px]">
          <button
            type="button"
            onClick={() => setStyle('ball-stick')}
            className={cn(
              'whitespace-nowrap rounded px-1.5 py-0.5 font-medium',
              style === 'ball-stick'
                ? 'bg-accent/90 text-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            Éclaté
          </button>
          <button
            type="button"
            onClick={() => setStyle('space-filling')}
            className={cn(
              'whitespace-nowrap rounded px-1.5 py-0.5 font-medium',
              style === 'space-filling'
                ? 'bg-accent/90 text-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            Compact
          </button>
        </div>

        <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            title={autoRotate ? 'Mettre la rotation en pause' : 'Rotation automatique'}
            aria-label={autoRotate ? 'Mettre la rotation en pause' : 'Rotation automatique'}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent/80 hover:text-foreground"
          >
            {autoRotate ? (
              <Pause className="h-3 w-3" strokeWidth={1.7} />
            ) : (
              <Play className="h-3 w-3" strokeWidth={1.7} />
            )}
          </button>
          <button
            type="button"
            onClick={() => setResetSignal((n) => n + 1)}
            title="Recentrer la caméra"
            aria-label="Recentrer la caméra"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent/80 hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" strokeWidth={1.7} />
          </button>
          {allowExpand && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              title="Agrandir le modèle 3D"
              aria-label="Agrandir le modèle 3D"
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent/80 hover:text-foreground"
            >
              <Maximize2 className="h-3 w-3" strokeWidth={1.7} />
            </button>
          )}
        </div>

        {scaleBar && (
          <div className="pointer-events-none absolute bottom-2 left-2.5 flex flex-col items-start gap-0.5">
            <span className="text-[9.5px] tabular-nums text-muted-foreground">
              {scaleBar.label}
            </span>
            <div
              className="flex items-center"
              style={{ width: `${scaleBar.widthPx}px` }}
              aria-hidden="true"
            >
              <span className="h-1.5 w-px bg-zinc-500" />
              <span className="h-px flex-1 bg-zinc-500" />
              <span className="h-1.5 w-px bg-zinc-500" />
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-2 right-2.5 text-right text-[9.5px] tabular-nums text-muted-foreground">
          {model.geometryLabelFr && <span>{model.geometryLabelFr}</span>}
          {model.spanAngstrom > 0 && (
            <span>
              {model.geometryLabelFr ? ' · ' : ''}
              {formatFrNumber(model.spanAngstrom, 1)} Å
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title ? `Modèle 3D — ${title}` : 'Modèle moléculaire 3D'}
          onClick={() => setExpanded(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-2.5">
              <div className="flex min-w-0 items-baseline gap-2.5">
                {formula && (
                  <span className="shrink-0 text-sm font-semibold text-foreground">
                    <ChemFormula value={formula} />
                  </span>
                )}
                {title && (
                  <span className="truncate text-xs text-muted-foreground">{title}</span>
                )}
                {!formula && !title && (
                  <span className="text-xs font-medium text-foreground">
                    Modèle moléculaire 3D
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-label="Fermer le modèle 3D"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.7} />
              </button>
            </div>

            <Molecule3DViewer
              structure={structure}
              defaultStyle={style}
              allowExpand={false}
              className="h-[min(70vh,520px)] rounded-none bg-background"
              ariaLabel={ariaLabel}
            />
          </div>
        </div>
      )}
    </>
  )
}
