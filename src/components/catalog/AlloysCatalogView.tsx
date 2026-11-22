import { Plus } from 'lucide-react'
import {
  type AlloyRecord,
  type ElementRecord,
  getElementSolidColor,
} from '../../../shared/chemistry.ts'
import { formatFrNumber } from '@/lib/chemistry-ui'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChemText, Sup } from '@/components/ui/chem-text'
import { SolidBlockArtwork } from '@/components/SolidBlockArtwork'
import { type SortDir, SortTh } from './CatalogShared'

export function AlloysCatalogTable({
  alloys,
  selectedAlloyId,
  sortKey,
  sortDir,
  onSort,
  onSelect,
  onSpawnAlloy,
}: {
  alloys: AlloyRecord[]
  selectedAlloyId: string | null
  sortKey: string
  sortDir: SortDir
  onSort: (k: string) => void
  onSelect: (id: string) => void
  onSpawnAlloy?: (alloy: AlloyRecord) => void
}) {
  return (
    <table className="w-full table-fixed border-collapse text-left text-xs">
      <thead className="sticky top-0 z-10 border-b border-border bg-panel/95 text-[11px] text-muted-foreground">
        <tr>
          <SortTh
            label="Alliage"
            activeKey={sortKey}
            colKey="name"
            dir={sortDir}
            onSort={onSort}
            className="w-[27%] pl-4 pr-4"
          />
          <SortTh
            label="Famille"
            activeKey={sortKey}
            colKey="family"
            dir={sortDir}
            onSort={onSort}
            className="hidden w-[18%] px-4 md:table-cell"
          />
          <th className="w-[25%] whitespace-nowrap px-4 py-2 font-medium">
            Composition typique
          </th>
          <SortTh
            label="Densité"
            activeKey={sortKey}
            colKey="density"
            dir={sortDir}
            onSort={onSort}
            align="right"
            className="hidden w-[12%] pl-4 pr-5 sm:table-cell"
          />
          <SortTh
            label="Fusion"
            activeKey={sortKey}
            colKey="melting"
            dir={sortDir}
            onSort={onSort}
            align="right"
            className="hidden w-[10%] px-3 lg:table-cell"
          />
          <th className="w-24 whitespace-nowrap py-2 pl-2 pr-4 text-right font-medium" />
        </tr>
      </thead>
      <tbody className="divide-y divide-border/50">
        {alloys.map((al) => {
          const isSel = selectedAlloyId === al.id
          return (
            <tr
              key={al.id}
              onClick={() => onSelect(al.id)}
              className={cn(isSel ? 'bg-accent/80' : 'hover:bg-accent/40')}
            >
              <td className="overflow-hidden py-2.5 pl-4 pr-4 font-medium text-foreground">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm border border-white/20"
                    style={{ backgroundColor: al.colorHex }}
                  />
                  <span className="truncate">
                    <ChemText value={al.nameFr} />
                  </span>
                </div>
              </td>
              <td className="hidden truncate px-4 py-2.5 text-muted-foreground md:table-cell">
                {al.familyFr}
              </td>
              <td className="truncate px-4 py-2.5 text-[11px] tabular-nums text-zinc-300">
                {al.components
                  .filter((c) => c.typicalPct > 0)
                  .slice(0, 4)
                  .map(
                    (c) =>
                      `${c.symbol} ${formatFrNumber(c.typicalPct, c.typicalPct < 5 ? 1 : 0)}%`,
                  )
                  .join(' · ')}
              </td>
              <td className="hidden whitespace-nowrap py-2.5 pl-4 pr-5 text-right text-[11px] tabular-nums text-muted-foreground sm:table-cell">
                {formatFrNumber(al.densityGPerCm3, 2)} g/cm<Sup>3</Sup>
              </td>
              <td className="hidden whitespace-nowrap px-3 py-2.5 text-right text-[11px] tabular-nums text-muted-foreground lg:table-cell">
                {al.meltingPointC !== null ? `${formatFrNumber(al.meltingPointC, 0)} °C` : '—'}
              </td>
              <td className="whitespace-nowrap py-1.5 pl-2 pr-4 text-right">
                {onSpawnAlloy && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSpawnAlloy(al)
                    }}
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

export function AlloyDetail({
  alloy,
  elementsBySymbol,
  onJumpToElement,
  onSpawn,
}: {
  alloy: AlloyRecord
  elementsBySymbol: Map<string, ElementRecord>
  onJumpToElement: (symbol: string) => void
  onSpawn?: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card/80">
            <SolidBlockArtwork colorHex={alloy.colorHex} size="sm" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              <ChemText value={alloy.nameFr} />
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{alloy.familyFr}</p>
          </div>
        </div>

        {onSpawn && (
          <Button size="sm" variant="secondary" className="shrink-0" onClick={onSpawn}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.7} />
            <span>Paillasse</span>
          </Button>
        )}
      </div>

      {/* Composition bar + percentages */}
      <div className="space-y-2.5 border-t border-border/60 pt-3.5">
        <p className="text-[11px] font-medium text-muted-foreground">
          Composition massique
        </p>

        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
          {alloy.components
            .filter((c) => c.typicalPct > 0)
            .map((c) => {
              const el = elementsBySymbol.get(c.symbol)
              return (
                <div
                  key={c.symbol}
                  style={{
                    width: `${Math.max(1.5, c.typicalPct)}%`,
                    backgroundColor: getElementSolidColor(c.symbol, el?.category),
                  }}
                />
              )
            })}
        </div>

        <ul className="divide-y divide-border/40">
          {alloy.components.map((c) => {
            const el = elementsBySymbol.get(c.symbol)
            return (
              <li
                key={c.symbol}
                className="flex items-center justify-between gap-2 py-1.5 text-[11px]"
              >
                <button
                  type="button"
                  onClick={() => onJumpToElement(c.symbol)}
                  className="flex min-w-0 items-center gap-1.5 text-left hover:text-white"
                >
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
                </button>
                <span className="shrink-0 tabular-nums text-zinc-200">
                  {formatFrNumber(c.typicalPct, c.typicalPct < 5 ? 1 : 0)} %
                  <span className="ml-1.5 text-[10px] text-muted-foreground">
                    ({formatFrNumber(c.minPct, c.minPct < 5 ? 1 : 0)}–
                    {formatFrNumber(c.maxPct, c.maxPct < 5 ? 1 : 0)} %)
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Physical metrics */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border/60 pt-3.5 text-xs">
        <div>
          <dt className="text-[10.5px] text-muted-foreground">Masse volumique</dt>
          <dd className="mt-0.5 tabular-nums text-foreground">
            {formatFrNumber(alloy.densityGPerCm3, 2)} g/cm<Sup>3</Sup>
          </dd>
        </div>
        <div>
          <dt className="text-[10.5px] text-muted-foreground">Température de fusion</dt>
          <dd className="mt-0.5 tabular-nums text-foreground">
            {alloy.meltingPointC !== null
              ? `${formatFrNumber(alloy.meltingPointC, 0)} °C`
              : '—'}
          </dd>
        </div>
      </dl>

      {alloy.usesFr && (
        <div className="border-t border-border/60 pt-3.5">
          <p className="mb-1 text-[11px] font-medium text-muted-foreground">
            Applications & description
          </p>
          <p className="text-xs leading-relaxed text-zinc-300">
            <ChemText value={alloy.usesFr} />
          </p>
        </div>
      )}
    </div>
  )
}
