import { useMemo } from 'react'
import type { ElementRecord, FullCatalogResponse } from '../../shared/chemistry.ts'
import {
  expandElectronConfiguration,
  getElementMassNumber,
} from '@/lib/chemistry-calc'
import {
  CATEGORY_META,
  STATE_META,
  formatDensity,
  formatElementChargeShort,
  formatElementTempC,
  formatElementTempK,
  formatFrNumber,
  formatOxidationState,
  getElementStateAtTemperature,
} from '@/lib/chemistry-ui'
import { ElectronConfig, Nuclide } from '@/components/ui/chem-text'

const SHELL_LETTERS = ['K', 'L', 'M', 'N', 'O', 'P', 'Q']

export function BohrAtomSvg({
  symbol,
  atomicNumber,
  shells,
  accentHex,
}: {
  symbol: string
  atomicNumber: number
  shells: number[]
  accentHex: string
}) {
  const size = 120
  const cx = size / 2
  const cy = size / 2
  const maxR = 52
  const minR = 18
  const count = Math.max(1, shells.length)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      aria-label={`Modèle en couches électroniques de ${symbol}`}
    >
      {shells.map((electronCount, idx) => {
        const r =
          count === 1
            ? 33
            : minR + ((maxR - minR) * idx) / Math.max(1, count - 1)
        const isValence = idx === shells.length - 1
        return (
          <g key={idx}>
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={isValence ? '#52525b' : '#27272a'}
              strokeWidth={isValence ? 1.15 : 0.9}
            />
            {Array.from({ length: electronCount }, (_, eIdx) => {
              const angle = (eIdx / electronCount) * Math.PI * 2 - Math.PI / 2
              const ex = cx + Math.cos(angle) * r
              const ey = cy + Math.sin(angle) * r
              return (
                <circle
                  key={eIdx}
                  cx={ex}
                  cy={ey}
                  r={isValence ? 2.3 : 1.7}
                  fill={isValence ? accentHex : '#a1a1aa'}
                />
              )
            })}
          </g>
        )
      })}

      <circle
        cx={cx}
        cy={cy}
        r={11.5}
        fill="#131317"
        stroke="#3f3f46"
        strokeWidth="1.2"
      />
      <text
        x={cx}
        y={cy - 1.5}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="8.8"
        fontWeight="600"
        fontFamily="var(--font-sans)"
        fill="#f4f4f5"
      >
        {symbol}
      </text>
      <text
        x={cx}
        y={cy + 6.2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="5.8"
        fontFamily="var(--font-mono)"
        fill="#8f8f9d"
      >
        {atomicNumber}p⁺
      </text>
    </svg>
  )
}

