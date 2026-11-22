import type {
  CanvasNode,
  FlaskProbeType,
  PhIndicatorId,
  VesselType,
} from '../../shared/chemistry.ts'

export interface LabPresetFlaskSpec {
  key: string
  vesselType: VesselType
  capacityMl?: number
  dx: number
  dy: number
  customLabel: string
  waterVolumeMl: number
  solutesMol: Record<string, number>
  temperatureC?: number
  pourStepMl?: number | null
  indicatorId?: PhIndicatorId | null
  probes?: FlaskProbeType[]
  stirrerOn?: boolean
  heaterTargetC?: number | null
}

export interface LabPresetDefinition {
  id: string
  titleFr: string
  subtitleFr: string
  categoryFr: 'Titrage' | 'Précipitation' | 'Cinétique & Gaz'
  /** If set, automatically opens the titration panel pairing these flask keys */
  autoTitration?: {
    buretteKey: string
    analyteKey: string
  }
  flasks: LabPresetFlaskSpec[]
}

export const LAB_TP_PRESETS: LabPresetDefinition[] = [
  {
    id: 'tp_titrage_vinaigre',
    titleFr: 'Titrage du vinaigre',
    subtitleFr: 'CH₃COOH (0,10 M) titré par NaOH (0,10 M) · phénolphtaléine',
    categoryFr: 'Titrage',
    autoTitration: { buretteKey: 'burette', analyteKey: 'erlen' },
    flasks: [
      {
        key: 'burette',
        vesselType: 'burette',
        capacityMl: 50,
        dx: -140,
        dy: -30,
        customLabel: 'Titrant · NaOH 0,10 M',
        waterVolumeMl: 45,
        solutesMol: { naoh: 0.0045 },
        pourStepMl: 1,
      },
      {
        key: 'erlen',
        vesselType: 'erlenmeyer',
        capacityMl: 250,
        dx: 140,
        dy: -10,
        customLabel: 'Vinaigre · CH₃COOH',
        waterVolumeMl: 20,
        solutesMol: { ch3cooh: 0.002 },
        indicatorId: 'phenolphthalein',
        probes: ['ph'],
        stirrerOn: true,
      },
    ],
  },
  {
    id: 'tp_titrage_hcl_naoh',
    titleFr: 'Titrage acide fort / base forte',
    subtitleFr: 'HCl (0,08 M) par NaOH (0,10 M) · BBT + pH-mètre + conductimètre',
    categoryFr: 'Titrage',
    autoTitration: { buretteKey: 'burette', analyteKey: 'becher' },
    flasks: [
      {
        key: 'burette',
        vesselType: 'burette',
        capacityMl: 50,
        dx: -120,
        dy: -15,
        customLabel: 'Titrant · NaOH 0,10 M',
        waterVolumeMl: 40,
        solutesMol: { naoh: 0.004 },
        pourStepMl: 1,
      },
      {
        key: 'becher',
        vesselType: 'beaker',
        capacityMl: 250,
        dx: 120,
        dy: 10,
        customLabel: 'HCl à titrer',
        waterVolumeMl: 25,
        solutesMol: { hcl: 0.002 },
        indicatorId: 'bbt',
        probes: ['ph', 'conductimeter'],
        stirrerOn: true,
      },
    ],
  },
  {
    id: 'tp_titrage_h3po4',
    titleFr: 'Titrage polyacide (H₃PO₄)',
    subtitleFr: 'Double saut de pH · H₃PO₄ (0,10 M) par NaOH (0,20 M)',
    categoryFr: 'Titrage',
    autoTitration: { buretteKey: 'burette', analyteKey: 'becher' },
    flasks: [
      {
        key: 'burette',
        vesselType: 'burette',
        capacityMl: 50,
        dx: -120,
        dy: -15,
        customLabel: 'Titrant · NaOH 0,20 M',
        waterVolumeMl: 45,
        solutesMol: { naoh: 0.009 },
        pourStepMl: 1,
      },
      {
        key: 'becher',
        vesselType: 'beaker',
        capacityMl: 250,
        dx: 120,
        dy: 10,
        customLabel: 'Acide phosphorique',
        waterVolumeMl: 20,
        solutesMol: { h3po4: 0.002 },
        indicatorId: 'universal',
        probes: ['ph'],
        stirrerOn: true,
      },
    ],
  },
  {
    id: 'tp_tests_ions',
    titleFr: 'Reconnaissance d’ions',
    subtitleFr: 'Verser NaOH ou AgNO₃ sur Cu²⁺, Fe³⁺ et Cl⁻ pour précipiter',
    categoryFr: 'Précipitation',
    flasks: [
      {
        key: 'tube_cu',
        vesselType: 'test_tube',
        capacityMl: 25,
        dx: -245,
        dy: 120,
        customLabel: 'Tube A · Cu²⁺',
        waterVolumeMl: 10,
        solutesMol: { cuso4: 0.002 },
      },
      {
        key: 'tube_fe',
        vesselType: 'test_tube',
        capacityMl: 25,
        dx: 0,
        dy: 120,
        customLabel: 'Tube B · Fe³⁺',
        waterVolumeMl: 10,
        solutesMol: { fecl3: 0.002 },
      },
      {
        key: 'tube_cl',
        vesselType: 'test_tube',
        capacityMl: 25,
        dx: 245,
        dy: 120,
        customLabel: 'Tube C · Cl⁻',
        waterVolumeMl: 10,
        solutesMol: { nacl: 0.002 },
      },
      {
        key: 'reactif_naoh',
        vesselType: 'beaker',
        capacityMl: 100,
        dx: -135,
        dy: -175,
        customLabel: 'Réactif · NaOH',
        waterVolumeMl: 40,
        solutesMol: { naoh: 0.02 },
        pourStepMl: 5,
      },
      {
        key: 'reactif_agno3',
        vesselType: 'beaker',
        capacityMl: 100,
        dx: 135,
        dy: -175,
        customLabel: 'Réactif · AgNO₃',
        waterVolumeMl: 40,
        solutesMol: { agno3: 0.01 },
        pourStepMl: 5,
      },
    ],
  },
  {
    id: 'tp_attaque_zinc',
    titleFr: 'Attaque du zinc par HCl',
    subtitleFr: 'Effervescence de H₂, thermomètre et chauffage Arrhenius',
    categoryFr: 'Cinétique & Gaz',
    flasks: [
      {
        key: 'erlen_zn',
        vesselType: 'erlenmeyer',
        capacityMl: 250,
        dx: 0,
        dy: 0,
        customLabel: 'Zn(s) + HCl(aq)',
        waterVolumeMl: 60,
        solutesMol: { hcl: 0.06, zn_solid: 0.02 },
        probes: ['ph', 'thermometer'],
        stirrerOn: true,
        heaterTargetC: 45,
      },
    ],
  },
]

