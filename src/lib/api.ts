import type {
  CatalogSummary,
  ElementRecord,
  EvaluateFlaskAdditionRequest,
  EvaluateFlaskAdditionResponse,
  FullCatalogResponse,
  IonizeRequest,
  IonizeResponse,
  LookupPubChemResponse,
  MatchLewisRequest,
  MatchLewisResponse,
  MergeAtomsRequest,
  MergeAtomsResponse,
  PredictReactionResponse,
  ReactionConstantsResponse,
  SpeciesRecord,
  VesselRecord,
} from '../../shared/chemistry.ts'
import {
  findLocalCustomSpeciesById,
  matchLocalCustomSpeciesByComposition,
  matchLocalCustomSpeciesByLewis,
} from '@/lib/local-store'

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...(import.meta.env.DEV ? { cache: 'no-store' as const } : {}),
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    throw new Error(`Erreur API (${res.status}) sur ${url}`)
  }
  return (await res.json()) as T
}

export const api = {
  getHealth: () => fetchJson<{ ok: boolean; summary: CatalogSummary }>('/api/health'),
  getCatalog: () => fetchJson<FullCatalogResponse>('/api/catalog'),
  getElements: () => fetchJson<{ elements: ElementRecord[] }>('/api/elements'),
  getSpecies: (mergeableOnly = false) =>
    fetchJson<{ species: SpeciesRecord[] }>(
      `/api/species${mergeableOnly ? '?mergeable=1' : ''}`,
    ),
  getSpeciesById: async (id: string) => {
    const local = findLocalCustomSpeciesById(id)
    if (local) return { species: local }
    return fetchJson<{ species: SpeciesRecord }>(`/api/species/${encodeURIComponent(id)}`)
  },
  getVessels: () => fetchJson<{ vessels: VesselRecord[] }>('/api/vessels'),
  mergeAtoms: async (payload: MergeAtomsRequest): Promise<MergeAtomsResponse> => {
    const res = await fetchJson<MergeAtomsResponse>('/api/species/merge', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (res.matched) return res
    const counts: Record<string, number> = {}
    if (payload.composition && Object.keys(payload.composition).length > 0) {
      for (const [sym, qty] of Object.entries(payload.composition)) {
        if (qty > 0) counts[sym] = (counts[sym] ?? 0) + qty
      }
    } else if (Array.isArray(payload.symbols)) {
      for (const sym of payload.symbols) {
        counts[sym] = (counts[sym] ?? 0) + 1
      }
    }
    const localCandidates = matchLocalCustomSpeciesByComposition(
      counts,
      payload.totalCharge ?? 0,
    )
    if (localCandidates.length === 0) return res
    return {
      matched: true,
      species: localCandidates[0],
      candidates: localCandidates,
      totalCandidatesCount: localCandidates.length,
      compositionFormula:
        localCandidates.length > 1
          ? res.compositionFormula
          : localCandidates[0].displayFormula,
    }
  },
  matchLewis: async (payload: MatchLewisRequest): Promise<MatchLewisResponse> => {
    const res = await fetchJson<MatchLewisResponse>('/api/species/match-lewis', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (res.matched) return res
    const localMatch = matchLocalCustomSpeciesByLewis(payload.atoms, payload.bonds)
    if (!localMatch || !localMatch.species.lewis) return res
    return {
      matched: true,
      exactLewisValid: localMatch.exactLewisValid,
      species: localMatch.species,
      expectedLewis: localMatch.species.lewis,
      issuesFr: localMatch.issuesFr,
    }
  },
  lookupPubChem: (payload: MatchLewisRequest) =>
    fetchJson<LookupPubChemResponse>('/api/species/lookup-pubchem', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  ionizeSpecies: (payload: IonizeRequest) =>
    fetchJson<IonizeResponse>('/api/species/ionize', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  evaluateFlaskAddition: (payload: EvaluateFlaskAdditionRequest) =>
    fetchJson<EvaluateFlaskAdditionResponse>('/api/solutions/evaluate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getReactionConstants: () =>
    fetchJson<ReactionConstantsResponse>('/api/reactions/constants'),
  predictReaction: (speciesAId: string, speciesBId: string, speciesCId?: string) =>
    fetchJson<PredictReactionResponse>('/api/reactions/predict', {
      method: 'POST',
      body: JSON.stringify({ speciesAId, speciesBId, speciesCId }),
    }),
}
