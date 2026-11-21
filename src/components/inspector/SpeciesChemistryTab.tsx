import { ArrowRight } from 'lucide-react'
import type {
  CatalogReactionRecord,
  CatalogSolutionRecord,
  CatalogSpeciesRecord,
  ElementRecord,
  SpeciesRecord,
} from '../../../shared/chemistry.ts'
import { DISSOLUTION_LABEL, formatFrNumber } from '@/lib/chemistry-ui'
import { formatBehaviorEntry } from '@/lib/chemistry-calc'
import { VesselArtwork } from '@/components/VesselArtwork'
import type { CatalogJumpTarget } from './InspectorPrimitives'

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
  isIon,
  isUnknownSolubility,
  linkedSolution,
  linkedReactions,
  massBreakdown,
  behaviors,
  distinctIupac,
  elementsBySymbol,
  onOpenInCatalog,
}: {
  sp: SpeciesRecord
  enriched: CatalogSpeciesRecord | null
  isIon: boolean
  isUnknownSolubility: boolean
  linkedSolution: CatalogSolutionRecord | null
  linkedReactions: CatalogReactionRecord[]
  massBreakdown: MassBreakdownItem[]
  behaviors: Array<[string, unknown]>
  distinctIupac: string | null
  elementsBySymbol: Map<string, ElementRecord>
  onOpenInCatalog: (target: CatalogJumpTarget) => void
}) {
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-medium text-muted-foreground">Comportement dans l’eau</span>
          <span className="shrink-0 whitespace-nowrap text-zinc-300">
            {sp.isSolvent
              ? 'Solvant'
              : isUnknownSolubility
                ? 'Non renseigné'
                : DISSOLUTION_LABEL[sp.dissolutionType]}
          </span>
        </div>

        {enriched && enriched.dissolutionProducts.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 py-1 font-mono text-[11.5px]">
            <span className="text-muted-foreground">{sp.displayFormula}</span>
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
                {p.displayFormula}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {sp.isSolvent
              ? 'Solvant aqueux principal pour préparer des solutions.'
              : isIon
                ? sp.canDissolveInWater
                  ? 'Soluble dans H₂O (espèce ionique hydratée).'
                  : 'Espèce ionique (solubilité non renseignée).'
                : isUnknownSolubility
                  ? 'Solubilité aqueuse non renseignée dans la base étendue.'
                  : sp.standardState === 'solid'
                    ? 'Insoluble dans l’eau : peut être immergé comme solide réactif.'
                    : 'Ne se dissout pas dans l’eau.'}
          </p>
        )}

        {sp.solubilityByTempC && Object.keys(sp.solubilityByTempC).length >= 2 && (
          <div className="pt-1">
            <span className="block text-[10.5px] text-muted-foreground">
              Solubilité dans H₂O (g/L)
            </span>
            <dl className="mt-1.5 grid grid-cols-4 divide-x divide-border/60 border-y border-border/60 py-1.5 text-center font-mono">
              {['0', '20', '60', '100']
                .filter((t) => sp.solubilityByTempC?.[t] !== undefined)
                .map((t) => (
                  <div key={t} className="px-1">
                    <dt className="text-[9.5px] text-muted-foreground">{t} °C</dt>
                    <dd className="mt-0.5 text-[11px] tabular-nums text-foreground">
                      {formatFrNumber(sp.solubilityByTempC![t], 0)}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
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
            <p className="truncate font-mono text-[10.5px] text-muted-foreground">
              {linkedSolution.formulaLabel}
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
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    ×{item.count}
                  </span>
                  <span className="truncate text-muted-foreground">{item.nameFr}</span>
                </button>
                <span className="shrink-0 whitespace-nowrap font-mono text-[10.5px] tabular-nums text-muted-foreground">
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
                <p className="mt-0.5 break-words font-mono text-[10.5px] text-muted-foreground">
                  {r.equationDisplay}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {behaviors.length > 0 && (
        <section className="space-y-1.5 border-t border-border/60 pt-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">Propriétés</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {behaviors.map(([k, v]) => {
              const formatted = formatBehaviorEntry(k, v)
              return (
                <span key={k}>
                  {formatted.label} :{' '}
                  <span className="font-mono text-zinc-200">{formatted.display}</span>
                </span>
              )
            })}
          </div>
        </section>
      )}

      {(distinctIupac || sp.casNumber || sp.pubchemCid) && (
        <section className="space-y-2 border-t border-border/60 pt-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">Références</p>
          {distinctIupac && (
            <div>
              <span className="block text-[10.5px] text-muted-foreground">Nom IUPAC</span>
              <p className="mt-0.5 break-words text-[11.5px] leading-snug text-zinc-200">
                {distinctIupac}
              </p>
            </div>
          )}
          {(sp.casNumber || sp.pubchemCid) && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {sp.casNumber && (
                <div>
                  <dt className="text-[10.5px] text-muted-foreground">N° CAS</dt>
                  <dd className="mt-0.5 font-mono text-[11px] tabular-nums text-foreground">
                    {sp.casNumber}
                  </dd>
                </div>
              )}
              {sp.pubchemCid && (
                <div>
                  <dt className="text-[10.5px] text-muted-foreground">PubChem CID</dt>
                  <dd className="mt-0.5 font-mono text-[11px] tabular-nums text-foreground">
                    {sp.pubchemCid}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </section>
      )}
    </div>
  )
}
