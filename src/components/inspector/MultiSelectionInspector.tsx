import { useMemo } from 'react'
import { Combine } from 'lucide-react'
import type {
  CanvasAtomNode,
  CanvasNode,
  CanvasSolidNode,
  ElementRecord,
  FullCatalogResponse,
} from '../../../shared/chemistry.ts'
import { formatFrNumber, formatMassG } from '@/lib/chemistry-ui'
import {
  buildCanonicalSignature,
  formatChargeLabel,
  formatFormulaFromComposition,
} from '@/lib/chemistry-calc'
import { forgeAlloyFromNodes, getSolidTotalMassG } from '@/lib/solid-alloys'
import { Button } from '@/components/ui/button'
import { ChemFormula, ChemText, Sup } from '@/components/ui/chem-text'
import { SolidBlockArtwork } from '@/components/SolidBlockArtwork'
import { MetricCell } from './InspectorPrimitives'

export function MultiSelectionInspector({
  nodes,
  catalog,
  elementsBySymbol,
  onMerge,
  onIonize,
}: {
  nodes: CanvasNode[]
  catalog: FullCatalogResponse | null
  elementsBySymbol: Map<string, ElementRecord>
  onMerge: () => void
  onIonize: (direction: 1 | -1) => void
}) {
  const atomsCount = nodes.filter((n) => n.kind === 'atom').length
  const solidsCount = nodes.filter((n) => n.kind === 'solid').length
  const moleculesCount = nodes.filter(
    (n) => n.kind === 'molecule' && n.species.kind !== 'ion',
  ).length
  const ionsCount = nodes.filter(
    (n) => n.kind === 'molecule' && n.species.kind === 'ion',
  ).length
  const flasksCount = nodes.filter((n) => n.kind === 'flask').length

  const canForgeAlloy =
    solidsCount > 0 &&
    flasksCount === 0 &&
    moleculesCount === 0 &&
    ionsCount === 0 &&
    nodes.every(
      (n) =>
        n.kind === 'solid' ||
        (n.kind === 'atom' && elementsBySymbol.get(n.symbol)?.defaultState === 'solid'),
    )

  const alloyPreview = useMemo(() => {
    if (!canForgeAlloy) return null
    return forgeAlloyFromNodes(
      nodes as Array<CanvasSolidNode | CanvasAtomNode>,
      catalog?.alloys ?? [],
      elementsBySymbol,
      0,
      0,
    )
  }, [canForgeAlloy, catalog?.alloys, elementsBySymbol, nodes])

  const allChemical = flasksCount === 0 && solidsCount === 0

  const summary = useMemo(() => {
    if (!allChemical) return null
    const composition: Record<string, number> = {}
    let totalCharge = 0
    let totalMass = 0

    for (const node of nodes) {
      if (node.kind === 'atom') {
        composition[node.symbol] = (composition[node.symbol] ?? 0) + 1
        totalMass += elementsBySymbol.get(node.symbol)?.atomicMass ?? 0
      } else if (node.kind === 'molecule') {
        totalCharge += node.species.charge
        totalMass += node.species.molarMass
        for (const [sym, qty] of Object.entries(node.species.composition)) {
          composition[sym] = (composition[sym] ?? 0) + qty
        }
      }
    }

    const sig = buildCanonicalSignature(composition)
    const rawFormula = formatFormulaFromComposition(composition)

    const exactMatches =
      catalog?.species.filter(
        (sp) =>
          buildCanonicalSignature(sp.composition) === sig && sp.charge === totalCharge,
      ) ?? []

    const possibleIons =
      catalog?.species.filter(
        (sp) =>
          sp.kind === 'ion' &&
          buildCanonicalSignature(sp.composition) === sig &&
          sp.charge !== totalCharge,
      ) ?? []

    return {
      composition,
      totalCharge,
      totalMass,
      rawFormula,
      exactMatches,
      possibleIons,
    }
  }, [allChemical, catalog, elementsBySymbol, nodes])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold text-foreground">Sélection multiple</h2>
          <p className="mt-0.5 text-[10.5px] tabular-nums text-muted-foreground">
            {[
              atomsCount > 0 ? `${atomsCount} atome${atomsCount > 1 ? 's' : ''}` : null,
              solidsCount > 0
                ? `${solidsCount} bloc${solidsCount > 1 ? 's' : ''} solide${solidsCount > 1 ? 's' : ''}`
                : null,
              moleculesCount > 0
                ? `${moleculesCount} molécule${moleculesCount > 1 ? 's' : ''}`
                : null,
              ionsCount > 0 ? `${ionsCount} ion${ionsCount > 1 ? 's' : ''}` : null,
              flasksCount > 0 ? `${flasksCount} fiole${flasksCount > 1 ? 's' : ''}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>

      {alloyPreview && (
        <div className="space-y-3 border-t border-border/60 pt-3.5">
          <p className="text-[10.5px] font-medium text-muted-foreground">
            {alloyPreview.alloyId
              ? 'Alliage répertorié'
              : alloyPreview.isAlloy
                ? 'Alliage personnalisé'
                : 'Fusion de solide'}
          </p>
          <div className="flex items-center gap-3">
            <SolidBlockArtwork colorHex={alloyPreview.colorHex} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                <ChemText value={alloyPreview.nameFr} />
              </p>
              <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                {formatMassG(getSolidTotalMassG(alloyPreview))} · ρ ={' '}
                {formatFrNumber(alloyPreview.densityGPerCm3, 2)} g/cm<Sup>3</Sup>
              </p>
            </div>
          </div>
          <Button size="sm" onClick={onMerge} className="w-full">
            <Combine className="h-3.5 w-3.5" strokeWidth={1.7} />
            <span>{alloyPreview.isAlloy ? 'Allier (V)' : 'Fusionner (V)'}</span>
          </Button>
        </div>
      )}

      {summary && (
        <>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-border/60 pt-3.5 text-xs">
            <MetricCell label="Formule cumulée" value={summary.rawFormula} mono />
            <MetricCell
              label="Charge totale"
              value={formatChargeLabel(summary.totalCharge)}
              mono
            />
            <MetricCell
              label="Masse cumulée"
              value={`${formatFrNumber(summary.totalMass, 2)} g/mol`}
              mono
            />
            <MetricCell
              label="Atomes"
              value={String(
                Object.values(summary.composition).reduce((a, b) => a + b, 0),
              )}
              mono
            />
          </dl>

          <div className="border-t border-border/60 pt-3.5">
            {summary.exactMatches.length > 0 ? (
              <>
                <p className="text-[10.5px] font-medium text-muted-foreground">
                  {summary.exactMatches.length > 1
                    ? `${summary.exactMatches.length} isomères reconnus en base`
                    : 'Combinaison reconnue en base'}
                </p>
                {summary.exactMatches.length === 1 ? (
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="shrink-0 text-sm font-semibold text-foreground">
                      <ChemFormula value={summary.exactMatches[0].displayFormula} />
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {summary.exactMatches[0].nameFr}
                    </span>
                  </div>
                ) : (
                  <ul className="mt-1.5 space-y-1 text-[11px]">
                    {summary.exactMatches.slice(0, 4).map((cand) => (
                      <li
                        key={cand.id}
                        className="flex items-baseline justify-between gap-2 text-zinc-200"
                      >
                        <span className="truncate font-medium">{cand.nameFr}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          <ChemFormula value={cand.displayFormula} />
                        </span>
                      </li>
                    ))}
                    {summary.exactMatches.length > 4 && (
                      <li className="text-[10px] text-muted-foreground">
                        +{summary.exactMatches.length - 4} autres isomères
                      </li>
                    )}
                  </ul>
                )}
                <Button size="sm" onClick={onMerge} className="mt-2.5 w-full">
                  <Combine className="h-3.5 w-3.5" strokeWidth={1.7} />
                  <span>
                    {summary.exactMatches.length > 1
                      ? 'Choisir l’isomère (V)'
                      : 'Fusionner (V)'}
                  </span>
                </Button>
              </>
            ) : (
              <>
                <p className="text-[11px] font-medium text-zinc-300">
                  Aucune espèce neutre exacte
                </p>
                {summary.possibleIons.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-[10.5px] text-muted-foreground">
                      Ion polyatomique possible :
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {summary.possibleIons.map((ion) => (
                        <Button
                          key={ion.id}
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            onIonize(ion.charge > summary.totalCharge ? 1 : -1)
                          }
                          className="h-7 px-2.5 text-xs"
                        >
                          <ChemFormula value={ion.displayFormula} />
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-[10.5px] text-muted-foreground">
                    Ajoutez ou ajustez les atomes sélectionnés pour former une espèce connue.
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
