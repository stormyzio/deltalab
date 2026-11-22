import type {
  CanvasAtomNode,
  CanvasFlaskNode,
  CanvasMoleculeNode,
  CanvasNode,
  CanvasSolidNode,
} from '../../shared/chemistry.ts'
import { createEmptySolution } from './chemistry-ui'
import { createNodeId } from './workbench-helpers'

export const WORKBENCH_FILE_FORMAT = 'deltalab-workbench' as const
export const WORKBENCH_FILE_VERSION = 1 as const

export interface DeltaLabWorkbenchFile {
  format: typeof WORKBENCH_FILE_FORMAT
  version: typeof WORKBENCH_FILE_VERSION
  name: string
  exportedAt: string
  nodes: CanvasNode[]
  discoveredSpeciesIds: string[]
}

export type ParseWorkbenchFileResult =
  | {
      ok: true
      name: string
      nodes: CanvasNode[]
      discoveredSpeciesIds: string[]
      skippedNodes: number
    }
  | {
      ok: false
      errorFr: string
    }

function slugifyWorkbenchFilename(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return `${base || 'paillasse-deltalab'}.deltalab.json`
}

function stripFileExtension(filename: string): string {
  return filename
    .replace(/\.deltalab\.json$/i, '')
    .replace(/\.json$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim()
}

function normalizeImportedNode(raw: unknown): CanvasNode | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const kind = obj.kind
  const x = typeof obj.x === 'number' && Number.isFinite(obj.x) ? obj.x : 0
  const y = typeof obj.y === 'number' && Number.isFinite(obj.y) ? obj.y : 0
  const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id : createNodeId('node')

  if (kind === 'atom') {
    if (typeof obj.symbol !== 'string' || typeof obj.atomicNumber !== 'number') return null
    return {
      ...(obj as unknown as CanvasAtomNode),
      id,
      kind: 'atom',
      x,
      y,
    }
  }

  if (kind === 'molecule') {
    const sp = obj.species as Record<string, unknown> | undefined
    if (!sp || typeof sp !== 'object' || typeof sp.id !== 'string' || typeof sp.formula !== 'string') {
      return null
    }
    const amountMol =
      typeof obj.amountMol === 'number' && Number.isFinite(obj.amountMol) && obj.amountMol > 0
        ? obj.amountMol
        : 0.1
    return {
      ...(obj as unknown as CanvasMoleculeNode),
      id,
      kind: 'molecule',
      x,
      y,
      amountMol,
    }
  }

  if (kind === 'solid') {
    if (!Array.isArray(obj.components) || obj.components.length === 0) return null
    const densityGPerCm3 =
      typeof obj.densityGPerCm3 === 'number' && Number.isFinite(obj.densityGPerCm3) && obj.densityGPerCm3 > 0
        ? obj.densityGPerCm3
        : 7.5
    return {
      ...(obj as unknown as CanvasSolidNode),
      id,
      kind: 'solid',
      x,
      y,
      densityGPerCm3,
    }
  }

  if (kind === 'flask') {
    const vessel = obj.vessel as Record<string, unknown> | undefined
    if (!vessel || typeof vessel !== 'object' || typeof vessel.vesselType !== 'string') {
      return null
    }
    const flask = obj as unknown as CanvasFlaskNode
    // Migrate legacy standalone filtration_funnel to erlenmeyer + hasFilter
    const isLegacyFunnel =
      vessel.id === 'filtration_250' || (vessel.vesselType as string) === 'filtration_funnel'
    const solution =
      flask.solution && typeof flask.solution === 'object'
        ? flask.solution
        : createEmptySolution()
    return {
      ...flask,
      id,
      kind: 'flask',
      x,
      y,
      hasFilter: isLegacyFunnel ? true : Boolean(flask.hasFilter),
      vessel: isLegacyFunnel
        ? {
            ...flask.vessel,
            id: 'erlenmeyer_250',
            nameFr: 'Erlenmeyer',
            vesselType: 'erlenmeyer',
            availableCapacitiesMl: [100, 250, 500, 1000, 2000, 5000],
            supportsHeating: true,
            stopperable: true,
          }
        : flask.vessel,
      solution,
      temperatureC:
        typeof flask.temperatureC === 'number' && Number.isFinite(flask.temperatureC)
          ? flask.temperatureC
          : 20,
    }
  }

  return null
}

