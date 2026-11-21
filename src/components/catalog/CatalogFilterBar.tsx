import type {
  FullCatalogResponse,
  ReactionConstantsResponse,
  SpeciesKind,
  SpeciesSource,
} from '../../../shared/chemistry.ts'
import { Separator } from '@/components/ui/separator'
import {
  type CatalogSection,
  FilterChip,
  type ReactionSubTab,
} from './CatalogShared'

interface CatalogFilterBarProps {
  section: CatalogSection
  catalog: FullCatalogResponse
  reactionConstants: ReactionConstantsResponse | null
  speciesKindFilter: SpeciesKind | 'all'
  onSpeciesKindFilter: (val: SpeciesKind | 'all') => void
  speciesSourceFilter: SpeciesSource | 'all'
  onSpeciesSourceFilter: (val: SpeciesSource | 'all') => void
  solubilityFilter: 'all' | 'soluble' | 'insoluble'
  onSolubilityFilter: (val: 'all' | 'soluble' | 'insoluble') => void
  solutionPhFilter: 'all' | 'acid' | 'neutral' | 'base' | 'colored'
  onSolutionPhFilter: (val: 'all' | 'acid' | 'neutral' | 'base' | 'colored') => void
  reactionSubTab: ReactionSubTab
  onReactionSubTab: (val: ReactionSubTab) => void
  activeCount: number
}

export function CatalogFilterBar({
  section,
  catalog,
  reactionConstants,
  speciesKindFilter,
  onSpeciesKindFilter,
  speciesSourceFilter,
  onSpeciesSourceFilter,
  solubilityFilter,
  onSolubilityFilter,
  solutionPhFilter,
  onSolutionPhFilter,
  reactionSubTab,
  onReactionSubTab,
  activeCount,
}: CatalogFilterBarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-background px-4 py-1.5 select-none">
      <div className="flex flex-wrap items-center gap-1">
        {section === 'species' && (
          <>
            {(
              [
                ['all', 'Toutes'],
                ['molecule', 'Molécules'],
                ['ionic_compound', 'Composés ioniques'],
                ['ion', 'Ions'],
                ['element_substance', 'Corps simples'],
              ] as const
            ).map(([val, label]) => (
              <FilterChip
                key={val}
                active={speciesKindFilter === val}
                onClick={() => onSpeciesKindFilter(val)}
              >
                {label}
              </FilterChip>
            ))}
            <Separator orientation="vertical" className="mx-1.5 h-3.5" />
            {(
              [
                ['all', 'Toutes sources'],
                ['curated', 'Noyau labo'],
                ['wikidata', 'Base étendue'],
                ['pubchem_live', 'PubChem'],
              ] as const
            ).map(([val, label]) => (
              <FilterChip
                key={val}
                active={speciesSourceFilter === val}
                onClick={() => onSpeciesSourceFilter(val)}
              >
                {label}
              </FilterChip>
            ))}
            <Separator orientation="vertical" className="mx-1.5 h-3.5" />
            {(
              [
                ['all', 'Toute solubilité'],
                ['soluble', 'Solubles H₂O'],
                ['insoluble', 'Insolubles'],
              ] as const
            ).map(([val, label]) => (
              <FilterChip
                key={val}
                active={solubilityFilter === val}
                onClick={() => onSolubilityFilter(val)}
              >
                {label}
              </FilterChip>
            ))}
          </>
        )}

        {section === 'solutions' &&
          (
            [
              ['all', 'Toutes'],
              ['acid', 'Acides'],
              ['neutral', 'Neutres'],
              ['base', 'Basiques'],
              ['colored', 'Colorées'],
            ] as const
          ).map(([val, label]) => (
            <FilterChip
              key={val}
              active={solutionPhFilter === val}
              onClick={() => onSolutionPhFilter(val)}
            >
              {label}
            </FilterChip>
          ))}

        {section === 'reactions' &&
          (
            [
              ['named', `Nommées (${catalog.reactions.length})`],
              [
                'redox',
                `Couples redox E° (${reactionConstants?.redoxCouples.length ?? catalog.summary.redoxCouplesCount ?? 0})`,
              ],
              [
                'ks',
                `Solubilité pKs (${reactionConstants?.solubilityProducts.length ?? catalog.summary.solubilityProductsCount ?? 0})`,
              ],
              [
                'pka',
                `Acide / Base pKa (${reactionConstants?.acidBaseCouples.length ?? catalog.summary.acidBaseCouplesCount ?? 0})`,
              ],
              ['predictor', 'Prédicteur'],
            ] as const
          ).map(([tabId, label]) => (
            <FilterChip
              key={tabId}
              active={reactionSubTab === tabId}
              onClick={() => onReactionSubTab(tabId)}
            >
              {label}
            </FilterChip>
          ))}

        {section === 'vessels' && (
          <span className="text-[11px] text-muted-foreground">
            Verrerie disponible dans la boîte à outils
          </span>
        )}
      </div>

      <span className="shrink-0 whitespace-nowrap font-mono text-[10.5px] tabular-nums text-muted-foreground">
        {activeCount} résultat{activeCount > 1 ? 's' : ''}
      </span>
    </div>
  )
}
