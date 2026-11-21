import type { PhCharacter, PhysicalState } from '../../shared/chemistry.ts'
import { smilesToLewis, type ParsedSmilesSpecies } from './smiles-lewis.ts'

const USER_AGENT = 'DeltaLab/1.0 (https://deltalab.local; educational chemistry app)'

export interface PubChemLookupResult {
  id: string
  nameFr: string
  pubchemCid: number
  inchikey: string | null
  wikidataId: string | null
  popularity: number
  standardState: PhysicalState
  phCharacter: PhCharacter
  parsed: ParsedSmilesSpecies
  behaviors: Record<string, unknown>
}

interface PubChemPropertyRow {
  CID?: number
  Title?: string
  IUPACName?: string
  CanonicalSMILES?: string
  ConnectivitySMILES?: string
  SMILES?: string
  InChIKey?: string
}

async function fetchWikidataFrenchMeta(inchikey: string): Promise<{
  qid: string
  labelFr: string | null
  sitelinks: number
  meltingPointC: number | null
  boilingPointC: number | null
  pKa: number | null
} | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3500)
  try {
    const sparql = `
SELECT ?item
  (SAMPLE(?lbl) AS ?labelFr)
  (MAX(?sl) AS ?sitelinks)
  (SAMPLE(?mpK) AS ?mpKelvin)
  (SAMPLE(?bpK) AS ?bpKelvin)
  (SAMPLE(?pkaVal) AS ?pka)
WHERE {
  ?item wdt:P235 "${inchikey.replace(/[^A-Z0-9-]/g, '')}" .
  OPTIONAL { ?item rdfs:label ?lbl . FILTER(LANG(?lbl) = "fr") }
  OPTIONAL { ?item wikibase:sitelinks ?sl . }
  OPTIONAL { ?item p:P2101/psn:P2101/wikibase:quantityAmount ?mpK . }
  OPTIONAL { ?item p:P2102/psn:P2102/wikibase:quantityAmount ?bpK . }
  OPTIONAL { ?item wdt:P1117 ?pkaVal . }
}
GROUP BY ?item
LIMIT 1
`
    const res = await fetch('https://query.wikidata.org/sparql', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/sparql-results+json',
      },
      body: new URLSearchParams({ query: sparql }).toString(),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      results?: { bindings?: Array<Record<string, { value: string }>> }
    }
    const row = data.results?.bindings?.[0]
    if (!row) return null
    const qid = (row.item?.value ?? '').split('/').pop() ?? ''
    const mpK = row.mpKelvin?.value ? Number(row.mpKelvin.value) : null
    const bpK = row.bpKelvin?.value ? Number(row.bpKelvin.value) : null
    const pka = row.pka?.value ? Number(row.pka.value) : null

    return {
      qid,
      labelFr: row.labelFr?.value ?? null,
      sitelinks: row.sitelinks?.value ? Math.trunc(Number(row.sitelinks.value)) : 1,
      meltingPointC:
        mpK !== null && Number.isFinite(mpK) && mpK > 0 && mpK < 6000
          ? Math.round((mpK - 273.15) * 10) / 10
          : null,
      boilingPointC:
        bpK !== null && Number.isFinite(bpK) && bpK > 0 && bpK < 6000
          ? Math.round((bpK - 273.15) * 10) / 10
          : null,
      pKa:
        pka !== null && Number.isFinite(pka) && pka > -20 && pka < 50
          ? Math.round(pka * 100) / 100
          : null,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function capitalizeTitle(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  if (/^[a-zéèêëàâîïôùûç]/.test(s) && !/^[a-z]-/i.test(s)) {
    return s[0].toUpperCase() + s.slice(1)
  }
  return s
}

export async function lookupSpeciesOnPubChem(
  smiles: string,
  atomicMassBySymbol: Map<string, number>,
): Promise<PubChemLookupResult | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)

  let prop: PubChemPropertyRow | undefined
  try {
    const res = await fetch(
      'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/property/Title,IUPACName,CanonicalSMILES,ConnectivitySMILES,InChIKey/JSON',
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({ smiles }).toString(),
      },
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      PropertyTable?: { Properties?: PubChemPropertyRow[] }
    }
    prop = data.PropertyTable?.Properties?.[0]
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }

  if (!prop?.CID) return null

  const resolvedSmiles =
    prop.CanonicalSMILES ?? prop.ConnectivitySMILES ?? prop.SMILES ?? smiles
  const parsed = smilesToLewis(resolvedSmiles, atomicMassBySymbol, {
    maxHeavyAtoms: 32,
    maxTotalAtoms: 80,
    maxMolarMass: 600,
  })
  if (!parsed) return null

  const inchikey = prop.InChIKey ?? null
  const wdMeta = inchikey ? await fetchWikidataFrenchMeta(inchikey) : null

  const rawName =
    wdMeta?.labelFr ?? prop.Title ?? prop.IUPACName ?? `Composé PubChem #${prop.CID}`
  const nameFr = capitalizeTitle(rawName)

  const mpC = wdMeta?.meltingPointC ?? null
  const bpC = wdMeta?.boilingPointC ?? null
  let standardState: PhysicalState = 'solid'
  if (parsed.kind === 'ion') standardState = 'aqueous'
  else if (bpC !== null && bpC < 20) standardState = 'gas'
  else if (mpC !== null && mpC > 20) standardState = 'solid'
  else if (mpC !== null && mpC <= 20) standardState = 'liquid'

  let phCharacter: PhCharacter = 'neutral'
  if (parsed.families.includes('Acide carboxylique') && !parsed.families.includes('Acide aminé')) {
    phCharacter = 'acidic_weak'
  } else if (parsed.families.includes('Amine') && !parsed.families.includes('Acide carboxylique')) {
    phCharacter = 'basic_weak'
  }

  const behaviors: Record<string, unknown> = {
    pubchemCid: prop.CID,
  }
  if (prop.IUPACName) behaviors.iupacName = prop.IUPACName
  if (mpC !== null) behaviors.meltingPointC = mpC
  if (bpC !== null) behaviors.boilingPointC = bpC
  if (wdMeta?.pKa != null) behaviors.pKa = wdMeta.pKa
  if (parsed.families.length > 0) behaviors.families = parsed.families
  if (wdMeta?.qid) behaviors.wikidataId = wdMeta.qid

  return {
    id: `pc_${prop.CID}`,
    nameFr,
    pubchemCid: prop.CID,
    inchikey,
    wikidataId: wdMeta?.qid ?? null,
    popularity: wdMeta?.sitelinks ?? 1,
    standardState,
    phCharacter,
    parsed,
    behaviors,
  }
}
