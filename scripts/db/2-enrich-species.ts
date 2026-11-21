/**
 * Étape 2 — Enrichissement scientifique fiable & Filtrage strict (« Carte d’identité complète »)
 *
 * Sources scientifiques officielles utilisées :
 *   1. PubChem (NIH) — Bulk Experimental Annotations (HSDB, ILO-ICSC, NIOSH, CAMEO, CRC, EPA, NTP)
 *      + Batch PUG REST (IUPACName, SMILES, InChIKey, Charge)
 *      + PUG View ciblé (Physical Description, CAS) pour les candidats survivants
 *   2. AqSolDB (Nature Scientific Data — 9 982 composés, solubilité aqueuse expérimentale LogS)
 *   3. IUPAC Digitized pKa (IUPAC/Dissociation-Constants — pKa aqueux haute confiance)
 *   4. Table de solubilité en fonction de la température 0–100 °C (sels inorganiques)
 *
 * Filtrage strict pour les espèces neutres candidates :
 *   - Tout le bloc A : nom FR, nom IUPAC, SMILES (+ schéma de Lewis valide), InChIKey, CID PubChem, CAS valide, formule, type, charge
 *   - Température de fusion et/ou d’ébullition expérimentale
 *   - Masse volumique expérimentale
 *   - Solubilité aqueuse expérimentale + type de dissolution
 *   - Aspect & couleur pure
 *   => Toute espèce incomplète est rejetée. Plafond final : 2 000 espèces les plus connues.
 *
 * Sortie : server/data/generated/species-enriched.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Molecule } from 'openchemlib'
import type {
  DissolutionType,
  PhCharacter,
  PhysicalState,
  SpeciesKind,
  ThermalNote,
} from '../../shared/chemistry.ts'
import { ELEMENTS_SEED } from '../../server/data/elements.ts'
import { computeLewisTopologyKey, resolveSpeciesLewis } from '../../server/data/lewis.ts'
import { SPECIES_SEED } from '../../server/data/species/index.ts'
import { computeMolarMassFromComposition } from '../../server/data/types.ts'
import { smilesToLewis } from '../../server/lib/smiles-lewis.ts'
import type { SpeciesCandidate } from './1-collect-species.ts'
import {
  fetchJsonCached,
  fetchTextCached,
  fetchWithRetry,
  readCacheJson,
  runWithRateLimit,
  writeCacheJson,
} from './lib/cache.ts'
import {
  deriveDissolutionType,
  derivePhCharacter,
  deriveStandardState,
  extractValidCasFromStrings,
  isValidCasNumber,
  parseAppearanceAndColor,
  parseCsv,
  parseDensityGPerCm3,
  parsePkaValues,
  parseSolubilityWater,
  parseTemperatureC,
  roundTo,
} from './lib/parsers.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CANDIDATES_PATH = path.resolve(__dirname, '../../server/data/generated/species-candidates.json')
const OUT_PATH = path.resolve(__dirname, '../../server/data/generated/species-enriched.json')

const MAX_TOTAL_SPECIES = 2000
const MAX_HEAVY_ATOMS = 55

const ATOMIC_MASS_BY_SYMBOL = new Map(ELEMENTS_SEED.map((e) => [e.symbol, e.atomicMass]))

export interface EnrichedSpeciesEntry {
  id: string
  source: 'curated' | 'wikidata'
  wikidataId: string | null
  formula: string
  displayFormula: string
  nameFr: string
  iupacName: string | null
  casNumber: string | null
  inchikey: string | null
  pubchemCid: number | null
  kind: SpeciesKind
  charge: number
  molarMass: number
  standardState: PhysicalState
  meltingPointC: number | null
  boilingPointC: number | null
  thermalNote: ThermalNote
  densityGPerCm3: number | null
  appearanceFr: string | null
  colorHex: string | null
  composition: Record<string, number>
  smiles: string | null
  popularity: number
  families: string[]
  canDissolveInWater: boolean
  solubilityGPerL: number | null
  solubilityByTempC: Record<string, number> | null
  dissolutionType: DissolutionType
  solutionColorHex: string | null
  phCharacter: PhCharacter
  pkaValues: number[]
  ghsPictograms: string[]
  ghsSignalWord: string | null
  dissociatesInto?: Array<{ speciesId: string; stoichiometry: number }>
  behaviors: Record<string, unknown>
}

// Explicit CID map for curated species whose FR Wikipedia title may differ or redirect
const CURATED_PUBCHEM_CID_HINTS: Record<string, number> = {
  h2o: 962,
  h2o2: 784,
  o2: 977,
  h2: 783,
  n2: 947,
  cl2: 24526,
  br2: 24408,
  i2: 807,
  f2: 24524,
  o3: 24823,
  co2: 280,
  co: 281,
  so2: 1119,
  so3: 24682,
  no: 145068,
  no2: 3032552,
  n2o: 948,
  nh3: 222,
  ch4: 297,
  h2s: 402,
  hcl: 313,
  hbr: 260,
  hi: 24841,
  hf: 14917,
  hcn: 768,
  hno3: 944,
  h2so4: 1118,
  h3po4: 1004,
  h2co3: 767,
  hclo: 24341,
  hclo4: 24247,
  naoh: 14798,
  koh: 14797,
  lioh: 3939,
  caoh2: 6093208,
  baoh2: 6093286,
  mgoh2: 73981,
  aloh3: 10176082,
  cuoh2: 30154,
  feoh2: 23994,
  feoh3: 73964,
  znoh2: 14778,
  nacl: 5234,
  kcl: 4873,
  licl: 433294,
  cacl2: 5284359,
  mgcl2: 5360315,
  bacl2: 25204,
  alcl3: 24012,
  fecl2: 24458,
  fecl3: 24380,
  cucl2: 24014,
  zncl2: 5727,
  agcl: 24561,
  nh4cl: 25517,
  nabr: 253881,
  kbr: 253877,
  nai: 5238,
  ki: 4875,
  pbi2: 24931,
  naf: 5235,
  nano3: 24268,
  kno3: 24434,
  agno3: 24470,
  nh4no3: 22985,
  pbno32: 24924,
  cuno32: 18616,
  na2so4: 24436,
  k2so4: 24507,
  mgso4: 24083,
  caso4: 24497,
  baso4: 24414,
  cuso4: 24462,
  feso4: 24393,
  znso4: 24424,
  na2s2o3: 24477,
  na2co3: 10340,
  nahco3: 516892,
  k2co3: 11430,
  caco3: 10112,
  mgco3: 11029,
  na2s: 14804,
  kmno4: 24401,
  k2cr2o7: 24502,
  naclo: 23665760,
  ch3coona: 517045,
  kscn: 516872,
  cuo: 14829,
  fe2o3: 518696,
  cao: 14778,
  mgo: 14792,
  al2o3: 9989226,
  sio2: 24261,
  mno2: 14801,
  tio2: 26042,
  zno: 14806,
  ch3cooh: 176,
  hcooh: 284,
  c2h5cooh: 1032,
  c3h7cooh: 264,
  c6h5cooh: 243,
  c2h2o4: 971,
  c6h8o7: 311,
  c3h6o3: 612,
  c6h8o6: 54670067,
  c9h8o4: 2244,
  ch3oh: 887,
  c2h6o: 702,
  c2h5oh: 702,
  c3h7oh: 1031,
  c3h8o: 3776,
  isopropanol: 3776,
  s8: 5362487,
  fe3o4: 16211978,
  cus: 14831,
  methanoate_methyle: 7865,
  c4h9oh: 263,
  c2h6o2: 174,
  c3h8o3: 753,
  c6h5oh: 996,
  hcho: 712,
  ch3cho: 177,
  propanal: 527,
  butanal: 261,
  c6h5cho: 240,
  acetone: 180,
  butanone: 6569,
  ch3cooc2h5: 8857,
  methyl_formate: 7865,
  methyl_propanoate: 11124,
  ethyl_formate: 8025,
  c2h5oc2h5: 3283,
  dimethyl_ether: 8254,
  ch3nh2: 6329,
  c6h5nh2: 6115,
  ch4n2o: 1176,
  c6h12o6: 5793,
  fructose: 5984,
  c12h22o11: 5988,
  c2h6: 6324,
  c3h8: 6334,
  c4h10: 7843,
  isobutane: 6360,
  c2h4: 6325,
  c2h2: 6326,
  c6h6: 241,
  c7h8: 1140,
  c6h12: 8078,
  c6h14: 8058,
  c8h18: 356,
  chcl3: 6212,
  ch2cl2: 6344,
  ccl4: 5943,
  c8h10n4o2: 2519,
  c2h3n: 6342,
  c3h7no: 6228,
  c2h6os: 679,
  oxirane: 6354,
  hnc: 64969,
  c2h5no2: 750,
}

// Color of classic ions in aqueous solution (for auto-tinting newly enriched salts)
const ION_SOLUTION_COLORS: Record<string, string> = {
  cu2_plus: '#0284c7',
  fe2_plus: '#16a34a',
  fe3_plus: '#d97706',
  ni2_plus: '#22c55e',
  co2_plus: '#ec4899',
  cr3_plus: '#15803d',
  mno4_minus: '#9333ea',
  cr2o7_2minus: '#ea580c',
  cro4_2minus: '#eab308',
}

// Map canonical fragment SMILES -> DeltaLab curated ion ID for automatic salt dissociation
const FRAGMENT_TO_ION_ID: Record<string, string> = {
  '[Na+]': 'na_plus',
  '[K+]': 'k_plus',
  '[Li+]': 'li_plus',
  '[Ca+2]': 'ca2_plus',
  '[Ca++]': 'ca2_plus',
  '[Mg+2]': 'mg2_plus',
  '[Mg++]': 'mg2_plus',
  '[Ba+2]': 'ba2_plus',
  '[Ba++]': 'ba2_plus',
  '[Al+3]': 'al3_plus',
  '[Cu+]': 'cu_plus',
  '[Cu+2]': 'cu2_plus',
  '[Cu++]': 'cu2_plus',
  '[Fe+2]': 'fe2_plus',
  '[Fe++]': 'fe2_plus',
  '[Fe+3]': 'fe3_plus',
  '[Ag+]': 'ag_plus',
  '[Zn+2]': 'zn2_plus',
  '[Zn++]': 'zn2_plus',
  '[Pb+2]': 'pb2_plus',
  '[Pb++]': 'pb2_plus',
  '[Ni+2]': 'ni2_plus',
  '[Co+2]': 'co2_plus',
  '[Mn+2]': 'mn2_plus',
  '[Cr+3]': 'cr3_plus',
  '[NH4+]': 'nh4_plus',
  '[Cl-]': 'cl_minus',
  '[Br-]': 'br_minus',
  '[I-]': 'i_minus',
  '[F-]': 'f_minus',
  '[OH-]': 'oh_minus',
  '[O-][N+](=O)[O-]': 'no3_minus',
  '[O-]N(=O)=O': 'no3_minus',
  '[O-]S(=O)(=O)[O-]': 'so4_2minus',
  '[O-]C(=O)[O-]': 'co3_2minus',
  'OC(=O)[O-]': 'hco3_minus',
  '[O-]C(=O)O': 'hco3_minus',
  '[O-]P(=O)([O-])[O-]': 'po4_3minus',
  'CC(=O)[O-]': 'ch3coo_minus',
  '[O-]C(=O)C': 'ch3coo_minus',
  '[C-]#N': 'cn_minus',
  '[S-2]': 's_2minus',
  '[S--]': 's_2minus',
  '[O-][Mn](=O)(=O)=O': 'mno4_minus',
  '[O-]Cl': 'clo_minus',
  '[Cl-]=O': 'clo_minus',
}

interface BulkAnnotationPage {
  Annotations?: {
    TotalPages?: number
    Annotation?: Array<{
      LinkedRecords?: { CID?: number[] }
      Data?: Array<{
        Value?: {
          StringWithMarkup?: Array<{ String?: string }>
          Number?: number[]
          Unit?: string
        }
      }>
    }>
  }
}

async function fetchPubChemBulkHeading(
  heading: string,
  cacheSlug: string,
): Promise<Map<number, string[]>> {
  const cached = readCacheJson<Record<string, string[]>>('pubchem-bulk', `${cacheSlug}-v1`)
  if (cached) {
    const map = new Map<number, string[]>()
    for (const [k, v] of Object.entries(cached)) {
      map.set(Number(k), v)
    }
    console.log(`[Stage 2] Cache hit PubChem "${heading}" : ${map.size} CIDs`)
    return map
  }

  const baseUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/annotations/heading/JSON?heading=${encodeURIComponent(heading)}&heading_type=Compound`
  const page1 = await fetchJsonCached<BulkAnnotationPage>(
    'pubchem-bulk-pages',
    `${cacheSlug}-p1`,
    `${baseUrl}&page=1`,
  )
  const totalPages = page1?.Annotations?.TotalPages ?? 1
  console.log(`[Stage 2] Téléchargement PubChem "${heading}" (${totalPages} pages)...`)

  const map = new Map<number, string[]>()

  const ingestPage = (page: BulkAnnotationPage | null) => {
    for (const ann of page?.Annotations?.Annotation ?? []) {
      const cids = ann.LinkedRecords?.CID ?? []
      if (cids.length === 0) continue
      const vals: string[] = []
      for (const d of ann.Data ?? []) {
        const swm = d.Value?.StringWithMarkup
        if (swm?.length) {
          for (const item of swm) {
            if (item.String) vals.push(item.String)
          }
        } else if (d.Value?.Number?.length) {
          vals.push(`${d.Value.Number[0]} ${d.Value.Unit ?? ''}`.trim())
        }
      }
      if (vals.length === 0) continue
      for (const cid of cids) {
        let arr = map.get(cid)
        if (!arr) {
          arr = []
          map.set(cid, arr)
        }
        if (arr.length < 8) {
          for (const v of vals) {
            if (arr.length < 8) arr.push(v)
          }
        }
      }
    }
  }

  ingestPage(page1)

  if (totalPages > 1) {
    const pageNums = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
    await runWithRateLimit(pageNums, 4, 0, async (pageNum) => {
      const p = await fetchJsonCached<BulkAnnotationPage>(
        'pubchem-bulk-pages',
        `${cacheSlug}-p${pageNum}`,
        `${baseUrl}&page=${pageNum}`,
        undefined,
        true,
      )
      ingestPage(p)
      if (pageNum % 15 === 0 || pageNum === totalPages) {
        console.log(`  [${heading}] page ${pageNum}/${totalPages} (${map.size} CIDs)`)
      }
    })
  }

  const serialized: Record<string, string[]> = {}
  for (const [cid, vals] of map.entries()) {
    serialized[String(cid)] = vals
  }
  writeCacheJson('pubchem-bulk', `${cacheSlug}-v1`, serialized)
  console.log(`[Stage 2] PubChem "${heading}" terminé : ${map.size} CIDs`)
  return map
}

async function loadAqSolDb(): Promise<{
  byInchiKey: Map<string, number>
  byConnectivity: Map<string, number>
}> {
  const csv = await fetchTextCached(
    'datasets',
    'aqsoldb-v1',
    'https://raw.githubusercontent.com/PatWalters/chem_tutorial/main/curated-solubility-dataset.csv',
    'csv',
  )
  const rows = parseCsv(csv)
  const byInchiKey = new Map<string, number>()
  const byConnectivity = new Map<string, number>()

  for (const r of rows) {
    const ik = r.InChIKey?.trim()
    const logS = Number(r.Solubility)
    if (!ik || !Number.isFinite(logS)) continue
    byInchiKey.set(ik, logS)
    const conn = ik.split('-')[0]
    if (conn && !byConnectivity.has(conn)) {
      byConnectivity.set(conn, logS)
    }
  }
  console.log(`[Stage 2] AqSolDB chargé : ${byInchiKey.size} composés (LogS expérimental)`)
  return { byInchiKey, byConnectivity }
}

async function loadIupacPka(): Promise<Map<string, number[]>> {
  const cached = readCacheJson<Record<string, number[]>>('datasets', 'iupac-pka-by-idcode-v2')
  if (cached) {
    const map = new Map<string, number[]>()
    for (const [k, v] of Object.entries(cached)) map.set(k, v)
    console.log(`[Stage 2] Cache hit IUPAC pKa : ${map.size} molécules`)
    return map
  }

  const csv = await fetchTextCached(
    'datasets',
    'iupac-pka-raw-v2_4',
    'https://raw.githubusercontent.com/IUPAC/Dissociation-Constants/main/iupac_high-confidence_v2_4.csv',
    'csv',
  )
  const rows = parseCsv(csv)
  // Group by (idCode -> pkaType -> best scored measurement preferring Reliable & T ≈ 25°C)
  const grouped = new Map<string, Map<string, { val: number; score: number }>>()

  for (const r of rows) {
    if (r.cosolvent && r.cosolvent.trim() !== '') continue
    const sm = r.SMILES?.trim()
    const val = Number(r.pka_value)
    if (!sm || !Number.isFinite(val) || val < -15 || val > 25) continue

    const temp = Number(r.T)
    const tempPenalty = Number.isFinite(temp) ? Math.abs(temp - 25) * 0.25 : 5
    const assessBonus = /reliable/i.test(r.assessment ?? '')
      ? 20
      : /approximate/i.test(r.assessment ?? '')
        ? 10
        : 0
    const lowIonicBonus = /I\s*=\s*0\b|zero|extrapol/i.test(r.remarks ?? '') ? 5 : 0
    const score = assessBonus + lowIonicBonus - tempPenalty

    const pkaType = (r.pka_type ?? 'pKa1').trim().toLowerCase() || 'pka1'
    try {
      const mol = Molecule.fromSmiles(sm)
      const idCode = mol.getIDCode()
      if (!idCode) continue
      let byType = grouped.get(idCode)
      if (!byType) {
        byType = new Map()
        grouped.set(idCode, byType)
      }
      const prev = byType.get(pkaType)
      if (!prev || score > prev.score) {
        byType.set(pkaType, { val: roundTo(val, 2), score })
      }
    } catch {
      // skip unparseable SMILES
    }
  }

  const clean: Record<string, number[]> = {}
  const map = new Map<string, number[]>()
  for (const [idCode, byType] of grouped.entries()) {
    const vals = [...byType.values()].map((x) => x.val).sort((a, b) => a - b)
    const deduped: number[] = []
    for (const v of vals) {
      if (deduped.length === 0 || Math.abs(v - deduped[deduped.length - 1]) > 0.3) {
        deduped.push(v)
      }
    }
    const trimmed = deduped.slice(0, 4)
    clean[idCode] = trimmed
    map.set(idCode, trimmed)
  }

  writeCacheJson('datasets', 'iupac-pka-by-idcode-v2', clean)
  console.log(`[Stage 2] IUPAC pKa chargé : ${map.size} molécules (aqueux haute confiance)`)
  return map
}

function normalizeFormulaPlain(s: string): string {
  return s
    .replace(/\{\{chem2?\|([^}]+)\}\}/gi, (_, inner: string) =>
      inner.replace(/\|/g, '').replace(/[_^]/g, ''),
    )
    .replace(/<\/?su[bp]>/gi, '')
    .replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^/]*\/>/gi, '')
    .replace(/['*]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

/**
 * Loads tabulated experimental aqueous solubility curves (0–100 °C, g/L)
 * for inorganic salts from Wikipedia EN "Solubility table".
 */
