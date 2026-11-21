import type {
  LewisAtom,
  LewisBond,
  SpeciesRecord,
  WorkspaceSnapshot,
} from '../../shared/chemistry.ts'
import { buildCanonicalSignature } from '@/lib/chemistry-calc'

const WORKSPACE_STORAGE_KEY = 'deltalab:workspace:v1'
const CUSTOM_SPECIES_STORAGE_KEY = 'deltalab:custom-species:v1'
const MAX_CUSTOM_SPECIES = 250

const EMPTY_WORKSPACE: WorkspaceSnapshot = {
  nodes: [],
  discoveredSpeciesIds: [],
}

export function loadLocalWorkspace(): WorkspaceSnapshot {
  if (typeof window === 'undefined') return EMPTY_WORKSPACE
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
    if (!raw) return EMPTY_WORKSPACE
    const parsed = JSON.parse(raw) as Partial<WorkspaceSnapshot>
    return {
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      discoveredSpeciesIds: Array.isArray(parsed.discoveredSpeciesIds)
        ? parsed.discoveredSpeciesIds.map(String)
        : [],
    }
  } catch {
    return EMPTY_WORKSPACE
  }
}

export function saveLocalWorkspace(snapshot: WorkspaceSnapshot): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // ignore storage quota or private mode errors
  }
}

export function loadLocalCustomSpecies(): SpeciesRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CUSTOM_SPECIES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is SpeciesRecord =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as SpeciesRecord).id === 'string' &&
        typeof (item as SpeciesRecord).formula === 'string',
    )
  } catch {
    return []
  }
}

export function saveLocalCustomSpecies(list: SpeciesRecord[]): void {
  if (typeof window === 'undefined') return
  try {
    const trimmed = list.slice(0, MAX_CUSTOM_SPECIES)
    window.localStorage.setItem(CUSTOM_SPECIES_STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // ignore storage quota or private mode errors
  }
}

export function upsertLocalCustomSpecies(
  list: SpeciesRecord[],
  species: SpeciesRecord,
): SpeciesRecord[] {
  const filtered = list.filter((item) => {
    if (item.id === species.id) return false
    if (species.inchikey && item.inchikey && item.inchikey === species.inchikey) {
      return false
    }
    return true
  })
  return [species, ...filtered].slice(0, MAX_CUSTOM_SPECIES)
}

export function findLocalCustomSpeciesById(id: string): SpeciesRecord | undefined {
  return loadLocalCustomSpecies().find((sp) => sp.id === id)
}

export function matchLocalCustomSpeciesByComposition(
  composition: Record<string, number>,
  totalCharge: number,
): SpeciesRecord[] {
  const targetSig = buildCanonicalSignature(composition)
  if (!targetSig) return []
  return loadLocalCustomSpecies().filter(
    (sp) =>
      sp.charge === totalCharge &&
      buildCanonicalSignature(sp.composition) === targetSig,
  )
}

function buildGraphDegreeSignature(atoms: LewisAtom[], bonds: LewisBond[]): string {
  const adj = new Map<string, string[]>()
  const atomById = new Map<string, LewisAtom>()
  for (const a of atoms) {
    atomById.set(a.id, a)
    adj.set(a.id, [])
  }
  for (const b of bonds) {
    const a1 = atomById.get(b.from)
    const a2 = atomById.get(b.to)
    if (!a1 || !a2) continue
    adj.get(b.from)?.push(`${b.order}:${a2.symbol}`)
    adj.get(b.to)?.push(`${b.order}:${a1.symbol}`)
  }
  const descriptors = atoms.map((a) => {
    const neighbors = (adj.get(a.id) ?? []).sort().join(',')
    return `${a.symbol}(${a.charge})[${neighbors}]`
  })
  descriptors.sort()
  return descriptors.join('|')
}

export function matchLocalCustomSpeciesByLewis(
  atoms: LewisAtom[],
  bonds: LewisBond[],
): { species: SpeciesRecord; exactLewisValid: boolean; issuesFr: string[] } | null {
  if (atoms.length === 0) return null
  const drawnSig = buildGraphDegreeSignature(atoms, bonds)
  const list = loadLocalCustomSpecies()
  for (const sp of list) {
    if (!sp.lewis) continue
    if (sp.lewis.atoms.length !== atoms.length || sp.lewis.bonds.length !== bonds.length) {
      continue
    }
    if (buildGraphDegreeSignature(sp.lewis.atoms, sp.lewis.bonds) === drawnSig) {
      const expectedLP = sp.lewis.atoms.reduce((sum, a) => sum + a.lonePairs, 0)
      const drawnLP = atoms.reduce((sum, a) => sum + a.lonePairs, 0)
      const issuesFr: string[] = []
      if (drawnLP !== expectedLP) {
        issuesFr.push(
          `Doublets non liants : ${expectedLP} attendus au total (actuellement ${drawnLP}).`,
        )
      }
      return {
        species: sp,
        exactLewisValid: issuesFr.length === 0,
        issuesFr,
      }
    }
  }
  return null
}
