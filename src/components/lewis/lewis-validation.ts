import type {
  ElementRecord,
  LewisAtom,
  LewisBond,
} from '../../../shared/chemistry.ts'
import {
  CLIENT_VALENCE_ELECTRONS,
  computeExpectedFormalCharge,
  formatLewisCharge,
  getAtomBondOrderSum,
} from '@/lib/lewis-geometry'

export type LewisDiagnosticSeverity = 'error' | 'warning'

export interface LewisAtomDiagnostic {
  atomId: string
  symbol: string
  severity: LewisDiagnosticSeverity
  /** Tiny badge rendered beside the atom in strict mode (e.g. "!", "−2", "LP", "q") */
  shortBadge: string
  /** Concise one-line summary for sidebar / hover */
  summaryFr: string
  detailsFr: string[]
}

export interface LewisValidationResult {
  byAtomId: Map<string, LewisAtomDiagnostic>
  list: LewisAtomDiagnostic[]
  errorCount: number
  warningCount: number
}

const NOBLE_GASES = new Set(['He', 'Ne', 'Ar', 'Kr'])
const PERIOD2_OCTET = new Set(['C', 'N', 'O', 'F'])
const HYPOVALENT_SEXTET = new Set(['B', 'Al'])
const HYPERVALENT_12 = new Set(['Si', 'P', 'S', 'As', 'Se'])
const HYPERVALENT_14 = new Set(['Cl', 'Br', 'I', 'Xe'])

function plural(n: number, singular: string, pluralWord: string): string {
  return `${n} ${n > 1 ? pluralWord : singular}`
}

