import type {
  ElementRecord,
  IonizeRequest,
  IonizeResponse,
  LewisAtom,
  LewisBond,
  MatchLewisRequest,
  MatchLewisResponse,
  MergeAtomsRequest,
  MergeAtomsResponse,
  SpeciesRecord,
} from '../../shared/chemistry.ts'
import { computeLewisTopologyKey, validateLewisElectrons } from '../data/lewis.ts'
import { buildCompositionKey } from '../data/types.ts'
import { toSubscript } from '../lib/math-format.ts'
import {
  type RawElementRow,
  type RawSpeciesRow,
  mapElementRow,
  mapSpeciesRow,
} from './catalog.ts'
import { getDb } from './connection.ts'

export function formatHillFormula(composition: Record<string, number>): string {
  const entries = Object.entries(composition).filter(([, c]) => c > 0)
  const hasCarbon = entries.some(([sym]) => sym === 'C')
  entries.sort(([a], [b]) => {
    if (hasCarbon) {
      if (a === 'C') return -1
      if (b === 'C') return 1
      if (a === 'H') return -1
      if (b === 'H') return 1
    }
    return a.localeCompare(b)
  })
  return entries
    .map(([sym, count]) => (count === 1 ? sym : `${sym}${toSubscript(count)}`))
    .join('')
}

function sanitizeLewisInput(req: MatchLewisRequest): {
  atoms: LewisAtom[]
  bonds: LewisBond[]
} {
  const atoms: LewisAtom[] = Array.isArray(req.atoms)
    ? req.atoms
        .filter((a) => a && typeof a.symbol === 'string' && a.symbol.trim().length > 0)
        .map((a, idx) => ({
          id: typeof a.id === 'string' && a.id ? a.id : `a${idx}`,
          symbol: a.symbol.trim(),
          x: Number.isFinite(a.x) ? a.x : 0,
          y: Number.isFinite(a.y) ? a.y : 0,
          lonePairs: Number.isFinite(a.lonePairs)
            ? Math.max(0, Math.trunc(a.lonePairs))
            : 0,
          charge: Number.isFinite(a.charge) ? Math.trunc(a.charge) : 0,
        }))
    : []

  const atomIds = new Set(atoms.map((a) => a.id))
  const bonds: LewisBond[] = Array.isArray(req.bonds)
    ? req.bonds
        .filter(
          (b) =>
            b &&
            atomIds.has(b.from) &&
            atomIds.has(b.to) &&
            b.from !== b.to &&
            (b.order === 1 || b.order === 2 || b.order === 3),
        )
        .map((b) => ({ from: b.from, to: b.to, order: b.order }))
    : []

  return { atoms, bonds }
}

export function mergeAtoms(req: MergeAtomsRequest | string[]): MergeAtomsResponse {
  const counts: Record<string, number> = {}
  let totalCharge = 0

  if (Array.isArray(req)) {
    for (const sym of req) {
      const trimmed = sym.trim()
      if (!trimmed) continue
      counts[trimmed] = (counts[trimmed] ?? 0) + 1
    }
  } else {
    totalCharge = Number.isFinite(req.totalCharge) ? Math.trunc(req.totalCharge ?? 0) : 0
    if (req.composition && Object.keys(req.composition).length > 0) {
      for (const [sym, qty] of Object.entries(req.composition)) {
        const trimmed = sym.trim()
        if (trimmed && qty > 0) counts[trimmed] = (counts[trimmed] ?? 0) + qty
      }
    } else if (Array.isArray(req.symbols)) {
      for (const sym of req.symbols) {
        const trimmed = sym.trim()
        if (!trimmed) continue
        counts[trimmed] = (counts[trimmed] ?? 0) + 1
      }
    }
  }

  const totalAtomCount = Object.values(counts).reduce((a, b) => a + b, 0)
  const atomSignature = buildCompositionKey(counts)
  const compositionFormula = formatHillFormula(counts)

  if (!atomSignature || (totalAtomCount < 2 && totalCharge === 0)) {
    return {
      matched: false,
      compositionFormula,
      reasonFr: 'Sélectionnez au moins deux espèces à fusionner.',
    }
  }

  const db = getDb()
  const rows = db
    .prepare(
      'SELECT * FROM species WHERE atom_signature = ? AND charge = ? ORDER BY popularity DESC, is_solvent DESC, name_fr ASC',
    )
    .all(atomSignature, totalCharge) as unknown as RawSpeciesRow[]

  if (rows.length === 0) {
    if (totalCharge !== 0) {
      const chargeLabel = totalCharge > 0 ? `+${totalCharge}` : `${totalCharge}`
      return {
        matched: false,
        compositionFormula,
        reasonFr: `Aucune espèce répertoriée pour ${compositionFormula} (charge ${chargeLabel}).`,
      }
    }
    return {
      matched: false,
      compositionFormula,
      reasonFr: `Aucune espèce répertoriée pour ${compositionFormula}.`,
    }
  }

  const candidates = rows.slice(0, 24).map(mapSpeciesRow)
  return {
    matched: true,
    species: candidates[0],
    candidates,
    totalCandidatesCount: rows.length,
    compositionFormula:
      candidates.length > 1 ? compositionFormula : candidates[0].displayFormula,
  }
}

