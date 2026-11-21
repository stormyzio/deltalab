import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const UNICODE_SUB_MAP: Record<string, string> = {
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
  '₊': '+',
  '₋': '−',
  'ₑ': 'e',
  'ₘ': 'm',
  'ₐ': 'a',
  'ₓ': 'x',
  'ₙ': 'n',
}

const UNICODE_SUP_MAP: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁺': '+',
  '⁻': '−',
}

function decodeSub(raw: string): string {
  return [...raw].map((ch) => UNICODE_SUB_MAP[ch] ?? ch).join('')
}

function decodeSup(raw: string): string {
  return [...raw].map((ch) => UNICODE_SUP_MAP[ch] ?? ch).join('')
}

/**
 * Semantic subscript with zero line-height inflation.
 */
export function Sub({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <sub
      className={cn(
        'relative top-[0.26em] align-baseline text-[0.72em] leading-none font-normal',
        className,
      )}
    >
      {children}
    </sub>
  )
}

/**
 * Semantic superscript with zero line-height inflation.
 */
export function Sup({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <sup
      className={cn(
        'relative -top-[0.44em] align-baseline text-[0.72em] leading-none font-normal',
        className,
      )}
    >
      {children}
    </sup>
  )
}

/**
 * Stacked right-side superscript over subscript (e.g. SO₄²⁻, Cr₂O₇²⁻, x_max^2).
 */
function RightSubSupStack({
  sup,
  sub,
}: {
  sup: ReactNode
  sub: ReactNode
}) {
  return (
    <span className="ml-[0.04em] inline-flex flex-col items-start justify-center align-middle text-[0.64em] leading-[1.02] font-normal tabular-nums">
      <span>{sup}</span>
      <span>{sub}</span>
    </span>
  )
}

/**
 * Clean scientific/chemistry variable with true sub/superscripts:
 *   <ChemVar base="x" sub="max" />  -> x_max
 *   <ChemVar base="C" sub="m" />    -> C_m
 *   <ChemVar base="V" sub="E" />    -> V_E
 *   <ChemVar base="E" sup="°" />    -> E°
 */
export function ChemVar({
  base,
  sub,
  sup,
  className,
}: {
  base: ReactNode
  sub?: ReactNode
  sup?: ReactNode
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-baseline whitespace-nowrap', className)}>
      <span>{base}</span>
      {sub !== undefined && sup !== undefined ? (
        <RightSubSupStack sup={sup} sub={sub} />
      ) : (
        <>
          {sub !== undefined && <Sub>{sub}</Sub>}
          {sup !== undefined && <Sup>{sup}</Sup>}
        </>
      )}
    </span>
  )
}

/**
 * Textbook nuclear / isotope notation with A stacked strictly above Z on the left
 * of the element symbol, plus optional ionic charge on the right:
 *   <Nuclide symbol="Cl" A={35} Z={17} />       ->  ³⁵/₁₇ Cl
 *   <Nuclide symbol="Fe" A={56} Z={26} charge={3} />
 */
export function Nuclide({
  symbol,
  A,
  Z,
  charge,
  className,
}: {
  symbol: string
  A: number | string
  Z: number | string
  charge?: number | string
  className?: string
}) {
  const chargeText =
    charge === undefined || charge === 0 || charge === ''
      ? null
      : typeof charge === 'number'
        ? charge === 1
          ? '+'
          : charge === -1
            ? '−'
            : charge > 0
              ? `${charge}+`
              : `${Math.abs(charge)}−`
        : charge

  return (
    <span className={cn('inline-flex items-center whitespace-nowrap leading-none', className)}>
      <span className="mr-[0.12em] inline-flex flex-col items-end justify-between text-[0.58em] leading-[1.02] font-normal tabular-nums text-muted-foreground">
        <span>{A}</span>
        <span>{Z}</span>
      </span>
      <span className="font-semibold leading-none">{symbol}</span>
      {chargeText && <Sup className="ml-[0.04em]">{chargeText}</Sup>}
    </span>
  )
}

export type PhysicalStateShorthand =
  | 'solid'
  | 'liquid'
  | 'gas'
  | 'aqueous'
  | 's'
  | 'l'
  | 'g'
  | 'aq'

const STATE_SHORTHAND_MAP: Record<PhysicalStateShorthand, string> = {
  solid: '(s)',
  s: '(s)',
  liquid: '(l)',
  l: '(l)',
  gas: '(g)',
  g: '(g)',
  aqueous: '(aq)',
  aq: '(aq)',
}

/**
 * Uniform, crisp physical state notation: (s), (l), (g), (aq).
 */
export function StateTag({
  state,
  className,
}: {
  state: PhysicalStateShorthand
  className?: string
}) {
  return (
    <span
      className={cn(
        'relative top-[0.12em] ml-[0.08em] align-baseline font-mono text-[0.72em] leading-none font-normal text-muted-foreground',
        className,
      )}
    >
      {STATE_SHORTHAND_MAP[state]}
    </span>
  )
}

