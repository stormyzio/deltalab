import { memo, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  Check,
  Copy,
  FlaskConical,
  RotateCcw,
  X,
} from 'lucide-react'
import type {
  CatalogSpeciesRecord,
  ElementRecord,
  FullCatalogResponse,
  PhysicalState,
  SpeciesRecord,
} from '../../shared/chemistry.ts'
import { buildCanonicalSignature } from '@/lib/chemistry-calc'
import {
  formatFrNumber,
  formatMassG,
  formatMol,
  formatVolumeMl,
} from '@/lib/chemistry-ui'
import {
  type BalancedParticipant,
  EQUATION_PRESETS,
  type EquationArrow,
  balanceChemicalEquation,
  splitEquationSideTerms,
} from '@/lib/equation-balancer'
import {
  type EquationRealityStatus,
  checkEquationRealitySync,
  verifyEquationRealityAsync,
} from '@/lib/equation-verification'
import {
  CONC_MOL_UNITS,
  MASS_UNITS,
  MOL_UNITS,
  VOLUME_UNITS,
} from '@/lib/quantity-units'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChemFormula, ChemText, ChemVar, StateTag } from '@/components/ui/chem-text'
import { ScrubNumberInput } from '@/components/ui/scrub-number-input'
import { InlineNumberInput } from '@/components/ui/inline-number-input'
import { Slider } from '@/components/ui/slider'
import type { ReactionSpawnSetup } from '@/components/catalog/CatalogShared'

type QuantityInputMode = 'mol' | 'mass' | 'solution' | 'gas'

interface ReactantInputState {
  mode: QuantityInputMode
  mol: number
  concMolL: number
  volMl: number
}

interface EquationSolverPageProps {
  catalog: FullCatalogResponse | null
  active?: boolean
  onSpawnReactionSetup: (setup: ReactionSpawnSetup) => void
  onOpenSpeciesInCatalog: (speciesId: string) => void
  onOpenInLewisBuilder: (species: SpeciesRecord) => void
}

function stateToShortTag(st: PhysicalState | null): 's' | 'l' | 'g' | 'aq' | null {
  if (!st) return null
  return st === 'solid' ? 's' : st === 'liquid' ? 'l' : st === 'gas' ? 'g' : 'aq'
}

function formatFormulaForInput(sp: CatalogSpeciesRecord): string {
  const st = stateToShortTag(sp.standardState)
  const chargeStr =
    sp.charge === 0
      ? ''
      : Math.abs(sp.charge) === 1
        ? sp.charge > 0
          ? '+'
          : '-'
        : `${Math.abs(sp.charge)}${sp.charge > 0 ? '+' : '-'}`
  const base = sp.formula.replace(/(\^?\d*[+-]+|[⁰¹²³⁴⁵⁶⁷⁸⁹]*[⁺⁻]+)$/, '')
  return `${base}${chargeStr}${st ? `(${st})` : ''}`
}

function getCurrentTokenRange(
  text: string,
  cursor: number,
): { start: number; end: number; token: string } {
  const before = text.slice(0, cursor)
  const match = before.match(/([A-Za-zÀ-ÿ0-9()[\]·^+-]+)$/)
  if (!match) return { start: cursor, end: cursor, token: '' }
  return {
    start: cursor - match[1].length,
    end: cursor,
    token: match[1],
  }
}