export function matchLewisStructure(req: MatchLewisRequest): MatchLewisResponse {
  const { atoms, bonds } = sanitizeLewisInput(req)

  const counts: Record<string, number> = {}
  let totalCharge = 0
  for (const atom of atoms) {
    counts[atom.symbol] = (counts[atom.symbol] ?? 0) + 1
    totalCharge += atom.charge
  }
  const atomSignature = buildCompositionKey(counts)
  const compositionFormula = formatHillFormula(counts)

  if (atoms.length === 0) {
    return {
      matched: false,
      compositionFormula: '',
      totalCharge: 0,
      sameFormulaSpecies: [],
      reasonFr:
        'Placez des atomes sur le plan de travail pour construire un schéma de Lewis.',
    }
  }

  const db = getDb()
  const topologyKey = computeLewisTopologyKey(atoms, bonds, false)

  const exactRow = db
    .prepare(
      'SELECT * FROM species WHERE lewis_topology_key = ? ORDER BY popularity DESC LIMIT 1',
    )
    .get(topologyKey) as unknown as RawSpeciesRow | undefined

  if (exactRow) {
    const species = mapSpeciesRow(exactRow)
    const expectedLewis = species.lewis!
    const { exactLewisValid, issuesFr } = validateLewisElectrons(
      { atoms, bonds },
      expectedLewis,
    )
    return { matched: true, exactLewisValid, species, expectedLewis, issuesFr }
  }

  const sameFormulaRows = db
    .prepare(
      'SELECT * FROM species WHERE atom_signature = ? AND charge = ? ORDER BY popularity DESC, is_solvent DESC, name_fr ASC',
    )
    .all(atomSignature, totalCharge) as unknown as RawSpeciesRow[]
  const sameFormulaMapped = sameFormulaRows.map(mapSpeciesRow)

  // Fallback: bond-order-agnostic skeleton connectivity (including Kekulé aromatic equivalence)
  if (sameFormulaMapped.length > 0 && bonds.length > 0) {
    const drawnSkeleton = computeLewisTopologyKey(atoms, bonds, true)
    const skeletonMatches = sameFormulaMapped.filter(
      (sp) =>
        sp.lewis &&
        computeLewisTopologyKey(sp.lewis.atoms, sp.lewis.bonds, true) === drawnSkeleton,
    )
    if (skeletonMatches.length === 1) {
      const species = skeletonMatches[0]
      const expectedLewis = species.lewis!
      const expectedTotalOrders = expectedLewis.bonds.reduce((s, b) => s + b.order, 0)
      const drawnTotalOrders = bonds.reduce((s, b) => s + b.order, 0)
      const expectedTotalLP = expectedLewis.atoms.reduce((s, a) => s + a.lonePairs, 0)
      const drawnTotalLP = atoms.reduce((s, a) => s + a.lonePairs, 0)

      // Check if every atom has identical total bond order sum + lone pairs (e.g. rotated Kekulé benzene)
      const isKekuleEquivalent =
        drawnTotalOrders === expectedTotalOrders &&
        drawnTotalLP === expectedTotalLP &&
        atoms.every((a) => {
          const orderSum = bonds.reduce(
            (sum, b) => (b.from === a.id || b.to === a.id ? sum + b.order : sum),
            0,
          )
          return a.symbol === 'C' ? orderSum === 4 && a.lonePairs === 0 : orderSum >= 1
        })

      return {
        matched: true,
        exactLewisValid: isKekuleEquivalent,
        species,
        expectedLewis,
        issuesFr: isKekuleEquivalent
          ? []
          : [
              'Squelette reconnu, mais vérifiez l’ordre des liaisons (simples, doubles ou triples) et les doublets non liants.',
            ],
      }
    }
  }

  const chargeText =
    totalCharge === 0
      ? ''
      : ` (charge ${totalCharge > 0 ? `+${totalCharge}` : totalCharge})`

  return {
    matched: false,
    compositionFormula,
    totalCharge,
    sameFormulaSpecies: sameFormulaMapped.slice(0, 10).map((sp) => ({
      id: sp.id,
      displayFormula: sp.displayFormula,
      nameFr: sp.nameFr,
    })),
    reasonFr:
      sameFormulaMapped.length > 0
        ? `La formule ${compositionFormula}${chargeText} existe en base, mais l’enchaînement des liaisons ne correspond à aucun isomère répertorié.`
        : `Aucune espèce répertoriée en base pour ce schéma (${compositionFormula}${chargeText}).`,
  }
}

