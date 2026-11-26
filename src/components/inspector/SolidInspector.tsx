import { useMemo } from 'react'
import {
  type AlloyRecord,
  type CanvasSolidNode,
  type ElementRecord,
  getElementSolidColor,
} from '../../../shared/chemistry.ts'
import { formatFrNumber } from '@/lib/chemistry-ui'
import {
  MOL_UNITS,
  SOLID_MASS_UNITS,
  SOLID_VOLUME_UNITS,
} from '@/lib/quantity-units'
import {
  getSolidTotalMassG,
  getSolidVolumeCm3,
  matchAlloyFromComponents,
} from '@/lib/solid-alloys'
import { ScrubNumberInput } from '@/components/ui/scrub-number-input'
import { ChemText, Sup } from '@/components/ui/chem-text'
import { SolidBlockArtwork } from '@/components/SolidBlockArtwork'
import { type CatalogJumpTarget, MetricCell, QuickActions } from './InspectorPrimitives'

export function SolidInspector({
  node,
  elementsBySymbol,
  alloys,
  onSetMass,
  onSetVolume,
  onSetComponentMass,
  onReproportionToAlloy,
  onOpenInCatalog,
}: {
  node: CanvasSolidNode
  elementsBySymbol: Map<string, ElementRecord>
  alloys: AlloyRecord[]
  onSetMass: (nextMassG: number) => void
  onSetVolume: (nextVolumeCm3: number) => void
  onSetComponentMass: (symbol: string, nextMassG: number) => void
  onReproportionToAlloy: (alloy: AlloyRecord) => void
  onOpenInCatalog: (target: CatalogJumpTarget) => void
}) {
  const totalMassG = getSolidTotalMassG(node)
  const volumeCm3 = getSolidVolumeCm3(node)

  const pureEl =
    !node.isAlloy && node.components.length === 1
      ? (elementsBySymbol.get(node.components[0].symbol) ?? null)
      : null
  const pureMol = pureEl && pureEl.atomicMass > 0 ? totalMassG / pureEl.atomicMass : null

  const matchedAlloy = useMemo(
    () => (node.alloyId ? (alloys.find((a) => a.id === node.alloyId) ?? null) : null),
    [alloys, node.alloyId],
  )

  const { sameElementAlloys } = useMemo(
    () => matchAlloyFromComponents(node.components, alloys),
    [alloys, node.components],
  )

  const alternativeAlloys = useMemo(
    () => sameElementAlloys.filter((a) => a.id !== node.alloyId),
    [node.alloyId, sameElementAlloys],
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card/80">
            <SolidBlockArtwork colorHex={node.colorHex} size="sm" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
              <ChemText value={node.nameFr} />
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {matchedAlloy
                ? `Alliage · ${matchedAlloy.familyFr}`
                : node.isAlloy
                  ? 'Alliage personnalisé'
                  : pureEl
                    ? `Corps simple solide · Z = ${pureEl.atomicNumber}`
                    : 'Bloc solide'}
            </p>
          </div>
        </div>

        {(pureEl || matchedAlloy) && (
          <QuickActions
            onOpenCatalog={() => {
              if (pureEl) {
                onOpenInCatalog({
                  section: 'elements',
                  id: String(pureEl.atomicNumber),
                })
              } else if (matchedAlloy) {
                onOpenInCatalog({
                  section: 'alloys',
                  id: matchedAlloy.id,
                })
              }
            }}
          />
        )}
      </div>

      {/* Mass <-> Volume synchronized controls */}
      <section className="space-y-2 border-t border-border/60 pt-3.5">
        <div className="flex items-baseline justify-between gap-2 text-[11px]">
          <span className="font-medium text-muted-foreground">Masse & volume</span>
          <span className="text-[10.5px] tabular-nums text-muted-foreground">
            ρ = {formatFrNumber(node.densityGPerCm3, 2)} g/cm<Sup>3</Sup>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <ScrubNumberInput
            prefixLabel="m"
            value={totalMassG}
            units={SOLID_MASS_UNITS}
            defaultUnitId={totalMassG < 1 ? 'mg' : totalMassG >= 1000 ? 'kg' : 'g'}
            min={0.01}
            max={100000}
            ariaLabel={`Masse de ${node.nameFr}`}
            onChange={onSetMass}
          />
          <ScrubNumberInput
            prefixLabel="V"
            value={volumeCm3}
            units={SOLID_VOLUME_UNITS}
            defaultUnitId={volumeCm3 < 0.1 ? 'mm3' : volumeCm3 >= 1000 ? 'dm3' : 'cm3'}
            min={0.001}
            max={50000}
            ariaLabel={`Volume de ${node.nameFr}`}
            onChange={onSetVolume}
          />
        </div>

        {pureEl && pureMol !== null && (
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-[11px] text-muted-foreground">Quantité de matière</span>
            <ScrubNumberInput
              prefixLabel="n"
              value={pureMol}
              units={MOL_UNITS}
              defaultUnitId={pureMol < 0.1 ? 'mmol' : 'mol'}
              min={0.0001}
              max={10000}
              ariaLabel={`Quantité de matière de ${node.nameFr}`}
              onChange={(mol) => onSetMass(mol * pureEl.atomicMass)}
              className="w-36"
            />
          </div>
        )}
      </section>

      {/* Alloy composition breakdown + live component mass tuning */}
      {node.isAlloy && (
        <section className="space-y-2.5 border-t border-border/60 pt-3.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            Composition massique
          </span>

          {/* Stacked realistic color bar */}
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
            {node.components.map((c) => {
              const pct = totalMassG > 0 ? (c.massG / totalMassG) * 100 : 0
              const el = elementsBySymbol.get(c.symbol)
              return (
                <div
                  key={c.symbol}
                  style={{
                    width: `${Math.max(1.5, pct)}%`,
                    backgroundColor: getElementSolidColor(c.symbol, el?.category),
                  }}
                  title={`${c.symbol} : ${formatFrNumber(pct, 1)} %`}
                />
              )
            })}
          </div>

          <ul className="divide-y divide-border/40">
            {node.components.map((c) => {
              const pct = totalMassG > 0 ? (c.massG / totalMassG) * 100 : 0
              const el = elementsBySymbol.get(c.symbol)
              return (
                <li
                  key={c.symbol}
                  className="flex items-center justify-between gap-2 py-1.5 text-[11px]"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full border border-white/15"
                      style={{
                        backgroundColor: getElementSolidColor(c.symbol, el?.category),
                      }}
                    />
                    <span className="font-semibold text-foreground">{c.symbol}</span>
                    <span className="truncate text-muted-foreground">
                      {el?.nameFr ?? c.symbol}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="w-[4.5ch] text-right text-[10.5px] tabular-nums text-muted-foreground">
                      {formatFrNumber(pct, pct < 5 ? 1 : 0)} %
                    </span>
                    <ScrubNumberInput
                      value={c.massG}
                      units={SOLID_MASS_UNITS}
                      defaultUnitId={c.massG < 1 ? 'mg' : 'g'}
                      min={0.001}
                      max={100000}
                      ariaLabel={`Masse de ${c.symbol} dans ${node.nameFr}`}
                      onChange={(nextG) => onSetComponentMass(c.symbol, nextG)}
                      className="w-24"
                    />
                  </div>
                </li>
              )
            })}
          </ul>

          {/* 1-click re-proportioning to known alloys with the same elements */}
          {alternativeAlloys.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="text-[10.5px] text-muted-foreground">
                {node.alloyId
                  ? 'Autres nuances avec ces éléments :'
                  : 'Ajuster les proportions vers un alliage connu :'}
              </p>
              <div className="flex flex-wrap gap-1">
                {alternativeAlloys.map((al) => (
                  <button
                    key={al.id}
                    type="button"
                    onClick={() => onReproportionToAlloy(al)}
                    className="rounded border border-border/70 bg-card/70 px-2 py-1 text-[10.5px] text-zinc-200 hover:bg-accent hover:text-foreground"
                  >
                    <ChemText value={al.nameFr} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Physical properties */}
      <section className="space-y-2 border-t border-border/60 pt-3.5">
        <span className="text-[11px] font-medium text-muted-foreground">
          Propriétés physiques
        </span>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <MetricCell
            label="Masse volumique"
            value={
              <>
                {formatFrNumber(node.densityGPerCm3, 2)} g/cm<Sup>3</Sup>
              </>
            }
            mono
          />
          <MetricCell
            label="Température de fusion"
            value={
              node.meltingPointC !== null
                ? `${formatFrNumber(node.meltingPointC, 0)} °C`
                : '—'
            }
            mono
          />
          {pureEl && (
            <MetricCell
              label="Masse molaire"
              value={`${formatFrNumber(pureEl.atomicMass, 2)} g/mol`}
              mono
            />
          )}
          <MetricCell
            label="État à 20 °C"
            value={
              node.meltingPointC !== null && node.meltingPointC < 20
                ? 'Liquide'
                : 'Solide'
            }
          />
        </dl>

        {node.usesFr && (
          <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
            <ChemText value={node.usesFr} />
          </p>
        )}
      </section>

      <p className="border-t border-border/60 pt-3 text-[10.5px] leading-relaxed text-muted-foreground">
        Glissez ce bloc sur une verrerie pour l’immerger, ou sur un autre bloc solide pour
        former un alliage.
      </p>
    </div>
  )
}
