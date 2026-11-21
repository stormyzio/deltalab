import { Plus } from 'lucide-react'
import type { ElementRecord, FullCatalogResponse } from '../../../shared/chemistry.ts'
import { getElementMassNumber } from '@/lib/chemistry-calc'
import {
  CATEGORY_META,
  STATE_META,
  formatFrNumber,
  getElementStateAtTemperature,
} from '@/lib/chemistry-ui'
import { Button } from '@/components/ui/button'
import { ElementDetailsBody } from '@/components/ElementDetailsBody'

export function PeriodicElementInspector({
  element,
  catalog,
  temperatureC,
  onSpawn,
  onJumpToSpecies,
}: {
  element: ElementRecord
  catalog: FullCatalogResponse
  temperatureC: number
  onSpawn: () => void
  onJumpToSpecies: (id: string) => void
}) {
  const cat = CATEGORY_META[element.category]
  const massNumber = getElementMassNumber(element.atomicNumber, element.atomicMass)
  const currentPhase = getElementStateAtTemperature(element, temperatureC)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex h-16 w-16 shrink-0 flex-col items-center justify-between rounded-xl border border-border bg-card px-1.5 py-1">
            <div className="flex w-full items-center justify-between leading-none">
              <span className="font-mono text-[9.5px] tabular-nums text-muted-foreground">
                {element.atomicNumber}
              </span>
            </div>
            <span
              className="text-xl font-semibold leading-none"
              style={{ color: cat.accentHex }}
            >
              {element.symbol}
            </span>
            <div className="flex w-full items-baseline justify-between leading-none">
              <span className="font-mono text-[9.5px] tabular-nums text-muted-foreground">
                {massNumber}
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-tight text-foreground">
              {element.nameFr}
            </h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {cat.labelFr} · Bloc {element.block}
            </p>
            <p className="mt-0.5 truncate font-mono text-[10.5px] text-muted-foreground">
              {currentPhase === 'solid'
                ? 'Solide'
                : currentPhase === 'liquid'
                  ? 'Liquide'
                  : currentPhase === 'gas'
                    ? 'Gaz'
                    : STATE_META[element.defaultState].labelFr}
              {temperatureC !== 20 ? ` à ${formatFrNumber(temperatureC, 0)} °C` : ' (20 °C)'}
              {element.radioactive ? ' · Radioactif' : ''}
              {element.synthetic ? ' · Synthétique' : ''}
            </p>
          </div>
        </div>

        <Button size="sm" variant="secondary" className="shrink-0" onClick={onSpawn}>
          <Plus className="h-3.5 w-3.5" strokeWidth={1.7} />
          <span>Paillasse</span>
        </Button>
      </div>

      <ElementDetailsBody
        element={element}
        catalog={catalog}
        temperatureC={temperatureC}
        onJumpToSpecies={onJumpToSpecies}
      />
    </div>
  )
}
