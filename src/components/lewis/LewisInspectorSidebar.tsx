import { ExternalLink, Loader2, Plus } from 'lucide-react'
import type {
  LewisAtom,
  MatchLewisResponse,
  SpeciesRecord,
} from '../../../shared/chemistry.ts'
import { STATE_META, formatFrNumber } from '@/lib/chemistry-ui'
import { formatChargeLabel } from '@/lib/chemistry-calc'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChemFormula, ChemText } from '@/components/ui/chem-text'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { LewisValidationResult } from './lewis-validation'

export function LewisInspectorSidebar({
  atoms,
  matching,
  activeMatch,
  compositionStats,
  strictMode,
  strictValidation,
  selectedAtomId,
  pubchemLoading,
  pubchemError,
  onSelectAndFocusAtom,
  onCompleteElectrons,
  onAddToWorkbench,
  onOpenSpeciesInCatalog,
  onLookupPubChem,
}: {
  atoms: LewisAtom[]
  matching: boolean
  activeMatch: MatchLewisResponse | null
  compositionStats: {
    formula: string
    totalCharge: number
    totalBondOrders: number
    totalLonePairs: number
  }
  strictMode: boolean
  strictValidation: LewisValidationResult
  selectedAtomId: string | null
  pubchemLoading: boolean
  pubchemError: string | null
  onSelectAndFocusAtom: (atomId: string) => void
  onCompleteElectrons: () => void
  onAddToWorkbench: (species: SpeciesRecord, switchToWorkbench: boolean) => void
  onOpenSpeciesInCatalog: (speciesId: string) => void
  onLookupPubChem: () => void
}) {
  const headerFormula = activeMatch?.matched
    ? activeMatch.species.displayFormula
    : compositionStats.formula
      ? `${compositionStats.formula}${
          compositionStats.totalCharge !== 0
            ? ` (${formatChargeLabel(compositionStats.totalCharge)})`
            : ''
        }`
      : ''

  const showStrictIssues = strictMode && strictValidation.list.length > 0

  return (
    <aside
      aria-label="Inspecteur du schéma de Lewis"
      className="flex w-72 shrink-0 flex-col border-l border-border bg-panel xl:w-80"
    >
      {/* Top header */}
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-3.5">
        <span className="truncate text-xs font-medium text-foreground">Inspecteur</span>
        {matching ? (
          <span className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
            Analyse…
          </span>
        ) : (
          headerFormula && (
            <span className="shrink-0 whitespace-nowrap text-[11px] text-zinc-300">
              <ChemFormula value={headerFormula} />
            </span>
          )
        )}
      </div>

      {/* Scrollable main area: Strict issues (top, only when issues exist) + Molecule (below) */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3.5">
        {/* 1. Strict mode issues (hidden when strict mode is off or everything is valid) */}
        {showStrictIssues && (
          <section className="space-y-1.5 border-b border-border/60 pb-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">
                Mode strict
              </span>
              <span
                className={cn(
                  'shrink-0 whitespace-nowrap text-[10px] tabular-nums',
                  strictValidation.errorCount > 0 ? 'text-red-300' : 'text-amber-300',
                )}
              >
                {strictValidation.errorCount > 0 &&
                  `${strictValidation.errorCount} erreur${strictValidation.errorCount > 1 ? 's' : ''}`}
                {strictValidation.errorCount > 0 && strictValidation.warningCount > 0
                  ? ' · '
                  : ''}
                {strictValidation.warningCount > 0 &&
                  `${strictValidation.warningCount} à compléter`}
              </span>
            </div>

            <ul className="space-y-0.5">
              {strictValidation.list.map((diag) => (
                <li key={diag.atomId}>
                  <button
                    type="button"
                    onClick={() => onSelectAndFocusAtom(diag.atomId)}
                    className={cn(
                      'flex w-full items-start gap-2 rounded px-1.5 py-1 text-left text-[11px] leading-snug hover:bg-accent/60',
                      selectedAtomId === diag.atomId && 'bg-accent/70',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 w-4 shrink-0 text-[10.5px] font-semibold',
                        diag.severity === 'error' ? 'text-red-400' : 'text-amber-300',
                      )}
                    >
                      {diag.symbol}
                    </span>
                    <span className="min-w-0 flex-1 text-zinc-300">
                      <ChemText value={diag.detailsFr.join(' · ')} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 2. Molecule section */}
        <section>
          {atoms.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Posez des atomes sur le canevas pour identifier l’espèce et vérifier son schéma de Lewis.
            </p>
          ) : activeMatch?.matched ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <h2 className="truncate text-lg font-semibold leading-tight tracking-tight text-foreground">
                      <ChemFormula value={activeMatch.species.displayFormula} />
                    </h2>
                    <span
                      className={cn(
                        'shrink-0 whitespace-nowrap text-[10.5px] font-medium',
                        activeMatch.exactLewisValid
                          ? 'text-emerald-400'
                          : 'text-amber-300',
                      )}
                    >
                      {activeMatch.exactLewisValid ? 'Valide' : 'À compléter'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-200">
                    {activeMatch.species.nameFr}
                  </p>
                  <p className="mt-0.5 text-[10.5px] tabular-nums text-muted-foreground">
                    {activeMatch.species.kind === 'ion'
                      ? 'Ion'
                      : STATE_META[activeMatch.species.standardState].labelFr}{' '}
                    · {formatFrNumber(activeMatch.species.molarMass, 2)} g/mol
                  </p>
                  {activeMatch.species.families.length > 0 && (
                    <p className="mt-1 text-[10.5px] text-muted-foreground">
                      {activeMatch.species.families.join(' · ')}
                    </p>
                  )}
                </div>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onOpenSpeciesInCatalog(activeMatch.species.id)}
                      aria-label="Ouvrir la fiche dans le catalogue"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.6} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Ouvrir la fiche catalogue</TooltipContent>
                </Tooltip>
              </div>

              {!activeMatch.exactLewisValid && activeMatch.issuesFr.length > 0 && (
                <div className="space-y-2 border-t border-border/60 pt-2.5">
                  <ul className="space-y-1 text-[11px] leading-snug text-zinc-300">
                    {activeMatch.issuesFr.map((issue, idx) => (
                      <li key={idx}>
                        • <ChemText value={issue} />
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={onCompleteElectrons}
                    className="h-7 w-full text-[11px]"
                  >
                    Compléter doublets & charges
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-1.5 pt-0.5">
                <Button
                  size="sm"
                  disabled={!activeMatch.exactLewisValid}
                  onClick={() => onAddToWorkbench(activeMatch.species, true)}
                  className="h-7 flex-1 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
                  <span>Paillasse</span>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!activeMatch.exactLewisValid}
                  onClick={() => onAddToWorkbench(activeMatch.species, false)}
                  className="h-7 shrink-0 px-2.5 text-[11px]"
                  title="Ajouter sur la paillasse sans quitter l’éditeur"
                >
                  + Rester
                </Button>
              </div>
            </div>
          ) : activeMatch ? (
            <div className="space-y-2.5">
              <div>
                <p className="text-xs font-medium text-foreground">
                  Espèce non répertoriée
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  <ChemText value={activeMatch.reasonFr} />
                </p>
              </div>

              <Button
                size="sm"
                variant="secondary"
                disabled={pubchemLoading}
                onClick={onLookupPubChem}
                className="h-7 w-full text-[11px]"
              >
                {pubchemLoading && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.7} />
                )}
                <span>
                  {pubchemLoading ? 'Recherche sur PubChem…' : 'Chercher sur PubChem'}
                </span>
              </Button>

              {pubchemError && (
                <p className="text-[10.5px] leading-snug text-amber-300">
                  {pubchemError}
                </p>
              )}

              {activeMatch.sameFormulaSpecies.length > 0 && (
                <div className="border-t border-border/60 pt-2.5">
                  <p className="mb-1 text-[10.5px] text-muted-foreground">
                    Isomères en base ({activeMatch.compositionFormula})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {activeMatch.sameFormulaSpecies.map((cand) => (
                      <button
                        key={cand.id}
                        type="button"
                        onClick={() => onOpenSpeciesInCatalog(cand.id)}
                        className="rounded px-1.5 py-0.5 text-[11px] text-zinc-300 hover:bg-accent hover:text-foreground"
                      >
                        {cand.nameFr}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </section>
      </div>

      {/* Slim footer summary */}
      {atoms.length > 0 && (
        <div className="flex h-8 shrink-0 items-center justify-between border-t border-border/70 px-3.5 text-[10px] tabular-nums text-muted-foreground">
          <span>
            {atoms.length} atome{atoms.length > 1 ? 's' : ''} ·{' '}
            {compositionStats.totalBondOrders} liaison
            {compositionStats.totalBondOrders > 1 ? 's' : ''} ·{' '}
            {compositionStats.totalLonePairs} doublet
            {compositionStats.totalLonePairs > 1 ? 's' : ''}
          </span>
          {compositionStats.totalCharge !== 0 && (
            <span className="text-zinc-300">
              q = {formatChargeLabel(compositionStats.totalCharge)}
            </span>
          )}
        </div>
      )}
    </aside>
  )
}
