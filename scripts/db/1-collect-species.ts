/**
 * Étape 1 — Liste des espèces (identité uniquement)
 *
 * Rassemble :
 *   1) La liste curatée (server/data/species/curated/*)
 *   2) La liste des espèces chimiques de Wikipédia FR (Modèle:Infobox_Chimie)
 *      enrichie de ses identifiants croisés Wikidata (QID, label EN, CAS, CID, InChIKey, popularité)
 *
 * Sortie : server/data/generated/species-candidates.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SPECIES_SEED } from '../../server/data/species/index.ts'
import {
  fetchJsonCached,
  readCacheJson,
  runWithRateLimit,
  sleep,
  writeCacheJson,
} from './lib/cache.ts'
import { isValidCasNumber } from './lib/parsers.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_PATH = path.resolve(__dirname, '../../server/data/generated/species-candidates.json')

export interface SpeciesCandidate {
  source: 'curated' | 'wikipedia'
  curatedId: string | null
  wikidataId: string | null
  nameFr: string
  nameEn: string | null
  wikiTitleFr: string | null
  casNumber: string | null
  pubchemCid: number | null
  inchikey: string | null
  smilesHint: string | null
  popularity: number
}

interface WikiPageItem {
  qid: string
  titleFr: string
}

async function fetchFrWikiChemicalPages(): Promise<WikiPageItem[]> {
  const cached = readCacheJson<WikiPageItem[]>('wiki', 'infobox-chimie-pages-v1')
  if (cached) {
    console.log(`[Stage 1] Cache hit: ${cached.length} pages Wikipédia FR (Infobox Chimie)`)
    return cached
  }

  const byQid = new Map<string, WikiPageItem>()
  let cont: Record<string, string> | null = null
  let pageNum = 0

  while (true) {
    const qs = new URLSearchParams({
      action: 'query',
      generator: 'embeddedin',
      geititle: 'Modèle:Infobox Chimie',
      geinamespace: '0',
      geilimit: '500',
      prop: 'pageprops',
      ppprop: 'wikibase_item',
      format: 'json',
      ...(cont ?? {}),
    })
    const url = `https://fr.wikipedia.org/w/api.php?${qs.toString()}`
    const data = await fetchJsonCached<{
      query?: {
        pages?: Record<
          string,
          { title?: string; pageprops?: { wikibase_item?: string } }
        >
      }
      continue?: Record<string, string>
    }>('wiki', `embed-page-${pageNum}`, url)

    for (const p of Object.values(data?.query?.pages ?? {})) {
      const qid = p.pageprops?.wikibase_item
      const title = p.title
      if (qid && title && /^Q\d+$/.test(qid) && !byQid.has(qid)) {
        byQid.set(qid, { qid, titleFr: title })
      }
    }

    pageNum++
    if (!data?.continue) break
    cont = data.continue
    await sleep(120)
  }

  const list = [...byQid.values()]
  writeCacheJson('wiki', 'infobox-chimie-pages-v1', list)
  console.log(`[Stage 1] Collecté ${list.length} pages Wikipédia FR (Infobox Chimie)`)
  return list
}

interface WikidataMetaRow {
  qid: string
  labelFr: string | null
  labelEn: string | null
  casNumber: string | null
  pubchemCid: number | null
  inchikey: string | null
  smiles: string | null
  sitelinks: number
}

interface WbEntity {
  labels?: { fr?: { value?: string }; en?: { value?: string } }
  sitelinks?: Record<string, unknown>
  claims?: Record<
    string,
    Array<{ mainsnak?: { datavalue?: { value?: string } } }>
  >
}

function firstClaimString(entity: WbEntity, prop: string): string | null {
  const list = entity.claims?.[prop]
  if (!Array.isArray(list)) return null
  for (const item of list) {
    const val = item?.mainsnak?.datavalue?.value
    if (typeof val === 'string' && val.trim()) return val.trim()
  }
  return null
}

async function fetchWikidataMetaBatches(qids: string[]): Promise<Map<string, WikidataMetaRow>> {
  const result = new Map<string, WikidataMetaRow>()
  const batchSize = 50
  const batches: string[][] = []
  for (let i = 0; i < qids.length; i += batchSize) {
    batches.push(qids.slice(i, i + batchSize))
  }

  console.log(`[Stage 1] Wikidata wbgetentities : ${qids.length} QIDs en ${batches.length} lots...`)

  await runWithRateLimit(batches, 5, 110, async (slice, batchIdx) => {
    const cacheKey = `wb-b${batchIdx}-${slice[0]}-${slice[slice.length - 1]}`
    const cached = readCacheJson<WikidataMetaRow[]>('wikidata-wb', cacheKey)
    if (cached) {
      for (const row of cached) result.set(row.qid, row)
      return
    }

    const qs = new URLSearchParams({
      action: 'wbgetentities',
      ids: slice.join('|'),
      props: 'labels|claims|sitelinks',
      languages: 'fr|en',
      format: 'json',
    })
    const url = `https://www.wikidata.org/w/api.php?${qs.toString()}`
    const data = await fetchJsonCached<{ entities?: Record<string, WbEntity> }>(
      'wikidata-wb-raw',
      cacheKey,
      url,
      undefined,
      true,
    )

    const rows: WikidataMetaRow[] = []
    for (const [qid, ent] of Object.entries(data?.entities ?? {})) {
      if (!ent || typeof ent !== 'object') continue
      const casRaw = firstClaimString(ent, 'P231')
      const cas = casRaw && isValidCasNumber(casRaw) ? casRaw : null
      const cidRaw = firstClaimString(ent, 'P662')
      const cidNum = cidRaw ? Number.parseInt(cidRaw, 10) : NaN
      const cid = Number.isFinite(cidNum) && cidNum > 0 ? cidNum : null
      const ik = firstClaimString(ent, 'P235')
      const sm = firstClaimString(ent, 'P233') ?? firstClaimString(ent, 'P2017')
      const sl = ent.sitelinks ? Object.keys(ent.sitelinks).length : 0

      rows.push({
        qid,
        labelFr: ent.labels?.fr?.value ?? null,
        labelEn: ent.labels?.en?.value ?? null,
        casNumber: cas,
        pubchemCid: cid,
        inchikey: ik,
        smiles: sm,
        sitelinks: sl,
      })
    }

    writeCacheJson('wikidata-wb', cacheKey, rows)
    for (const row of rows) result.set(row.qid, row)

    if ((batchIdx + 1) % 25 === 0 || batchIdx === batches.length - 1) {
      console.log(
        `[Stage 1] Wikidata wbgetentities : lot ${batchIdx + 1}/${batches.length} (${result.size} espèces)`,
      )
    }
  })

  return result
}

function normalizeFrName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function cleanWikiTitle(title: string): string {
  return title.replace(/\s*\((?:chimie|composé|molécule|ion|élément|substance)\)$/i, '').trim()
}

async function main() {
  console.log('=== ÉTAPE 1 : Collecte de la liste des espèces (Curatées + Wikipédia FR) ===')
  const wikiPages = await fetchFrWikiChemicalPages()
  const wdMeta = await fetchWikidataMetaBatches(wikiPages.map((p) => p.qid))

  // Index Wikipedia pages by normalized FR name to link curated species to their QID/CID/CAS/EN-label
  const wikiByNormName = new Map<string, { page: WikiPageItem; meta: WikidataMetaRow }>()
  for (const page of wikiPages) {
    const meta = wdMeta.get(page.qid)
    if (!meta) continue
    const k1 = normalizeFrName(cleanWikiTitle(page.titleFr))
    if (k1 && !wikiByNormName.has(k1)) wikiByNormName.set(k1, { page, meta })
    if (meta.labelFr) {
      const k2 = normalizeFrName(meta.labelFr)
      if (k2 && !wikiByNormName.has(k2)) wikiByNormName.set(k2, { page, meta })
    }
  }

  const candidates: SpeciesCandidate[] = []
  const usedQids = new Set<string>()
  const usedCids = new Set<number>()
  const usedNormNames = new Set<string>()

  // 1. Add all curated species first (linking them to Wikidata metadata when available!)
  for (const sp of SPECIES_SEED) {
    const norm = normalizeFrName(sp.nameFr)
    const linked = wikiByNormName.get(norm)
    const qid = linked?.page.qid ?? null
    const cid = linked?.meta.pubchemCid ?? null
    if (qid) usedQids.add(qid)
    if (cid) usedCids.add(cid)
    usedNormNames.add(norm)

    candidates.push({
      source: 'curated',
      curatedId: sp.id,
      wikidataId: qid,
      nameFr: sp.nameFr,
      nameEn: linked?.meta.labelEn ?? null,
      wikiTitleFr: linked?.page.titleFr ?? null,
      casNumber: linked?.meta.casNumber ?? null,
      pubchemCid: cid,
      inchikey: linked?.meta.inchikey ?? null,
      smilesHint: linked?.meta.smiles ?? null,
      popularity: (linked?.meta.sitelinks ?? 0) + 1000,
    })
  }

  // 2. Add Wikipedia FR chemical candidates (must have a chemical identifier: CID, InChIKey, CAS, or SMILES)
  const wikiCandidates: SpeciesCandidate[] = []
  for (const page of wikiPages) {
    if (usedQids.has(page.qid)) continue
    const meta = wdMeta.get(page.qid)
    if (!meta) continue

    // Skip pages without any chemical database identifier at all
    if (!meta.pubchemCid && !meta.inchikey && !meta.casNumber && !meta.smiles) continue
    if (meta.pubchemCid && usedCids.has(meta.pubchemCid)) continue

    const rawTitle = cleanWikiTitle(page.titleFr)
    // Skip clearly non-single-species articles (families, lists, mixtures, polymers)
    if (/^(?:Liste |Catégorie:|Acides |Sels |Oxydes |Hydroxydes |Chlorures |Sulfates |Nitrates )/i.test(rawTitle)) {
      continue
    }

    const nameFr = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1)
    const norm = normalizeFrName(nameFr)
    if (!norm || usedNormNames.has(norm)) continue

    usedQids.add(page.qid)
    if (meta.pubchemCid) usedCids.add(meta.pubchemCid)
    usedNormNames.add(norm)

    wikiCandidates.push({
      source: 'wikipedia',
      curatedId: null,
      wikidataId: page.qid,
      nameFr,
      nameEn: meta.labelEn ?? null,
      wikiTitleFr: page.titleFr,
      casNumber: meta.casNumber,
      pubchemCid: meta.pubchemCid,
      inchikey: meta.inchikey,
      smilesHint: meta.smiles,
      popularity: meta.sitelinks,
    })
  }

  // Sort Wikipedia candidates by notoriety (Wikidata sitelinks count) descending
  wikiCandidates.sort((a, b) => b.popularity - a.popularity || a.nameFr.localeCompare(b.nameFr, 'fr'))

  const all = [...candidates, ...wikiCandidates]
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(all, null, 2), 'utf8')

  console.log(
    `[Stage 1] Terminé : ${candidates.length} curatées + ${wikiCandidates.length} candidates Wikipédia FR = ${all.length} espèces → ${path.relative(process.cwd(), OUT_PATH)}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