export function ionizeComposition(req: IonizeRequest): IonizeResponse {
  const counts: Record<string, number> = {}
  for (const [sym, qty] of Object.entries(req.composition)) {
    const trimmed = sym.trim()
    if (trimmed && qty > 0) counts[trimmed] = (counts[trimmed] ?? 0) + qty
  }

  const atomSignature = buildCompositionKey(counts)
  const formula = formatHillFormula(counts)
  if (!atomSignature) {
    return { ok: false, reasonFr: 'Aucune espèce sélectionnée à ioniser.' }
  }

  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM species WHERE atom_signature = ? ORDER BY charge ASC')
    .all(atomSignature) as unknown as RawSpeciesRow[]

  const entries = Object.entries(counts)
  const singleElementSymbol =
    entries.length === 1 && entries[0][1] === 1 ? entries[0][0] : null
  const neutralElementRow = singleElementSymbol
    ? (db
        .prepare('SELECT * FROM elements WHERE symbol = ?')
        .get(singleElementSymbol) as unknown as RawElementRow | undefined)
    : undefined

  type ChargeOption =
    | { charge: number; kind: 'species'; species: SpeciesRecord }
    | { charge: number; kind: 'element'; element: ElementRecord }

  const optionsByCharge = new Map<number, ChargeOption>()
  for (const r of rows) {
    const mapped = mapSpeciesRow(r)
    if (neutralElementRow && mapped.charge === 0) continue
    optionsByCharge.set(mapped.charge, {
      charge: mapped.charge,
      kind: 'species',
      species: mapped,
    })
  }
  if (neutralElementRow) {
    optionsByCharge.set(0, {
      charge: 0,
      kind: 'element',
      element: mapElementRow(neutralElementRow),
    })
  }

  const sortedCharges = [...optionsByCharge.keys()].sort((a, b) => a - b)
  const targetCharge =
    req.direction > 0
      ? sortedCharges.find((c) => c > req.currentCharge)
      : [...sortedCharges].reverse().find((c) => c < req.currentCharge)

  if (targetCharge === undefined) {
    const hasAnyIon = sortedCharges.some((c) => c !== 0)
    if (!hasAnyIon) {
      if (neutralElementRow?.category === 'noble-gas') {
        return {
          ok: false,
          reasonFr: `${neutralElementRow.symbol} (${neutralElementRow.name_fr}) est un gaz noble : aucun ion stable.`,
        }
      }
      return {
        ok: false,
        reasonFr: `Aucun ion répertorié en base pour ${formula}.`,
      }
    }
    return {
      ok: false,
      reasonFr:
        req.direction > 0
          ? `Aucun état plus oxydé répertorié pour ${formula}.`
          : `Aucun état plus réduit répertorié pour ${formula}.`,
    }
  }

  const chosen = optionsByCharge.get(targetCharge)!
  if (chosen.kind === 'element') {
    return {
      ok: true,
      resultKind: 'neutral_atom',
      element: chosen.element,
      messageFr: `Retour à l’atome neutre ${chosen.element.symbol} (${chosen.element.nameFr}).`,
    }
  }

  if (chosen.species.charge === 0) {
    return {
      ok: true,
      resultKind: 'neutral_species',
      species: chosen.species,
      messageFr: `${chosen.species.displayFormula} · ${chosen.species.nameFr}`,
    }
  }

  const delta = chosen.species.charge - req.currentCharge
  const eCount = Math.abs(delta)
  const eText = delta > 0 ? `−${eCount} e⁻` : `+${eCount} e⁻`
  return {
    ok: true,
    resultKind: 'ion',
    species: chosen.species,
    messageFr: `${chosen.species.displayFormula} · ${chosen.species.nameFr} (${eText})`,
  }
}
