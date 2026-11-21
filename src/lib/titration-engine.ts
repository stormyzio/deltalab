import type {
  CanvasFlaskNode,
  DissolvedSpeciesItem,
  PhIndicatorId,
} from '../../shared/chemistry.ts'
import {
  computeSolutionConductivityMsCm,
  solveExactPh,
} from '../../shared/ph-solver.ts'
import { evaluateIndicatorVisual } from './lab-indicators'

export interface TitrationPoint {
  volumeAddedMl: number
  ph: number
  conductivityMsCm: number
  dpHdV: number
  indicatorColorHex: string | null
}

export interface EquivalencePoint {
  volumeMl: number
  ph: number
  slope: number
}

export interface TitrationAnalysis {
  titrantLabel: string
  analyteLabel: string
  titrantConcMolL: number | null
  initialAnalyteVolumeMl: number
  buretteRemainingMl: number
  equivalences: EquivalencePoint[]
  estimatedAnalyteConcMolL: number | null
  maxVolumeMl: number
}

/**
 * Computes exact conductivity for a mixture of initial analyte solutes + added titrant solutes
 * in totalVolumeMl, accounting for acid-base neutralization of H3O+ and OH-.
 */
export function estimateTitrationPointMetrics(
  baseSolutesMol: Record<string, number>,
  baseWaterMl: number,
  titrantSolutesPerMl: Record<string, number>,
  addedVolumeMl: number,
  temperatureC = 20,
  indicatorId?: PhIndicatorId | null,
): { ph: number; conductivityMsCm: number; indicatorColorHex: string | null } {
  const combined: Record<string, number> = {}
  for (const [k, v] of Object.entries(baseSolutesMol)) {
    if (v > 1e-12) combined[k] = v
  }
  for (const [k, perMl] of Object.entries(titrantSolutesPerMl)) {
    const add = perMl * addedVolumeMl
    if (add > 1e-12) combined[k] = (combined[k] ?? 0) + add
  }

  const totalVolL = Math.max(1e-5, (baseWaterMl + addedVolumeMl) / 1000)
  const ph = solveExactPh({
    solutesMol: combined,
    totalVolumeL: totalVolL,
    temperatureC,
  })

  // Approximate dissolved spectator + active ions for realistic V-shaped conductimetry!
  const syntheticIons: DissolvedSpeciesItem[] = []
  const pushIon = (id: string, charge: number, mol: number) => {
    if (mol <= 1e-12) return
    syntheticIons.push({
      speciesId: id,
      displayFormula: id,
      nameFr: id,
      kind: 'ion',
      charge,
      state: 'aqueous',
      amountMol: mol,
      concentrationMolPerL: mol / totalVolL,
      massConcentrationGPerL: 0,
      colorHex: null,
    })
  }

  const h = 10 ** -ph
  for (const [spId, mol] of Object.entries(combined)) {
    if (spId === 'hcl') {
      pushIon('cl_minus', -1, mol)
    } else if (spId === 'hno3') {
      pushIon('no3_minus', -1, mol)
    } else if (spId === 'h2so4') {
      pushIon('so4_2minus', -2, mol)
    } else if (spId === 'naoh') {
      pushIon('na_plus', 1, mol)
    } else if (spId === 'koh') {
      pushIon('k_plus', 1, mol)
    } else if (spId === 'caoh2') {
      pushIon('ca2_plus', 2, mol)
    } else if (spId === 'ch3cooh' || spId === 'ch3coona' || spId === 'ch3coo_minus') {
      const ka = 10 ** -4.76
      const alpha = ka / (h + ka)
      pushIon('ch3coo_minus', -1, mol * alpha)
      if (spId === 'ch3coona') pushIon('na_plus', 1, mol)
    } else if (spId === 'nh3' || spId === 'nh4cl' || spId === 'nh4_plus') {
      const ka = 10 ** -9.25
      const alphaProtonated = h / (h + ka)
      pushIon('nh4_plus', 1, mol * alphaProtonated)
      if (spId === 'nh4cl') pushIon('cl_minus', -1, mol)
    } else if (spId === 'h3po4') {
      const k1 = 10 ** -2.15
      const k2 = 10 ** -7.2
      const k3 = 10 ** -12.35
      const d = h * h * h + h * h * k1 + h * k1 * k2 + k1 * k2 * k3
      pushIon('h2po4_minus', -1, (mol * (h * h * k1)) / d)
      pushIon('hpo4_2minus', -2, (mol * (h * k1 * k2)) / d)
      pushIon('po4_3minus', -3, (mol * (k1 * k2 * k3)) / d)
    } else if (spId === 'na2co3' || spId === 'nahco3' || spId === 'co3_2minus') {
      const k1 = 10 ** -6.35
      const k2 = 10 ** -10.33
      const d = h * h + h * k1 + k1 * k2
      pushIon('hco3_minus', -1, (mol * (h * k1)) / d)
      pushIon('co3_2minus', -2, (mol * (k1 * k2)) / d)
      if (spId === 'na2co3') pushIon('na_plus', 1, 2 * mol)
      if (spId === 'nahco3') pushIon('na_plus', 1, mol)
    } else if (spId === 'nacl') {
      pushIon('na_plus', 1, mol)
      pushIon('cl_minus', -1, mol)
    }
  }

  // Note: H3O+ and OH- are automatically added from `ph` by computeSolutionConductivityMsCm
  const conductivityMsCm = computeSolutionConductivityMsCm(
    syntheticIons,
    ph,
    temperatureC,
  )
  const indicatorColorHex = indicatorId
    ? evaluateIndicatorVisual(indicatorId, ph).hex
    : null

  return { ph, conductivityMsCm, indicatorColorHex }
}

