import type { ElementRecord, SpeciesRecord, VesselRecord } from '../../shared/chemistry.ts'

export type ExternalDragItem =
  | { kind: 'atom'; element: ElementRecord }
  | { kind: 'vessel'; vessel: VesselRecord }
  | { kind: 'molecule'; species: SpeciesRecord }
  | { kind: 'gas_collector' }
  | { kind: 'thermal_chamber'; initialTargetC?: number }

export interface ActiveExternalDrag {
  item: ExternalDragItem
  clientX: number
  clientY: number
  started: boolean
  originX: number
  originY: number
}