type FormulaToken =
  | { kind: 'text'; text: string }
  | { kind: 'sub'; text: string }
  | { kind: 'sup'; text: string }
  | { kind: 'subsup'; sub: string; sup: string }
  | { kind: 'state'; state: 's' | 'l' | 'g' | 'aq' }

const TOKEN_REGEX =
  /\((aq|s|l|g)\)|([₀-₉]+)([⁰-⁹]*[⁺⁻])|([₀-₉]+)|([⁰-⁹]*[⁺⁻]|[⁰-⁹]+)|\^([0-9]*[+-−]|[0-9]+)|([A-Za-z)\]])([0-9]+)(?:\^([0-9]*[+-−]))?/g

function tokenizeChemFormula(input: string): FormulaToken[] {
  const tokens: FormulaToken[] = []
  let lastIdx = 0
  TOKEN_REGEX.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = TOKEN_REGEX.exec(input)) !== null) {
    if (match.index > lastIdx) {
      tokens.push({ kind: 'text', text: input.slice(lastIdx, match.index) })
    }

    const [
      ,
      stateMatch,
      uniSubWithSup,
      uniSupAfterSub,
      uniSubOnly,
      uniSupOnly,
      caretSup,
      asciiLead,
      asciiSub,
      asciiCaretSup,
    ] = match

    if (stateMatch) {
      tokens.push({ kind: 'state', state: stateMatch as 's' | 'l' | 'g' | 'aq' })
    } else if (uniSubWithSup && uniSupAfterSub) {
      tokens.push({
        kind: 'subsup',
        sub: decodeSub(uniSubWithSup),
        sup: decodeSup(uniSupAfterSub),
      })
    } else if (uniSubOnly) {
      tokens.push({ kind: 'sub', text: decodeSub(uniSubOnly) })
    } else if (uniSupOnly) {
      tokens.push({ kind: 'sup', text: decodeSup(uniSupOnly) })
    } else if (caretSup) {
      tokens.push({ kind: 'sup', text: caretSup.replace(/-/g, '−') })
    } else if (asciiLead && asciiSub) {
      tokens.push({ kind: 'text', text: asciiLead })
      if (asciiCaretSup) {
        tokens.push({
          kind: 'subsup',
          sub: asciiSub,
          sup: asciiCaretSup.replace(/-/g, '−'),
        })
      } else {
        tokens.push({ kind: 'sub', text: asciiSub })
      }
    }

    lastIdx = TOKEN_REGEX.lastIndex
  }

  if (lastIdx < input.length) {
    tokens.push({ kind: 'text', text: input.slice(lastIdx) })
  }
  return tokens
}

/**
 * Renders any chemical formula, ion, or full reaction equation cleanly using
 * real HTML <sub>/<sup>, vertically stacked ion sub+charge (e.g. SO₄²⁻),
 * and uniform (s)/(l)/(g)/(aq) state tags.
 * Accepts both Unicode formulas from SQLite ("Fe₂(SO₄)₃", "MnO₄⁻") and ASCII ("H2SO4", "SO4^2-").
 */
export function ChemFormula({
  value,
  state,
  className,
}: {
  value: string
  state?: PhysicalStateShorthand | null
  className?: string
}) {
  const tokens = tokenizeChemFormula(value)
  return (
    <span className={cn('inline', className)}>
      {tokens.map((tok, idx) => {
        if (tok.kind === 'text') return <Fragment key={idx}>{tok.text}</Fragment>
        if (tok.kind === 'sub') return <Sub key={idx}>{tok.text}</Sub>
        if (tok.kind === 'sup') return <Sup key={idx}>{tok.text}</Sup>
        if (tok.kind === 'subsup') {
          return <RightSubSupStack key={idx} sup={tok.sup} sub={tok.sub} />
        }
        return <StateTag key={idx} state={tok.state} />
      })}
      {state && <StateTag state={state} />}
    </span>
  )
}

/**
 * Renders an electron configuration like "[Ne] 3s² 3p⁵" or "1s2 2s2 2p6"
 * with real HTML <sup> exponents instead of mismatched Unicode superscripts.
 */
export function ElectronConfig({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  const parts = value.trim().split(/\s+/)
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-[0.35em]', className)}>
      {parts.map((part, idx) => {
        const m = part.match(/^(\d[spdfg])([⁰-⁹]+|\d+)$/)
        if (!m) {
          return <span key={idx}>{part}</span>
        }
        return (
          <span key={idx} className="whitespace-nowrap">
            {m[1]}
            <Sup>{decodeSup(m[2])}</Sup>
          </span>
        )
      })}
    </span>
  )
}
