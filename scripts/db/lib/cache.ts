import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const CACHE_ROOT = path.resolve(__dirname, '../.cache')

export const USER_AGENT =
  'DeltaLab/2.0 (https://deltalab.local; educational chemistry workbench)'

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function ensureDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

export function getCachePath(namespace: string, key: string, ext = 'json'): string {
  const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, '_')
  return path.join(CACHE_ROOT, namespace, `${safeKey}.${ext}`)
}

export function readCacheJson<T>(namespace: string, key: string): T | null {
  const fp = getCachePath(namespace, key, 'json')
  if (!fs.existsSync(fp)) return null
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8')) as T
  } catch {
    return null
  }
}

export function writeCacheJson(namespace: string, key: string, data: unknown): void {
  const fp = getCachePath(namespace, key, 'json')
  ensureDir(fp)
  fs.writeFileSync(fp, JSON.stringify(data))
}

export function readCacheText(namespace: string, key: string, ext = 'txt'): string | null {
  const fp = getCachePath(namespace, key, ext)
  if (!fs.existsSync(fp)) return null
  try {
    return fs.readFileSync(fp, 'utf8')
  } catch {
    return null
  }
}

export function writeCacheText(
  namespace: string,
  key: string,
  text: string,
  ext = 'txt',
): void {
  const fp = getCachePath(namespace, key, ext)
  ensureDir(fp)
  fs.writeFileSync(fp, text, 'utf8')
}

let lastPubChemNetAt = 0

async function waitPubChemSlot() {
  const now = Date.now()
  const wait = Math.max(0, lastPubChemNetAt + 215 - now)
  lastPubChemNetAt = now + wait
  if (wait > 0) await sleep(wait)
}

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retries = 4,
): Promise<Response> {
  const isPubChem = url.includes('pubchem.ncbi.nlm.nih.gov')
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (isPubChem) await waitPubChemSlot()
      const res = await fetch(url, {
        ...init,
        signal: init?.signal ?? AbortSignal.timeout(25000),
        headers: {
          'User-Agent': USER_AGENT,
          ...(init?.headers ?? {}),
        },
      })
      if (res.status === 429 || res.status === 503 || res.status === 504 || res.status === 500) {
        const waitMs = Math.min(12000, 1400 * attempt * attempt)
        await sleep(waitMs)
        continue
      }
      return res
    } catch (err) {
      if (attempt === retries) throw err
      await sleep(1200 * attempt)
    }
  }
  throw new Error(`Fetch retries exhausted for ${url.slice(0, 140)}`)
}

export async function fetchJsonCached<T>(
  namespace: string,
  key: string,
  url: string,
  init?: RequestInit,
  allow404Null = false,
): Promise<T | null> {
  const cached = readCacheJson<{ __notFound?: boolean; data?: T }>(namespace, key)
  if (cached !== null) {
    if (cached.__notFound) return null
    return (cached.data ?? (cached as unknown as T))
  }

  const res = await fetchWithRetry(url, init)
  if (res.status === 404 && allow404Null) {
    writeCacheJson(namespace, key, { __notFound: true })
    return null
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} on ${url.slice(0, 140)}`)
  }
  const data = (await res.json()) as T
  writeCacheJson(namespace, key, { data })
  return data
}

export async function fetchTextCached(
  namespace: string,
  key: string,
  url: string,
  ext = 'txt',
): Promise<string> {
  const cached = readCacheText(namespace, key, ext)
  if (cached !== null) return cached
  const res = await fetchWithRetry(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} on ${url.slice(0, 140)}`)
  }
  const text = await res.text()
  writeCacheText(namespace, key, text, ext)
  return text
}

/**
 * Simple rate-limited parallel runner respecting polite API limits (e.g. PubChem 4-5 req/s).
 */
export async function runWithRateLimit<T, R>(
  items: T[],
  concurrency: number,
  minIntervalMs: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIdx = 0
  let lastStart = 0

  async function runOne() {
    while (true) {
      const idx = nextIdx++
      if (idx >= items.length) return
      if (minIntervalMs > 0) {
        const now = Date.now()
        const wait = Math.max(0, lastStart + minIntervalMs - now)
        lastStart = now + wait
        if (wait > 0) await sleep(wait)
      }
      results[idx] = await worker(items[idx], idx)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runOne())
  await Promise.all(workers)
  return results
}