export interface SavedWorkbenchRecord {
  id: string
  name: string
  savedAt: string
  updatedAt?: string
  nodeCount: number
  nodes: CanvasNode[]
  discoveredSpeciesIds: string[]
}

const SAVED_BENCHES_KEY = 'deltalab:saved-benches:v1'
const MAX_SAVED_BENCHES = 50

export function loadSavedWorkbenches(): SavedWorkbenchRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(SAVED_BENCHES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (item): item is SavedWorkbenchRecord =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as SavedWorkbenchRecord).id === 'string' &&
          typeof (item as SavedWorkbenchRecord).name === 'string' &&
          Array.isArray((item as SavedWorkbenchRecord).nodes),
      )
      .map((item) => ({
        ...item,
        nodeCount: item.nodes.length,
        updatedAt: item.updatedAt ?? item.savedAt,
        discoveredSpeciesIds: Array.isArray(item.discoveredSpeciesIds)
          ? item.discoveredSpeciesIds
          : [],
      }))
  } catch {
    return []
  }
}

export function persistSavedWorkbenches(list: SavedWorkbenchRecord[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      SAVED_BENCHES_KEY,
      JSON.stringify(list.slice(0, MAX_SAVED_BENCHES)),
    )
  } catch {
    // ignore storage quota errors
  }
}
