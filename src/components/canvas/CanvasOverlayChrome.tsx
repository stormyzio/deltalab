import {
  Combine,
  Copy,
  Hand,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export interface CanvasNotice {
  id: number
  tone: 'neutral' | 'success' | 'warning'
  text: string
}

export function CanvasSelectionBar({
  selectedCount,
  canMergeSelected,
  canIonizeSelected,
  canIonizeMinus = true,
  canIonizePlus = true,
  selectedChargeSum,
  onMergeSelected,
  onIonizeSelected,
  onDuplicateSelected,
  onDeleteSelected,
}: {
  selectedCount: number
  canMergeSelected: boolean
  canIonizeSelected: boolean
  canIonizeMinus?: boolean
  canIonizePlus?: boolean
  selectedChargeSum: number
  onMergeSelected: () => void
  onIonizeSelected: (direction: 1 | -1) => void
  onDuplicateSelected: () => void
  onDeleteSelected: () => void
}) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-panel/95 p-1 shadow-xl"
    >
      {canMergeSelected && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                onClick={onMergeSelected}
                className="h-7 gap-1.5 px-2.5 text-xs font-medium"
              >
                <Combine className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Fusionner</span>
                <span className="rounded bg-black/15 px-1 font-mono text-[10px] tabular-nums">
                  {selectedCount}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fusionner (V)</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="mx-0.5 h-4" />
        </>
      )}

      {canIonizeSelected ? (
        <div className="flex items-center gap-0.5 px-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={!canIonizeMinus}
                  onClick={() => onIonizeSelected(-1)}
                  aria-label="Ajouter un électron (charge négative)"
                >
                  <Minus className="h-3 w-3" strokeWidth={1.9} />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {canIonizeMinus
                ? 'Gagner e⁻ · charge − (−)'
                : 'Aucun état plus réduit répertorié'}
            </TooltipContent>
          </Tooltip>

          <span
            className="min-w-[26px] text-center font-mono text-[11px] font-medium tabular-nums text-foreground"
            title="Charge électrique"
          >
            {selectedChargeSum > 0 ? `+${selectedChargeSum}` : selectedChargeSum}
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={!canIonizePlus}
                  onClick={() => onIonizeSelected(1)}
                  aria-label="Retirer un électron (charge positive)"
                >
                  <Plus className="h-3 w-3" strokeWidth={1.9} />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {canIonizePlus
                ? 'Perdre e⁻ · charge + (+)'
                : 'Aucun état plus oxydé répertorié'}
            </TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <span className="whitespace-nowrap px-2 font-mono text-[11px] tabular-nums text-muted-foreground">
          {selectedCount} sélection{selectedCount > 1 ? 's' : ''}
        </span>
      )}

      <Separator orientation="vertical" className="mx-0.5 h-4" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDuplicateSelected}
            aria-label="Dupliquer la sélection"
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={1.6} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Dupliquer (Alt + glisser / ⌘D)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDeleteSelected}
            className="hover:text-red-400"
            aria-label="Supprimer la sélection"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Supprimer (X / ⌫)</TooltipContent>
      </Tooltip>
    </div>
  )
}

export function CanvasNoticeBanner({
  notice,
  offsetBelowSelectionBar,
}: {
  notice: CanvasNotice
  offsetBelowSelectionBar: boolean
}) {
  return (
    <div
      key={notice.id}
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-none absolute left-1/2 z-20 max-w-[90%] -translate-x-1/2 rounded-lg border border-border bg-panel/95 px-3 py-1.5 text-center text-xs shadow-lg animate-dl-pop',
        offsetBelowSelectionBar ? 'top-14' : 'top-3',
        notice.tone === 'warning' ? 'text-amber-200' : 'text-foreground',
      )}
    >
      <span>{notice.text}</span>
    </div>
  )
}

export function CanvasViewportHud({
  toolMode,
  spacePressed,
  zoom,
  nodeCount,
  onSetToolMode,
  onZoomStep,
  onResetView,
  onClearCanvas,
}: {
  toolMode: 'select' | 'pan'
  spacePressed: boolean
  zoom: number
  nodeCount: number
  onSetToolMode: (m: 'select' | 'pan') => void
  onZoomStep: (delta: number) => void
  onResetView: () => void
  onClearCanvas: () => void
}) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute bottom-3 left-3 z-20 flex items-center gap-0.5 rounded-lg border border-border bg-panel/95 p-1 shadow-lg"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={toolMode === 'select' && !spacePressed ? 'secondary' : 'ghost'}
            size="icon-sm"
            onClick={() => onSetToolMode('select')}
            aria-label="Outil sélection"
          >
            <MousePointer2 className="h-3.5 w-3.5" strokeWidth={1.6} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Sélectionner</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={toolMode === 'pan' || spacePressed ? 'secondary' : 'ghost'}
            size="icon-sm"
            onClick={() => onSetToolMode('pan')}
            aria-label="Outil déplacement"
          >
            <Hand className="h-3.5 w-3.5" strokeWidth={1.6} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Déplacer (Espace)</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 h-4" />

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onZoomStep(-0.15)}
        aria-label="Dézoomer"
      >
        <Minus className="h-3 w-3" strokeWidth={1.8} />
      </Button>

      <button
        type="button"
        onClick={onResetView}
        className="min-w-[42px] whitespace-nowrap rounded px-1 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground"
        title="Réinitialiser le zoom"
      >
        {Math.round(zoom * 100)}%
      </button>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onZoomStep(0.15)}
        aria-label="Zoomer"
      >
        <Plus className="h-3 w-3" strokeWidth={1.8} />
      </Button>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onResetView}
            aria-label="Centrer la vue"
          >
            <Maximize2 className="h-3 w-3" strokeWidth={1.6} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Recentrer</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 h-4" />

      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={nodeCount === 0}
              onClick={onClearCanvas}
              aria-label="Vider la paillasse"
              className="text-muted-foreground hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">Vider la paillasse</TooltipContent>
      </Tooltip>
    </div>
  )
}
