import { type RefObject, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type {
  AcidBaseCoupleRecord,
  RedoxCoupleRecord,
  SolubilityProductRecord,
} from '../../../shared/chemistry.ts'
import { formatFrNumber } from '@/lib/chemistry-ui'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChemFormula, ChemVar, Sup } from '@/components/ui/chem-text'
import type { ReactionSpawnSetup } from './CatalogShared'

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a))
  let y = Math.abs(Math.trunc(b))
  while (y !== 0) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}

function fmtTerm(stoich: number, formula: string): string {
  return stoich > 1 ? `${stoich} ${formula}` : formula
}

function buildRedoxPair(a: RedoxCoupleRecord, b: RedoxCoupleRecord) {
  const [oxC, redC] = a.e0V >= b.e0V ? [a, b] : [b, a]
  const deltaE0 = Math.round((oxC.e0V - redC.e0V) * 100) / 100
  const g = gcd(oxC.electrons, redC.electrons)
  const mOx = redC.electrons / g
  const mRed = oxC.electrons / g

  const oxQty = mOx * oxC.oxStoich
  const redQty = mRed * redC.redStoich
  const redProdQty = mOx * oxC.redStoich
  const oxProdQty = mRed * redC.oxStoich
  const netHPlus = mOx * oxC.hPlus - mRed * redC.hPlus
  const netH2O = mOx * oxC.h2o - mRed * redC.h2o

  const leftParts = [fmtTerm(oxQty, oxC.oxFormula), fmtTerm(redQty, redC.redFormula)]
  const rightParts = [
    fmtTerm(redProdQty, oxC.redFormula),
    fmtTerm(oxProdQty, redC.oxFormula),
  ]
  if (netHPlus > 0) leftParts.push(fmtTerm(netHPlus, 'H⁺'))
  else if (netHPlus < 0) rightParts.push(fmtTerm(-netHPlus, 'H⁺'))
  if (netH2O < 0) leftParts.push(fmtTerm(-netH2O, 'H₂O'))
  else if (netH2O > 0) rightParts.push(fmtTerm(netH2O, 'H₂O'))

  const equation = `${leftParts.join(' + ')} → ${rightParts.join(' + ')}`

  const canSpawn = Boolean(
    oxC.oxSpeciesId &&
      redC.redSpeciesId &&
      oxC.oxSpeciesId !== redC.redSpeciesId &&
      deltaE0 > 0.05,
  )

  const reactants: Array<{ speciesId: string; stoichiometry: number }> = []
  if (oxC.oxSpeciesId) reactants.push({ speciesId: oxC.oxSpeciesId, stoichiometry: oxQty })
  if (redC.redSpeciesId) {
    reactants.push({ speciesId: redC.redSpeciesId, stoichiometry: redQty })
  }
  if (netHPlus > 0) {
    reactants.push({ speciesId: 'h3o_plus', stoichiometry: netHPlus })
  }

  const missingReason =
    deltaE0 <= 0.05
      ? 'Écart ΔE° insuffisant (≤ 0,05 V).'
      : !oxC.oxSpeciesId
        ? `${oxC.oxFormula} absent du catalogue.`
        : !redC.redSpeciesId
          ? `${redC.redFormula} absent du catalogue.`
          : null

  return {
    oxC,
    redC,
    deltaE0,
    equation,
    canSpawn,
    missingReason,
    setup: {
      titleFr: `${oxC.oxFormula} + ${redC.redFormula}`,
      medium: 'aqueous' as const,
      reactants,
    },
  }
}