/**
 * Computes numerical derivative dpH/dV and detects prominent equivalence jumps
 * (supports monoprotic and polyprotic curves!).
 */
export function computeDerivativesAndEquivalences(
  rawPoints: Array<{
    volumeAddedMl: number
    ph: number
    conductivityMsCm: number
    indicatorColorHex: string | null
  }>,
): { points: TitrationPoint[]; equivalences: EquivalencePoint[] } {
  if (rawPoints.length === 0) return { points: [], equivalences: [] }

  const sorted = [...rawPoints].sort((a, b) => a.volumeAddedMl - b.volumeAddedMl)
  const points: TitrationPoint[] = sorted.map((p, i) => {
    let slope = 0
    if (sorted.length >= 2) {
      if (i === 0) {
        const dv = sorted[1].volumeAddedMl - sorted[0].volumeAddedMl
        slope = dv > 1e-4 ? (sorted[1].ph - sorted[0].ph) / dv : 0
      } else if (i === sorted.length - 1) {
        const dv = sorted[i].volumeAddedMl - sorted[i - 1].volumeAddedMl
        slope = dv > 1e-4 ? (sorted[i].ph - sorted[i - 1].ph) / dv : 0
      } else {
        const dv = sorted[i + 1].volumeAddedMl - sorted[i - 1].volumeAddedMl
        slope = dv > 1e-4 ? (sorted[i + 1].ph - sorted[i - 1].ph) / dv : 0
      }
    }
    return {
      ...p,
      dpHdV: Math.round(slope * 100) / 100,
    }
  })

  // Detect local maxima of |dpH/dV| above threshold (>= 0.45 pH/mL)
  const equivalences: EquivalencePoint[] = []
  for (let i = 1; i < points.length - 1; i++) {
    const prevAbs = Math.abs(points[i - 1].dpHdV)
    const curAbs = Math.abs(points[i].dpHdV)
    const nextAbs = Math.abs(points[i + 1].dpHdV)
    if (curAbs >= 0.45 && curAbs >= prevAbs && curAbs > nextAbs) {
      // Avoid duplicate detections within 2 mL
      const prevEq = equivalences[equivalences.length - 1]
      if (prevEq && points[i].volumeAddedMl - prevEq.volumeMl < 2.2) {
        if (curAbs > Math.abs(prevEq.slope)) {
          equivalences[equivalences.length - 1] = {
            volumeMl: Math.round(points[i].volumeAddedMl * 100) / 100,
            ph: points[i].ph,
            slope: points[i].dpHdV,
          }
        }
      } else {
        equivalences.push({
          volumeMl: Math.round(points[i].volumeAddedMl * 100) / 100,
          ph: points[i].ph,
          slope: points[i].dpHdV,
        })
      }
    }
  }

  return { points, equivalences }
}

/**
 * Extracts main titrant concentration (mol/L) from a burette flask.
 */
export function getPrimarySoluteConcentration(flask: CanvasFlaskNode): number | null {
  if (!flask.solution.hasWater || flask.solution.totalVolumeMl <= 0.1) return null
  const primary = flask.solution.solutes.find(
    (s) => !s.isImmersedSolid && s.concentrationMolPerL > 1e-6,
  )
  return primary ? primary.concentrationMolPerL : null
}

/**
 * Finds the best default (burette, analyte) pair on the workbench.
 */
export function findTitrationPairs(flasks: CanvasFlaskNode[]): {
  burettes: CanvasFlaskNode[]
  analytes: CanvasFlaskNode[]
} {
  const burettes = flasks.filter((f) => f.vessel.vesselType === 'burette')
  const analytes = flasks.filter(
    (f) =>
      f.vessel.vesselType === 'beaker' ||
      f.vessel.vesselType === 'erlenmeyer' ||
      f.vessel.vesselType === 'round_bottom_flask',
  )
  return { burettes, analytes }
}
