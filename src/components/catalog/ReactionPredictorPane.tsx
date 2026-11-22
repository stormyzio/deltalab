import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, Plus } from 'lucide-react'
import type {
  CatalogSpeciesRecord,
  PredictReactionResponse,
} from '../../../shared/chemistry.ts'
import { api } from '@/lib/api'
import { REACTION_CATEGORY_LABEL } from '@/lib/chemistry-ui'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChemFormula, ChemText, Sup } from '@/components/ui/chem-text'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ReactionSpawnSetup } from './CatalogShared'
import { PredictorSpeciesPicker } from './PredictorSpeciesPicker'

const PREDICTOR_PRESETS: Array<{
  label: string
  a: string
  b: string
  c?: string
  group: 'precipitation' | 'acid_base' | 'redox' | 'non_aqueous'
}> = [
  { label: 'AgNO₃ + NaCl', a: 'agno3', b: 'nacl', group: 'precipitation' },
  { label: 'CuSO₄ + NaOH', a: 'cuso4', b: 'naoh', group: 'precipitation' },
  { label: 'Pb(NO₃)₂ + KI', a: 'pb_no3_2', b: 'ki', group: 'precipitation' },
  { label: 'HCl + NaOH', a: 'hcl', b: 'naoh', group: 'acid_base' },
  { label: 'CH₃COOH + NH₃', a: 'ch3cooh', b: 'nh3', group: 'acid_base' },
  { label: 'CaCO₃ + HCl', a: 'caco3', b: 'hcl', group: 'acid_base' },
  { label: 'KMnO₄ + FeSO₄ (H⁺)', a: 'kmno4', b: 'feso4', c: 'h_plus', group: 'redox' },
  { label: 'CuSO₄ + Zn(s)', a: 'cuso4', b: 'zn_solid', group: 'redox' },
  { label: 'I₂ + Na₂S₂O₃', a: 'i2', b: 'na2s2o3', group: 'redox' },
  { label: 'NH₃(g) + HCl(g)', a: 'nh3', b: 'hcl', group: 'non_aqueous' },
  { label: '2 Al + Fe₂O₃ (thermite)', a: 'al_solid', b: 'fe2o3', group: 'non_aqueous' },
  { label: '8 Fe + S₈', a: 'fe_solid', b: 's8', group: 'non_aqueous' },
  { label: 'CH₄ + 2 O₂', a: 'ch4', b: 'o2', group: 'non_aqueous' },
  { label: '2 Mg + O₂', a: 'mg_solid', b: 'o2', group: 'non_aqueous' },
  { label: 'C₂H₅OH + 3 O₂', a: 'c2h6o', b: 'o2', group: 'non_aqueous' },
]

const QUICK_REACTANT_A_IDS = [
  'agno3',
  'cuso4',
  'hcl',
  'kmno4',
  'ch3cooh',
  'fe_solid',
  'al_solid',
  'ch4',
]

const QUICK_REACTANT_B_IDS = [
  'nacl',
  'naoh',
  'feso4',
  'nh3',
  'o2',
  'zn_solid',
  's8',
  'fe2o3',
]

