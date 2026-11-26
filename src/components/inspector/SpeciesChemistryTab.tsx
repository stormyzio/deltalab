import { ArrowRight } from 'lucide-react'
import type {
  CatalogReactionRecord,
  CatalogSolutionRecord,
  CatalogSpeciesRecord,
  ElementRecord,
  SpeciesRecord,
} from '../../../shared/chemistry.ts'
import { formatFrNumber } from '@/lib/chemistry-ui'
import { describeWaterBehavior } from '@/lib/water-behavior'
import { ChemFormula, ChemText } from '@/components/ui/chem-text'
import { VesselArtwork } from '@/components/VesselArtwork'
import type { CatalogJumpTarget } from './InspectorPrimitives'

function UnknownValue({ title = 'Donnée non renseignée en base' }: { title?: string }) {
  return (
    <span title={title} className="text-muted-foreground">
      ?
    </span>
  )
}

export interface MassBreakdownItem {
  sym: string
  count: number
  nameFr: string
  partMass: number
  pct: number
}

export function SpeciesChemistryTab({
  sp,
  enriched,
  linkedSolution,
  linkedReactions,
  massBreakdown,
  notableBehaviors,
  elementsBySymbol,
  onOpenInCatalog,
}: {
  sp: SpeciesRecord
  enriched: CatalogSpeciesRecord | null
  linkedSolution: CatalogSolutionRecord | null
  linkedReactions: CatalogReactionRecord[]
  massBreakdown: MassBreakdownItem[]
  notableBehaviors: Array<{ key: string; text: string }>
  elementsBySymbol: Map<string, ElementRecord>
  onOpenInCatalog: (target: CatalogJumpTarget) => void
}) {
  const waterBehavior = describeWaterBehavior(sp)
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-medium text-muted-foreground">Comportement dans l’eau</span>
          <span className="shrink-0 whitespace-nowrap text-zinc-300">
            {waterBehavior.tier === 'unknown' ? (
              <UnknownValue title="Solubilité dans l’eau non renseignée" />
            ) : (
              waterBehavior.tierLabel
            )}
          </span>
        </div>

        {enriched && enriched.dissolutionProducts.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 py-1 text-[11.5px]">
            <span className="text-muted-foreground">
              <ChemFormula value={sp.displayFormula} />
            </span>
            <ArrowRight className="h-3 w-3 shrink-0 text-zinc-500" />
            {enriched.dissolutionProducts.map((p, idx) => (
              <button
                key={p.speciesId}
                type="button"
                onClick={() => onOpenInCatalog({ section: 'species', id: p.speciesId })}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded px-1 py-0.5 text-foreground hover:bg-accent"
              >
                {idx > 0 && <span className="mr-0.5 text-zinc-500">+</span>}
                {p.colorHex && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: p.colorHex }}
                  />
                )}
                {p.stoichiometry > 1 ? `${p.stoichiometry} ` : ''}
                <ChemFormula value={p.displayFormula} />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <ChemText value={waterBehavior.descriptionFr} />
          </p>
        )}
      </section>

      {linkedSolution && (
        <button
          type="button"
          onClick={() => onOpenInCatalog({ section: 'solutions', id: linkedSolution.id })}
          className="flex w-full items-center gap-3 border-t border-border/60 pt-3.5 text-left hover:opacity-90"
        >
          <VesselArtwork
            vesselType="erlenmeyer"
            fillRatio={0.55}
            liquidColorHex={linkedSolution.colorHex}
            liquidOpacity={
              linkedSolution.colorHex &&
              linkedSolution.colorHex !== '#bae6fd' &&
              linkedSolution.colorHex !== '#e0f2fe'
                ? 0.62
                : 0.28
            }
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-muted-foreground">Solution obtenue</p>
            <p className="truncate text-xs font-medium text-foreground">
              {linkedSolution.nameFr}
            </p>
            <p className="truncate text-[10.5px] text-muted-foreground">
              <ChemFormula value={linkedSolution.formulaLabel} />
              {linkedSolution.phEstimate !== null
                ? ` · pH ${formatFrNumber(linkedSolution.phEstimate, 1)}`
                : ''}
            </p>
          </div>
        </button>
      )}

      <section className="space-y-2 border-t border-border/60 pt-3.5">
        <p className="text-[11px] font-medium text-muted-foreground">Composition massique</p>
        <div className="space-y-2">
          {massBreakdown.map((item) => (
            <div key={item.sym}>
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    const el = elementsBySymbol.get(item.sym)
                    if (el) {
                      onOpenInCatalog({
                        section: 'elements',
                        id: String(el.atomicNumber),
                      })
                    }
                  }}
                  className="inline-flex min-w-0 items-center gap-1.5 text-foreground hover:text-white"
                >
                  <span className="shrink-0 font-semibold">{item.sym}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    ×{item.count}
                  </span>
                  <span className="truncate text-muted-foreground">{item.nameFr}</span>
                </button>
                <span className="shrink-0 whitespace-nowrap text-[10.5px] tabular-nums text-muted-foreground">
                  {formatFrNumber(item.pct, 1)} %
                </span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-zinc-400/70"
                  style={{ width: `${Math.min(100, Math.max(3, item.pct))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {linkedReactions.length > 0 && (
        <section className="space-y-1.5 border-t border-border/60 pt-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            Réactions connues ({linkedReactions.length})
          </p>
          <div className="divide-y divide-border/50">
            {linkedReactions.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onOpenInCatalog({ section: 'reactions', id: r.id })}
                className="w-full py-2 text-left hover:text-white"
              >
                <p className="text-[11px] font-medium text-foreground">{r.nameFr}</p>
                <p className="mt-0.5 break-words text-[10.5px] text-muted-foreground">
                  <ChemFormula value={r.equationDisplay} />
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {notableBehaviors.length > 0 && (
        <section className="space-y-1 border-t border-border/60 pt-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">Particularités</p>
          <p className="text-[11px] leading-relaxed text-zinc-200">
            {notableBehaviors.map((b, idx) => (
              <span key={b.key}>
                {idx > 0 && ' · '}
                <ChemText value={b.text} />
              </span>
            ))}
          </p>
        </section>
      )}

      <section className="space-y-2 border-t border-border/60 pt-3.5">
        <p className="text-[11px] font-medium text-muted-foreground">Références</p>
        <div>
          <span className="block text-[10.5px] text-muted-foreground">Nom IUPAC</span>
          <p className="mt-0.5 break-words text-[11.5px] leading-snug text-zinc-200">
            {sp.iupacName ? sp.iupacName : <UnknownValue />}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <dt className="text-[10.5px] text-muted-foreground">N° CAS</dt>
            <dd className="mt-0.5 text-[11px] tabular-nums text-foreground">
              {sp.casNumber ? sp.casNumber : <UnknownValue />}
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] text-muted-foreground">PubChem CID</dt>
            <dd className="mt-0.5 text-[11px] tabular-nums text-foreground">
              {sp.pubchemCid ? sp.pubchemCid : <UnknownValue />}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
