import { useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import type {
  CanvasMoleculeNode,
  CatalogSpeciesRecord,
  ElementRecord,
  FullCatalogResponse,
  SpeciesRecord,
} from '../../../shared/chemistry.ts'
import {
  GAS_MOLAR_VOLUME_L,
  GHS_LABEL_FR,
  PH_CHAR_LABEL,
  SPECIES_KIND_LABEL,
  STATE_META,
  THERMAL_NOTE_FR,
  WATER_MOLAR_MASS,
  formatDensity,
  formatFrNumber,
  formatMol,
  formatVolumeMl,
  getSpeciesDensityGPerMl,
} from '@/lib/chemistry-ui'
import { buildCanonicalSignature, formatChargeLabel } from '@/lib/chemistry-calc'
import { cn } from '@/lib/utils'
import { MASS_UNITS, MOL_UNITS, VOLUME_UNITS } from '@/lib/quantity-units'
import { ChemFormula } from '@/components/ui/chem-text'
import { ScrubNumberInput } from '@/components/ui/scrub-number-input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { MolecularRepresentationSection } from '@/components/MolecularRepresentationSection'
import {
  type CatalogJumpTarget,
  MetricCell,
  QuickActions,
} from './InspectorPrimitives'
import { SpeciesChemistryTab } from './SpeciesChemistryTab'

export function SpeciesInspector({
  node,
  enriched,
  catalog,
  elementsBySymbol,
  onIonize,
  canIonizeMinus = true,
  canIonizePlus = true,
  onUpdateAmount,
  onDuplicate,
  onDelete,
  onOpenInCatalog,
  onOpenInLewisBuilder,
}: {
  node: CanvasMoleculeNode
  enriched: CatalogSpeciesRecord | null
  catalog: FullCatalogResponse | null
  elementsBySymbol: Map<string, ElementRecord>
  onIonize: (direction: 1 | -1) => void
  canIonizeMinus?: boolean
  canIonizePlus?: boolean
  onUpdateAmount: (amountMol: number) => void
  onDuplicate: () => void
  onDelete: () => void
  onOpenInCatalog: (target: CatalogJumpTarget) => void
  onOpenInLewisBuilder: (species: SpeciesRecord) => void
}) {
  const sp = enriched
    ? { ...enriched, lewis: enriched.lewis ?? node.species.lewis }
    : node.species
  const isIon = sp.kind === 'ion'
  const isUnknownSolubility =
    sp.source !== 'curated' && !sp.canDissolveInWater && sp.solubilityGPerL === null
  const tintDot = sp.solutionColorHex ?? sp.colorHex ?? (sp.isSolvent ? '#bae6fd' : null)
  const density = getSpeciesDensityGPerMl(sp)
  const massG = node.amountMol * sp.molarMass
  const liquidVolMl = sp.standardState === 'liquid' && density ? massG / density : null
  const gasVolMl =
    sp.standardState === 'gas' ? node.amountMol * GAS_MOLAR_VOLUME_L * 1000 : null

  const applyMolNumber = (val: number) => {
    if (Number.isFinite(val) && val > 0) {
      onUpdateAmount(Math.min(1000, Math.max(1e-6, val)))
    }
  }

  const applyMassGNumber = (val: number) => {
    if (Number.isFinite(val) && val > 0 && sp.molarMass > 0) {
      onUpdateAmount(Math.min(1000, Math.max(1e-6, val / sp.molarMass)))
    }
  }

  const applyVolumeMlNumber = (val: number) => {
    if (!density) return
    if (Number.isFinite(val) && val > 0 && sp.molarMass > 0) {
      onUpdateAmount(Math.min(1000, Math.max(1e-6, (val * density) / sp.molarMass)))
    }
  }

  const massBreakdown = useMemo(() => {
    const entries = Object.entries(sp.composition).map(([sym, count]) => {
      const el = elementsBySymbol.get(sym)
      const partMass = (el?.atomicMass ?? 0) * count
      return { sym, count, nameFr: el?.nameFr ?? sym, partMass }
    })
    const total = entries.reduce((acc, e) => acc + e.partMass, 0) || sp.molarMass || 1
    return entries.map((e) => ({
      ...e,
      pct: Math.round((e.partMass / total) * 1000) / 10,
    }))
  }, [sp.composition, sp.molarMass, elementsBySymbol])

  const linkedSolution = useMemo(() => {
    if (!catalog || !enriched?.namedSolutionId) return null
    return catalog.solutions.find((s) => s.id === enriched.namedSolutionId) ?? null
  }, [catalog, enriched])

  const linkedReactions = useMemo(() => {
    if (!catalog) return []
    return catalog.reactions.filter(
      (r) =>
        r.reactants.some((x) => x.speciesId === sp.id) ||
        r.products.some((x) => x.speciesId === sp.id),
    )
  }, [catalog, sp.id])

  const isomers = useMemo(() => {
    if (!catalog) return []
    const sig = buildCanonicalSignature(sp.composition)
    return catalog.species.filter(
      (other) =>
        other.id !== sp.id &&
        other.charge === sp.charge &&
        buildCanonicalSignature(other.composition) === sig,
    )
  }, [catalog, sp.charge, sp.composition, sp.id])

  const behaviors = Object.entries(sp.behaviors).filter(([key]) => key !== 'families')
  const [speciesTab, setSpeciesTab] = useState<'overview' | 'chemistry'>('overview')

  const kindLabel = SPECIES_KIND_LABEL[sp.kind]
  const stateOrCharge = isIon
    ? formatChargeLabel(sp.charge)
    : STATE_META[sp.standardState].labelFr
  const seenMeta = new Set([kindLabel.toLowerCase(), stateOrCharge.toLowerCase()])
  const extraFamilies = sp.families.filter((f) => {
    const k = f.trim().toLowerCase()
    if (!k || seenMeta.has(k)) return false
    seenMeta.add(k)
    return true
  })
  const subtitleParts = [kindLabel, stateOrCharge, ...extraFamilies]
  const distinctIupac =
    sp.iupacName && sp.iupacName.trim().toLowerCase() !== sp.nameFr.trim().toLowerCase()
      ? sp.iupacName.trim()
      : null

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {tintDot && (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: tintDot }}
              />
            )}
            <h2 className="truncate text-lg font-semibold leading-tight tracking-tight text-foreground">
              <ChemFormula value={sp.displayFormula} />
            </h2>
          </div>
          <p className="mt-1 text-[13px] font-medium leading-snug text-zinc-200">
            {sp.nameFr}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {subtitleParts.join(' · ')}
          </p>
        </div>

        <QuickActions
          onOpenCatalog={() => onOpenInCatalog({ section: 'species', id: sp.id })}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      </div>

      <dl className="grid grid-cols-3 gap-x-3 border-t border-border/60 pt-3 text-xs">
        <MetricCell
          label="Masse molaire"
          value={`${formatFrNumber(sp.molarMass, 2)} g/mol`}
          mono
        />
        <MetricCell
          label="Charge / pH"
          value={`${formatChargeLabel(sp.charge)} · ${PH_CHAR_LABEL[sp.phCharacter]}`}
        />
        <MetricCell
          label="Solubilité H₂O"
          value={
            sp.isSolvent
              ? 'Solvant'
              : sp.canDissolveInWater
                ? sp.solubilityGPerL !== null
                  ? `${formatFrNumber(sp.solubilityGPerL, 1)} g/L`
                  : sp.dissolutionType === 'miscible'
                    ? 'Miscible'
                    : 'Soluble'
                : isUnknownSolubility
                  ? 'Non renseigné'
                  : 'Insoluble'
          }
          mono={sp.solubilityGPerL !== null}
        />
      </dl>

      <div
        role="tablist"
        aria-label="Sections de l’espèce"
        className="flex gap-5 overflow-x-auto border-b border-border/70"
      >
        <button
          type="button"
          role="tab"
          aria-selected={speciesTab === 'overview'}
          onClick={() => setSpeciesTab('overview')}
          className={cn(
            '-mb-px shrink-0 whitespace-nowrap border-b-2 pb-2 text-[11.5px] font-medium',
            speciesTab === 'overview'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Fiche & échantillon
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={speciesTab === 'chemistry'}
          onClick={() => setSpeciesTab('chemistry')}
          className={cn(
            '-mb-px shrink-0 whitespace-nowrap border-b-2 pb-2 text-[11.5px] font-medium',
            speciesTab === 'chemistry'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Solution & données
        </button>
      </div>

      {speciesTab === 'overview' ? (
        <div className="space-y-4">
          <MolecularRepresentationSection
            speciesId={sp.id}
            structure={sp.lewis}
            formula={sp.displayFormula}
            nameFr={sp.nameFr}
            onOpenInLewisBuilder={() => onOpenInLewisBuilder(sp)}
            isomers={isomers}
            onJumpToIsomer={(id) => onOpenInCatalog({ section: 'species', id })}
            maxIsomers={5}
            lewisHeightClassName="h-36"
          />

          <section className="space-y-2.5 border-t border-border/60 pt-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">
                Échantillon & charge
              </span>
              <span className="shrink-0 whitespace-nowrap font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {formatMol(node.amountMol)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <ScrubNumberInput
                prefixLabel="n"
                value={node.amountMol}
                units={MOL_UNITS}
                defaultUnitId={node.amountMol >= 0.5 ? 'mol' : 'mmol'}
                min={0.0001}
                max={1000}
                ariaLabel={`Quantité de matière de ${sp.displayFormula}`}
                onChange={applyMolNumber}
              />
              <ScrubNumberInput
                prefixLabel="m"
                value={massG}
                units={MASS_UNITS}
                defaultUnitId={massG < 0.5 ? 'mg' : 'g'}
                min={0.001}
                max={50000}
                ariaLabel={`Masse de ${sp.displayFormula}`}
                onChange={applyMassGNumber}
              />
              {liquidVolMl !== null && (
                <ScrubNumberInput
                  prefixLabel="V"
                  value={liquidVolMl}
                  units={VOLUME_UNITS}
                  defaultUnitId={liquidVolMl >= 1000 ? 'L' : 'mL'}
                  min={0.1}
                  max={10000}
                  ariaLabel={`Volume liquide de ${sp.displayFormula}`}
                  onChange={applyVolumeMlNumber}
                  className="col-span-2"
                />
              )}
            </div>

            {gasVolMl !== null && (
              <div className="flex items-center justify-between gap-2 text-[10.5px] text-muted-foreground">
                <span>Volume gazeux (20 °C)</span>
                <span className="shrink-0 whitespace-nowrap font-mono tabular-nums text-zinc-200">
                  {formatVolumeMl(gasVolMl)}
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-0.5 font-mono text-[10px]">
                <button
                  type="button"
                  onClick={() => applyMolNumber(Math.max(0.0001, node.amountMol / 2))}
                  className="shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  ÷2
                </button>
                <button
                  type="button"
                  onClick={() => applyMolNumber(node.amountMol * 2)}
                  className="shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  ×2
                </button>
                {sp.isSolvent ? (
                  [25, 50, 100, 200].map((ml) => (
                    <button
                      key={ml}
                      type="button"
                      onClick={() => onUpdateAmount(ml / WATER_MOLAR_MASS)}
                      className="shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      {ml} mL
                    </button>
                  ))
                ) : (
                  <>
                    {[
                      { label: '1 mmol', mol: 0.001 },
                      { label: '10 mmol', mol: 0.01 },
                      { label: '0,1 mol', mol: 0.1 },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => onUpdateAmount(p.mol)}
                        className="shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        {p.label}
                      </button>
                    ))}
                    {sp.standardState === 'solid' &&
                      [1, 5].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => onUpdateAmount(g / sp.molarMass)}
                          className="shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          {g} g
                        </button>
                      ))}
                  </>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <span className="mr-1 text-[10.5px] text-muted-foreground">q</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <button
                        type="button"
                        disabled={!canIonizeMinus}
                        onClick={() => onIonize(-1)}
                        aria-label="Gagner des électrons"
                        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                      >
                        <Minus className="h-3 w-3" strokeWidth={1.7} />
                      </button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    {canIonizeMinus
                      ? 'Gagner e⁻ (charge −)'
                      : 'Aucun état plus réduit répertorié'}
                  </TooltipContent>
                </Tooltip>
                <span className="min-w-[20px] text-center font-mono text-[11px] tabular-nums text-foreground">
                  {formatChargeLabel(sp.charge)}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <button
                        type="button"
                        disabled={!canIonizePlus}
                        onClick={() => onIonize(1)}
                        aria-label="Perdre des électrons"
                        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                      >
                        <Plus className="h-3 w-3" strokeWidth={1.7} />
                      </button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    {canIonizePlus
                      ? 'Perdre e⁻ (charge +)'
                      : 'Aucun état plus oxydé répertorié'}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </section>

          {(sp.meltingPointC !== null ||
            sp.boilingPointC !== null ||
            sp.densityGPerCm3 !== null ||
            sp.appearanceFr !== null ||
            sp.pkaValues.length > 0 ||
            sp.ghsPictograms.length > 0) && (
            <section className="space-y-2.5 border-t border-border/60 pt-3.5">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-medium text-muted-foreground">
                  Constantes physico-chimiques
                </span>
                {sp.pubchemCid && (
                  <span className="shrink-0 whitespace-nowrap font-mono text-[10px] text-zinc-500">
                    CID {sp.pubchemCid}
                  </span>
                )}
              </div>

              <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-[11px]">
                {sp.meltingPointC !== null && (
                  <MetricCell
                    label="T° fusion"
                    value={`${formatFrNumber(sp.meltingPointC, 1)} °C`}
                    mono
                  />
                )}
                {sp.boilingPointC !== null && (
                  <MetricCell
                    label="T° ébullition"
                    value={`${formatFrNumber(sp.boilingPointC, 1)} °C${sp.thermalNote ? ` (${THERMAL_NOTE_FR[sp.thermalNote] ?? sp.thermalNote})` : ''}`}
                    mono
                  />
                )}
                {sp.densityGPerCm3 !== null && (
                  <MetricCell
                    label="Densité"
                    value={formatDensity(sp.densityGPerCm3, sp.standardState)}
                    mono
                  />
                )}
                {sp.appearanceFr && (
                  <div className="col-span-3">
                    <dt className="text-[10px] text-muted-foreground">Aspect pur</dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-200">
                      {sp.colorHex && (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full border border-white/20"
                          style={{ backgroundColor: sp.colorHex }}
                        />
                      )}
                      <span>{sp.appearanceFr}</span>
                    </dd>
                  </div>
                )}
              </dl>

              {sp.pkaValues.length > 0 && (
                <p className="font-mono text-[11px] tabular-nums text-zinc-300">
                  <span className="font-sans text-[10.5px] text-muted-foreground">pKa · </span>
                  {sp.pkaValues
                    .map((val, idx) =>
                      `${sp.pkaValues.length > 1 ? `pKa${idx + 1} ` : ''}${formatFrNumber(val, 2)}`,
                    )
                    .join(' · ')}
                </p>
              )}

              {sp.ghsPictograms.length > 0 && (
                <p className="text-[10.5px] text-muted-foreground">
                  {sp.ghsSignalWord && (
                    <span className="mr-1.5 font-medium text-zinc-200">
                      {sp.ghsSignalWord} ·
                    </span>
                  )}
                  {sp.ghsPictograms.map((code) => GHS_LABEL_FR[code] ?? code).join(', ')}
                </p>
              )}
            </section>
          )}
        </div>
      ) : (
        <SpeciesChemistryTab
          sp={sp}
          enriched={enriched}
          isIon={isIon}
          isUnknownSolubility={isUnknownSolubility}
          linkedSolution={linkedSolution}
          linkedReactions={linkedReactions}
          massBreakdown={massBreakdown}
          behaviors={behaviors}
          distinctIupac={distinctIupac}
          elementsBySymbol={elementsBySymbol}
          onOpenInCatalog={onOpenInCatalog}
        />
      )}
    </div>
  )
}