async function loadSolubilityTempCurves(): Promise<Map<string, Record<string, number>>> {
  const cached = readCacheJson<Record<string, Record<string, number>>>(
    'datasets',
    'solubility-curves-v3',
  )
  if (cached) {
    const map = new Map<string, Record<string, number>>()
    for (const [k, v] of Object.entries(cached)) map.set(k, v)
    console.log(`[Stage 2] Cache hit courbes solubilité 0–100 °C : ${map.size} sels`)
    return map
  }

  const url =
    'https://en.wikipedia.org/w/api.php?action=query&redirects=1&prop=revisions&rvprop=content&rvslots=main&format=json&titles=Solubility_table'
  const data = await fetchJsonCached<{
    query?: { pages?: Record<string, { revisions?: Array<{ slots?: { main?: { '*': string } } }> }> }
  }>('datasets', 'enwiki-solubility-table-raw', url)

  const page = Object.values(data?.query?.pages ?? {})[0]
  const wikitext = page?.revisions?.[0]?.slots?.main?.['*'] ?? ''

  const curves = new Map<string, Record<string, number>>()

  // Parse each wikitable separately so we read EACH table's exact temperature column headers!
  const tables = wikitext.split(/\{\|\s*class="wikitable/i).slice(1)
  for (const tableChunk of tables) {
    const tableBody = tableChunk.split(/\n\|\}/)[0] ?? ''
    const rowChunks = tableBody.split(/\n\|-/)
    const headerBlock = rowChunks[0] ?? ''

    // Extract temperature headers in order (skipping Substance & Formula columns)
    const headerLines = headerBlock
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('!'))
    const headerCells: string[] = []
    for (const hl of headerLines) {
      for (const part of hl.replace(/^!/, '').split('!!')) {
        headerCells.push(part)
      }
    }
    const colTemps: Array<string | null> = headerCells.map((hc) => {
      const m = /(\d{1,3})(?:&nbsp;|\s)*°\s*C/i.exec(hc)
      return m ? m[1] : null
    })
    if (colTemps.filter(Boolean).length < 3) continue

    for (const chunk of rowChunks.slice(1)) {
      const lines = chunk
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('|') && !l.startsWith('|-') && !l.startsWith('|}'))
      if (lines.length === 0) continue

      const cells: string[] = []
      for (const line of lines) {
        const stripped = line.replace(/^\|/, '')
        for (const part of stripped.split('||')) {
          const cleanCell = part.replace(/^[^|[\]{}]*\|\s*(?=[A-Za-z0-9{[])/, '').trim()
          cells.push(cleanCell)
        }
      }

      if (cells.length < 4) continue
      const substanceName = cells[0] ?? ''
      if (/\(\s*(?:ml\/l|mol\/l|cm3|vol)\s*\)/i.test(substanceName)) continue
      const formulaPlain = normalizeFormulaPlain(cells[1] ?? '')
      if (!formulaPlain || !/^[A-Z][A-Za-z0-9()]+$/.test(formulaPlain)) continue

      const curve: Record<string, number> = {}
      for (let colIdx = 2; colIdx < colTemps.length && colIdx < cells.length; colIdx++) {
        const tempKey = colTemps[colIdx]
        if (!tempKey) continue
        const rawCell = (cells[colIdx] ?? '')
          .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
          .replace(/<ref[^/]*\/>/gi, '')
          .replace(/\{\{[^}]+\}\}/g, '')
          .trim()
        const sciMatch = /^(\d+(?:\.\d+)?)\s*[×x]\s*10(?:<sup>|\^)\s*[−-]?(\d+)/i.exec(rawCell)
        if (sciMatch) {
          const base = Number(sciMatch[1])
          const exp = Number(sciMatch[2])
          const gPer100Ml = base * 10 ** -exp
          if (Number.isFinite(gPer100Ml) && gPer100Ml >= 0) {
            curve[tempKey] = roundTo(gPer100Ml * 10, 5)
          }
          continue
        }
        const numMatch = /^(\d+(?:\.\d+)?)/.exec(rawCell)
        if (!numMatch) continue
        const gPer100Ml = Number(numMatch[1])
        if (Number.isFinite(gPer100Ml) && gPer100Ml >= 0 && gPer100Ml <= 1200) {
          curve[tempKey] = roundTo(gPer100Ml * 10, gPer100Ml < 0.1 ? 3 : 1)
        }
      }

      if (Object.keys(curve).length >= 2 && !curves.has(formulaPlain)) {
        curves.set(formulaPlain, curve)
      }
    }
  }

  const serialized: Record<string, Record<string, number>> = {}
  for (const [k, v] of curves.entries()) serialized[k] = v
  writeCacheJson('datasets', 'solubility-curves-v3', serialized)
  console.log(`[Stage 2] Courbes de solubilité 0–100 °C extraites : ${curves.size} sels`)
  return curves
}

