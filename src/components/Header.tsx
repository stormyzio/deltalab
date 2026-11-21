import {
  ArrowLeftRight,
  Atom,
  Beaker,
  Database,
  Droplets,
  FlaskConical,
  Grid3x3,
  Keyboard,
  PanelRight,
  Share2,
} from 'lucide-react'
import type { CatalogSummary } from '../../shared/chemistry.ts'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DeltaLabLogo } from '@/components/DeltaLabLogo'

export type AppView =
  | 'workbench'
  | 'lewis'
  | 'periodic'
  | 'species'
  | 'solutions'
  | 'reactions'
  | 'vessels'

interface HeaderProps {
  activeView: AppView
  onViewChange: (view: AppView) => void
  summary: CatalogSummary | null
  mobilePanelOpen: boolean
  onToggleMobilePanel: () => void
}

export function Header({
  activeView,
  onViewChange,
  summary,
  mobilePanelOpen,
  onToggleMobilePanel,
}: HeaderProps) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border bg-panel px-3 select-none">
      {/* Brand mark + primary view switcher */}
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={() => onViewChange('workbench')}
          className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md py-0.5 text-left transition-opacity hover:opacity-90"
        >
          <DeltaLabLogo className="h-[26px] w-[26px]" />
          <span className="text-[13px] font-semibold tracking-tight text-foreground">
            DeltaLab
          </span>
        </button>

        <Separator orientation="vertical" className="h-4" />

        <nav aria-label="Navigation principale" className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => onViewChange('workbench')}
            aria-current={activeView === 'workbench' ? 'page' : undefined}
            className={cn(
              'inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium',
              activeView === 'workbench'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
          >
            <FlaskConical className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
            <span>Paillasse</span>
          </button>

          <button
            type="button"
            onClick={() => onViewChange('lewis')}
            aria-current={activeView === 'lewis' ? 'page' : undefined}
            className={cn(
              'inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium',
              activeView === 'lewis'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
          >
            <Share2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
            <span>Lewis</span>
          </button>

          <button
            type="button"
            onClick={() => onViewChange('periodic')}
            aria-current={activeView === 'periodic' ? 'page' : undefined}
            className={cn(
              'inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium',
              activeView === 'periodic'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
          >
            <Grid3x3 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
            <span className="hidden lg:inline">Tableau périodique</span>
            <span className="lg:hidden">Tableau</span>
          </button>

          <Separator orientation="vertical" className="mx-1.5 h-4 shrink-0" />

          <button
            type="button"
            onClick={() => onViewChange('species')}
            aria-current={activeView === 'species' ? 'page' : undefined}
            className={cn(
              'inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium',
              activeView === 'species'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
          >
            <Atom className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
            <span>Espèces</span>
          </button>

          <button
            type="button"
            onClick={() => onViewChange('solutions')}
            aria-current={activeView === 'solutions' ? 'page' : undefined}
            className={cn(
              'inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium',
              activeView === 'solutions'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
          >
            <Droplets className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
            <span>Solutions</span>
          </button>

          <button
            type="button"
            onClick={() => onViewChange('reactions')}
            aria-current={activeView === 'reactions' ? 'page' : undefined}
            className={cn(
              'inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium',
              activeView === 'reactions'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
          >
            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
            <span>Réactions</span>
          </button>

          <button
            type="button"
            onClick={() => onViewChange('vessels')}
            aria-current={activeView === 'vessels' ? 'page' : undefined}
            className={cn(
              'inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium',
              activeView === 'vessels'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
          >
            <Beaker className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
            <span>Verrerie</span>
          </button>
        </nav>
      </div>

      {/* Reserved center slot for upcoming experiment modules */}
      <div className="flex-1" />

      {/* Minimal icon toolbar */}
      <div className="flex shrink-0 items-center gap-1">
        {/* Database status popover */}
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                  aria-label="État de la base de données"
                >
                  <span
                    className={
                      summary
                        ? 'h-1.5 w-1.5 rounded-full bg-emerald-400'
                        : 'h-1.5 w-1.5 rounded-full bg-zinc-600'
                    }
                  />
                  <Database className="h-3.5 w-3.5" strokeWidth={1.6} />
                  {summary && (
                    <span className="hidden tabular-nums sm:inline">
                      {summary.speciesCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Base SQLite locale</TooltipContent>
          </Tooltip>
          <PopoverContent align="end" className="w-60 p-3">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-medium text-foreground">
                Base SQLite locale
              </span>
              <span className="font-mono text-[10px] text-emerald-400">
                connectée
              </span>
            </div>
            <Separator className="mb-2.5" />
            {summary ? (
              <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">Éléments</dt>
                <dd className="text-right font-mono tabular-nums text-foreground">
                  {summary.elementsCount}
                </dd>
                <dt className="text-muted-foreground">Espèces & ions</dt>
                <dd className="text-right font-mono tabular-nums text-foreground">
                  {summary.speciesCount}
                </dd>
                <dt className="text-muted-foreground">Solutions</dt>
                <dd className="text-right font-mono tabular-nums text-foreground">
                  {summary.solutionsCount}
                </dd>
                <dt className="text-muted-foreground">Verrerie</dt>
                <dd className="text-right font-mono tabular-nums text-foreground">
                  {summary.vesselsCount}
                </dd>
                <dt className="text-muted-foreground">Réactions</dt>
                <dd className="text-right font-mono tabular-nums text-foreground">
                  {summary.reactionsCount}
                </dd>
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">Connexion…</p>
            )}
            <Separator className="my-2.5" />
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onViewChange('species')}
            >
              Explorer les espèces
            </Button>
          </PopoverContent>
        </Popover>

        {/* Keyboard shortcuts popover (always visible on every tab) */}
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Raccourcis clavier"
                >
                  <Keyboard className="h-3.5 w-3.5" strokeWidth={1.6} />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Raccourcis</TooltipContent>
          </Tooltip>
          <PopoverContent align="end" className="w-64 p-3">
            <p className="pb-2 text-xs font-medium text-foreground">
              Raccourcis & gestes
            </p>
            <Separator className="mb-2.5" />
            <ul className="space-y-1.5 text-[11px] text-muted-foreground">
              <li className="flex items-center justify-between gap-2">
                <span>Annuler / Rétablir</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                  ⌘Z / ⇧⌘Z
                </kbd>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Sélection multiple</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                  Glisser / Shift
                </kbd>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Fusionner</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                  V
                </kbd>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Ioniser (+ / − e⁻)</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                  + / −
                </kbd>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Dupliquer</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                  Alt + glisser / ⌘D
                </kbd>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Déplacer la vue</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                  Espace + glisser
                </kbd>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Rechercher</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                  ⌘K / /
                </kbd>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Supprimer la sélection</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                  X / ⌫
                </kbd>
              </li>
            </ul>
          </PopoverContent>
        </Popover>

        {activeView === 'workbench' && (
          <Button
            variant={mobilePanelOpen ? 'secondary' : 'ghost'}
            size="icon"
            onClick={onToggleMobilePanel}
            className="lg:hidden"
            aria-label="Ouvrir l’inspecteur"
          >
            <PanelRight className="h-3.5 w-3.5" strokeWidth={1.6} />
          </Button>
        )}
      </div>
    </header>
  )
}