export function ElementDetailsBody({
  element,
  catalog,
  temperatureC = 20,
  onJumpToSpecies,
  showRelatedSpecies = true,
  maxSpecies = 28,
}: {
  element: ElementRecord
  catalog: FullCatalogResponse | null
  temperatureC?: number
  onJumpToSpecies?: (speciesId: string) => void
  showRelatedSpecies?: boolean
  maxSpecies?: number
}) {
  const cat = CATEGORY_META[element.category]
  const massNumber = getElementMassNumber(element.atomicNumber, element.atomicMass)
  const neutronCount = Math.max(0, massNumber - element.atomicNumber)
  const fullElectronConfig = expandElectronConfiguration(element.electronConfiguration)
  const hasCondensedConfig =
    fullElectronConfig !== element.electronConfiguration.trim()
  const phase = getElementStateAtTemperature(element, temperatureC)
  const phaseLabel =
    phase === 'solid'
      ? 'Solide'
      : phase === 'liquid'
        ? 'Liquide'
        : phase === 'gas'
          ? 'Gaz'
          : STATE_META[element.defaultState].labelFr

  const relatedSpecies = useMemo(() => {
    if (!showRelatedSpecies || !catalog) return []
    return catalog.species
      .filter((sp) => (sp.composition[element.symbol] ?? 0) > 0)
      .slice(0, maxSpecies)
  }, [showRelatedSpecies, catalog, element.symbol, maxSpecies])

  return (
    <>
      {/* Concise scientific summary */}
      {element.summaryFr && (
        <p className="border-t border-border/60 pt-3.5 text-xs leading-relaxed text-zinc-300">
          {element.summaryFr}
        </p>
      )}

      {/* Explicit Subatomic Composition (Protons, Neutrons, Nucleons, Electrons, Valence) */}
      <div className="border-t border-border/60 pt-3.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">
            Composition de l’atome
          </span>
          <span
            className="shrink-0 whitespace-nowrap font-mono text-sm text-zinc-200"
            title="Notation symbolique de l’isotope principal"
          >
            <Nuclide symbol={element.symbol} A={massNumber} Z={element.atomicNumber} />
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div className="min-w-0">
            <dt className="text-[10.5px] text-muted-foreground">Protons (Z)</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-foreground">
              {element.atomicNumber}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10.5px] text-muted-foreground">Neutrons (N = A − Z)</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-foreground">
              {neutronCount}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10.5px] text-muted-foreground">Nucléons (A)</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-foreground">
              {massNumber}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10.5px] text-muted-foreground">Électrons (atome neutre)</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-foreground">
              {element.atomicNumber}{' '}
              <span className="text-[10.5px] text-muted-foreground">
                (dont {element.valenceElectrons} de valence)
              </span>
            </dd>
          </div>
        </dl>
      </div>

      {/* Bohr Electron Shell Diagram + Full & Condensed Configuration */}
      <div className="border-t border-border/60 pt-3.5">
        <p className="text-[11px] font-medium text-muted-foreground">
          Structure électronique
        </p>

        <dl className="mt-2 space-y-1.5 text-xs">
          <div>
            <dt className="text-[10px] text-muted-foreground">
              Configuration complète
            </dt>
            <dd className="mt-0.5 break-words font-mono text-[11.5px] leading-relaxed text-foreground">
              <ElectronConfig value={fullElectronConfig} />
            </dd>
          </div>
          {hasCondensedConfig && (
            <div>
              <dt className="text-[10px] text-muted-foreground">
                Configuration condensée (gaz noble)
              </dt>
              <dd className="mt-0.5 font-mono text-[11.5px] text-zinc-300">
                <ElectronConfig value={element.electronConfiguration} />
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-3 flex items-center gap-3.5">
          <BohrAtomSvg
            symbol={element.symbol}
            atomicNumber={element.atomicNumber}
            shells={element.electronShells}
            accentHex={cat.accentHex}
          />

          <div className="min-w-0 flex-1 space-y-2 text-xs">
            <div>
              <span className="block text-[10px] text-muted-foreground">
                Répartition par couche ({element.electronShells.length})
              </span>
              <span className="mt-0.5 block break-words font-mono text-[11px] tabular-nums text-foreground">
                {element.electronShells
                  .map((n, i) => `${SHELL_LETTERS[i] ?? i + 1}(${n})`)
                  .join(' · ')}
              </span>
            </div>

            <div>
              <span className="block text-[10px] text-muted-foreground">
                Électrons de valence · Bloc
              </span>
              <span className="mt-0.5 block font-mono text-[11px] tabular-nums text-foreground">
                {element.valenceElectrons} électron{element.valenceElectrons > 1 ? 's' : ''} · Bloc{' '}
                {element.block}
              </span>
            </div>

            {element.oxidationStates.length > 0 && (
              <div>
                <span className="block text-[10px] text-muted-foreground">
                  Degrés d’oxydation
                </span>
                <span className="mt-0.5 block font-mono text-[11px] tabular-nums text-zinc-200">
                  {element.oxidationStates.map(formatOxidationState).join(' · ')}
                </span>
              </div>
            )}

            {element.commonIonCharges.length > 0 && (
              <div>
                <span className="block text-[10px] text-muted-foreground">
                  Ions usuels
                </span>
                <span className="mt-0.5 block font-mono text-[11px] tabular-nums text-zinc-200">
                  {element.commonIonCharges
                    .map((q) => `${element.symbol}${formatElementChargeShort(q)}`)
                    .join(' · ')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Atomic Properties */}
      <div className="border-t border-border/60 pt-3.5">
        <p className="mb-2 text-[11px] font-medium text-muted-foreground">
          Propriétés atomiques
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <dt className="text-[10.5px] text-muted-foreground">Masse atomique</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-foreground">
              {formatFrNumber(element.atomicMass, 4)} g/mol
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] text-muted-foreground">Électronégativité (χ)</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-foreground">
              {element.electronegativity !== null
                ? formatFrNumber(element.electronegativity, 2)
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] text-muted-foreground">Rayon covalent</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-foreground">
              {element.atomicRadiusPm !== null ? `${element.atomicRadiusPm} pm` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] text-muted-foreground">Rayon Van der Waals</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-foreground">
              {element.vdwRadiusPm !== null ? `${element.vdwRadiusPm} pm` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] text-muted-foreground">1ʳᵉ ionisation</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-foreground">
              {element.ionizationEnergyKjMol !== null
                ? `${formatFrNumber(element.ionizationEnergyKjMol, 1)} kJ/mol`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] text-muted-foreground">Affinité électronique</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-foreground">
              {element.electronAffinityKjMol !== null
                ? `${formatFrNumber(element.electronAffinityKjMol, 1)} kJ/mol`
                : '—'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Physical & Thermal Properties */}
      <div className="border-t border-border/60 pt-3.5">
        <p className="mb-2 text-[11px] font-medium text-muted-foreground">
          Propriétés physiques
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <dt className="text-[10.5px] text-muted-foreground">
              État ({formatFrNumber(temperatureC, 0)} °C)
            </dt>
            <dd className="mt-0.5 text-foreground">{phaseLabel}</dd>
          </div>
          <div>
            <dt className="text-[10.5px] text-muted-foreground">Position</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-foreground">
              P{element.period} · {element.groupNum ? `G${element.groupNum}` : 'Bloc f'}
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] text-muted-foreground">T° fusion</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-foreground">
              {formatElementTempC(element.meltingPointC)}
              {element.meltingPointC !== null && (
                <span className="ml-1 text-[10px] text-muted-foreground">
                  ({formatElementTempK(element.meltingPointC)})
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] text-muted-foreground">T° ébullition</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-foreground">
              {formatElementTempC(element.boilingPointC)}
              {element.boilingPointC !== null && (
                <span className="ml-1 text-[10px] text-muted-foreground">
                  ({formatElementTempK(element.boilingPointC)})
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] text-muted-foreground">Masse volumique</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-foreground">
              {element.densityGPerCm3 !== null
                ? formatDensity(element.densityGPerCm3, element.defaultState)
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] text-muted-foreground">Réseau cristallin</dt>
            <dd className="mt-0.5 text-foreground">
              {element.crystalStructure ?? '—'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Discovery & History */}
      <div className="border-t border-border/60 pt-3.5">
        <p className="mb-2 text-[11px] font-medium text-muted-foreground">
          Découverte & origine
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <dt className="text-[10.5px] text-muted-foreground">Année</dt>
            <dd className="mt-0.5 font-mono tabular-nums text-foreground">
              {element.discoveryYear ?? 'Antiquité'}
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] text-muted-foreground">Origine</dt>
            <dd className="mt-0.5 text-foreground">
              {element.synthetic ? 'Synthétique' : 'Naturel'}
              {element.radioactive ? ' (radioactif)' : ''}
            </dd>
          </div>
          {element.discoveredBy && (
            <div className="col-span-2">
              <dt className="text-[10.5px] text-muted-foreground">Découvreur</dt>
              <dd className="mt-0.5 text-zinc-200">{element.discoveredBy}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Related Species from SQLite */}
      {showRelatedSpecies && catalog && (
        <div className="border-t border-border/60 pt-3.5">
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            Espèces en base ({relatedSpecies.length})
          </p>
          {relatedSpecies.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Aucune espèce composée enregistrée pour cet élément.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {relatedSpecies.map((sp) => (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => onJumpToSpecies?.(sp.id)}
                  className="rounded px-2 py-0.5 font-mono text-[11px] text-zinc-200 hover:bg-accent hover:text-foreground"
                >
                  {sp.displayFormula}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
