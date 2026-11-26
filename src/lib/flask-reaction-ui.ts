import type {
  DissolvedSpeciesItem,
  FlaskActiveReaction,
  FlaskSolutionState,
  PhIndicatorId,
} from '../../shared/chemistry.ts'
import { computeSolutionConductivityMsCm } from '../../shared/ph-solver.ts'
import { applyIndicatorToLiquidVisual } from './lab-indicators'

export interface ProjectedSolidItem {
  speciesId: string
  displayFormula: string
  nameFr: string
  amountMol: number
  massG: number
  colorHex: string | null
}

export interface ProjectedGasItem {
  speciesId: string
  displayFormula: string
  nameFr: string
  amountMol: number
  volumeMl: number
  colorHex?: string | null
}

export interface ProjectedFlaskState {
  reaction: FlaskActiveReaction | null
  xMol: number
  progressRatio: number
  liquidColorHex: string | null
  liquidOpacity: number
  hasUndissolvedSolid: boolean
  sedimentColorHex: string | null
  sedimentRatio: number
  isPrecipitating: boolean
  evolvingGas: boolean
  phEstimate: number | null
  conductivityMsCm: number | null
  dissolvedSpecies: DissolvedSpeciesItem[]
  solidSpecies: ProjectedSolidItem[]
  gasProduced: ProjectedGasItem[]
}

const OPTICAL_STRENGTH: Record<string, number> = {
  mno4_minus: 22,
  cu_nh3_4_2plus: 9.0,
  cr2o7_2minus: 8.0,
  i2: 6.0,
  fe3_plus: 4.5,
  cu2_plus: 3.5,
  cr3_plus: 3.2,
  co2_plus: 3.0,
  ni2_plus: 2.5,
  fe2_plus: 1.8,
}

const SPECIES_AQUEOUS_COLOR: Record<string, string> = {
  cu2_plus: '#0284c7',
  cu_nh3_4_2plus: '#1d4ed8',
  fe2_plus: '#16a34a',
  fe3_plus: '#d97706',
  mno4_minus: '#9333ea',
  cr2o7_2minus: '#ea580c',
  cro4_2minus: '#eab308',
  ni2_plus: '#22c55e',
  co2_plus: '#ec4899',
  cr3_plus: '#15803d',
  i2: '#b45309',
}

