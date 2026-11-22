import { ArrowRight } from 'lucide-react'
import type { FlaskReactionParticipant } from '../../shared/chemistry.ts'
import { formatMol } from '@/lib/chemistry-ui'
import { cn } from '@/lib/utils'
import { ChemFormula, ChemText, ChemVar } from '@/components/ui/chem-text'

export interface ReactionBarDatum extends FlaskReactionParticipant {
  currentMol: number
  finalMol: number
  referenceMol: number
  barColor: string
}

function ReactionParticipantFormula({ p }: { p: FlaskReactionParticipant }) {
  const explicitState =
    p.state === 'solid' && !p.displayFormula.endsWith('(s)')
      ? 's'
      : p.state === 'gas' && !p.displayFormula.endsWith('(g)')
        ? 'g'
        : null
  return <ChemFormula value={p.displayFormula} state={explicitState} />
}

export function ReactionBarChart({
  reactantBars,
  productBars,
  maxScaleMol,
  isCanvas,
}: {
  reactantBars: ReactionBarDatum[]
  productBars: ReactionBarDatum[]
  maxScaleMol: number
  isCanvas: boolean
}) {
  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <div className="mb-2 flex items-center justify-between text-[10.5px] font-medium text-muted-foreground">
        <span>Réactifs</span>
        <span>Produits</span>
      </div>

      <div className="flex items-stretch gap-2.5">
        <div
          className="flex min-w-0 items-end justify-around gap-2"
          style={{ flex: Math.max(1, reactantBars.length) }}
        >
          {reactantBars.map((r) => {
            const fillPct = Math.min(100, (r.currentMol / maxScaleMol) * 100)
            const refPct = Math.min(100, (r.referenceMol / maxScaleMol) * 100)
            const depleted = r.currentMol <= 1e-7
            return (
              <div
                key={`bar-r-${r.speciesId}`}
                className="flex min-w-0 flex-1 flex-col items-center"
              >
                <span
                  className={cn(
                    'mb-1.5 whitespace-nowrap text-[10.5px] tabular-nums',
                    depleted ? 'text-zinc-600' : 'text-zinc-300',
                  )}
                >
                  {depleted ? '0' : formatMol(r.currentMol)}
                </span>

                <div
                  className={cn(
                    'relative flex w-full max-w-[38px] items-end border-b border-border/90',
                    isCanvas ? 'h-[68px]' : 'h-[82px]',
                  )}
                >
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 rounded-t-[3px] border-t border-dashed border-zinc-600/70 bg-zinc-800/35"
                    style={{ height: `${refPct}%` }}
                  />
                  <div
                    className="relative w-full rounded-t-[3px] transition-[height] duration-75"
                    style={{
                      height: `${fillPct}%`,
                      backgroundColor: r.barColor,
                      opacity: depleted ? 0 : 0.86,
                    }}
                  />
                </div>

                <span
                  className={cn(
                    'mt-1.5 max-w-full truncate whitespace-nowrap text-[11px] font-medium',
                    depleted ? 'text-zinc-500' : 'text-foreground',
                  )}
                >
                  <ReactionParticipantFormula p={r} />
                </span>
                <span className="h-3.5 text-[9.5px] text-muted-foreground">
                  {r.isLimiting ? 'limitant' : ''}
                </span>
              </div>
            )
          })}
        </div>

        <div className="flex shrink-0 items-center justify-center pb-5 text-zinc-500">
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.6} />
        </div>

        <div
          className="flex min-w-0 items-end justify-around gap-2"
          style={{ flex: Math.max(1, productBars.length) }}
        >
          {productBars.map((p) => {
            const fillPct = Math.min(100, (p.currentMol / maxScaleMol) * 100)
            const targetPct = Math.min(100, (p.referenceMol / maxScaleMol) * 100)
            const noneYet = p.currentMol <= 1e-7
            return (
              <div
                key={`bar-p-${p.speciesId}`}
                className="flex min-w-0 flex-1 flex-col items-center"
              >
                <span
                  className={cn(
                    'mb-1.5 whitespace-nowrap text-[10.5px] tabular-nums',
                    noneYet ? 'text-zinc-600' : 'text-zinc-200',
                  )}
                >
                  {noneYet ? '0' : formatMol(p.currentMol)}
                </span>

                <div
                  className={cn(
                    'relative flex w-full max-w-[38px] items-end border-b border-border/90',
                    isCanvas ? 'h-[68px]' : 'h-[82px]',
                  )}
                >
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 rounded-t-[3px] border-t border-dashed border-zinc-600/60"
                    style={{ height: `${targetPct}%` }}
                  />
                  <div
                    className="relative w-full rounded-t-[3px] transition-[height] duration-75"
                    style={{
                      height: `${fillPct}%`,
                      backgroundColor: p.barColor,
                      opacity: noneYet ? 0 : 0.9,
                    }}
                  />
                </div>

                <span
                  className={cn(
                    'mt-1.5 max-w-full truncate whitespace-nowrap text-[11px] font-medium',
                    noneYet ? 'text-zinc-500' : 'text-foreground',
                  )}
                >
                  <ReactionParticipantFormula p={p} />
                </span>
                <span className="h-3.5 text-[9.5px] text-muted-foreground">
                  {p.state === 'solid' ? 'dépôt' : p.state === 'gas' ? 'gaz ↑' : ''}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function ReactionStoichiometryTable({
  reactantBars,
  productBars,
  observationsFr,
}: {
  reactantBars: ReactionBarDatum[]
  productBars: ReactionBarDatum[]
  observationsFr: string | null
}) {
  return (
    <div className="mt-3 space-y-2.5 border-t border-border/60 pt-3">
      {observationsFr && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          <ChemText value={observationsFr} />
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left text-[11px] tabular-nums">
          <thead className="border-b border-border/70 text-[10px] text-muted-foreground">
            <tr>
              <th className="w-[34%] py-1.5 font-medium">Espèce</th>
              <th className="w-[22%] px-1.5 py-1.5 text-right font-medium">
                <ChemVar base="n" sub="0" />
              </th>
              <th className="w-[22%] px-1.5 py-1.5 text-right font-medium text-foreground">
                n(x)
              </th>
              <th className="w-[22%] py-1.5 text-right font-medium">
                <ChemVar base="n" sub="f" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {reactantBars.map((r) => (
              <tr key={`tbl-r-${r.speciesId}`}>
                <td className="whitespace-nowrap py-1.5 text-zinc-200">
                  <ReactionParticipantFormula p={r} />
                  {r.isLimiting && (
                    <span className="ml-1.5 text-[9.5px] text-muted-foreground">lim.</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right text-muted-foreground">
                  {formatMol(r.initialMol)}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-medium text-foreground">
                  {formatMol(r.currentMol)}
                </td>
                <td className="whitespace-nowrap py-1.5 text-right text-muted-foreground">
                  {formatMol(r.finalMol)}
                </td>
              </tr>
            ))}
            {productBars.map((p) => (
              <tr key={`tbl-p-${p.speciesId}`}>
                <td className="whitespace-nowrap py-1.5 text-zinc-200">
                  <ReactionParticipantFormula p={p} />
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right text-muted-foreground">
                  {formatMol(p.initialMol)}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-medium text-foreground">
                  {formatMol(p.currentMol)}
                </td>
                <td className="whitespace-nowrap py-1.5 text-right text-muted-foreground">
                  {formatMol(p.finalMol)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
