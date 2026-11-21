export interface ScrubUnitOption {
  id: string
  label: string
  /** Multiply displayed value by this factor to obtain base value */
  toBase: number
}

export const MOL_UNITS: ScrubUnitOption[] = [
  { id: 'mmol', label: 'mmol', toBase: 0.001 },
  { id: 'mol', label: 'mol', toBase: 1 },
]

export const MASS_UNITS: ScrubUnitOption[] = [
  { id: 'g', label: 'g', toBase: 1 },
  { id: 'mg', label: 'mg', toBase: 0.001 },
]

export const VOLUME_UNITS: ScrubUnitOption[] = [
  { id: 'mL', label: 'mL', toBase: 1 },
  { id: 'L', label: 'L', toBase: 1000 },
]

export const CONC_MOL_UNITS: ScrubUnitOption[] = [
  { id: 'M', label: 'M', toBase: 1 },
  { id: 'mM', label: 'mM', toBase: 0.001 },
]

export const CONC_MASS_UNITS: ScrubUnitOption[] = [
  { id: 'g/L', label: 'g/L', toBase: 1 },
  { id: 'mg/L', label: 'mg/L', toBase: 0.001 },
]