function hexToRgb(hex: string): [number, number, number] | null {
  const cleaned = hex.replace('#', '')
  if (cleaned.length !== 6) return null
  const r = Number.parseInt(cleaned.slice(0, 2), 16)
  const g = Number.parseInt(cleaned.slice(2, 4), 16)
  const b = Number.parseInt(cleaned.slice(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
  return [r, g, b]
}

function blendHex(weighted: Array<{ hex: string; weight: number }>): string | null {
  if (weighted.length === 0) return null
  let total = 0
  let r = 0
  let g = 0
  let b = 0
  for (const w of weighted) {
    const rgb = hexToRgb(w.hex)
    if (!rgb || w.weight <= 0) continue
    r += rgb[0] * w.weight
    g += rgb[1] * w.weight
    b += rgb[2] * w.weight
    total += w.weight
  }
  if (total <= 0) return null
  const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${toHex(r / total)}${toHex(g / total)}${toHex(b / total)}`
}

function parseDisplayCharge(formula: string): number {
  const m = formula.match(/([²³⁴⁵⁶⁷⁸⁹]?)([⁺⁻])$/)
  if (!m) return 0
  const magMap: Record<string, number> = {
    '': 1,
    '²': 2,
    '³': 3,
    '⁴': 4,
    '⁵': 5,
    '⁶': 6,
    '⁷': 7,
    '⁸': 8,
    '⁹': 9,
  }
  const mag = magMap[m[1]] ?? 1
  return m[2] === '⁺' ? mag : -mag
}

export function getSelectedFlaskReaction(
  solution: FlaskSolutionState,
  selectedReactionId?: string,
): FlaskActiveReaction | null {
  const list = solution.availableReactions ?? []
  if (selectedReactionId) {
    const found = list.find((r) => r.id === selectedReactionId)
    if (found) return found
  }
  return solution.activeReaction ?? list[0] ?? null
}

/**
 * Projects live flask composition, liquid color, solid deposit color, gas bubbles,
 * and pH instantaneously (0 ms, 60 FPS) as the user drags x between 0 and x_max.
 */
export function projectFlaskStateAtExtent(
  solution: FlaskSolutionState,
  rawXMol: number,
  selectedReactionId?: string,
  indicatorId?: PhIndicatorId | null,
  temperatureC = 20,
): ProjectedFlaskState {
  const reaction = getSelectedFlaskReaction(solution, selectedReactionId)

  // Baseline solids from solutes (only actual solids, never undissolved gases or liquids)
  const baseSolids: ProjectedSolidItem[] = solution.solutes
    .filter((s) => s.undissolvedMol > 1e-7 && (s.standardState ?? 'solid') === 'solid')
    .map((s) => ({
      speciesId: s.speciesId,
      displayFormula: s.displayFormula,
      nameFr: s.nameFr,
      amountMol: s.undissolvedMol,
      massG: s.undissolvedMassG,
      colorHex: s.colorHex ?? '#d4d4d8',
    }))

  // Baseline headspace gases present in the vessel (undissolved gas in aqueous vessel or dry gas in anhydrous vessel)
  const baseGasMap = new Map<string, ProjectedGasItem>()
  for (const s of solution.solutes) {
    if (s.standardState === 'gas' && s.undissolvedMol > 1e-7) {
      baseGasMap.set(s.speciesId, {
        speciesId: s.speciesId,
        displayFormula: s.displayFormula,
        nameFr: s.nameFr,
        amountMol: s.undissolvedMol,
        volumeMl: s.undissolvedMol * 24000,
        colorHex: s.colorHex ?? null,
      })
    }
  }
  for (const d of solution.dissolvedSpecies) {
    if (d.state === 'gas' && d.amountMol > 1e-7 && !baseGasMap.has(d.speciesId)) {
      baseGasMap.set(d.speciesId, {
        speciesId: d.speciesId,
        displayFormula: d.displayFormula,
        nameFr: d.nameFr,
        amountMol: d.amountMol,
        volumeMl: d.amountMol * 24000,
        colorHex: d.colorHex ?? null,
      })
    }
  }
  const baseGases: ProjectedGasItem[] = [...baseGasMap.values()]
  const baseAqueous: DissolvedSpeciesItem[] = solution.dissolvedSpecies.filter(
    (d) => d.state !== 'gas',
  )

  const applyVisualAndCond = (
    baseHex: string | null,
    baseOpacity: number,
    ph: number | null,
    dissolved: DissolvedSpeciesItem[],
  ) => {
    const tinted = applyIndicatorToLiquidVisual(
      baseHex,
      baseOpacity,
      ph,
      solution.hasWater,
      indicatorId,
    )
    const conductivityMsCm = solution.hasWater
      ? computeSolutionConductivityMsCm(dissolved, ph, temperatureC)
      : null
    return { ...tinted, conductivityMsCm }
  }

  if (!reaction) {
    const totalSolidG = baseSolids.reduce((acc, s) => acc + s.massG, 0)
    const visual = applyVisualAndCond(
      solution.liquidColorHex,
      solution.liquidOpacity,
      solution.phEstimate,
      baseAqueous,
    )
    return {
      reaction: null,
      xMol: 0,
      progressRatio: 0,
      liquidColorHex: visual.liquidColorHex,
      liquidOpacity: visual.liquidOpacity,
      hasUndissolvedSolid: baseSolids.length > 0 && totalSolidG > 1e-6,
      sedimentColorHex: solution.sedimentColorHex ?? (baseSolids[0]?.colorHex ?? null),
      sedimentRatio: totalSolidG > 0 ? Math.min(1, 0.3 + Math.log10(1 + totalSolidG * 3) * 0.45) : 0,
      isPrecipitating: false,
      evolvingGas: false,
      phEstimate: solution.phEstimate,
      conductivityMsCm: visual.conductivityMsCm,
      dissolvedSpecies: baseAqueous,
      solidSpecies: baseSolids,
      gasProduced: baseGases,
    }
  }

  const xMol = Math.max(0, Math.min(reaction.xMaxMol, Number.isFinite(rawXMol) ? rawXMol : 0))
  const progressRatio = reaction.xMaxMol > 0 ? xMol / reaction.xMaxMol : 0

  if (xMol <= 1e-9) {
    const totalSolidG = baseSolids.reduce((acc, s) => acc + s.massG, 0)
    const visual = applyVisualAndCond(
      solution.liquidColorHex,
      solution.liquidOpacity,
      solution.phEstimate,
      baseAqueous,
    )
    return {
      reaction,
      xMol: 0,
      progressRatio: 0,
      liquidColorHex: visual.liquidColorHex,
      liquidOpacity: visual.liquidOpacity,
      hasUndissolvedSolid: baseSolids.length > 0 && totalSolidG > 1e-6,
      sedimentColorHex: solution.sedimentColorHex ?? (baseSolids[0]?.colorHex ?? null),
      sedimentRatio: totalSolidG > 0 ? Math.min(1, 0.3 + Math.log10(1 + totalSolidG * 3) * 0.45) : 0,
      isPrecipitating: false,
      evolvingGas: false,
      phEstimate: solution.phEstimate,
      conductivityMsCm: visual.conductivityMsCm,
      dissolvedSpecies: baseAqueous,
      solidSpecies: baseSolids,
      gasProduced: baseGases,
    }
  }

  const totalVolumeL = Math.max(1e-5, solution.totalVolumeMl / 1000)

  // Clone aqueous map
  const aqMap = new Map<string, DissolvedSpeciesItem>()
  for (const d of baseAqueous) {
    aqMap.set(d.speciesId, { ...d })
  }

  // Clone solid map
  const solidMap = new Map<string, ProjectedSolidItem>()
  for (const s of baseSolids) {
    solidMap.set(s.speciesId, { ...s })
  }

  // Clone headspace gas map
  const gasMap = new Map<string, ProjectedGasItem>()
  for (const g of baseGases) {
    gasMap.set(g.speciesId, { ...g })
  }

  // Subtract reactants
  for (const r of reaction.reactants) {
    if (r.speciesId === 'h2o') continue
    const delta = r.stoichiometry * xMol
    if (r.state === 'solid') {
      const cur = solidMap.get(r.speciesId)
      if (cur) {
        const nextMol = Math.max(0, cur.amountMol - delta)
        if (nextMol <= 1e-7) solidMap.delete(r.speciesId)
        else {
          cur.amountMol = nextMol
          cur.massG = nextMol * r.molarMass
        }
      }
    } else if (r.state === 'gas') {
      const curGas = gasMap.get(r.speciesId)
      if (curGas) {
        const nextMol = Math.max(0, curGas.amountMol - delta)
        if (nextMol <= 1e-7) gasMap.delete(r.speciesId)
        else {
          curGas.amountMol = nextMol
          curGas.volumeMl = nextMol * 24000
        }
      } else {
        const curAq = aqMap.get(r.speciesId)
        if (curAq) {
          const nextMol = Math.max(0, curAq.amountMol - delta)
          if (nextMol <= 1e-7) aqMap.delete(r.speciesId)
          else {
            curAq.amountMol = nextMol
            curAq.concentrationMolPerL = nextMol / totalVolumeL
            curAq.massConcentrationGPerL = curAq.concentrationMolPerL * r.molarMass
          }
        }
      }
    } else if (r.state === 'aqueous' || r.state === 'liquid') {
      const cur = aqMap.get(r.speciesId)
      if (cur) {
        const nextMol = Math.max(0, cur.amountMol - delta)
        if (nextMol <= 1e-7) aqMap.delete(r.speciesId)
        else {
          cur.amountMol = nextMol
          cur.concentrationMolPerL = nextMol / totalVolumeL
          cur.massConcentrationGPerL = cur.concentrationMolPerL * r.molarMass
        }
      }
    }
  }

  // Add products
  for (const p of reaction.products) {
    if (p.speciesId === 'h2o' && solution.hasWater) continue
    const delta = p.stoichiometry * xMol
    if (delta <= 1e-8) continue

    if (p.state === 'gas') {
      const curGas = gasMap.get(p.speciesId)
      if (curGas) {
        curGas.amountMol += delta
        curGas.volumeMl = curGas.amountMol * 24000
      } else {
        gasMap.set(p.speciesId, {
          speciesId: p.speciesId,
          displayFormula: p.displayFormula,
          nameFr: p.nameFr,
          amountMol: delta,
          volumeMl: delta * 24000, // 24.0 L/mol at 20 °C
          colorHex: p.colorHex ?? null,
        })
      }
    } else if (p.state === 'solid') {
      const cur = solidMap.get(p.speciesId)
      if (cur) {
        cur.amountMol += delta
        cur.massG = cur.amountMol * p.molarMass
      } else {
        solidMap.set(p.speciesId, {
          speciesId: p.speciesId,
          displayFormula: p.displayFormula,
          nameFr: p.nameFr,
          amountMol: delta,
          massG: delta * p.molarMass,
          colorHex: p.colorHex ?? reaction.precipitateColorHex ?? '#f4f4f5',
        })
      }
    } else if (p.state === 'aqueous' || p.state === 'liquid') {
      const cur = aqMap.get(p.speciesId)
      const conc = delta / totalVolumeL
      if (cur) {
        cur.amountMol += delta
        cur.concentrationMolPerL = cur.amountMol / totalVolumeL
        cur.massConcentrationGPerL = cur.concentrationMolPerL * p.molarMass
      } else {
        const parsedCharge = parseDisplayCharge(p.displayFormula)
        aqMap.set(p.speciesId, {
          speciesId: p.speciesId,
          displayFormula: p.displayFormula,
          nameFr: p.nameFr,
          kind: parsedCharge !== 0 ? 'ion' : 'molecule',
          charge: parsedCharge,
          state: 'aqueous',
          amountMol: delta,
          concentrationMolPerL: conc,
          massConcentrationGPerL: conc * p.molarMass,
          colorHex: p.colorHex ?? SPECIES_AQUEOUS_COLOR[p.speciesId] ?? null,
        })
      }
    }
  }

  const dissolvedSpecies = [...aqMap.values()].sort((a, b) => {
    if (b.charge !== a.charge) return b.charge - a.charge
    return a.displayFormula.localeCompare(b.displayFormula)
  })
  const solidSpecies = [...solidMap.values()].sort((a, b) => b.massG - a.massG)
  const gasProduced = [...gasMap.values()]

  // Recompute live liquid color (Beer-Lambert weighted blend of colored aqueous species)
  const colorSamples: Array<{ hex: string; weight: number }> = []
  let absorbanceProxy = 0
  for (const item of dissolvedSpecies) {
    const hex = item.colorHex ?? SPECIES_AQUEOUS_COLOR[item.speciesId] ?? null
    if (!hex || hex === '#bae6fd' || hex === '#e0f2fe') continue
    const strength = OPTICAL_STRENGTH[item.speciesId] ?? 2.8
    const weight = item.concentrationMolPerL * strength
    if (weight > 0) {
      colorSamples.push({ hex, weight })
      absorbanceProxy += weight
    }
  }
  const blended = blendHex(colorSamples)
  const producedWater = !solution.hasWater && (aqMap.get('h2o')?.amountMol ?? 0) > 1e-6
  const liquidColorHex =
    blended ??
    (solution.hasWater || producedWater
      ? '#bae6fd'
      : solution.liquidColorHex)
  const liquidOpacity = blended
    ? Math.round((0.28 + 0.6 * (1 - Math.exp(-absorbanceProxy))) * 1000) / 1000
    : solution.hasWater || producedWater
      ? 0.28
      : solution.liquidOpacity

  // Recompute live sediment color & visual thickness
  const totalSolidG = solidSpecies.reduce((acc, s) => acc + s.massG, 0)
  const hasUndissolvedSolid = solidSpecies.length > 0 && totalSolidG > 1e-6
  const sedimentColorHex = hasUndissolvedSolid
    ? blendHex(
        solidSpecies.map((s) => ({
          hex: s.colorHex ?? '#e4e4e7',
          weight: Math.max(0.01, s.massG),
        })),
      ) ?? '#e4e4e7'
    : null
  const sedimentRatio = hasUndissolvedSolid
    ? Math.min(1, 0.3 + Math.log10(1 + totalSolidG * 3) * 0.45)
    : 0

  // Recompute live pH when H3O+ or OH- is involved
  let phEstimate = solution.phEstimate
  const h3oC = aqMap.get('h3o_plus')?.concentrationMolPerL ?? 0
  const ohC = aqMap.get('oh_minus')?.concentrationMolPerL ?? 0
  const involvesStrongPh =
    reaction.reactants.some((r) => r.speciesId === 'h3o_plus' || r.speciesId === 'oh_minus') ||
    reaction.products.some((p) => p.speciesId === 'h3o_plus' || p.speciesId === 'oh_minus')
  if (involvesStrongPh) {
    const net = h3oC - ohC
    const KW = 1e-14
    if (Math.abs(net) < 1e-9) {
      phEstimate = 7.0
    } else if (net > 0) {
      const h = (net + Math.sqrt(net * net + 4 * KW)) / 2
      phEstimate = Math.round(Math.max(0, Math.min(14, -Math.log10(h))) * 100) / 100
    } else {
      const b = -net
      const oh = (b + Math.sqrt(b * b + 4 * KW)) / 2
      phEstimate = Math.round(Math.max(0, Math.min(14, 14 + Math.log10(oh))) * 100) / 100
    }
  }

  const finalVisual = applyVisualAndCond(
    liquidColorHex,
    liquidOpacity,
    phEstimate,
    dissolvedSpecies,
  )
  const producesSolid = reaction.products.some((p) => p.state === 'solid')

  return {
    reaction,
    xMol,
    progressRatio,
    liquidColorHex: finalVisual.liquidColorHex,
    liquidOpacity: finalVisual.liquidOpacity,
    hasUndissolvedSolid,
    sedimentColorHex,
    sedimentRatio,
    isPrecipitating: producesSolid && xMol > 0,
    evolvingGas: reaction.evolvesGas && xMol > 0,
    phEstimate,
    conductivityMsCm: finalVisual.conductivityMsCm,
    dissolvedSpecies,
    solidSpecies,
    gasProduced,
  }
}