export function ReactionPredictorPane({
  speciesList,
  onJumpToSpecies,
  onSpawnReactionSetup,
}: {
  speciesList: CatalogSpeciesRecord[]
  onJumpToSpecies?: (id: string) => void
  onSpawnReactionSetup?: (setup: ReactionSpawnSetup) => void
}) {
  const [speciesAId, setSpeciesAId] = useState('agno3')
  const [speciesBId, setSpeciesBId] = useState('nacl')
  const [speciesCId, setSpeciesCId] = useState('')
  const [presetGroup, setPresetGroup] = useState<
    'all' | 'precipitation' | 'acid_base' | 'redox' | 'non_aqueous'
  >('all')
  const [result, setResult] = useState<PredictReactionResponse | null>(null)
  const [loadedKey, setLoadedKey] = useState('')
  const requestKey = `${speciesAId}::${speciesBId}::${speciesCId}`
  const loading = Boolean(speciesAId && speciesBId && loadedKey !== requestKey)

  useEffect(() => {
    if (!speciesAId || !speciesBId) return
    let cancelled = false
    const key = `${speciesAId}::${speciesBId}::${speciesCId}`
    api
      .predictReaction(speciesAId, speciesBId, speciesCId || undefined)
      .then((res) => {
        if (!cancelled) {
          setResult(res)
          setLoadedKey(key)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult(null)
          setLoadedKey(key)
        }
      })
    return () => {
      cancelled = true
    }
  }, [speciesAId, speciesBId, speciesCId])

  const visiblePresets = useMemo(
    () =>
      presetGroup === 'all'
        ? PREDICTOR_PRESETS
        : PREDICTOR_PRESETS.filter((p) => p.group === presetGroup),
    [presetGroup],
  )

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          Prédicteur de réactions (aqueux & hors aqueux)
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Sélectionnez deux réactifs (et éventuellement un milieu ou 3<Sup>e</Sup> réactif) pour prédire
          les réactions acide-base (ΔpKa), précipitations (pKs), oxydoréductions (ΔE°),
          combustions et synthèses, puis lancez le montage directement sur la paillasse.
        </p>
      </div>

      <div className="space-y-2 border-t border-border/60 pt-3.5">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 whitespace-nowrap text-[11px] font-medium text-muted-foreground">
            Exemples rapides :
          </span>
          {(
            [
              ['all', 'Tous'],
              ['precipitation', 'Précipitations'],
              ['acid_base', 'Acide-Base'],
              ['redox', 'Redox'],
              ['non_aqueous', 'Hors aqueux (gaz / solides)'],
            ] as const
          ).map(([gId, gLabel]) => (
            <button
              key={gId}
              type="button"
              onClick={() => setPresetGroup(gId)}
              className={cn(
                'shrink-0 whitespace-nowrap rounded px-2 py-0.5 text-[10.5px] font-medium',
                presetGroup === gId
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              {gLabel}
            </button>
          ))}
        </div>

        <div className="flex min-h-[60px] flex-wrap content-start items-center gap-1">
          {visiblePresets.map((p) => {
            const active =
              speciesAId === p.a &&
              speciesBId === p.b &&
              (speciesCId || '') === (p.c || '')
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setSpeciesAId(p.a)
                  setSpeciesBId(p.b)
                  setSpeciesCId(p.c ?? '')
                }}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded px-2 py-1 text-[11px] font-medium',
                  active
                    ? 'bg-accent text-foreground'
                    : 'text-zinc-300 hover:bg-accent/60 hover:text-foreground',
                )}
              >
                <ChemText value={p.label} />
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-3.5 border-t border-border/60 pt-4">
        <div className="grid items-start gap-3 md:grid-cols-[1fr_auto_1fr]">
          <PredictorSpeciesPicker
            label="Réactif A"
            selectedId={speciesAId}
            onSelect={setSpeciesAId}
            speciesList={speciesList}
            quickIds={QUICK_REACTANT_A_IDS}
          />

          <div className="flex items-center justify-center pt-5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setSpeciesAId(speciesBId)
                    setSpeciesBId(speciesAId)
                  }}
                  aria-label="Inverser Réactif A et Réactif B"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={1.7} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Inverser A et B</TooltipContent>
            </Tooltip>
          </div>

          <PredictorSpeciesPicker
            label="Réactif B"
            selectedId={speciesBId}
            onSelect={setSpeciesBId}
            speciesList={speciesList}
            quickIds={QUICK_REACTANT_B_IDS}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 whitespace-nowrap text-[11px] text-muted-foreground">
              Milieu / 3<Sup>e</Sup> réactif :
            </span>
            {(
              [
                ['', 'Sans 3ᵉ réactif'],
                ['h_plus', '+ H⁺ (milieu acide)'],
                ['oh_minus', '+ OH⁻ (milieu basique)'],
                ['o2', '+ O₂(g) (combustion)'],
                ['co2', '+ CO₂(g)'],
                ['h2o', '+ H₂O(l)'],
              ] as const
            ).map(([cId, cLabel]) => (
              <button
                key={cLabel}
                type="button"
                onClick={() => setSpeciesCId(cId)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-medium',
                  speciesCId === cId
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                )}
              >
                <ChemText value={cLabel} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className={cn(
          'min-h-[140px] border-t border-border/60 pt-4 transition-opacity duration-150',
          loading && 'opacity-55',
        )}
      >
        {loading && !result ? (
          <p className="text-xs text-muted-foreground">Calcul en cours…</p>
        ) : result && result.reactions.length > 0 ? (
          <div className="divide-y divide-border/60">
            {result.reactions.map((rxn, idx) => (
              <div
                key={`${rxn.equationDisplay}-${idx}`}
                className="py-3.5 first:pt-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="text-xs font-semibold text-foreground">
                      <ChemText value={rxn.titleFr} />
                    </h3>
                    <span className="text-[10.5px] text-muted-foreground">
                      · {REACTION_CATEGORY_LABEL[rxn.category] ?? rxn.category}
                      {rxn.setupMedium === 'gas'
                        ? ' · Phase gazeuse'
                        : rxn.setupMedium === 'solid'
                          ? ' · Voie sèche / solide'
                          : ''}
                    </span>
                    {rxn.equilibriumLabel && (
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        · <ChemText value={rxn.equilibriumLabel} />
                      </span>
                    )}
                  </div>

                  {onSpawnReactionSetup &&
                    rxn.setupReactants &&
                    rxn.setupReactants.length > 0 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          onSpawnReactionSetup({
                            titleFr: rxn.titleFr,
                            medium: rxn.setupMedium ?? 'aqueous',
                            reactants: rxn.setupReactants!,
                          })
                        }
                        className="h-7 shrink-0 text-[11px]"
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={1.7} />
                        <span>Simuler sur la paillasse</span>
                      </Button>
                    )}
                </div>

                <p className="mt-2 break-words text-[13px] text-foreground">
                  <ChemFormula value={rxn.equationDisplay} />
                </p>
                <p className="mt-1.5 text-xs text-zinc-200">
                  <ChemText value={rxn.observationsFr} />
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  <ChemText value={rxn.detailsFr} />
                </p>

                {onJumpToSpecies &&
                  rxn.setupReactants &&
                  rxn.setupReactants.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <span className="text-[10.5px] text-muted-foreground">
                        Fiches réactifs :
                      </span>
                      {rxn.setupReactants.map((sr) => {
                        const sp = speciesList.find((s) => s.id === sr.speciesId)
                        if (!sp) return null
                        return (
                          <button
                            key={sr.speciesId}
                            type="button"
                            onClick={() => onJumpToSpecies(sr.speciesId)}
                            className="whitespace-nowrap rounded px-1.5 py-0.5 text-[10.5px] text-zinc-300 hover:bg-accent hover:text-foreground"
                          >
                            <ChemFormula value={sp.displayFormula} />
                          </button>
                        )
                      })}
                    </div>
                  )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center">
            <p className="text-xs font-medium text-foreground">
              Aucune réaction spontanée prédite entre ces espèces
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Essayez un couple acide/base, deux sels précipitants (
              <ChemFormula value="AgNO3" /> + NaCl), un couple redox (
              <ChemFormula value="KMnO4" /> + <ChemFormula value="FeSO4" /> avec +{' '}
              <ChemFormula value="H^+" />) ou une réaction hors aqueux (
              <ChemFormula value="CH4" /> + <ChemFormula value="O2" />, Al +{' '}
              <ChemFormula value="Fe2O3" />, <ChemFormula value="NH3" /> + HCl).
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
