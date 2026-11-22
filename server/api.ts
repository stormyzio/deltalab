import { Hono } from 'hono'
import type {
  EvaluateFlaskAdditionRequest,
  IonizeRequest,
  MatchLewisRequest,
  MergeAtomsRequest,
  WorkspaceSnapshot,
} from '../shared/chemistry.ts'
import {
  evaluateFlaskAddition,
  getCatalogSummary,
  getFullCatalog,
  getReactionConstants,
  getSpeciesById,
  getWorkspaceSnapshot,
  ionizeComposition,
  listElements,
  listSpecies,
  listVessels,
  lookupAndCachePubChem,
  matchLewisStructure,
  mergeAtoms,
  predictReactionByIds,
  saveWorkspaceSnapshot,
} from './db.ts'

export const apiApp = new Hono()

apiApp.get('/api/health', (c) => {
  return c.json({ ok: true, summary: getCatalogSummary() })
})

const CATALOG_CACHE_HEADER =
  process.env.VERCEL === '1'
    ? 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
    : 'no-store'

apiApp.get('/api/catalog', (c) => {
  c.header('Cache-Control', CATALOG_CACHE_HEADER)
  return c.json(getFullCatalog())
})

apiApp.get('/api/elements', (c) => {
  c.header('Cache-Control', CATALOG_CACHE_HEADER)
  return c.json({ elements: listElements() })
})

apiApp.get('/api/species', (c) => {
  const mergeableOnly = c.req.query('mergeable') === '1'
  return c.json({ species: listSpecies(mergeableOnly, false) })
})

apiApp.get('/api/species/:id', (c) => {
  const id = c.req.param('id')
  const species = getSpeciesById(id)
  if (!species) {
    return c.json({ error: 'Espèce introuvable.' }, 404)
  }
  return c.json({ species })
})

apiApp.get('/api/vessels', (c) => {
  return c.json({ vessels: listVessels() })
})

apiApp.post('/api/species/merge', async (c) => {
  const body = (await c.req.json()) as Partial<MergeAtomsRequest>
  const result = mergeAtoms({
    symbols: Array.isArray(body.symbols) ? body.symbols.map(String) : undefined,
    composition:
      body.composition && typeof body.composition === 'object'
        ? body.composition
        : undefined,
    totalCharge: typeof body.totalCharge === 'number' ? body.totalCharge : 0,
  })
  return c.json(result)
})

apiApp.post('/api/species/match-lewis', async (c) => {
  const body = (await c.req.json()) as Partial<MatchLewisRequest>
  const result = matchLewisStructure({
    atoms: Array.isArray(body.atoms) ? body.atoms : [],
    bonds: Array.isArray(body.bonds) ? body.bonds : [],
  })
  return c.json(result)
})

apiApp.post('/api/species/lookup-pubchem', async (c) => {
  const body = (await c.req.json()) as Partial<MatchLewisRequest>
  const result = await lookupAndCachePubChem({
    atoms: Array.isArray(body.atoms) ? body.atoms : [],
    bonds: Array.isArray(body.bonds) ? body.bonds : [],
  })
  return c.json(result)
})

apiApp.post('/api/species/ionize', async (c) => {
  const body = (await c.req.json()) as Partial<IonizeRequest>
  const direction = body.direction === -1 ? -1 : 1
  const result = ionizeComposition({
    composition:
      body.composition && typeof body.composition === 'object' ? body.composition : {},
    currentCharge: typeof body.currentCharge === 'number' ? body.currentCharge : 0,
    direction,
  })
  return c.json(result)
})

apiApp.post('/api/solutions/evaluate', async (c) => {
  const body = (await c.req.json()) as Partial<EvaluateFlaskAdditionRequest>
  const result = evaluateFlaskAddition({
    vesselId: String(body.vesselId ?? ''),
    vesselCapacityMl:
      typeof body.vesselCapacityMl === 'number' ? body.vesselCapacityMl : undefined,
    temperatureC:
      typeof body.temperatureC === 'number' ? body.temperatureC : undefined,
    currentWaterVolumeMl: Number(body.currentWaterVolumeMl ?? 0),
    currentSolutesMol:
      body.currentSolutesMol && typeof body.currentSolutesMol === 'object'
        ? body.currentSolutesMol
        : {},
    incomingSpeciesId: body.incomingSpeciesId ? String(body.incomingSpeciesId) : undefined,
    incomingElementSymbol: body.incomingElementSymbol
      ? String(body.incomingElementSymbol)
      : undefined,
    incomingAmountMol:
      typeof body.incomingAmountMol === 'number' ? body.incomingAmountMol : undefined,
    incomingWaterVolumeMl:
      typeof body.incomingWaterVolumeMl === 'number'
        ? body.incomingWaterVolumeMl
        : undefined,
    evaporateWaterMl:
      typeof body.evaporateWaterMl === 'number' ? body.evaporateWaterMl : undefined,
    recomputeOnly: Boolean(body.recomputeOnly),
    setWaterVolumeMl:
      typeof body.setWaterVolumeMl === 'number' ? body.setWaterVolumeMl : undefined,
    setSolutesMol:
      body.setSolutesMol && typeof body.setSolutesMol === 'object'
        ? body.setSolutesMol
        : undefined,
    commitReaction:
      body.commitReaction &&
      typeof body.commitReaction.reactionId === 'string' &&
      typeof body.commitReaction.xMol === 'number'
        ? {
            reactionId: body.commitReaction.reactionId,
            xMol: body.commitReaction.xMol,
          }
        : undefined,
    incomingFlask: body.incomingFlask,
  })
  return c.json(result)
})

apiApp.get('/api/reactions/constants', (c) => {
  return c.json(getReactionConstants())
})

apiApp.post('/api/reactions/predict', async (c) => {
  const body = (await c.req.json()) as {
    speciesAId?: string
    speciesBId?: string
    speciesCId?: string
  }
  const result = predictReactionByIds(
    String(body.speciesAId ?? ''),
    String(body.speciesBId ?? ''),
    body.speciesCId ? String(body.speciesCId) : undefined,
  )
  if (!result) {
    return c.json({ error: 'Espèces introuvables.' }, 404)
  }
  return c.json(result)
})

apiApp.get('/api/workspace', (c) => {
  return c.json(getWorkspaceSnapshot())
})

apiApp.put('/api/workspace', async (c) => {
  const body = (await c.req.json()) as Partial<WorkspaceSnapshot>
  const snapshot: WorkspaceSnapshot = {
    nodes: Array.isArray(body.nodes) ? body.nodes : [],
    discoveredSpeciesIds: Array.isArray(body.discoveredSpeciesIds)
      ? body.discoveredSpeciesIds.map(String)
      : [],
  }
  saveWorkspaceSnapshot(snapshot)
  return c.json({ ok: true })
})