export function buildWorkbenchExportPayload(
  name: string,
  nodes: CanvasNode[],
  discoveredSpeciesIds: string[],
): DeltaLabWorkbenchFile {
  return {
    format: WORKBENCH_FILE_FORMAT,
    version: WORKBENCH_FILE_VERSION,
    name: name.trim() || 'Paillasse DeltaLab',
    exportedAt: new Date().toISOString(),
    nodes: JSON.parse(JSON.stringify(nodes)) as CanvasNode[],
    discoveredSpeciesIds: [...discoveredSpeciesIds],
  }
}

export function downloadWorkbenchFile(payload: DeltaLabWorkbenchFile): string {
  const filename = slugifyWorkbenchFilename(payload.name)
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return filename
}

export function parseWorkbenchFile(
  rawText: string,
  fallbackFilename?: string,
): ParseWorkbenchFileResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return { ok: false, errorFr: 'Fichier JSON invalide ou corrompu.' }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, errorFr: 'Format de fichier de paillasse non reconnu.' }
  }

  const obj = parsed as Record<string, unknown>
  if (obj.format !== undefined && obj.format !== WORKBENCH_FILE_FORMAT) {
    return {
      ok: false,
      errorFr: 'Ce fichier n’est pas un export de paillasse DeltaLab.',
    }
  }

  if (!Array.isArray(obj.nodes)) {
    return {
      ok: false,
      errorFr: 'Le fichier ne contient aucune liste d’éléments valide.',
    }
  }

  const nodes: CanvasNode[] = []
  let skippedNodes = 0
  for (const item of obj.nodes) {
    const normalized = normalizeImportedNode(item)
    if (normalized) nodes.push(normalized)
    else skippedNodes++
  }

  if (nodes.length === 0) {
    return {
      ok: false,
      errorFr: 'La paillasse importée ne contient aucun élément valide.',
    }
  }

  const rawName =
    typeof obj.name === 'string' && obj.name.trim()
      ? obj.name.trim().slice(0, 60)
      : fallbackFilename
        ? stripFileExtension(fallbackFilename).slice(0, 60)
        : 'Paillasse importée'

  const discoveredSpeciesIds = Array.isArray(obj.discoveredSpeciesIds)
    ? obj.discoveredSpeciesIds.filter((s): s is string => typeof s === 'string')
    : []

  return {
    ok: true,
    name: rawName || 'Paillasse importée',
    nodes,
    discoveredSpeciesIds,
    skippedNodes,
  }
}

export function cloneNodesWithFreshIds(
  nodes: CanvasNode[],
  offsetX = 0,
  offsetY = 0,
): CanvasNode[] {
  const copy = JSON.parse(JSON.stringify(nodes)) as CanvasNode[]
  return copy.map((node) => ({
    ...node,
    id: createNodeId(node.kind),
    x: Math.round(node.x + offsetX),
    y: Math.round(node.y + offsetY),
  }))
}

export function summarizeWorkbenchNodes(nodes: CanvasNode[]): string {
  if (nodes.length === 0) return 'Vide'
  let flasks = 0
  let solids = 0
  let molecules = 0
  let atoms = 0
  for (const n of nodes) {
    if (n.kind === 'flask') flasks++
    else if (n.kind === 'solid') solids++
    else if (n.kind === 'molecule') molecules++
    else if (n.kind === 'atom') atoms++
  }
  const parts: string[] = []
  if (flasks > 0) parts.push(`${flasks} verrerie${flasks > 1 ? 's' : ''}`)
  if (solids > 0) parts.push(`${solids} solide${solids > 1 ? 's' : ''}`)
  if (molecules > 0) parts.push(`${molecules} espèce${molecules > 1 ? 's' : ''}`)
  if (atoms > 0) parts.push(`${atoms} atome${atoms > 1 ? 's' : ''}`)
  return parts.join(' · ')
}

export function formatRelativeSavedTime(isoString: string): string {
  const ts = Date.parse(isoString)
  if (!Number.isFinite(ts)) return ''
  const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (diffSec < 45) return 'À l’instant'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `Il y a ${diffMin} min`
  const diffHours = Math.round(diffMin / 60)
  if (diffHours < 24) return `Il y a ${diffHours} h`
  const date = new Date(ts)
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Hier'
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