function buildAcidBasePair(a: AcidBaseCoupleRecord, b: AcidBaseCoupleRecord) {
  const [acidC, baseC] = a.pKa <= b.pKa ? [a, b] : [b, a]
  const effectiveAcidPka = Math.max(0, acidC.pKa)
  const deltaPka = Math.round((baseC.pKa - effectiveAcidPka) * 100) / 100

  const indifferentBase = baseC.pKa <= 0
  const sameSpecies =
    Boolean(acidC.acidSpeciesId && baseC.baseSpeciesId) &&
    acidC.acidSpeciesId === baseC.baseSpeciesId
  const acidDisp = acidC.pKa < 0 ? 'H₃O⁺' : acidC.acidFormula
  const conjBaseDisp = acidC.pKa < 0 ? 'H₂O' : acidC.baseFormula
  const equation = `${acidDisp} + ${baseC.baseFormula} ${deltaPka >= 3 ? '→' : '⇌'} ${conjBaseDisp} + ${baseC.acidFormula}`

  const canSpawn = Boolean(
    !indifferentBase &&
      !sameSpecies &&
      deltaPka > 0.01 &&
      acidC.acidSpeciesId &&
      baseC.baseSpeciesId,
  )

  const missingReason = indifferentBase
    ? `${baseC.baseFormula} est spectateur dans l’eau (pKa ≤ 0).`
    : sameSpecies || deltaPka <= 0.01
      ? 'Pas de transfert spontané entre ces deux couples.'
      : !acidC.acidSpeciesId
        ? `${acidC.acidFormula} absent du catalogue.`
        : !baseC.baseSpeciesId
          ? `${baseC.baseFormula} absent du catalogue.`
          : null

  return {
    acidC,
    baseC,
    deltaPka,
    equation,
    canSpawn,
    missingReason,
    setup: {
      titleFr: `${acidC.acidFormula} + ${baseC.baseFormula}`,
      medium: 'aqueous' as const,
      reactants:
        acidC.acidSpeciesId && baseC.baseSpeciesId
          ? [
              { speciesId: acidC.acidSpeciesId, stoichiometry: 1 },
              { speciesId: baseC.baseSpeciesId, stoichiometry: 1 },
            ]
          : [],
    },
  }
}

