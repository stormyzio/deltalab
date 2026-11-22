import {
  Eraser,
  Link2,
  Minus,
  MousePointer2,
  Plus,
  Sparkles,
  Trash2,
  Undo2,
  Zap,
} from 'lucide-react'
import type { LewisAtom, LewisBond } from '../../../shared/chemistry.ts'
import { formatChargeLabel } from '@/lib/chemistry-calc'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { BuilderTool } from './lewis-editor-utils'

export function LewisToolbar({
  tool,
  activeSymbol,
  atomsCount,
  selectedAtom,
  selectedBond,
  selectedBondKey,
  historyCount,
  split3DOpen,
  strictMode,
  strictErrorCount,
  strictWarningCount,
  onSelectTool,
  onAutoCompleteLonePairs,
  onUndo,
  onClear,
  onToggleStrictMode,
  onToggleSplit3D,
  onUpdateAtom,
  onDeleteAtom,
  onSetBondOrder,
  onDeleteBond,
}: {
  tool: BuilderTool
  activeSymbol: string
  atomsCount: number
  selectedAtom: LewisAtom | null
  selectedBond: LewisBond | null
  selectedBondKey: string | null
  historyCount: number
  split3DOpen: boolean
  strictMode: boolean
  strictErrorCount: number
  strictWarningCount: number
  onSelectTool: (t: BuilderTool) => void
  onAutoCompleteLonePairs: () => void
  onUndo: () => void
  onClear: () => void
  onToggleStrictMode: () => void
  onToggleSplit3D: () => void
  onUpdateAtom: (atomId: string, updater: (a: LewisAtom) => LewisAtom) => void
  onDeleteAtom: (atomId: string) => void
  onSetBondOrder: (bondKey: string, order: 1 | 2 | 3) => void
  onDeleteBond: (bondKey: string) => void
}) {
  const tools: Array<{
    id: BuilderTool
    label: string
    shortcut: string
    icon: typeof MousePointer2
    hint: string
  }> = [
    {
      id: 'build',
      label: `Poser (${activeSymbol})`,
      shortcut: '1',
      icon: Plus,
      hint: `Clic vide : poser ${activeSymbol} · Glisser/cliquer depuis un atome : lier un nouveau ${activeSymbol} · Clic sur liaison : 1→2→3`,
    },
    {
      id: 'move',
      label: 'Déplacer',
      shortcut: '2',
      icon: MousePointer2,
      hint: 'Déplacer un atome ou glisser le fond pour naviguer (2)',
    },
    {
      id: 'bond',
      label: 'Liaison',
      shortcut: '3',
      icon: Link2,
      hint: 'Glisser d’un atome à l’autre ou cliquer sur une liaison (1 → 2 → 3)',
    },
    {
      id: 'lonepair',
      label: 'Doublet',
      shortcut: '4',
      icon: Minus,
      hint: 'Cliquer sur un atome pour ajouter un doublet non liant (clic droit : retirer)',
    },
    {
      id: 'charge',
      label: 'Charge',
      shortcut: '5',
      icon: Zap,
      hint: 'Cliquer sur un atome pour ajuster sa charge formelle (+ / −)',
    },
  ]

  const strictIssueTotal = strictErrorCount + strictWarningCount

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 flex max-w-[calc(100%-1rem)] -translate-x-1/2 flex-col items-center gap-1.5 select-none">
      <div className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-border bg-panel/95 p-1 shadow-xl">
        {tools.map((item) => {
          const Icon = item.icon
          const active = tool === item.id
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onSelectTool(item.id)}
                  className={cn(
                    'inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium',
                    active
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.7} />
                  <span className="hidden sm:inline">
                    {item.id === 'build' ? (
                      <>
                        Poser (
                        <span className="inline-block w-[2ch] text-center">
                          {activeSymbol}
                        </span>
                        )
                      </>
                    ) : (
                      item.label
                    )}
                  </span>
                  {!split3DOpen && (
                    <kbd className="hidden rounded border border-border/80 bg-muted/70 px-1 text-[9.5px] text-muted-foreground md:inline">
                      {item.shortcut}
                    </kbd>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{item.hint}</TooltipContent>
            </Tooltip>
          )
        })}

        <Separator orientation="vertical" className="mx-1 h-4 shrink-0" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={atomsCount === 0}
              onClick={onAutoCompleteLonePairs}
              aria-label="Auto-doublets"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.6} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Compléter automatiquement les doublets non liants (E)
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={historyCount === 0}
              onClick={onUndo}
              aria-label="Annuler"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Undo2 className="h-3.5 w-3.5" strokeWidth={1.6} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Annuler (⌘Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={atomsCount === 0}
              onClick={onClear}
              aria-label="Effacer le schéma"
              className="shrink-0 text-muted-foreground hover:text-red-400"
            >
              <Eraser className="h-3.5 w-3.5" strokeWidth={1.6} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Tout effacer</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-4 shrink-0" />

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex h-7 shrink-0 items-center gap-1.5 px-1.5">
              <span className="whitespace-nowrap text-[11px] font-medium text-muted-foreground">
                Strict
              </span>
              <span
                aria-hidden={!(strictMode && strictIssueTotal > 0)}
                className={cn(
                  'inline-block w-[2ch] text-center text-[10px] tabular-nums',
                  strictMode && strictIssueTotal > 0
                    ? strictErrorCount > 0
                      ? 'text-red-300'
                      : 'text-amber-300'
                    : 'invisible',
                )}
              >
                {strictIssueTotal}
              </span>
              <Switch
                checked={strictMode}
                onCheckedChange={onToggleStrictMode}
                ariaLabel="Mode strict"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Mode strict : signale les liaisons manquantes, octets/duets dépassés et charges incohérentes
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-0.5 h-4 shrink-0" />

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex h-7 shrink-0 items-center gap-1.5 px-1.5">
              <span className="whitespace-nowrap text-[11px] font-medium text-muted-foreground">
                3D
              </span>
              <Switch
                checked={split3DOpen}
                onCheckedChange={onToggleSplit3D}
                ariaLabel="Vue 3D partagée"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {split3DOpen
              ? 'Masquer le panneau 3D partagé'
              : 'Afficher le modèle 3D en vue partagée'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Contextual sub-bar below toolbar when an atom or bond is selected */}
      {selectedAtom && (
        <div
          aria-label="Contrôles de l’atome sélectionné"
          className="pointer-events-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-lg border border-border bg-panel/95 px-2.5 py-1 shadow-xl"
        >
          <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
            <span className="text-[11px] text-muted-foreground">Doublets</span>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={selectedAtom.lonePairs <= 0}
                onClick={() =>
                  onUpdateAtom(selectedAtom.id, (a) => ({
                    ...a,
                    lonePairs: Math.max(0, a.lonePairs - 1),
                  }))
                }
                aria-label="Retirer un doublet non liant"
                className="h-6 w-6"
              >
                <Minus className="h-3 w-3" strokeWidth={1.8} />
              </Button>
              <span className="min-w-[18px] text-center text-xs tabular-nums text-foreground">
                {selectedAtom.lonePairs}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={selectedAtom.lonePairs >= 4}
                onClick={() =>
                  onUpdateAtom(selectedAtom.id, (a) => ({
                    ...a,
                    lonePairs: Math.min(4, a.lonePairs + 1),
                  }))
                }
                aria-label="Ajouter un doublet non liant"
                className="h-6 w-6"
              >
                <Plus className="h-3 w-3" strokeWidth={1.8} />
              </Button>
            </div>
          </div>

          <Separator orientation="vertical" className="h-4 shrink-0" />

          <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
            <span className="text-[11px] text-muted-foreground">Charge</span>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={selectedAtom.charge <= -3}
                onClick={() =>
                  onUpdateAtom(selectedAtom.id, (a) => ({
                    ...a,
                    charge: Math.max(-3, a.charge - 1),
                  }))
                }
                aria-label="Diminuer la charge formelle"
                className="h-6 w-6"
              >
                <Minus className="h-3 w-3" strokeWidth={1.8} />
              </Button>
              <span className="min-w-[22px] text-center text-xs tabular-nums text-foreground">
                {formatChargeLabel(selectedAtom.charge)}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={selectedAtom.charge >= 4}
                onClick={() =>
                  onUpdateAtom(selectedAtom.id, (a) => ({
                    ...a,
                    charge: Math.min(4, a.charge + 1),
                  }))
                }
                aria-label="Augmenter la charge formelle"
                className="h-6 w-6"
              >
                <Plus className="h-3 w-3" strokeWidth={1.8} />
              </Button>
            </div>
          </div>

          <Separator orientation="vertical" className="h-4 shrink-0" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onDeleteAtom(selectedAtom.id)}
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-400"
                aria-label="Supprimer l’atome"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Supprimer l’atome (Suppr)</TooltipContent>
          </Tooltip>
        </div>
      )}

      {!selectedAtom && selectedBond && selectedBondKey && (
        <div
          aria-label="Contrôles de la liaison sélectionnée"
          className="pointer-events-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-lg border border-border bg-panel/95 px-2 py-1 shadow-xl"
        >
          <div className="flex shrink-0 items-center gap-0.5">
            {([1, 2, 3] as const).map((ord) => (
              <button
                key={ord}
                type="button"
                onClick={() => onSetBondOrder(selectedBondKey, ord)}
                className={cn(
                  'h-6 shrink-0 whitespace-nowrap rounded-md px-2 text-[11px] font-medium',
                  selectedBond.order === ord
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                )}
              >
                {ord === 1 ? 'Simple' : ord === 2 ? 'Double' : 'Triple'}
              </button>
            ))}
          </div>

          <Separator orientation="vertical" className="h-4 shrink-0" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onDeleteBond(selectedBondKey)}
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-400"
                aria-label="Supprimer la liaison"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Supprimer la liaison (Suppr)</TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  )
}
