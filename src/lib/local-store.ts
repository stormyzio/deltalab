import type { WorkspaceSnapshot } from '../../shared/chemistry.ts'

const WORKSPACE_STORAGE_KEY = 'deltalab:workspace:v1'

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
    const rawNodes = Array.isArray(parsed.nodes) ? parsed.nodes : []
    // Migrate legacy standalone filtration_funnel vessels to erlenmeyer + hasFilter
    const nodes = rawNodes.map((n) => {
      if (
        n &&
        n.kind === 'flask' &&
        (n.vessel.id === 'filtration_250' ||
          (n.vessel.vesselType as string) === 'filtration_funnel')
      ) {
        return {
          ...n,
          hasFilter: true,
          vessel: {
            ...n.vessel,
            id: 'erlenmeyer_250',
            nameFr: 'Erlenmeyer',
            vesselType: 'erlenmeyer' as const,
            availableCapacitiesMl: [100, 250, 500, 1000, 2000, 5000],
            supportsHeating: true,
            stopperable: true,
          },
        }
      }
      return n
    })
    return {
      nodes,
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