interface PugRestProp {
  CID: number
  MolecularFormula?: string
  IUPACName?: string
  SMILES?: string
  ConnectivitySMILES?: string
  InChIKey?: string
  Charge?: number
}

async function fetchPugRestPropertiesBatch(cids: number[]): Promise<Map<number, PugRestProp>> {
  const unique = [...new Set(cids)].sort((a, b) => a - b)
  const map = new Map<number, PugRestProp>()
  const batchSize = 100
  const batches: number[][] = []
  for (let i = 0; i < unique.length; i += batchSize) {
    batches.push(unique.slice(i, i + batchSize))
  }

  console.log(`[Stage 2] PubChem PUG REST (carte d’identité) : ${unique.length} CIDs en ${batches.length} lots...`)
  await runWithRateLimit(batches, 4, 0, async (batch, idx) => {
    const key = `props-${batch[0]}-${batch[batch.length - 1]}-${batch.length}`
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${batch.join(',')}/property/MolecularFormula,IUPACName,SMILES,ConnectivitySMILES,InChIKey,Charge/JSON`
    const data = await fetchJsonCached<{ PropertyTable?: { Properties?: PugRestProp[] } }>(
      'pubchem-props',
      key,
      url,
      undefined,
      true,
    )
    for (const p of data?.PropertyTable?.Properties ?? []) {
      map.set(p.CID, p)
    }
    if ((idx + 1) % 10 === 0 || idx === batches.length - 1) {
      console.log(`  [PUG REST] lot ${idx + 1}/${batches.length} (${map.size} fiches)`)
    }
  })

  return map
}

async function resolveCidByInchiKeyOrName(
  candidate: SpeciesCandidate,
): Promise<number | null> {
  if (candidate.inchikey) {
    const data = await fetchJsonCached<{ IdentifierList?: { CID?: number[] } }>(
      'pubchem-resolve',
      `ik-${candidate.inchikey}`,
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/inchikey/${encodeURIComponent(candidate.inchikey)}/cids/JSON`,
      undefined,
      true,
    )
    const cid = data?.IdentifierList?.CID?.[0]
    if (cid) return cid
  }
  if (candidate.nameEn) {
    const data = await fetchJsonCached<{ IdentifierList?: { CID?: number[] } }>(
      'pubchem-resolve',
      `name-${candidate.nameEn.toLowerCase()}`,
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(candidate.nameEn)}/cids/JSON`,
      undefined,
      true,
    )
    const cid = data?.IdentifierList?.CID?.[0]
    if (cid) return cid
  }
  return null
}

function extractPugViewStrings(sections: unknown, out: string[] = []): string[] {
  if (!Array.isArray(sections)) return out
  for (const s of sections as Array<{
    Information?: Array<{
      Value?: {
        StringWithMarkup?: Array<{ String?: string }>
        Number?: number[]
        Unit?: string
      }
    }>
    Section?: unknown
  }>) {
    for (const info of s.Information ?? []) {
      for (const swm of info.Value?.StringWithMarkup ?? []) {
        if (swm.String) out.push(swm.String)
      }
      if (info.Value?.Number?.length) {
        out.push(`${info.Value.Number[0]} ${info.Value.Unit ?? ''}`.trim())
      }
    }
    if (s.Section) extractPugViewStrings(s.Section, out)
  }
  return out
}

async function fetchPugViewHeadingStrings(
  cid: number,
  heading: string,
  slug: string,
): Promise<string[]> {
  const cached = readCacheJson<string[]>('pubchem-view', `${slug}-${cid}`)
  if (cached !== null) return cached

  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON?heading=${encodeURIComponent(heading)}`
  try {
    const res = await fetchWithRetry(url)
    if (res.status === 404) {
      writeCacheJson('pubchem-view', `${slug}-${cid}`, [])
      return []
    }
    if (!res.ok) return []
    const json = (await res.json()) as { Record?: { Section?: unknown } }
    const strings = extractPugViewStrings(json.Record?.Section).slice(0, 12)
    writeCacheJson('pubchem-view', `${slug}-${cid}`, strings)
    return strings
  } catch {
    return []
  }
}

interface GhsInfo {
  pictograms: string[]
  signalWord: string | null
}

async function fetchPugViewGhs(cid: number): Promise<GhsInfo> {
  const cached = readCacheJson<GhsInfo>('pubchem-ghs', `ghs-${cid}`)
  if (cached !== null) return cached

  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON?heading=GHS+Classification`
  try {
    const res = await fetchWithRetry(url)
    if (res.status === 404 || !res.ok) {
      const empty: GhsInfo = { pictograms: [], signalWord: null }
      writeCacheJson('pubchem-ghs', `ghs-${cid}`, empty)
      return empty
    }
    const json = (await res.json()) as { Record?: { Section?: unknown } }
    const picSet = new Set<string>()
    let signalWord: string | null = null

    const walk = (sections: unknown) => {
      if (!Array.isArray(sections)) return
      for (const s of sections as Array<{
        Information?: Array<{
          Name?: string
          Value?: {
            StringWithMarkup?: Array<{
              String?: string
              Markup?: Array<{ Extra?: string; URL?: string }>
            }>
          }
        }>
        Section?: unknown
      }>) {
        for (const info of s.Information ?? []) {
          for (const swm of info.Value?.StringWithMarkup ?? []) {
            if (info.Name === 'Signal' && !signalWord && swm.String) {
              if (/danger/i.test(swm.String)) signalWord = 'Danger'
              else if (/warning/i.test(swm.String)) signalWord = 'Attention'
            }
            for (const mk of swm.Markup ?? []) {
              const ghsMatch = /GHS0[1-9]/.exec(mk.URL ?? '')
              if (ghsMatch) picSet.add(ghsMatch[0])
            }
          }
        }
        if (s.Section) walk(s.Section)
      }
    }
    walk(json.Record?.Section)

    const result: GhsInfo = {
      pictograms: [...picSet].sort(),
      signalWord,
    }
    writeCacheJson('pubchem-ghs', `ghs-${cid}`, result)
    return result
  } catch {
    return { pictograms: [], signalWord: null }
  }
}

function inferSaltDissociation(
  smiles: string,
): Array<{ speciesId: string; stoichiometry: number }> | undefined {
  if (!smiles.includes('.')) return undefined
  const parts = smiles.split('.').filter(Boolean)
  if (parts.length < 2 || parts.length > 5) return undefined
  const counts = new Map<string, number>()
  for (const part of parts) {
    const mapped = FRAGMENT_TO_ION_ID[part]
    if (!mapped) return undefined
    counts.set(mapped, (counts.get(mapped) ?? 0) + 1)
  }
  return [...counts.entries()].map(([speciesId, stoichiometry]) => ({
    speciesId,
    stoichiometry,
  }))
}

function inferKind(
  smiles: string,
  charge: number,
  composition: Record<string, number>,
): SpeciesKind {
  if (charge !== 0) return 'ion'
  const symbols = Object.keys(composition)
  if (symbols.length === 1) return 'element_substance'
  if (smiles.includes('.') && /[+-]\]/.test(smiles)) return 'ionic_compound'
  const metals = new Set([
    'Li', 'Na', 'K', 'Rb', 'Cs', 'Be', 'Mg', 'Ca', 'Sr', 'Ba', 'Al',
    'Fe', 'Cu', 'Zn', 'Ag', 'Au', 'Pb', 'Sn', 'Ni', 'Co', 'Mn', 'Cr', 'Hg', 'Cd', 'Ti',
  ])
  if (symbols.some((s) => metals.has(s)) && !composition.C) {
    return 'ionic_compound'
  }
  return 'molecule'
}

const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉']
function toSubscript(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUBSCRIPT_DIGITS[Number(d)] ?? d)
    .join('')
}

function formatHillDisplayFormula(
  composition: Record<string, number>,
  charge: number,
): { formula: string; displayFormula: string } {
  const entries = Object.entries(composition).filter(([, c]) => c > 0)
  const hasC = entries.some(([sym]) => sym === 'C')
  entries.sort(([a], [b]) => {
    if (hasC) {
      if (a === 'C') return -1
      if (b === 'C') return 1
      if (a === 'H') return -1
      if (b === 'H') return 1
    }
    return a.localeCompare(b)
  })
  const basePlain = entries.map(([s, c]) => (c === 1 ? s : `${s}${c}`)).join('')
  const baseDisp = entries.map(([s, c]) => (c === 1 ? s : `${s}${toSubscript(c)}`)).join('')
  if (charge === 0) return { formula: basePlain, displayFormula: baseDisp }
  const abs = Math.abs(charge)
  const sign = charge > 0 ? '+' : '-'
  const signDisp = charge > 0 ? '⁺' : '⁻'
  const supDigits = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹']
  const supAbs = abs > 1 ? String(abs).split('').map((d) => supDigits[Number(d)] ?? d).join('') : ''
  return {
    formula: `${basePlain}${abs > 1 ? abs : ''}${sign}`,
    displayFormula: `${baseDisp}${supAbs}${signDisp}`,
  }
}

async function main() {
  console.log('=== ÉTAPE 2 : Enrichissement scientifique (PubChem + AqSolDB + IUPAC) & Filtrage strict ===')
  if (!fs.existsSync(CANDIDATES_PATH)) {
    throw new Error(`Fichier introuvable : ${CANDIDATES_PATH}. Lance d’abord "pnpm db:collect".`)
  }
  const candidates = JSON.parse(fs.readFileSync(CANDIDATES_PATH, 'utf8')) as SpeciesCandidate[]
  console.log(`[Stage 2] ${candidates.length} candidats chargés depuis l’étape 1`)

  // 1. Load all authoritative bulk scientific datasets (all cached locally)
  const [
    densityByCid,
    mpByCid,
    bpByCid,
    colorFormByCid,
    pkaByCid,
    solubilityByCid,
    aqSolDb,
    iupacPkaByIdCode,
    solubilityCurves,
  ] = await Promise.all([
    fetchPubChemBulkHeading('Density', 'density'),
    fetchPubChemBulkHeading('Melting Point', 'melting-point'),
    fetchPubChemBulkHeading('Boiling Point', 'boiling-point'),
    fetchPubChemBulkHeading('Color/Form', 'color-form'),
    fetchPubChemBulkHeading('Dissociation Constants', 'pka'),
    fetchPubChemBulkHeading('Solubility', 'solubility'),
    loadAqSolDb(),
    loadIupacPka(),
    loadSolubilityTempCurves(),
  ])

  const curatedById = new Map(SPECIES_SEED.map((s) => [s.id, s]))

  // 2. Assign / verify PubChem CIDs (fix missing/broken Wikidata CIDs for top candidates & curated)
  const curatedCandidates = candidates.filter((c) => c.source === 'curated')
  const wikiCandidates = candidates.filter((c) => c.source === 'wikipedia')

  for (const c of curatedCandidates) {
    if (c.curatedId && CURATED_PUBCHEM_CID_HINTS[c.curatedId]) {
      c.pubchemCid = CURATED_PUBCHEM_CID_HINTS[c.curatedId]
    }
  }

  // For Wikipedia candidates whose Wikidata CID is missing or absent from PubChem Density,
  // check InChIKey / EN name resolution for the top 2,500 most popular missing ones
  const toResolve = wikiCandidates
    .filter((c) => !c.pubchemCid || !densityByCid.has(c.pubchemCid))
    .slice(0, 1200)

  if (toResolve.length > 0) {
    console.log(`[Stage 2] Résolution CID PubChem (InChIKey / nom EN) sur ${toResolve.length} candidats prioritaires...`)
    let fixedCount = 0
    await runWithRateLimit(toResolve, 4, 0, async (cand) => {
      const resolved = await resolveCidByInchiKeyOrName(cand)
      if (resolved && resolved !== cand.pubchemCid) {
        if (densityByCid.has(resolved) || !cand.pubchemCid) {
          cand.pubchemCid = resolved
          fixedCount++
        }
      }
    })
    console.log(`[Stage 2] ${fixedCount} CIDs PubChem résolus/corrigés`)
  }

  // 3. Pre-filter Wikipedia candidates that have a CID present in PubChem Density AND (Melting Point OR Boiling Point)
  const preFilteredWiki = wikiCandidates.filter((c) => {
    if (!c.pubchemCid) return false
    const hasDens = densityByCid.has(c.pubchemCid)
    const hasThermal = mpByCid.has(c.pubchemCid) || bpByCid.has(c.pubchemCid)
    return hasDens && hasThermal
  })
  console.log(
    `[Stage 2] Pré-filtre PubChem (Densité + Fusion/Ébullition) : ${preFilteredWiki.length} candidats Wikipédia retenus sur ${wikiCandidates.length}`,
  )

  // 4. Batch fetch PUG REST identity card (IUPACName, SMILES, InChIKey, Charge)
  const allCidsToFetch = [
    ...curatedCandidates.map((c) => c.pubchemCid).filter((x): x is number => x !== null),
    ...preFilteredWiki.map((c) => c.pubchemCid).filter((x): x is number => x !== null),
  ]
  const pugPropsByCid = await fetchPugRestPropertiesBatch(allCidsToFetch)

  // 5. Targeted PUG View lookups ONLY for pre-filtered candidates missing Color/Form or CAS
  const needDescCids: number[] = []
  const needCasCids: number[] = []
  const needDescSet = new Set<number>()
  const needCasSet = new Set<number>()

  for (const cand of [...curatedCandidates, ...preFilteredWiki]) {
    const cid = cand.pubchemCid
    if (!cid) continue
    if (!colorFormByCid.has(cid) && !needDescSet.has(cid)) {
      needDescSet.add(cid)
      needDescCids.push(cid)
    }
    if (!isValidCasNumber(cand.casNumber) && !needCasSet.has(cid)) {
      needCasSet.add(cid)
      needCasCids.push(cid)
    }
  }

  const physDescByCid = new Map<number, string[]>()
  if (needDescCids.length > 0) {
    console.log(`[Stage 2] Récupération aspect/couleur (Physical Description) pour ${needDescCids.length} CIDs...`)
    await runWithRateLimit(needDescCids, 4, 0, async (cid, idx) => {
      const strs = await fetchPugViewHeadingStrings(cid, 'Physical Description', 'phys-desc')
      if (strs.length) physDescByCid.set(cid, strs)
      if ((idx + 1) % 200 === 0 || idx === needDescCids.length - 1) {
        console.log(`  [Physical Description] ${idx + 1}/${needDescCids.length}`)
      }
    })
  }

  const casStringsByCid = new Map<number, string[]>()
  if (needCasCids.length > 0) {
    console.log(`[Stage 2] Récupération numéro CAS PubChem pour ${needCasCids.length} CIDs...`)
    await runWithRateLimit(needCasCids, 4, 0, async (cid, idx) => {
      const strs = await fetchPugViewHeadingStrings(cid, 'CAS', 'cas')
      if (strs.length) casStringsByCid.set(cid, strs)
      if ((idx + 1) % 200 === 0 || idx === needCasCids.length - 1) {
        console.log(`  [CAS] ${idx + 1}/${needCasCids.length}`)
      }
    })
  }

  // 6. Build enriched entries & enforce STRICT completeness gate
  const finalEntries: EnrichedSpeciesEntry[] = []
  const seenCids = new Set<number>()
  const seenTopologyKeys = new Set<string>()
  const seenIds = new Set<string>()

  const rejectionStats = {
    noPubChemProps: 0,
    noIupacOrInchiKey: 0,
    noValidCas: 0,
    noValidLewis: 0,
    tooLarge: 0,
    noThermal: 0,
    noDensity: 0,
    noSolubility: 0,
    noAppearance: 0,
    duplicate: 0,
  }

  // Helper to fetch curve by formula
  const lookupCurve = (formulaPlain: string): Record<string, number> | null => {
    return solubilityCurves.get(formulaPlain) ?? null
  }

  // 6A. Process all CURATED species first (enriched with PubChem + AqSolDB + IUPAC + curves!)
  for (const cand of curatedCandidates) {
    const seed = cand.curatedId ? curatedById.get(cand.curatedId) : null
    if (!seed) continue

    const cid = cand.pubchemCid
    const prop = cid ? pugPropsByCid.get(cid) : undefined
    const charge = seed.charge ?? 0
    const molarMass =
      computeMolarMassFromComposition(seed.composition, ATOMIC_MASS_BY_SYMBOL) || seed.molarMass

    const smiles = prop?.SMILES ?? prop?.ConnectivitySMILES ?? cand.smilesHint ?? null
    const inchikey = prop?.InChIKey ?? cand.inchikey ?? null
    const iupacName = prop?.IUPACName ?? null
    const casNumber = isValidCasNumber(cand.casNumber)
      ? cand.casNumber
      : cid
        ? extractValidCasFromStrings(casStringsByCid.get(cid) ?? [])
        : null

    const mp = cid ? parseTemperatureC(mpByCid.get(cid) ?? []) : { valueC: null, note: null }
    const bp = cid ? parseTemperatureC(bpByCid.get(cid) ?? []) : { valueC: null, note: null }
    const thermalNote: ThermalNote = mp.note ?? bp.note ?? null

    const isGas = seed.standardState === 'gas' || (bp.valueC !== null && bp.valueC < 20)
    const density =
      cid ? parseDensityGPerCm3(densityByCid.get(cid) ?? [], isGas) : null

    const curve = lookupCurve(seed.formula)
    const aqLogS = inchikey
      ? (aqSolDb.byInchiKey.get(inchikey) ?? aqSolDb.byConnectivity.get(inchikey.split('-')[0]) ?? null)
      : null
    const parsedSol = cid
      ? parseSolubilityWater(solubilityByCid.get(cid) ?? [], molarMass, aqLogS, curve?.['20'] ?? null)
      : { solubilityGPerL: null, miscible: false, insoluble: false, source: null }

    let iupacVals: number[] = []
    let families: string[] = []
    if (smiles) {
      try {
        const mol = Molecule.fromSmiles(smiles)
        iupacVals = iupacPkaByIdCode.get(mol.getIDCode()) ?? []
      } catch {
        // ignore
      }
      const parsedLewis = smilesToLewis(smiles, ATOMIC_MASS_BY_SYMBOL)
      if (parsedLewis) families = parsedLewis.families
    }
    const pkaValues = parsePkaValues(cid ? (pkaByCid.get(cid) ?? []) : [], iupacVals)

    const appearanceRaw = cid
      ? [...(colorFormByCid.get(cid) ?? []), ...(physDescByCid.get(cid) ?? [])]
      : []
    const parsedApp = parseAppearanceAndColor(appearanceRaw, seed.standardState)

    // Register curated topology key & CID for deduplication
    const resolvedLewis = resolveSpeciesLewis(seed, curatedById)
    if (resolvedLewis) {
      seenTopologyKeys.add(computeLewisTopologyKey(resolvedLewis.atoms, resolvedLewis.bonds, false))
    }
    if (cid) seenCids.add(cid)
    seenIds.add(seed.id)

    const aq = seed.aqueous
    const finalSolGPerL =
      aq?.solubilityGPerL !== undefined
        ? aq.solubilityGPerL
        : parsedSol.solubilityGPerL
    const finalDissType: DissolutionType =
      aq?.dissolutionType ??
      (aq?.soluble
        ? seed.kind === 'ionic_compound'
          ? 'ionic_complete'
          : 'molecular'
        : parsedSol.miscible
          ? 'miscible'
          : 'none')

    const curatedDensityFallback =
      typeof seed.behaviors?.densityGPerMl === 'number'
        ? seed.behaviors.densityGPerMl
        : null

    finalEntries.push({
      id: seed.id,
      source: 'curated',
      wikidataId: cand.wikidataId,
      formula: seed.formula,
      displayFormula: seed.displayFormula,
      nameFr: seed.nameFr,
      iupacName,
      casNumber,
      inchikey,
      pubchemCid: cid,
      kind: seed.kind,
      charge,
      molarMass,
      standardState: seed.standardState,
      meltingPointC: mp.valueC,
      boilingPointC: bp.valueC,
      thermalNote,
      densityGPerCm3: density ?? curatedDensityFallback,
      appearanceFr: parsedApp.appearanceFr,
      colorHex: seed.colorHex ?? parsedApp.colorHex ?? null,
      composition: seed.composition,
      smiles,
      popularity: cand.popularity,
      families,
      canDissolveInWater: Boolean(aq?.soluble),
      solubilityGPerL: finalSolGPerL ?? null,
      solubilityByTempC: curve,
      dissolutionType: finalDissType,
      solutionColorHex: aq?.colorHex ?? null,
      phCharacter: aq?.phCharacter ?? 'neutral',
      pkaValues,
      ghsPictograms: [],
      ghsSignalWord: null,
      dissociatesInto: aq?.dissociatesInto?.map((d) => ({
        speciesId: d.speciesId,
        stoichiometry: d.stoichiometry ?? 1,
      })),
      behaviors: {
        ...(seed.behaviors ?? {}),
        ...(density ? { densityGPerMl: density } : {}),
        ...(pkaValues.length > 0 ? { pKa: pkaValues } : {}),
      },
    })
  }

  // 6B. Process Wikipedia FR candidates with STRICT completeness gate (sorted by notoriety)
  const targetWikiCount = Math.max(0, MAX_TOTAL_SPECIES - finalEntries.length)
  let acceptedWiki = 0

  for (const cand of preFilteredWiki) {
    if (acceptedWiki >= targetWikiCount) break
    const cid = cand.pubchemCid!
    if (seenCids.has(cid)) {
      rejectionStats.duplicate++
      continue
    }

    const prop = pugPropsByCid.get(cid)
    if (!prop) {
      rejectionStats.noPubChemProps++
      continue
    }

    // Block A: Identity & structure (ALL mandatory)
    const iupacName = prop.IUPACName?.trim() || null
    const inchikey = prop.InChIKey?.trim() || cand.inchikey || null
    const smiles = prop.SMILES?.trim() || prop.ConnectivitySMILES?.trim() || cand.smilesHint || null
    if (!iupacName || !inchikey || !smiles) {
      rejectionStats.noIupacOrInchiKey++
      continue
    }

    const casNumber = isValidCasNumber(cand.casNumber)
      ? cand.casNumber
      : extractValidCasFromStrings(casStringsByCid.get(cid) ?? [])
    if (!casNumber) {
      rejectionStats.noValidCas++
      continue
    }

    // Must produce a valid 2D Lewis structure & composition
    const parsedLewis = smilesToLewis(smiles, ATOMIC_MASS_BY_SYMBOL)
    if (!parsedLewis) {
      rejectionStats.noValidLewis++
      continue
    }
    const heavyAtoms = Object.entries(parsedLewis.composition)
      .filter(([sym]) => sym !== 'H')
      .reduce((acc, [, n]) => acc + n, 0)
    if (heavyAtoms === 0 || heavyAtoms > MAX_HEAVY_ATOMS) {
      rejectionStats.tooLarge++
      continue
    }

    const topoKey = computeLewisTopologyKey(
      parsedLewis.lewis.atoms,
      parsedLewis.lewis.bonds,
      false,
    )
    if (seenTopologyKeys.has(topoKey)) {
      rejectionStats.duplicate++
      continue
    }

    // Category 1 derived: molarMass, formula, kind
    const molarMass = computeMolarMassFromComposition(
      parsedLewis.composition,
      ATOMIC_MASS_BY_SYMBOL,
    )
    if (molarMass <= 0) {
      rejectionStats.noValidLewis++
      continue
    }
    const charge = parsedLewis.totalCharge ?? 0
    const { formula, displayFormula } = formatHillDisplayFormula(parsedLewis.composition, charge)
    const kind = inferKind(smiles, charge, parsedLewis.composition)

    // Mandatory 2: Melting / Boiling point
    const mp = parseTemperatureC(mpByCid.get(cid) ?? [])
    const bp = parseTemperatureC(bpByCid.get(cid) ?? [])
    if (mp.valueC === null && bp.valueC === null) {
      rejectionStats.noThermal++
      continue
    }
    const thermalNote: ThermalNote = mp.note ?? bp.note ?? null
    const standardState = deriveStandardState(mp.valueC, bp.valueC, 'solid')

    // Mandatory 3: Experimental density
    const density = parseDensityGPerCm3(densityByCid.get(cid) ?? [], standardState === 'gas')
    if (density === null) {
      rejectionStats.noDensity++
      continue
    }

    // Mandatory 4: Experimental water solubility & dissolution type
    const curve = lookupCurve(formula)
    const aqLogS =
      aqSolDb.byInchiKey.get(inchikey) ??
      aqSolDb.byConnectivity.get(inchikey.split('-')[0]) ??
      null
    const parsedSol = parseSolubilityWater(
      solubilityByCid.get(cid) ?? [],
      molarMass,
      aqLogS,
      curve?.['20'] ?? null,
    )
    if (!parsedSol.miscible && parsedSol.solubilityGPerL === null) {
      rejectionStats.noSolubility++
      continue
    }

    // Mandatory 5: Appearance & pure color
    const appRaw = [...(colorFormByCid.get(cid) ?? []), ...(physDescByCid.get(cid) ?? [])]
    const parsedApp = parseAppearanceAndColor(appRaw, standardState)
    if (!parsedApp.appearanceFr || !parsedApp.colorHex) {
      rejectionStats.noAppearance++
      continue
    }

    // Optional bonus: pKa (IUPAC priority + PubChem)
    let iupacVals: number[] = []
    try {
      const mol = Molecule.fromSmiles(smiles)
      iupacVals = iupacPkaByIdCode.get(mol.getIDCode()) ?? []
    } catch {
      // ignore
    }
    const pkaValues = parsePkaValues(pkaByCid.get(cid) ?? [], iupacVals)

    const dissolutionType = deriveDissolutionType(kind, parsedSol, pkaValues)
    const canDissolveInWater =
      dissolutionType !== 'none' &&
      (parsedSol.miscible || (parsedSol.solubilityGPerL ?? 0) >= 0.1)
    const phCharacter = derivePhCharacter(pkaValues, parsedLewis.families, smiles)
    const dissociatesInto =
      kind === 'ionic_compound' && canDissolveInWater
        ? inferSaltDissociation(smiles)
        : undefined
    const solutionColorHex =
      dissociatesInto?.map((d) => ION_SOLUTION_COLORS[d.speciesId]).find(Boolean) ?? null

    const id = `cid_${cid}`
    if (seenIds.has(id)) {
      rejectionStats.duplicate++
      continue
    }

    seenCids.add(cid)
    seenTopologyKeys.add(topoKey)
    seenIds.add(id)
    acceptedWiki++

    finalEntries.push({
      id,
      source: 'wikidata',
      wikidataId: cand.wikidataId,
      formula,
      displayFormula,
      nameFr: cand.nameFr,
      iupacName,
      casNumber,
      inchikey,
      pubchemCid: cid,
      kind,
      charge,
      molarMass,
      standardState,
      meltingPointC: mp.valueC,
      boilingPointC: bp.valueC,
      thermalNote,
      densityGPerCm3: density,
      appearanceFr: parsedApp.appearanceFr,
      colorHex: parsedApp.colorHex,
      composition: parsedLewis.composition,
      smiles,
      popularity: cand.popularity,
      families: parsedLewis.families,
      canDissolveInWater,
      solubilityGPerL: parsedSol.solubilityGPerL,
      solubilityByTempC: curve,
      dissolutionType,
      solutionColorHex,
      phCharacter,
      pkaValues,
      ghsPictograms: [],
      ghsSignalWord: null,
      dissociatesInto,
      behaviors: {
        densityGPerMl: density,
        ...(pkaValues.length > 0 ? { pKa: pkaValues } : {}),
        ...(parsedSol.source ? { solubilitySource: parsedSol.source } : {}),
      },
    })
  }

  // 7. Bonus: Fetch GHS safety pictograms for the final accepted species (cached on disk!)
  const ghsTargets = finalEntries.filter((e) => e.pubchemCid !== null)
  console.log(`[Stage 2] Bonus SGH/GHS : récupération des pictogrammes pour ${ghsTargets.length} espèces finales...`)
  await runWithRateLimit(ghsTargets, 4, 0, async (entry, idx) => {
    const ghs = await fetchPugViewGhs(entry.pubchemCid!)
    entry.ghsPictograms = ghs.pictograms
    entry.ghsSignalWord = ghs.signalWord
    if ((idx + 1) % 250 === 0 || idx === ghsTargets.length - 1) {
      console.log(`  [GHS] ${idx + 1}/${ghsTargets.length}`)
    }
  })

  // Write final enriched output
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(finalEntries), 'utf8')

  const withCurves = finalEntries.filter((e) => e.solubilityByTempC !== null).length
  const withPka = finalEntries.filter((e) => e.pkaValues.length > 0).length
  const withGhs = finalEntries.filter((e) => e.ghsPictograms.length > 0).length
  const curatedCount = finalEntries.filter((e) => e.source === 'curated').length
  const wikiCount = finalEntries.filter((e) => e.source === 'wikidata').length

  console.log('\n=== RAPPORT D’ENRICHISSEMENT (ÉTAPE 2) ===')
  console.log(`Total final retenu   : ${finalEntries.length} espèces (${curatedCount} curatées + ${wikiCount} Wikipédia complètes)`)
  console.log(`Bonus courbes 0-100° : ${withCurves} espèces`)
  console.log(`Bonus pKa (IUPAC+PC) : ${withPka} espèces`)
  console.log(`Bonus SGH/GHS        : ${withGhs} espèces`)
  console.log('Rejets stricts (candidats pré-filtrés Wikipédia) :', rejectionStats)
  console.log(`Écrit dans ${path.relative(process.cwd(), OUT_PATH)} (${(fs.statSync(OUT_PATH).size / 1024 / 1024).toFixed(2)} Mo)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
