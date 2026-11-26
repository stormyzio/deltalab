export interface ScrubUnitOption {
  id: string
  label: string
  /** Multiply displayed value by this factor to obtain base value */
  toBase: number
  /** Natural single-step increment in this displayed unit */
  step?: number
}

export const MOL_UNITS: ScrubUnitOption[] = [
  { id: 'mmol', label: 'mmol', toBase: 0.001, step: 0.1 },
  { id: 'mol', label: 'mol', toBase: 1, step: 0.001 },
]

export const MASS_UNITS: ScrubUnitOption[] = [
  { id: 'g', label: 'g', toBase: 1, step: 0.05 },
  { id: 'mg', label: 'mg', toBase: 0.001, step: 1 },
]

export const SOLID_MASS_UNITS: ScrubUnitOption[] = [
  { id: 'g', label: 'g', toBase: 1, step: 0.5 },
  { id: 'mg', label: 'mg', toBase: 0.001, step: 10 },
  { id: 'kg', label: 'kg', toBase: 1000, step: 0.01 },
]

export const SOLID_VOLUME_UNITS: ScrubUnitOption[] = [
  { id: 'cm3', label: 'cm³', toBase: 1, step: 0.1 },
  { id: 'mm3', label: 'mm³', toBase: 0.001, step: 10 },
  { id: 'dm3', label: 'dm³', toBase: 1000, step: 0.01 },
]

export const VOLUME_UNITS: ScrubUnitOption[] = [
  { id: 'mL', label: 'mL', toBase: 1, step: 1 },
  { id: 'L', label: 'L', toBase: 1000, step: 0.01 },
]

export const CONC_MOL_UNITS: ScrubUnitOption[] = [
  { id: 'mol/L', label: 'mol/L', toBase: 1, step: 0.01 },
  { id: 'mmol/L', label: 'mmol/L', toBase: 0.001, step: 1 },
]

export const CONC_MASS_UNITS: ScrubUnitOption[] = [
  { id: 'g/L', label: 'g/L', toBase: 1, step: 0.1 },
  { id: 'mg/L', label: 'mg/L', toBase: 0.001, step: 1 },
]
