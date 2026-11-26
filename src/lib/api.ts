import type {
  CatalogSummary,
  ElementRecord,
  EvaluateFlaskAdditionRequest,
  EvaluateFlaskAdditionResponse,
  FullCatalogResponse,
  IonizeRequest,
  IonizeResponse,
  MatchLewisRequest,
  MatchLewisResponse,
  MergeAtomsRequest,
  MergeAtomsResponse,
  PredictReactionResponse,
  ReactionConstantsResponse,
  SpeciesRecord,
  VesselRecord,
} from '../../shared/chemistry.ts'

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
  getSpeciesById: (id: string) =>
    fetchJson<{ species: SpeciesRecord }>(`/api/species/${encodeURIComponent(id)}`),
  getVessels: () => fetchJson<{ vessels: VesselRecord[] }>('/api/vessels'),
  mergeAtoms: (payload: MergeAtomsRequest) =>
    fetchJson<MergeAtomsResponse>('/api/species/merge', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  matchLewis: (payload: MatchLewisRequest) =>
    fetchJson<MatchLewisResponse>('/api/species/match-lewis', {
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
  predictReactions: (
    speciesIds: string[],
    options?: { includeContexts?: boolean },
  ) =>
    fetchJson<PredictReactionResponse>('/api/reactions/predict', {
      method: 'POST',
      body: JSON.stringify({
        speciesIds,
        ...(options?.includeContexts ? { includeContexts: true } : {}),
      }),
    }),
  predictReaction: (speciesAId: string, speciesBId: string, speciesCId?: string) =>
    fetchJson<PredictReactionResponse>('/api/reactions/predict', {
      method: 'POST',
      body: JSON.stringify({ speciesAId, speciesBId, speciesCId }),
    }),
}