export function ReactionConstantsTables({
  subTab,
  redox,
  ks,
  ab,
  onSpawnReactionSetup,
}: {
  subTab: 'redox' | 'ks' | 'pka'
  redox: RedoxCoupleRecord[]
  ks: SolubilityProductRecord[]
  ab: AcidBaseCoupleRecord[]
  scrollRootRef?: RefObject<HTMLElement | null>
  onSpawnReactionSetup?: (setup: ReactionSpawnSetup) => void
}) {
  const [selectedRedoxCouples, setSelectedRedoxCouples] = useState<RedoxCoupleRecord[]>([])
  const [selectedAbCouples, setSelectedAbCouples] = useState<AcidBaseCoupleRecord[]>([])

  const redoxPair = useMemo(() => {
    if (selectedRedoxCouples.length !== 2) return null
    return buildRedoxPair(selectedRedoxCouples[0], selectedRedoxCouples[1])
  }, [selectedRedoxCouples])

  const abPair = useMemo(() => {
    if (selectedAbCouples.length !== 2) return null
    return buildAcidBasePair(selectedAbCouples[0], selectedAbCouples[1])
  }, [selectedAbCouples])

  const toggleRedoxCouple = (couple: RedoxCoupleRecord) => {
    setSelectedRedoxCouples((prev) => {
      if (prev.some((x) => x.id === couple.id)) return prev.filter((x) => x.id !== couple.id)
      if (prev.length >= 2) return [prev[1], couple]
      return [...prev, couple]
    })
  }

  const toggleAbCouple = (couple: AcidBaseCoupleRecord) => {
    setSelectedAbCouples((prev) => {
      if (prev.some((x) => x.id === couple.id)) return prev.filter((x) => x.id !== couple.id)
      if (prev.length >= 2) return [prev[1], couple]
      return [...prev, couple]
    })
  }

  if (subTab === 'redox') {
    return (
      <>
        {/* Fixed-height sticky composer bar (zero vertical shift) */}
        <div className="sticky top-0 z-20 flex h-11 shrink-0 flex-nowrap items-center justify-between gap-3 overflow-hidden border-b border-border bg-panel/95 px-4 text-xs">
          {redoxPair ? (
            <>
              <div className="flex min-w-0 flex-1 items-baseline gap-2.5 overflow-hidden">
                <span className="truncate text-[12px] font-medium text-foreground">
                  <ChemFormula value={redoxPair.equation} />
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  ΔE° = +{formatFrNumber(redoxPair.deltaE0, 2)} V
                </span>
                {redoxPair.missingReason && (
                  <span className="shrink-0 text-[11px] text-amber-300">
                    {redoxPair.missingReason}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {onSpawnReactionSetup && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!redoxPair.canSpawn}
                    onClick={() => onSpawnReactionSetup(redoxPair.setup)}
                    className="h-7 gap-1.5 px-2.5 text-[11px]"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.7} />
                    <span>Paillasse</span>
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedRedoxCouples([])}
                  aria-label="Effacer la sélection"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          ) : selectedRedoxCouples.length === 1 ? (
            <>
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-[11.5px] text-muted-foreground">
                <span className="shrink-0 font-medium text-foreground">
                  <ChemFormula value={selectedRedoxCouples[0].coupleLabel} />
                </span>
                <span className="shrink-0 tabular-nums">
                  ({selectedRedoxCouples[0].e0V > 0 ? '+' : ''}
                  {formatFrNumber(selectedRedoxCouples[0].e0V, 2)} V)
                </span>
                <span className="truncate">
                  · Sélectionnez un 2<Sup>e</Sup> couple pour composer la réaction
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRedoxCouples([])}
                aria-label="Effacer la sélection"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <span className="truncate text-[11px] text-muted-foreground">
              Sélectionnez 2 couples redox pour calculer la réaction spontanée (règle du γ)
              et l’envoyer sur la paillasse.
            </span>
          )}
        </div>

        <table className="w-full table-fixed border-collapse text-left text-xs">
          <thead className="border-b border-border bg-panel/60 text-[11px] text-muted-foreground">
            <tr>
              <th className="w-12 py-2 pl-4 pr-1 font-medium" aria-label="Sélection" />
              <th className="w-36 whitespace-nowrap px-2 py-2 font-medium">Couple Ox / Red</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">
                Demi-équation électronique
              </th>
              <th className="w-24 whitespace-nowrap px-3 py-2 text-right font-medium">E° (V)</th>
              <th className="hidden w-28 whitespace-nowrap py-2 pl-3 pr-4 font-medium md:table-cell">
                Source
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {redox.map((c) => {
              const isSelected = selectedRedoxCouples.some((x) => x.id === c.id)
              const slotText =
                redoxPair && redoxPair.oxC.id === c.id
                  ? 'Ox'
                  : redoxPair && redoxPair.redC.id === c.id
                    ? 'Red'
                    : isSelected
                      ? '1'
                      : ''
              return (
                <tr
                  key={c.id}
                  onClick={() => toggleRedoxCouple(c)}
                  className={cn(isSelected ? 'bg-accent/75' : 'hover:bg-accent/40')}
                >
                  <td className="w-12 py-2 pl-4 pr-1">
                    <span
                      className={cn(
                        'inline-flex h-5 w-8 items-center justify-center rounded border text-[10px] tabular-nums',
                        isSelected
                          ? 'border-zinc-200 bg-zinc-100 text-zinc-950'
                          : 'border-border/80 text-transparent',
                      )}
                    >
                      {slotText || '·'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-[11.5px] font-medium text-foreground">
                    <ChemFormula value={c.coupleLabel} />
                  </td>
                  <td className="px-3 py-2 text-[11px] text-zinc-300">
                    <ChemFormula value={c.halfEquation} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-[11.5px] tabular-nums text-foreground">
                    {c.e0V > 0 ? `+${formatFrNumber(c.e0V, 2)}` : formatFrNumber(c.e0V, 2)} V
                  </td>
                  <td className="hidden whitespace-nowrap py-2 pl-3 pr-4 text-[11px] text-muted-foreground md:table-cell">
                    {c.source}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </>
    )
  }

  if (subTab === 'ks') {
    return (
      <table className="w-full table-fixed border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 border-b border-border bg-panel/95 text-[11px] text-muted-foreground">
          <tr>
            <th className="w-32 whitespace-nowrap py-2 pl-4 pr-3 font-medium">Précipité</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Nom</th>
            <th className="hidden w-36 whitespace-nowrap px-3 py-2 font-medium lg:table-cell">
              Ions
            </th>
            <th className="w-20 whitespace-nowrap px-3 py-2 text-right font-medium">pKs</th>
            <th className="hidden w-40 whitespace-nowrap px-3 py-2 font-medium md:table-cell">
              Aspect
            </th>
            <th className="w-28 whitespace-nowrap py-2 pl-2 pr-4 text-right font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {ks.map((k) => {
            const canSpawn = Boolean(k.cationSpeciesId && k.anionSpeciesId)
            return (
              <tr key={k.id} className="hover:bg-accent/40">
                <td className="whitespace-nowrap py-2 pl-4 pr-3 text-[12px] font-semibold text-foreground">
                  <div className="flex items-center gap-2">
                    {k.precipitateColorHex && (
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20"
                        style={{ backgroundColor: k.precipitateColorHex }}
                      />
                    )}
                    <span>
                      <ChemFormula value={k.solidFormula} />
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-zinc-200">{k.solidNameFr}</td>
                <td className="hidden whitespace-nowrap px-3 py-2 text-[11px] text-muted-foreground lg:table-cell">
                  {k.cationStoich > 1 ? `${k.cationStoich} ` : ''}
                  <ChemFormula value={k.cationFormula} /> +{' '}
                  {k.anionStoich > 1 ? `${k.anionStoich} ` : ''}
                  <ChemFormula value={k.anionFormula} />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-[11.5px] tabular-nums text-zinc-200">
                  {formatFrNumber(k.pKs, 2)}
                </td>
                <td className="hidden px-3 py-2 text-[11px] text-muted-foreground md:table-cell">
                  {k.precipitateColorFr}
                </td>
                <td className="whitespace-nowrap py-1.5 pl-2 pr-4 text-right">
                  {onSpawnReactionSetup && canSpawn && (
                    <button
                      type="button"
                      onClick={() =>
                        onSpawnReactionSetup({
                          titleFr: `Précipitation ${k.solidFormula}`,
                          medium: 'aqueous',
                          reactants: [
                            { speciesId: k.cationSpeciesId!, stoichiometry: k.cationStoich },
                            { speciesId: k.anionSpeciesId!, stoichiometry: k.anionStoich },
                          ],
                        })
                      }
                      className="inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded px-2 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Plus className="h-3 w-3 shrink-0" strokeWidth={1.7} />
                      <span>Paillasse</span>
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  return (
    <>
      {/* Fixed-height sticky acid-base 2-couple composer bar (zero vertical shift) */}
      <div className="sticky top-0 z-20 flex h-11 shrink-0 flex-nowrap items-center justify-between gap-3 overflow-hidden border-b border-border bg-panel/95 px-4 text-xs">
        {abPair ? (
          <>
            <div className="flex min-w-0 flex-1 items-baseline gap-2.5 overflow-hidden">
              <span className="truncate text-[12px] font-medium text-foreground">
                <ChemFormula value={abPair.equation} />
              </span>
              {abPair.deltaPka > 0 && !abPair.missingReason && (
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  ΔpKa = +{formatFrNumber(abPair.deltaPka, 2)}
                </span>
              )}
              {abPair.missingReason && (
                <span className="shrink-0 text-[11px] text-amber-300">
                  {abPair.missingReason}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {onSpawnReactionSetup && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!abPair.canSpawn}
                  onClick={() => onSpawnReactionSetup(abPair.setup)}
                  className="h-7 gap-1.5 px-2.5 text-[11px]"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.7} />
                  <span>Paillasse</span>
                </Button>
              )}
              <button
                type="button"
                onClick={() => setSelectedAbCouples([])}
                aria-label="Effacer la sélection"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        ) : selectedAbCouples.length === 1 ? (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-[11.5px] text-muted-foreground">
              <span className="shrink-0 font-medium text-foreground">
                <ChemFormula value={selectedAbCouples[0].acidFormula} /> /{' '}
                <ChemFormula value={selectedAbCouples[0].baseFormula} />
              </span>
              <span className="shrink-0 tabular-nums">
                (p<ChemVar base="K" sub="a" /> {formatFrNumber(selectedAbCouples[0].pKa, 2)})
              </span>
              <span className="truncate">
                · Sélectionnez un 2<Sup>e</Sup> couple pour composer la réaction acide-base
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedAbCouples([])}
              aria-label="Effacer la sélection"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <span className="truncate text-[11px] text-muted-foreground">
            Sélectionnez 2 couples acide-base pour composer une réaction (ou utilisez +
            Paillasse sur une ligne).
          </span>
        )}
      </div>

      <table className="w-full table-fixed border-collapse text-left text-xs">
        <thead className="border-b border-border bg-panel/60 text-[11px] text-muted-foreground">
          <tr>
            <th className="w-12 py-2 pl-4 pr-1 font-medium" aria-label="Sélection" />
            <th className="w-40 whitespace-nowrap px-2 py-2 font-medium">Couple Acide / Base</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Espèce</th>
            <th className="w-24 whitespace-nowrap px-3 py-2 text-right font-medium">
              pKa (25 °C)
            </th>
            <th className="hidden w-32 whitespace-nowrap px-3 py-2 font-medium md:table-cell">
              Source
            </th>
            <th className="w-28 whitespace-nowrap py-2 pl-2 pr-4 text-right font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {ab.map((item) => {
            const isSelected = selectedAbCouples.some((x) => x.id === item.id)
            const slotText =
              abPair && abPair.acidC.id === item.id
                ? 'AH'
                : abPair && abPair.baseC.id === item.id
                  ? 'B'
                  : isSelected
                    ? '1'
                    : ''
            const canQuickSpawn = Boolean(item.acidSpeciesId || item.baseSpeciesId)
            return (
              <tr
                key={item.id}
                onClick={() => toggleAbCouple(item)}
                className={cn(isSelected ? 'bg-accent/75' : 'hover:bg-accent/40')}
              >
                <td className="w-12 py-2 pl-4 pr-1">
                  <span
                    className={cn(
                      'inline-flex h-5 w-8 items-center justify-center rounded border text-[10px] tabular-nums',
                      isSelected
                        ? 'border-zinc-200 bg-zinc-100 text-zinc-950'
                        : 'border-border/80 text-transparent',
                    )}
                  >
                    {slotText || '·'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-[11.5px] font-medium text-foreground">
                  <ChemFormula value={item.acidFormula} /> /{' '}
                  <ChemFormula value={item.baseFormula} />
                </td>
                <td className="px-3 py-2 text-zinc-200">{item.acidNameFr}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-[11.5px] tabular-nums text-foreground">
                  {formatFrNumber(item.pKa, 2)}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2 text-[11px] text-muted-foreground md:table-cell">
                  {item.source}
                </td>
                <td className="whitespace-nowrap py-1.5 pl-2 pr-4 text-right">
                  {onSpawnReactionSetup && canQuickSpawn && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        const reactants =
                          item.acidSpeciesId && item.baseSpeciesId
                            ? [
                                { speciesId: item.acidSpeciesId, stoichiometry: 1 },
                                { speciesId: item.baseSpeciesId, stoichiometry: 1 },
                              ]
                            : item.acidSpeciesId
                              ? [{ speciesId: item.acidSpeciesId, stoichiometry: 1 }]
                              : [{ speciesId: item.baseSpeciesId!, stoichiometry: 1 }]
                        onSpawnReactionSetup({
                          titleFr:
                            item.acidSpeciesId && item.baseSpeciesId
                              ? `Tampon ${item.acidFormula} / ${item.baseFormula}`
                              : item.acidNameFr,
                          medium: 'aqueous',
                          reactants,
                        })
                      }}
                      title={
                        item.acidSpeciesId && item.baseSpeciesId
                          ? 'Préparer le couple tampon sur la paillasse'
                          : 'Préparer cette espèce en solution sur la paillasse'
                      }
                      className="inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded px-2 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Plus className="h-3 w-3 shrink-0" strokeWidth={1.7} />
                      <span>Paillasse</span>
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}