export const EquationSolverPage = memo(function EquationSolverPage({
  catalog,
  onSpawnReactionSetup,
  onOpenSpeciesInCatalog,
  onOpenInLewisBuilder,
}: EquationSolverPageProps) {
  const [equationInput, setEquationInput] = useState(EQUATION_PRESETS[1].equation)
  const [cursorPos, setCursorPos] = useState(0)
  const [inputFocused, setInputFocused] = useState(false)
  const [copiedMode, setCopiedMode] = useState<'plain' | 'latex' | null>(null)
  const [inputStates, setInputStates] = useState<Record<string, ReactantInputState>>({
    'r:0': { mode: 'mol', mol: 0.02, concMolL: 0.2, volMl: 100 },
    'r:1': { mode: 'mol', mol: 0.12, concMolL: 0.6, volMl: 200 },
    'r:2': { mode: 'mol', mol: 0.2, concMolL: 1.0, volMl: 200 },
  })
  const [progressFraction, setProgressFraction] = useState(1)
  const [yieldPercent, setYieldPercent] = useState(100)
  const [gasTempC, setGasTempC] = useState(20)
  const [gasPressureBar, setGasPressureBar] = useState(1.013)
  const [asyncReality, setAsyncReality] = useState<{
    key: string
    status: EquationRealityStatus
  } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const elementsBySymbol = useMemo(() => {
    const map = new Map<string, ElementRecord>()
    for (const el of catalog?.elements ?? []) map.set(el.symbol, el)
    return map
  }, [catalog])

  const speciesById = useMemo(() => {
    const map = new Map<string, CatalogSpeciesRecord>()
    for (const sp of catalog?.species ?? []) map.set(sp.id, sp)
    return map
  }, [catalog])

  const speciesBySigAndCharge = useMemo(() => {
    const map = new Map<string, CatalogSpeciesRecord>()
    for (const sp of catalog?.species ?? []) {
      const sig = buildCanonicalSignature(sp.composition)
      if (!sig) continue
      const key = `${sig}|${sp.charge}`
      const existing = map.get(key)
      if (!existing || sp.popularity > existing.popularity) {
        map.set(key, sp)
      }
    }
    return map
  }, [catalog])

  const result = useMemo(
    () =>
      balanceChemicalEquation(equationInput, elementsBySymbol, speciesBySigAndCharge),
    [equationInput, elementsBySymbol, speciesBySigAndCharge],
  )

  // Chemical existence & spontaneity verification
  const syncReality = useMemo(() => {
    if (!result.ok || !catalog) return null
    return checkEquationRealitySync(
      result.reactants,
      result.products,
      result.arrow,
      catalog.reactions,
      speciesById,
    )
  }, [catalog, result, speciesById])

  const resultKey = result.ok ? `${result.plainText}|${result.arrow}` : ''

  useEffect(() => {
    if (!result.ok || !syncReality || syncReality.immediateStatus || !syncReality.userSig) {
      return
    }
    let cancelled = false
    const key = resultKey
    const userSig = syncReality.userSig
    const reverseFallback = syncReality.reverseFallback
    const timer = window.setTimeout(() => {
      void verifyEquationRealityAsync({
        reactants: result.reactants,
        products: result.products,
        userSig,
        reverseFallback,
        elementsBySymbol,
        speciesBySigAndCharge,
        speciesById,
      }).then((status) => {
        if (!cancelled) setAsyncReality({ key, status })
      })
    }, 150)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    elementsBySymbol,
    result,
    resultKey,
    speciesById,
    speciesBySigAndCharge,
    syncReality,
  ])

  const realityStatus: EquationRealityStatus | null = useMemo(() => {
    if (!result.ok || !syncReality) return null
    if (syncReality.immediateStatus) return syncReality.immediateStatus
    if (asyncReality && asyncReality.key === resultKey) return asyncReality.status
    return { kind: 'checking' }
  }, [asyncReality, result.ok, resultKey, syncReality])

  // Molar volume of an ideal gas: Vm = R*T / P (L/mol), R = 0.0831446 L·bar/(mol·K)
  const gasMolarVolumeL = useMemo(() => {
    const tK = Math.max(10, gasTempC + 273.15)
    const pBar = Math.max(0.05, gasPressureBar)
    return Math.round(((0.0831446 * tK) / pBar) * 100) / 100
  }, [gasTempC, gasPressureBar])

  const activeToken = useMemo(
    () => getCurrentTokenRange(equationInput, cursorPos),
    [equationInput, cursorPos],
  )

  const inlineSuggestions = useMemo(() => {
    if (!inputFocused || !catalog) return []
    const q = activeToken.token.trim().toLowerCase()
    if (q.length < 2) return []
    if (/\((s|l|g|aq)\)$/i.test(q)) return []
    return catalog.species
      .filter(
        (sp) =>
          sp.formula.toLowerCase().includes(q) ||
          sp.displayFormula.toLowerCase().includes(q) ||
          sp.nameFr.toLowerCase().includes(q),
      )
      .slice(0, 6)
  }, [activeToken.token, catalog, inputFocused])

  const { rawLeftTerms, rawRightTerms, currentArrow } = useMemo(() => {
    const arrowRegex = /\s*(<=>|<->|⇌|->|=>|→|=)\s*/
    const m = equationInput.match(arrowRegex)
    if (!m || m.index === undefined) {
      return {
        rawLeftTerms: splitEquationSideTerms(equationInput),
        rawRightTerms: [] as string[],
        currentArrow: '->' as EquationArrow,
      }
    }
    const arr: EquationArrow =
      m[1] === '<=>' || m[1] === '<->' || m[1] === '⇌' ? '<=>' : '->'
    return {
      rawLeftTerms: splitEquationSideTerms(equationInput.slice(0, m.index)),
      rawRightTerms: splitEquationSideTerms(equationInput.slice(m.index + m[0].length)),
      currentArrow: arr,
    }
  }, [equationInput])

  const handleSwapSides = () => {
    const glyph = currentArrow === '<=>' ? '⇌' : '->'
    setEquationInput(`${rawRightTerms.join(' + ')} ${glyph} ${rawLeftTerms.join(' + ')}`)
  }

  const handleAcceptInlineSuggestion = (sp: CatalogSpeciesRecord) => {
    const inserted = formatFormulaForInput(sp)
    const next = `${equationInput.slice(0, activeToken.start)}${inserted}${equationInput.slice(activeToken.end)}`
    const nextPos = activeToken.start + inserted.length
    setEquationInput(next)
    setCursorPos(nextPos)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(nextPos, nextPos)
    })
  }

  const handleSelectPreset = (presetId: string) => {
    const preset = EQUATION_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    setEquationInput(preset.equation)
    const nextStates: Record<string, ReactantInputState> = {}
    ;(preset.defaultReactantMols ?? []).forEach((mol, idx) => {
      nextStates[`r:${idx}`] = {
        mode: 'mol',
        mol,
        concMolL: Math.round(mol * 10 * 100) / 100,
        volMl: 100,
      }
    })
    setInputStates(nextStates)
    setProgressFraction(1)
    setYieldPercent(100)
  }

  const handleCopy = (mode: 'plain' | 'latex') => {
    if (!result.ok) return
    const text = mode === 'plain' ? result.plainText : result.latexText
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopiedMode(mode)
    window.setTimeout(() => setCopiedMode(null), 1600)
  }

  const getReactantState = (idx: number, p: BalancedParticipant): ReactantInputState => {
    const existing = inputStates[`r:${idx}`]
    if (existing) return existing
    const defaultMol = Math.round(0.1 * p.coefficient * 1000) / 1000
    return {
      mode: p.state === 'gas' ? 'gas' : 'mol',
      mol: defaultMol,
      concMolL: 0.5,
      volMl: Math.round((defaultMol / 0.5) * 1000),
    }
  }

  const updateReactantState = (
    idx: number,
    p: BalancedParticipant,
    patch: Partial<ReactantInputState>,
  ) => {
    setInputStates((prev) => {
      const base = prev[`r:${idx}`] ?? getReactantState(idx, p)
      return {
        ...prev,
        [`r:${idx}`]: { ...base, ...patch },
      }
    })
  }

  const stoich = useMemo(() => {
    if (!result.ok) return null
    const reactantMols = result.reactants.map((r, idx) => {
      const st = inputStates[`r:${idx}`]
      const mol = st
        ? st.mode === 'solution'
          ? (st.concMolL * st.volMl) / 1000
          : st.mol
        : Math.round(0.1 * r.coefficient * 1000) / 1000
      return Math.max(0, mol)
    })

    const ratios = result.reactants.map((r, idx) => reactantMols[idx] / r.coefficient)
    const xMax = ratios.length > 0 ? Math.min(...ratios) : 0
    const limitingIndices = new Set<number>()
    if (xMax > 0) {
      ratios.forEach((ratio, idx) => {
        if (Math.abs(ratio - xMax) <= Math.max(1e-7, xMax * 1e-4)) {
          limitingIndices.add(idx)
        }
      })
    }
    const isExactStoich =
      xMax > 0 && limitingIndices.size === result.reactants.length

    const effectiveYield = Math.max(0, Math.min(1, yieldPercent / 100))
    const xFinal = xMax * effectiveYield
    const xCurrent = xFinal * Math.max(0, Math.min(1, progressFraction))

    return {
      reactantMols,
      ratios,
      xMax,
      xFinal,
      xCurrent,
      limitingIndices,
      isExactStoich,
      effectiveYield,
    }
  }, [inputStates, progressFraction, result, yieldPercent])

  const hasGasInEquation = useMemo(() => {
    if (!result.ok) return false
    if (
      result.reactants.some((r) => r.state === 'gas') ||
      result.products.some((p) => p.state === 'gas')
    ) {
      return true
    }
    return result.reactants.some((_, idx) => inputStates[`r:${idx}`]?.mode === 'gas')
  }, [inputStates, result])

  const handleSetStoichiometricProportions = () => {
    if (!result.ok || !stoich) return
    const refRatio = Math.max(1e-4, stoich.ratios[0] || 0.1)
    const next: Record<string, ReactantInputState> = { ...inputStates }
    result.reactants.forEach((r, idx) => {
      const targetMol = Math.round(refRatio * r.coefficient * 1e6) / 1e6
      const prev = next[`r:${idx}`] ?? getReactantState(idx, r)
      next[`r:${idx}`] = {
        ...prev,
        mol: targetMol,
        volMl:
          prev.concMolL > 0
            ? Math.round((targetMol / prev.concMolL) * 1000 * 10) / 10
            : prev.volMl,
      }
    })
    setInputStates(next)
  }

  const canSpawnToWorkbench = useMemo(() => {
    if (!result.ok) return false
    const nonWaterMatched = result.reactants.filter(
      (r) => r.matchedSpecies && r.matchedSpecies.id !== 'h2o',
    )
    return (
      nonWaterMatched.length > 0 &&
      result.reactants.every((r) => Boolean(r.matchedSpecies))
    )
  }, [result])

  const handleSendToWorkbench = () => {
    if (!result.ok || !stoich || !canSpawnToWorkbench) return
    const reactantsSetup = result.reactants
      .filter((r) => r.matchedSpecies && r.matchedSpecies.id !== 'h2o')
      .map((r, idx) => ({
        speciesId: r.matchedSpecies!.id,
        stoichiometry: r.coefficient,
        amountMol: stoich.reactantMols[idx],
      }))
    if (reactantsSetup.length === 0) return
    const hasAqueous = result.reactants.some(
      (r) => r.state === 'aqueous' || r.matchedSpecies?.id === 'h2o',
    )
    onSpawnReactionSetup({
      titleFr: result.plainText,
      medium: hasAqueous ? 'aqueous' : 'any',
      reactants: reactantsSetup.map(({ speciesId, stoichiometry }) => ({
        speciesId,
        stoichiometry,
      })),
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background select-none">
      {/* Top preset & quick action bar */}
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-border bg-panel px-4">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          <span className="mr-1.5 shrink-0 text-[11px] font-medium text-muted-foreground">
            Exemples
          </span>
          {EQUATION_PRESETS.map((preset) => {
            const isCurrent = equationInput.trim() === preset.equation
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.id)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-[11.5px] font-medium',
                  isCurrent
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                {preset.labelFr}
              </button>
            )
          })}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleSwapSides}
            disabled={rawLeftTerms.length === 0 && rawRightTerms.length === 0}
            title="Inverser réactifs et produits"
            aria-label="Inverser réactifs et produits"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={1.6} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setEquationInput('')
              setInputStates({})
              inputRef.current?.focus()
            }}
            disabled={!equationInput}
            title="Effacer l’équation"
            aria-label="Effacer l’équation"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.6} />
          </Button>
        </div>
      </div>

      {/* Main split workspace */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Main scroll area */}
        <div className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="mx-auto max-w-4xl space-y-5">
            {/* 1. Single unified equation input + compact helper strip */}
            <section className="space-y-2">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={equationInput}
                  onChange={(e) => {
                    setEquationInput(e.target.value)
                    setCursorPos(e.target.selectionStart ?? e.target.value.length)
                  }}
                  onClick={(e) =>
                    setCursorPos(
                      (e.target as HTMLInputElement).selectionStart ??
                        equationInput.length,
                    )
                  }
                  onKeyUp={(e) =>
                    setCursorPos(
                      (e.target as HTMLInputElement).selectionStart ??
                        equationInput.length,
                    )
                  }
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => {
                    window.setTimeout(() => setInputFocused(false), 140)
                  }}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="Saisir une équation — ex. MnO4-(aq) + Fe2+(aq) + H+(aq) -> Mn2+(aq) + Fe3+(aq) + H2O(l)"
                  aria-label="Équation chimique à équilibrer"
                  className="h-11 w-full rounded-lg border border-border bg-panel px-4 pr-10 text-[14.5px] text-foreground placeholder:text-muted-foreground/55 focus-visible:border-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring select-text"
                />
                {equationInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setEquationInput('')
                      inputRef.current?.focus()
                    }}
                    aria-label="Effacer"
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}

                {inlineSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-xl">
                    {inlineSuggestions.map((sp) => (
                      <button
                        key={sp.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleAcceptInlineSuggestion(sp)
                        }}
                        className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs hover:bg-accent"
                      >
                        <span className="flex min-w-0 items-baseline gap-2">
                          <span className="font-semibold text-foreground">
                            <ChemFormula
                              value={sp.displayFormula}
                              state={sp.standardState}
                            />
                          </span>
                          <span className="truncate text-muted-foreground">
                            {sp.nameFr}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">
                          {formatFrNumber(sp.molarMass, 2)} g/mol
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* 2. Balanced Result + Chemical Existence Verdict */}
            <section className="border-t border-border/60 pt-4">
              {result.ok ? (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {/* Clear chemical reality vs. mathematical balance status */}
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px]">
                      {realityStatus?.kind === 'known' && (
                        <>
                          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Réaction connue
                          </span>
                          <span className="text-border">·</span>
                          <span className="truncate text-foreground/85">
                            <ChemText value={realityStatus.titleFr} />
                          </span>
                          {realityStatus.equilibriumLabel && (
                            <>
                              <span className="text-border">·</span>
                              <span className="text-[11px] tabular-nums text-muted-foreground">
                                <ChemText value={realityStatus.equilibriumLabel} />
                              </span>
                            </>
                          )}
                        </>
                      )}

                      {realityStatus?.kind === 'half_equation' && (
                        <>
                          <span className="inline-flex items-center gap-1.5 font-medium text-sky-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                            Demi-équation équilibrée
                          </span>
                          <span className="text-border">·</span>
                          <span className="text-muted-foreground">
                            Atomes et charges conservés
                          </span>
                        </>
                      )}

                      {realityStatus?.kind === 'non_spontaneous' && (
                        <>
                          <span className="inline-flex items-center gap-1.5 font-medium text-amber-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                            Équilibrée · non spontanée
                          </span>
                          {realityStatus.equilibriumLabel && (
                            <>
                              <span className="text-border">·</span>
                              <span className="text-[11px] tabular-nums text-muted-foreground">
                                <ChemText value={realityStatus.equilibriumLabel} />
                              </span>
                            </>
                          )}
                        </>
                      )}

                      {realityStatus?.kind === 'spectator_only' && (
                        <span className="inline-flex items-center gap-1.5 font-medium text-amber-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          Équilibrée · aucune réaction nette
                        </span>
                      )}

                      {realityStatus?.kind === 'unlisted' && (
                        <span className="inline-flex items-center gap-1.5 font-medium text-amber-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          Équilibrée mathématiquement · non répertoriée
                        </span>
                      )}

                      {realityStatus?.kind === 'unknown_species' && (
                        <span className="inline-flex items-center gap-1.5 font-medium text-zinc-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                          Équilibrée mathématiquement · existence non vérifiée
                        </span>
                      )}

                      {(!realityStatus || realityStatus.kind === 'checking') && (
                        <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                          Équilibrée · vérification…
                        </span>
                      )}

                      {result.underdetermined && (
                        <>
                          <span className="text-border">·</span>
                          <span className="text-amber-300">
                            Plusieurs solutions possibles
                          </span>
                        </>
                      )}
                    </div>

                    {/* Compact export / workbench actions */}
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy('plain')}
                        className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        {copiedMode === 'plain' ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" strokeWidth={1.6} />
                        )}
                        <span>Copier</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy('latex')}
                        className="h-7 min-w-[52px] justify-center px-2 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        {copiedMode === 'latex' ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <span>LaTeX</span>
                        )}
                      </Button>
                      {canSpawnToWorkbench && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleSendToWorkbench}
                          className="ml-1 h-7 gap-1.5 px-2.5 text-[11px]"
                        >
                          <FlaskConical className="h-3.5 w-3.5" strokeWidth={1.6} />
                          <span>Paillasse</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Hero balanced equation */}
                  <div className="overflow-x-auto py-2 text-[20px] leading-relaxed tracking-tight text-foreground sm:text-[22px] select-text">
                    <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      {result.reactants.map((r, idx) => (
                        <span key={`br-${idx}`} className="inline-flex items-baseline">
                          {idx > 0 && (
                            <span className="mr-2 text-muted-foreground">+</span>
                          )}
                          {r.coefficient > 1 && (
                            <span className="mr-1 font-semibold text-sky-300 tabular-nums">
                              {r.coefficient}
                            </span>
                          )}
                          <ChemFormula value={r.displayFormula} />
                          {r.state && (
                            <StateTag state={r.state} className="text-[0.65em]" />
                          )}
                        </span>
                      ))}

                      <span className="mx-1.5 text-zinc-400">
                        {result.arrow === '<=>' ? '⇌' : '→'}
                      </span>

                      {result.products.map((p, idx) => (
                        <span key={`bp-${idx}`} className="inline-flex items-baseline">
                          {idx > 0 && (
                            <span className="mr-2 text-muted-foreground">+</span>
                          )}
                          {p.coefficient > 1 && (
                            <span className="mr-1 font-semibold text-sky-300 tabular-nums">
                              {p.coefficient}
                            </span>
                          )}
                          <ChemFormula value={p.displayFormula} />
                          {p.state && (
                            <StateTag state={p.state} className="text-[0.65em]" />
                          )}
                        </span>
                      ))}
                    </span>
                  </div>

                  {/* Short, unambiguous chemical reality clarification when not a known spontaneous reaction */}
                  {realityStatus?.kind === 'non_spontaneous' && (
                    <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                      Stœchiométrie correcte, mais la réaction ne se produit pas
                      spontanément dans ce sens. <ChemText value={realityStatus.reasonFr} />
                    </p>
                  )}
                  {realityStatus?.kind === 'spectator_only' && (
                    <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                      Stœchiométrie correcte sur le papier, mais tous les ions sont
                      spectateurs : aucune réaction réelle en solution aqueuse.
                    </p>
                  )}
                  {realityStatus?.kind === 'unlisted' && (
                    <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                      Atomes et charges sont bien équilibrés, mais cette transformation
                      n’est pas répertoriée comme réaction spontanée dans le catalogue.
                      {realityStatus.suggestedEquation && (
                        <>
                          {' '}
                          Réaction connue avec ces réactifs :{' '}
                          <span className="text-zinc-300">
                            <ChemFormula value={realityStatus.suggestedEquation} />
                          </span>
                          .
                        </>
                      )}
                    </p>
                  )}
                  {realityStatus?.kind === 'unknown_species' && (
                    <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                      Atomes et charges sont équilibrés, mais l’existence réelle ne peut
                      pas être vérifiée (
                      {realityStatus.unknownFormulas.map((f, i) => (
                        <span key={f}>
                          {i > 0 && ', '}
                          <ChemFormula value={f} />
                        </span>
                      ))}{' '}
                      hors catalogue).
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1 py-1">
                  <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-rose-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                    Impossible à équilibrer
                  </div>
                  <p className="text-xs text-foreground/90">
                    <ChemText value={result.errorFr} />
                  </p>
                  {result.hintFr && (
                    <p className="text-[11.5px] text-muted-foreground">
                      <ChemText value={result.hintFr} />
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* 3. Stoichiometry & Progress Table */}
            {result.ok && stoich && (
              <>
                <section className="space-y-2.5 border-t border-border/60 pt-4">
                  <div className="flex min-h-7 flex-nowrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-baseline gap-2.5 overflow-hidden">
                      <span className="shrink-0 whitespace-nowrap text-xs font-medium text-foreground">
                        Quantités initiales
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
                        <ChemVar base="x" sub="max" /> = {formatMol(stoich.xMax)}
                      </span>
                      <span
                        aria-hidden={!stoich.isExactStoich}
                        className={cn(
                          'truncate text-[10.5px] text-emerald-400',
                          !stoich.isExactStoich && 'invisible',
                        )}
                      >
                        Proportions stœchiométriques
                      </span>
                    </div>

                    {result.reactants.length >= 2 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSetStoichiometricProportions}
                        className="h-7 shrink-0 whitespace-nowrap px-2 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Proportions stœchiométriques
                      </Button>
                    )}
                  </div>

                  <div className="divide-y divide-border/50 border-y border-border/60">
                    {result.reactants.map((r, idx) => {
                      const st = getReactantState(idx, r)
                      const mol = stoich.reactantMols[idx]
                      const massG = mol * r.molarMass
                      const isLimiting =
                        stoich.limitingIndices.has(idx) && !stoich.isExactStoich
                      return (
                        <div
                          key={`in-${idx}-${r.formula}`}
                          className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 shrink-0 items-baseline gap-2 sm:w-48">
                            <span className="shrink-0 text-xs font-semibold text-foreground">
                              {r.coefficient > 1 && (
                                <span className="mr-1 text-sky-300">
                                  {r.coefficient}
                                </span>
                              )}
                              <ChemFormula value={r.displayFormula} />
                              {r.state && <StateTag state={r.state} />}
                            </span>
                            {r.matchedSpecies && (
                              <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                                {r.matchedSpecies.nameFr}
                              </span>
                            )}
                            <span
                              aria-hidden={!isLimiting}
                              className={cn(
                                'shrink-0 text-[10px] text-amber-300',
                                !isLimiting && 'invisible',
                              )}
                            >
                              Limitant
                            </span>
                          </div>

                          <div className="flex flex-nowrap items-center gap-2">
                            <div className="flex shrink-0 items-center rounded-md border border-border/70 bg-panel p-0.5 text-[10px]">
                              {(
                                [
                                  ['mol', 'n'],
                                  ['mass', 'm'],
                                  ['solution', 'C·V'],
                                  ['gas', 'V gaz'],
                                ] as Array<[QuantityInputMode, string]>
                              ).map(([modeId, label]) => (
                                <button
                                  key={modeId}
                                  type="button"
                                  onClick={() =>
                                    updateReactantState(idx, r, { mode: modeId })
                                  }
                                  className={cn(
                                    'shrink-0 whitespace-nowrap rounded px-1.5 py-0.5',
                                    st.mode === modeId
                                      ? 'bg-accent text-foreground'
                                      : 'text-muted-foreground hover:text-foreground',
                                  )}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>

                            <div className="flex w-[262px] shrink-0 items-center justify-end gap-1.5">
                              {st.mode === 'mol' && (
                                <ScrubNumberInput
                                  prefixLabel={<ChemVar base="n" sub="0" />}
                                  value={mol}
                                  units={MOL_UNITS}
                                  defaultUnitId={mol < 0.05 ? 'mmol' : 'mol'}
                                  min={0}
                                  max={1000}
                                  ariaLabel={`Quantité de matière initiale de ${r.displayFormula}`}
                                  onChange={(val) =>
                                    updateReactantState(idx, r, { mol: val })
                                  }
                                  className="w-36"
                                />
                              )}

                              {st.mode === 'mass' && (
                                <ScrubNumberInput
                                  prefixLabel={<ChemVar base="m" sub="0" />}
                                  value={massG}
                                  units={MASS_UNITS}
                                  defaultUnitId={massG < 1 ? 'mg' : 'g'}
                                  min={0}
                                  max={100000}
                                  ariaLabel={`Masse initiale de ${r.displayFormula}`}
                                  onChange={(g) =>
                                    updateReactantState(idx, r, {
                                      mol: r.molarMass > 0 ? g / r.molarMass : 0,
                                    })
                                  }
                                  className="w-36"
                                />
                              )}

                              {st.mode === 'solution' && (
                                <>
                                  <ScrubNumberInput
                                    prefixLabel="C"
                                    value={st.concMolL}
                                    units={CONC_MOL_UNITS}
                                    defaultUnitId="M"
                                    min={0}
                                    max={20}
                                    ariaLabel={`Concentration de ${r.displayFormula}`}
                                    onChange={(c) =>
                                      updateReactantState(idx, r, {
                                        concMolL: c,
                                        mol: (c * st.volMl) / 1000,
                                      })
                                    }
                                    className="w-32"
                                  />
                                  <ScrubNumberInput
                                    prefixLabel="V"
                                    value={st.volMl}
                                    units={VOLUME_UNITS}
                                    defaultUnitId="mL"
                                    min={0}
                                    max={10000}
                                    ariaLabel={`Volume de ${r.displayFormula}`}
                                    onChange={(v) =>
                                      updateReactantState(idx, r, {
                                        volMl: v,
                                        mol: (st.concMolL * v) / 1000,
                                      })
                                    }
                                    className="w-32"
                                  />
                                </>
                              )}

                              {st.mode === 'gas' && (
                                <ScrubNumberInput
                                  prefixLabel="V"
                                  value={mol * gasMolarVolumeL * 1000}
                                  units={VOLUME_UNITS}
                                  defaultUnitId={
                                    mol * gasMolarVolumeL >= 1 ? 'L' : 'mL'
                                  }
                                  min={0}
                                  max={1000000}
                                  ariaLabel={`Volume de gaz de ${r.displayFormula}`}
                                  onChange={(ml) =>
                                    updateReactantState(idx, r, {
                                      mol: ml / 1000 / gasMolarVolumeL,
                                    })
                                  }
                                  className="w-36"
                                />
                              )}
                            </div>

                            <span className="w-24 shrink-0 whitespace-nowrap text-right text-[10.5px] tabular-nums text-muted-foreground">
                              {st.mode === 'mass'
                                ? formatMol(mol)
                                : formatMassG(massG)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>

                {/* Progress Table + inline x / η sliders */}
                <section className="space-y-3 border-t border-border/60 pt-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">
                      Tableau d’avancement
                    </span>
                  </div>

                  {/* Sliders directly governing the En cours & Final rows */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <div className="flex flex-nowrap items-center justify-between gap-2 text-[11.5px]">
                        <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                          Avancement <ChemVar base="x" />
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] tabular-nums text-zinc-200">
                          <InlineNumberInput
                            value={
                              stoich.xMax < 0.5
                                ? stoich.xCurrent * 1000
                                : stoich.xCurrent
                            }
                            onChange={(val) => {
                              const molVal = stoich.xMax < 0.5 ? val / 1000 : val
                              setProgressFraction(
                                stoich.xFinal > 1e-12
                                  ? Math.max(0, Math.min(1, molVal / stoich.xFinal))
                                  : 0,
                              )
                            }}
                            min={0}
                            max={
                              stoich.xMax < 0.5 ? stoich.xFinal * 1000 : stoich.xFinal
                            }
                            step={stoich.xMax < 0.5 ? 0.1 : 0.01}
                            decimals={stoich.xMax < 0.5 ? 2 : 3}
                            unit={stoich.xMax < 0.5 ? 'mmol' : 'mol'}
                            inputWidthClass="w-[5.5ch]"
                            ariaLabel="Avancement x"
                          />
                          <span className="inline-block w-[5.5ch] text-right text-muted-foreground">
                            {Math.round(progressFraction * 100)} %
                          </span>
                        </div>
                      </div>
                      <Slider
                        value={progressFraction}
                        min={0}
                        max={1}
                        step={0.005}
                        snapPoints={[0, 0.25, 0.5, 0.75, 1]}
                        ariaLabel="Avancement de la réaction"
                        onChange={setProgressFraction}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex flex-nowrap items-center justify-between gap-2 text-[11.5px]">
                        <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                          Rendement <span >η</span>
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] tabular-nums text-zinc-200">
                          <InlineNumberInput
                            value={Math.round(yieldPercent)}
                            onChange={(v) => setYieldPercent(Math.round(v))}
                            min={0}
                            max={100}
                            step={1}
                            unit="%"
                            inputWidthClass="w-[3.5ch]"
                            ariaLabel="Rendement en pourcentage"
                          />
                        </div>
                      </div>
                      <Slider
                        value={yieldPercent}
                        min={0}
                        max={100}
                        step={1}
                        snapPoints={[0, 25, 50, 75, 100]}
                        ariaLabel="Rendement expérimental"
                        onChange={setYieldPercent}
                      />
                    </div>
                  </div>

                  {/* Merged État / x column table */}
                  <div className="overflow-x-auto border-y border-border/70">
                    <table className="w-full table-fixed border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-border/70 bg-panel/60 text-[11px] text-muted-foreground">
                          <th className="w-[138px] whitespace-nowrap px-3 py-2 font-sans font-medium">
                            État <span className="text-muted-foreground/70">/ <ChemVar base="x" /></span>
                          </th>
                          {result.reactants.map((r, i) => (
                            <th
                              key={`th-r-${i}`}
                              className="min-w-[112px] whitespace-nowrap px-3 py-2 text-right font-medium text-foreground"
                            >
                              {r.coefficient > 1 && (
                                <span className="mr-0.5 text-sky-300">
                                  {r.coefficient}
                                </span>
                              )}
                              <ChemFormula value={r.displayFormula} />
                            </th>
                          ))}
                          {result.products.map((p, i) => (
                            <th
                              key={`th-p-${i}`}
                              className="min-w-[112px] whitespace-nowrap px-3 py-2 text-right font-medium text-foreground"
                            >
                              {p.coefficient > 1 && (
                                <span className="mr-0.5 text-sky-300">
                                  {p.coefficient}
                                </span>
                              )}
                              <ChemFormula value={p.displayFormula} />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 text-[11px] tabular-nums">
                        {/* Initial state */}
                        <tr>
                          <td className="whitespace-nowrap px-3 py-2">
                            <div className="font-sans text-[11.5px] text-muted-foreground">
                              Initial
                            </div>
                            <div className="text-[10px] text-muted-foreground/80">
                              x = 0
                            </div>
                          </td>
                          {result.reactants.map((r, i) => {
                            const n0 = stoich.reactantMols[i]
                            return (
                              <td
                                key={`ti-r-${i}`}
                                className="whitespace-nowrap px-3 py-2 text-right"
                              >
                                <div className="text-foreground">{formatMol(n0)}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {formatMassG(n0 * r.molarMass)}
                                </div>
                              </td>
                            )
                          })}
                          {result.products.map((_, i) => (
                            <td
                              key={`ti-p-${i}`}
                              className="whitespace-nowrap px-3 py-2 text-right text-muted-foreground"
                            >
                              <div>0</div>
                              <div className="text-[10px]">0 g</div>
                            </td>
                          ))}
                        </tr>

                        {/* Current state (x) */}
                        <tr className="bg-accent/25">
                          <td className="whitespace-nowrap px-3 py-2">
                            <div className="font-sans text-[11.5px] font-medium text-foreground">
                              En cours
                            </div>
                            <div className="text-[10px] text-sky-300">
                              x = {formatMol(stoich.xCurrent)}
                            </div>
                          </td>
                          {result.reactants.map((r, i) => {
                            const nCur = Math.max(
                              0,
                              stoich.reactantMols[i] - r.coefficient * stoich.xCurrent,
                            )
                            return (
                              <td
                                key={`tc-r-${i}`}
                                className="whitespace-nowrap px-3 py-2 text-right"
                              >
                                <div
                                  className={
                                    nCur < 1e-7 ? 'text-amber-300' : 'text-foreground'
                                  }
                                >
                                  {formatMol(nCur)}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {formatMassG(nCur * r.molarMass)}
                                </div>
                              </td>
                            )
                          })}
                          {result.products.map((p, i) => {
                            const nCur = p.coefficient * stoich.xCurrent
                            return (
                              <td
                                key={`tc-p-${i}`}
                                className="whitespace-nowrap px-3 py-2 text-right"
                              >
                                <div className="text-foreground">{formatMol(nCur)}</div>
                                <div className="truncate text-[10px] text-muted-foreground">
                                  {formatMassG(nCur * p.molarMass)}
                                  {p.state === 'gas' && (
                                    <span>
                                      {' '}
                                      · {formatVolumeMl(nCur * gasMolarVolumeL * 1000)}
                                    </span>
                                  )}
                                </div>
                              </td>
                            )
                          })}
                        </tr>

                        {/* Final state (x_f) */}
                        <tr>
                          <td className="whitespace-nowrap px-3 py-2">
                            <div className="font-sans text-[11.5px] text-muted-foreground">
                              Final
                              {yieldPercent < 100
                                ? ` (${Math.round(yieldPercent)} %)`
                                : ''}
                            </div>
                            <div className="text-[10px] text-zinc-300">
                              <ChemVar base="x" sub="f" /> = {formatMol(stoich.xFinal)}
                            </div>
                          </td>
                          {result.reactants.map((r, i) => {
                            const nFin = Math.max(
                              0,
                              stoich.reactantMols[i] - r.coefficient * stoich.xFinal,
                            )
                            const isZero = nFin < 1e-7
                            return (
                              <td
                                key={`tf-r-${i}`}
                                className="whitespace-nowrap px-3 py-2 text-right"
                              >
                                <div
                                  className={
                                    isZero ? 'text-amber-300' : 'text-foreground'
                                  }
                                >
                                  {isZero ? '0 (épuisé)' : formatMol(nFin)}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {isZero ? '0 g' : formatMassG(nFin * r.molarMass)}
                                </div>
                              </td>
                            )
                          })}
                          {result.products.map((p, i) => {
                            const nFin = p.coefficient * stoich.xFinal
                            return (
                              <td
                                key={`tf-p-${i}`}
                                className="whitespace-nowrap px-3 py-2 text-right"
                              >
                                <div className="text-emerald-300">
                                  {formatMol(nFin)}
                                </div>
                                <div className="truncate text-[10px] text-muted-foreground">
                                  {formatMassG(nFin * p.molarMass)}
                                  {p.state === 'gas' && (
                                    <span>
                                      {' '}
                                      · {formatVolumeMl(nFin * gasMolarVolumeL * 1000)}
                                    </span>
                                  )}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>

        {/* Right sidebar: Species, Conservation & contextual Gas conditions */}
        <aside className="hidden w-[296px] shrink-0 overflow-y-auto border-l border-border bg-panel px-4 py-4 xl:block">
          <div className="space-y-5">
            {result.ok ? (
              <>
                {/* Species breakdown */}
                <section className="space-y-1.5">
                  <span className="text-[11px] font-medium text-foreground">
                    Espèces
                  </span>
                  <ul className="divide-y divide-border/40">
                    {[...result.reactants, ...result.products].map((p, idx) => (
                      <li
                        key={`sp-${idx}-${p.formula}`}
                        className="flex items-center justify-between gap-2 py-2 text-[11px]"
                      >
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-semibold text-foreground">
                              <ChemFormula value={p.displayFormula} />
                              {p.state && <StateTag state={p.state} />}
                            </span>
                            <span className="text-[10px] tabular-nums text-muted-foreground">
                              {formatFrNumber(p.molarMass, 2)} g/mol
                            </span>
                          </div>
                          <p
                            className={cn(
                              'truncate text-[10.5px]',
                              p.matchedSpecies
                                ? 'text-muted-foreground'
                                : 'text-amber-300/80',
                            )}
                          >
                            {p.matchedSpecies?.nameFr ?? 'Hors catalogue'}
                          </p>
                        </div>

                        {p.matchedSpecies && (
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                onOpenSpeciesInCatalog(p.matchedSpecies!.id)
                              }
                              className="rounded px-1.5 py-0.5 text-[10.5px] text-muted-foreground hover:bg-accent hover:text-foreground"
                            >
                              Fiche
                            </button>
                            {p.matchedSpecies.kind !== 'element_substance' && (
                              <button
                                type="button"
                                onClick={() => onOpenInLewisBuilder(p.matchedSpecies!)}
                                className="rounded px-1.5 py-0.5 text-[10.5px] text-muted-foreground hover:bg-accent hover:text-foreground"
                              >
                                Lewis
                              </button>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>

                {/* Conservation table */}
                <section className="space-y-2 border-t border-border/60 pt-4">
                  <span className="text-[11px] font-medium text-foreground">
                    Conservation
                  </span>

                  <table className="w-full border-collapse text-[11px] tabular-nums">
                    <thead>
                      <tr className="border-b border-border/60 text-[10px] text-muted-foreground">
                        <th className="py-1 text-left font-normal">Élément</th>
                        <th className="py-1 text-right font-normal">Réactifs</th>
                        <th className="py-1 text-right font-normal">Produits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {result.conservation.map((row) => (
                        <tr key={row.key}>
                          <td className="py-1 text-foreground">
                            {row.key}{' '}
                            <span className="font-sans text-[10px] text-muted-foreground">
                              {row.label !== row.key ? row.label : ''}
                            </span>
                          </td>
                          <td className="py-1 text-right text-zinc-300">
                            {row.key === 'Charge' && row.left > 0
                              ? `+${row.left}`
                              : row.left}
                          </td>
                          <td className="py-1 text-right text-zinc-300">
                            {row.key === 'Charge' && row.right > 0
                              ? `+${row.right}`
                              : row.right}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex items-center justify-between border-t border-border/60 pt-2 text-[10.5px] tabular-nums text-muted-foreground">
                    <span>Masse molaire totale</span>
                    <span className="text-zinc-200">
                      {formatFrNumber(result.totalMassLeftGPerMol, 2)} g/mol
                    </span>
                  </div>
                </section>

                {/* Ideal gas conditions (only shown when gas is involved) */}
                {hasGasInEquation && (
                  <section className="space-y-2 border-t border-border/60 pt-4">
                    <div className="flex items-baseline justify-between text-[11px]">
                      <span className="font-medium text-foreground">
                        Gaz parfait (<ChemVar base="V" sub="m" />)
                      </span>
                      <span className="text-[11px] tabular-nums text-zinc-200">
                        {formatFrNumber(gasMolarVolumeL, 2)} L/mol
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                          <span >T</span>
                          <InlineNumberInput
                            value={Math.round(gasTempC)}
                            onChange={(v) => setGasTempC(Math.round(v))}
                            min={0}
                            max={100}
                            step={1}
                            unit="°C"
                            inputWidthClass="w-[3.5ch]"
                            ariaLabel="Température des gaz en degrés Celsius"
                          />
                        </div>
                        <Slider
                          value={gasTempC}
                          min={0}
                          max={100}
                          step={1}
                          snapPoints={[0, 20, 25, 100]}
                          ariaLabel="Température des gaz"
                          onChange={setGasTempC}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                          <span >P</span>
                          <InlineNumberInput
                            value={gasPressureBar}
                            onChange={setGasPressureBar}
                            min={0.5}
                            max={5}
                            step={0.05}
                            decimals={2}
                            unit="bar"
                            inputWidthClass="w-[4.5ch]"
                            ariaLabel="Pression des gaz en bar"
                          />
                        </div>
                        <Slider
                          value={gasPressureBar}
                          min={0.5}
                          max={5}
                          step={0.05}
                          snapPoints={[1.013, 2, 5]}
                          ariaLabel="Pression des gaz"
                          onChange={setGasPressureBar}
                        />
                      </div>
                    </div>
                  </section>
                )}
              </>
            ) : (
              <div className="space-y-2 text-[11.5px] leading-relaxed text-muted-foreground">
                <p className="font-medium text-foreground">Syntaxe acceptée</p>
                <ul className="space-y-1.5 text-[11px]">
                  <li>Fe + O2 -&gt; Fe2O3</li>
                  <li>MnO4- + Fe2+ + H+ -&gt; Mn2+ + Fe3+ + H2O</li>
                  <li>Ca(OH)2 + H3PO4 -&gt; Ca3(PO4)2 + H2O</li>
                  <li>MnO4- + H+ + e- -&gt; Mn2+ + H2O</li>
                </ul>
                <p className="pt-1 text-[11px]">
                  Parenthèses, hydrates (<code>·</code>), charges ioniques,
                  demi-équations (<code>e-</code>) et états <code>(s)</code>,{' '}
                  <code>(l)</code>, <code>(g)</code>, <code>(aq)</code>.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
})