export function validateLewisDrawing(
  atoms: LewisAtom[],
  bonds: LewisBond[],
  elementsBySymbol: Map<string, ElementRecord>,
): LewisValidationResult {
  const byAtomId = new Map<string, LewisAtomDiagnostic>()
  const list: LewisAtomDiagnostic[] = []
  let errorCount = 0
  let warningCount = 0

  for (const atom of atoms) {
    const sym = atom.symbol
    const bondOrder = getAtomBondOrderSum(atom.id, bonds)
    const lp = Math.max(0, Math.trunc(atom.lonePairs))
    const shellE = bondOrder * 2 + lp * 2
    const valence =
      CLIENT_VALENCE_ELECTRONS[sym] ?? elementsBySymbol.get(sym)?.valenceElectrons
    const expectedCharge =
      valence !== undefined
        ? computeExpectedFormalCharge(sym, bondOrder, lp)
        : null

    const errors: string[] = []
    const warnings: string[] = []
    let badge: string | null = null

    if (NOBLE_GASES.has(sym)) {
      if (bondOrder > 0) {
        errors.push(`Gaz noble : ne forme pas de liaison covalente (${bondOrder} tracée${bondOrder > 1 ? 's' : ''})`)
        badge = '!'
      }
    } else if (sym === 'H') {
      if (shellE > 2) {
        errors.push(
          bondOrder > 1
            ? `Duet dépassé : ${bondOrder} liaisons (max 1 pour H)`
            : `Duet dépassé : ${shellE}/2 e⁻`,
        )
        badge = '!'
      } else if (shellE === 0 && atom.charge !== 1) {
        warnings.push('1 liaison manquante (duet incomplet : 0/2 e⁻)')
        badge = '−1'
      } else if (expectedCharge !== null && expectedCharge !== atom.charge) {
        warnings.push(
          `Charge formelle incohérente : attendue ${formatLewisCharge(expectedCharge) || '0'} (actuelle ${formatLewisCharge(atom.charge) || '0'})`,
        )
        badge = 'q'
      }
    } else if (sym === 'Be') {
      if (shellE > 8) {
        errors.push(`Octet dépassé (${shellE}/8 e⁻)`)
        badge = '!'
      } else if (shellE < 4 && atom.charge === 0) {
        const missingBonds = Math.max(1, 2 - bondOrder)
        warnings.push(`${plural(missingBonds, 'liaison manquante', 'liaisons manquantes')} (${shellE}/4 e⁻)`)
        badge = `−${missingBonds}`
      } else if (expectedCharge !== null && expectedCharge !== atom.charge) {
        warnings.push(
          `Charge formelle attendue : ${formatLewisCharge(expectedCharge) || '0'}`,
        )
        badge = 'q'
      }
    } else if (HYPOVALENT_SEXTET.has(sym)) {
      const targetShell = atom.charge < 0 ? 8 : 6
      if (shellE > 8) {
        errors.push(`Octet dépassé (${shellE}/8 e⁻) — impossible pour ${sym}`)
        badge = '!'
      } else if (shellE < targetShell) {
        const missingBonds = Math.max(1, Math.ceil((targetShell - shellE) / 2))
        warnings.push(
          `${plural(missingBonds, 'liaison manquante', 'liaisons manquantes')} (${shellE}/${targetShell} e⁻)`,
        )
        badge = `−${missingBonds}`
      } else if (expectedCharge !== null && expectedCharge !== atom.charge) {
        warnings.push(
          `Charge formelle attendue : ${formatLewisCharge(expectedCharge) || '0'}`,
        )
        badge = 'q'
      }
    } else if (PERIOD2_OCTET.has(sym) && valence !== undefined) {
      // Exact algebraic solution for octet (2B + 2L = 8) & formal charge (B + 2L = V - q)
      const ownedTarget = valence - atom.charge
      const neededBonds = Math.max(0, 8 - ownedTarget)
      const neededLp = Math.max(0, Math.floor((2 * ownedTarget - 8) / 2))

      if (shellE > 8) {
        errors.push(
          bondOrder > 4
            ? `Impossible : ${bondOrder} liaisons sur ${sym} (octet dépassé : ${shellE}/8 e⁻)`
            : `Octet dépassé (${shellE}/8 e⁻) — impossible en période 2`,
        )
        badge = '!'
      } else if (shellE < 8) {
        if (bondOrder < neededBonds) {
          const missB = neededBonds - bondOrder
          warnings.push(
            `${plural(missB, 'liaison manquante', 'liaisons manquantes')} (${shellE}/8 e⁻)`,
          )
          badge = `−${missB}`
        }
        if (lp < neededLp) {
          const missLp = neededLp - lp
          warnings.push(
            `${plural(missLp, 'doublet non liant manquant', 'doublets non liants manquants')} (${lp}/${neededLp})`,
          )
          if (!badge) badge = 'LP'
        }
        if (warnings.length === 0) {
          warnings.push(`Octet incomplet (${shellE}/8 e⁻)`)
          badge = '!'
        }
      } else if (expectedCharge !== null && expectedCharge !== atom.charge) {
        warnings.push(
          `Charge formelle incohérente : attendue ${formatLewisCharge(expectedCharge) || '0'} (actuelle ${formatLewisCharge(atom.charge) || '0'})`,
        )
        badge = 'q'
      }
    } else if (
      (HYPERVALENT_12.has(sym) || HYPERVALENT_14.has(sym)) &&
      valence !== undefined
    ) {
      const maxShell = HYPERVALENT_14.has(sym) ? 14 : 12
      const ownedTarget = valence - atom.charge
      const neededBonds = Math.max(0, 8 - ownedTarget)
      const neededLp = Math.max(0, Math.floor((2 * ownedTarget - 8) / 2))

      if (shellE > maxShell) {
        errors.push(
          `Couche de valence dépassée (${shellE}/${maxShell} e⁻ max pour ${sym})`,
        )
        badge = '!'
      } else if (shellE < 8) {
        if (bondOrder < neededBonds) {
          const missB = neededBonds - bondOrder
          warnings.push(
            `${plural(missB, 'liaison manquante', 'liaisons manquantes')} (${shellE}/8 e⁻)`,
          )
          badge = `−${missB}`
        }
        if (lp < neededLp) {
          const missLp = neededLp - lp
          warnings.push(
            `${plural(missLp, 'doublet non liant manquant', 'doublets non liants manquants')} (${lp}/${neededLp})`,
          )
          if (!badge) badge = 'LP'
        }
        if (warnings.length === 0) {
          warnings.push(`Octet incomplet (${shellE}/8 e⁻)`)
          badge = '!'
        }
      } else if (expectedCharge !== null && expectedCharge !== atom.charge) {
        warnings.push(
          `Charge formelle incohérente : attendue ${formatLewisCharge(expectedCharge) || '0'} (actuelle ${formatLewisCharge(atom.charge) || '0'})`,
        )
        badge = 'q'
      }
    } else if (expectedCharge !== null && bondOrder > 0 && expectedCharge !== atom.charge) {
      // Other main-group / alkali metals bonded covalently with unexpected formal charge
      warnings.push(
        `Charge formelle attendue : ${formatLewisCharge(expectedCharge) || '0'}`,
      )
      badge = 'q'
    }

    if (errors.length > 0 || warnings.length > 0) {
      const severity: LewisDiagnosticSeverity = errors.length > 0 ? 'error' : 'warning'
      const detailsFr = [...errors, ...warnings]
      const diag: LewisAtomDiagnostic = {
        atomId: atom.id,
        symbol: sym,
        severity,
        shortBadge: badge ?? '!',
        summaryFr: detailsFr[0],
        detailsFr,
      }
      byAtomId.set(atom.id, diag)
      list.push(diag)
      if (severity === 'error') errorCount++
      else warningCount++
    }
  }

  return { byAtomId, list, errorCount, warningCount }
}
