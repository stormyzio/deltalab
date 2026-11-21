import {
  ELEMENT_SYMBOL_TO_SOLID_SPECIES_ID,
  type EvaluateFlaskAdditionRequest,
  type EvaluateFlaskAdditionResponse,
  type FlaskSolutionState,
  type WorkspaceSnapshot,
} from '../../shared/chemistry.ts'
import { WATER_MOLAR_MASS, formatQtyFr, roundTo } from '../lib/math-format.ts'
import { getSpeciesById, getVesselById } from './catalog.ts'
import { getDb } from './connection.ts'
import {
  computeSolutionState,
  getDefaultAmountMol,
  getLiquidDensity,
} from './solution-state.ts'

function getDefaultWaterStepMl(capacityMl: number): number {
  if (capacityMl <= 15) return 5
  if (capacityMl <= 30) return 10
  if (capacityMl <= 120) return 50
  if (capacityMl <= 350) return 100
  if (capacityMl <= 750) return 250
  return 500
}

export function evaluateFlaskAddition(
  req: EvaluateFlaskAdditionRequest,
): EvaluateFlaskAdditionResponse {
  const vessel = getVesselById(req.vesselId)
  if (!vessel) {
    return {
      ok: false,
      code: 'UNKNOWN_SPECIES',
      messageFr: 'Verrerie introuvable en base.',
    }
  }

  const effectiveCapacityMl =
    typeof req.vesselCapacityMl === 'number' && req.vesselCapacityMl > 0
      ? Math.min(10000, Math.max(1, req.vesselCapacityMl))
      : vessel.capacityMl
  const temperatureC =
    typeof req.temperatureC === 'number' && Number.isFinite(req.temperatureC)
      ? Math.max(0, Math.min(100, req.temperatureC))
      : 20

  let currentWater = Math.max(0, req.currentWaterVolumeMl)
  let currentState = computeSolutionState(
    currentWater,
    req.currentSolutesMol,
    temperatureC,
  )

  if (req.setSolutesMol !== undefined || typeof req.setWaterVolumeMl === 'number') {
    const targetWater =
      typeof req.setWaterVolumeMl === 'number'
        ? Math.max(0, Math.min(effectiveCapacityMl, req.setWaterVolumeMl))
        : currentWater
    const targetSolutes = req.setSolutesMol ?? req.currentSolutesMol
    const solution = computeSolutionState(targetWater, targetSolutes, temperatureC)
    return {
      ok: true,
      solution,
      effect: 'batch_configured',
      messageFr: solution.activeReaction
        ? `Préparation prête : ${solution.activeReaction.nameFr}`
        : `Mélange préparé (${solution.labelFr}).`,
    }
  }

  if (req.commitReaction && req.commitReaction.xMol > 1e-8) {
    const targetRxn =
      currentState.availableReactions?.find(
        (r) => r.id === req.commitReaction!.reactionId,
      ) ?? currentState.activeReaction
    if (targetRxn) {
      const xMol = Math.max(0, Math.min(targetRxn.xMaxMol, req.commitReaction.xMol))
      if (xMol > 1e-8) {
        const elemSolutes: Record<string, number> = {}
        for (const d of currentState.dissolvedSpecies) {
          if (d.amountMol > 1e-8) {
            elemSolutes[d.speciesId] = (elemSolutes[d.speciesId] ?? 0) + d.amountMol
          }
        }
        for (const s of currentState.solutes) {
          if (s.undissolvedMol > 1e-8) {
            elemSolutes[s.speciesId] = (elemSolutes[s.speciesId] ?? 0) + s.undissolvedMol
          }
        }

        let waterDeltaMol = 0
        for (const r of targetRxn.reactants) {
          const delta = r.stoichiometry * xMol
          if (r.speciesId === 'h2o') {
            waterDeltaMol -= delta
          } else {
            const left = (elemSolutes[r.speciesId] ?? 0) - delta
            if (left > 1e-7) elemSolutes[r.speciesId] = roundTo(left, 6)
            else delete elemSolutes[r.speciesId]
          }
        }
        for (const p of targetRxn.products) {
          const delta = p.stoichiometry * xMol
          if (p.speciesId === 'h2o') {
            waterDeltaMol += delta
          } else if (p.state === 'gas') {
            // Gas escapes to atmosphere
          } else if (getSpeciesById(p.speciesId)) {
            elemSolutes[p.speciesId] = roundTo((elemSolutes[p.speciesId] ?? 0) + delta, 6)
          }
        }

        const rawWaterMl = roundTo(currentWater + waterDeltaMol * WATER_MOLAR_MASS, 2)
        currentWater =
          currentWater > 0 && rawWaterMl <= 0.05 ? 0.1 : Math.max(0, rawWaterMl)
        currentState = computeSolutionState(currentWater, elemSolutes, temperatureC)

        const hasFollowUp = Boolean(
          req.incomingSpeciesId ||
            req.incomingElementSymbol ||
            req.incomingFlask ||
            req.evaporateWaterMl ||
            req.recomputeOnly,
        )
        if (!hasFollowUp) {
          return {
            ok: true,
            solution: currentState,
            effect: 'reaction_committed',
            messageFr: `Réaction appliquée (${targetRxn.nameFr}) · x = ${formatQtyFr(xMol * 1000, 2)} mmol.`,
          }
        }
      }
    }
  }

  const nextSolutes: Record<string, number> = { ...currentState.solutesMol }
  const availableMl = Math.max(
    0,
    roundTo(effectiveCapacityMl - currentState.totalVolumeMl, 2),
  )

  if (req.recomputeOnly) {
    return {
      ok: true,
      solution: currentState,
      effect: 'temperature_changed',
      messageFr: currentState.hasUndissolvedSolid
        ? `Température ${Math.round(temperatureC)} °C · solution saturée (dépôt présent).`
        : `Température réglée à ${Math.round(temperatureC)} °C.`,
    }
  }

  if (typeof req.evaporateWaterMl === 'number' && req.evaporateWaterMl > 0) {
    if (currentWater <= 0.05) {
      return {
        ok: false,
        code: 'EMPTY_SOURCE',
        messageFr: 'Aucun solvant à évaporer.',
      }
    }
    const evapMl = Math.min(currentWater - 0.1, roundTo(req.evaporateWaterMl, 2))
    if (evapMl <= 0.05) {
      return {
        ok: false,
        code: 'EMPTY_SOURCE',
        messageFr: 'Volume d’eau minimal atteint.',
      }
    }
    const nextWater = roundTo(currentWater - evapMl, 2)
    const solution = computeSolutionState(nextWater, nextSolutes, temperatureC)
    return {
      ok: true,
      solution,
      effect: solution.hasUndissolvedSolid ? 'saturated' : 'evaporated',
      messageFr: solution.hasUndissolvedSolid
        ? `−${formatQtyFr(evapMl, 1)} mL évaporés · cristallisation par saturation.`
        : `−${formatQtyFr(evapMl, 1)} mL d’eau évaporés · solution concentrée.`,
    }
  }

  if (req.incomingFlask) {
    const srcTempC =
      typeof req.incomingFlask.sourceTemperatureC === 'number' &&
      Number.isFinite(req.incomingFlask.sourceTemperatureC)
        ? Math.max(0, Math.min(100, req.incomingFlask.sourceTemperatureC))
        : 20
    const srcState = computeSolutionState(
      req.incomingFlask.waterVolumeMl,
      req.incomingFlask.solutesMol,
      srcTempC,
    )
    if (!srcState.hasWater || srcState.totalVolumeMl <= 0) {
      return {
        ok: false,
        code: 'EMPTY_SOURCE',
        messageFr: 'La verrerie source est vide.',
      }
    }
    if (availableMl <= 0.05) {
      return {
        ok: false,
        code: 'CAPACITY_EXCEEDED',
        messageFr: `${vessel.nameFr} pleine (${effectiveCapacityMl} mL).`,
      }
    }

    const requestedVolMl =
      typeof req.incomingFlask.transferVolumeMl === 'number' &&
      req.incomingFlask.transferVolumeMl > 0
        ? Math.min(req.incomingFlask.transferVolumeMl, srcState.totalVolumeMl)
        : srcState.totalVolumeMl

    const maxTransferMl = Math.min(requestedVolMl, availableMl)
    const fraction = Math.min(1, maxTransferMl / srcState.totalVolumeMl)
    const transferredWaterMl = roundTo(srcState.waterVolumeMl * fraction, 2)
    const remainingWaterMl = roundTo(srcState.waterVolumeMl - transferredWaterMl, 2)
    const remainingSolutes: Record<string, number> = {}

    for (const [soluteId, mol] of Object.entries(srcState.solutesMol)) {
      if (mol <= 0) continue
      const movedMol = mol * fraction
      nextSolutes[soluteId] = (nextSolutes[soluteId] ?? 0) + movedMol
      const leftMol = mol - movedMol
      if (fraction < 0.9999 && leftMol > 1e-8) remainingSolutes[soluteId] = leftMol
    }

    const solution = computeSolutionState(
      currentWater + transferredWaterMl,
      nextSolutes,
      temperatureC,
    )
    const remainingSourceFlask =
      fraction < 0.9999 && remainingWaterMl > 0.05
        ? { solution: computeSolutionState(remainingWaterMl, remainingSolutes, srcTempC) }
        : null

    const transferredTotalMl = roundTo(srcState.totalVolumeMl * fraction, 1)
    return {
      ok: true,
      solution,
      remainingSourceFlask,
      effect: currentWater === 0 ? 'water_added' : 'mixed',
      messageFr:
        currentWater === 0
          ? `${formatQtyFr(transferredTotalMl, 1)} mL transférés → ${solution.labelFr}.`
          : `${formatQtyFr(transferredTotalMl, 1)} mL mélangés → ${solution.labelFr}.`,
    }
  }

  const resolvedSpeciesId =
    req.incomingSpeciesId ??
    (req.incomingElementSymbol
      ? ELEMENT_SYMBOL_TO_SOLID_SPECIES_ID[req.incomingElementSymbol.trim()]
      : undefined)

  if (!resolvedSpeciesId) {
    return {
      ok: false,
      code: 'UNKNOWN_SPECIES',
      messageFr: req.incomingElementSymbol
        ? `${req.incomingElementSymbol} n’est pas disponible en corps simple solide à immerger.`
        : 'Espèce chimique manquante.',
    }
  }

  const species = getSpeciesById(resolvedSpeciesId)
  if (!species) {
    return {
      ok: false,
      code: 'UNKNOWN_SPECIES',
      messageFr: 'Espèce introuvable en base.',
    }
  }

  if (species.isSolvent) {
    if (availableMl <= 0.05) {
      return {
        ok: false,
        code: 'CAPACITY_EXCEEDED',
        messageFr: `${vessel.nameFr} déjà au volume maximal (${effectiveCapacityMl} mL).`,
      }
    }

    const requestedWaterMl =
      typeof req.incomingWaterVolumeMl === 'number' && req.incomingWaterVolumeMl > 0
        ? req.incomingWaterVolumeMl
        : typeof req.incomingAmountMol === 'number' && req.incomingAmountMol > 0
          ? req.incomingAmountMol * WATER_MOLAR_MASS
          : getDefaultWaterStepMl(effectiveCapacityMl)

    const addedMl = Math.min(availableMl, roundTo(requestedWaterMl, 2))
    const nextWater = roundTo(currentWater + addedMl, 2)
    const solution = computeSolutionState(nextWater, nextSolutes, temperatureC)
    const hasSolutes = Object.keys(nextSolutes).length > 0

    return {
      ok: true,
      solution,
      effect: currentWater === 0 ? 'water_added' : 'diluted',
      messageFr:
        currentWater === 0
          ? `${formatQtyFr(addedMl, 1)} mL d’eau ajoutés.`
          : hasSolutes
            ? `Dilution (+${formatQtyFr(addedMl, 1)} mL) · V = ${formatQtyFr(solution.totalVolumeMl, 1)} mL.`
            : `Eau complétée à ${formatQtyFr(solution.totalVolumeMl, 1)} mL.`,
    }
  }

  const addedMol =
    typeof req.incomingAmountMol === 'number' && req.incomingAmountMol > 0
      ? req.incomingAmountMol
      : getDefaultAmountMol(species)

  if (currentWater <= 0) {
    if (species.standardState === 'liquid') {
      const density = getLiquidDensity(species) ?? 0.9
      const extraMl = (addedMol * species.molarMass) / Math.max(0.4, density)
      if (extraMl > availableMl + 0.05) {
        return {
          ok: false,
          code: 'CAPACITY_EXCEEDED',
          messageFr: `Volume insuffisant dans ${vessel.nameFr} (${formatQtyFr(availableMl, 1)} mL libres).`,
        }
      }
    }
    nextSolutes[species.id] = (nextSolutes[species.id] ?? 0) + addedMol
    const solution = computeSolutionState(0, nextSolutes, temperatureC)
    const rxnHint = solution.activeReaction
      ? ` · réaction prête : ${solution.activeReaction.nameFr}`
      : ''
    const stateTag =
      species.standardState === 'solid'
        ? '(s)'
        : species.standardState === 'gas'
          ? '(g)'
          : '(l)'
    return {
      ok: true,
      solution,
      effect: species.standardState === 'solid' ? 'solid_immersed' : 'dissolved',
      messageFr: `${species.displayFormula}${stateTag} ajouté hors solvant${rxnHint}.`,
    }
  }

  if (!species.canDissolveInWater) {
    nextSolutes[species.id] = (nextSolutes[species.id] ?? 0) + addedMol
    const solution = computeSolutionState(currentWater, nextSolutes, temperatureC)
    const addedMassG = addedMol * species.molarMass
    const rxnHint = solution.activeReaction
      ? ` · réaction prête : ${solution.activeReaction.nameFr}`
      : ''
    if (species.standardState === 'solid') {
      return {
        ok: true,
        solution,
        effect: 'solid_immersed',
        messageFr: `${species.displayFormula}(s) immergé (${formatQtyFr(addedMassG, 2)} g)${rxnHint}.`,
      }
    }
    return {
      ok: true,
      solution,
      effect: 'dissolved',
      messageFr: `${species.displayFormula} introduit dans la verrerie${rxnHint}.`,
    }
  }

  if (species.standardState === 'liquid') {
    const density = getLiquidDensity(species) ?? 1.0
    const extraMl = (addedMol * species.molarMass) / density
    if (extraMl > availableMl + 0.05) {
      return {
        ok: false,
        code: 'CAPACITY_EXCEEDED',
        messageFr: `Volume insuffisant dans ${vessel.nameFr} (${formatQtyFr(availableMl, 1)} mL libres).`,
      }
    }
  }

  nextSolutes[species.id] = (nextSolutes[species.id] ?? 0) + addedMol
  const solution = computeSolutionState(currentWater, nextSolutes, temperatureC)
  const targetSolute = solution.solutes.find((s) => s.speciesId === species.id)

  if (targetSolute && targetSolute.undissolvedMassG > 1e-4) {
    return {
      ok: true,
      solution,
      effect: 'saturated',
      messageFr: `Solution saturée en ${species.displayFormula} (${formatQtyFr(targetSolute.undissolvedMassG, 2)} g non dissous).`,
    }
  }

  const concStr = targetSolute
    ? targetSolute.concentrationMolPerL >= 0.01
      ? `${formatQtyFr(targetSolute.concentrationMolPerL, 2)} mol/L`
      : `${formatQtyFr(targetSolute.concentrationMolPerL * 1000, 1)} mmol/L`
    : ''

  return {
    ok: true,
    solution,
    effect: 'dissolved',
    messageFr: concStr
      ? `${species.displayFormula} dissous · C = ${concStr}.`
      : `${species.displayFormula} dissous → ${solution.labelFr}.`,
  }
}

export function getWorkspaceSnapshot(): WorkspaceSnapshot {
  const db = getDb()
  const row = db
    .prepare("SELECT payload_json FROM workspace_state WHERE id = 'default'")
    .get() as { payload_json: string } | undefined
  if (!row) return { nodes: [], discoveredSpeciesIds: [] }

  try {
    const parsed = JSON.parse(row.payload_json) as WorkspaceSnapshot
    const migratedNodes = (parsed.nodes ?? []).map((node) => {
      if (node.kind === 'molecule') {
        const freshSpecies = getSpeciesById(node.species.id) ?? node.species
        const amountMol =
          typeof node.amountMol === 'number' && node.amountMol > 0
            ? node.amountMol
            : getDefaultAmountMol(freshSpecies)
        return { ...node, species: freshSpecies, amountMol }
      }
      if (node.kind === 'flask') {
        const freshVessel = getVesselById(node.vessel.id)
        const hydratedVessel = freshVessel
          ? {
              ...freshVessel,
              capacityMl:
                typeof node.vessel.capacityMl === 'number' && node.vessel.capacityMl > 0
                  ? node.vessel.capacityMl
                  : freshVessel.capacityMl,
            }
          : {
              ...node.vessel,
              availableCapacitiesMl: node.vessel.availableCapacitiesMl ?? [
                node.vessel.capacityMl,
              ],
              supportsHeating: node.vessel.supportsHeating ?? false,
              stopperable: node.vessel.stopperable ?? false,
              precisionLabel: node.vessel.precisionLabel ?? 'Graduations indicatives',
              defaultPourStepMl: node.vessel.defaultPourStepMl ?? null,
            }
        const tempC =
          typeof node.temperatureC === 'number' && Number.isFinite(node.temperatureC)
            ? node.temperatureC
            : 20
        const legacySol = node.solution as FlaskSolutionState & {
          soluteCounts?: Record<string, number>
        }
        const solutesMol: Record<string, number> =
          legacySol.solutesMol && typeof legacySol.solutesMol === 'object'
            ? legacySol.solutesMol
            : Object.fromEntries(
                Object.entries(legacySol.soluteCounts ?? {}).map(([id, cnt]) => [
                  id,
                  cnt * 0.01,
                ]),
              )
        const recomputedSolution = computeSolutionState(
          legacySol.waterVolumeMl ?? 0,
          solutesMol,
          tempC,
        )
        const matchingRxn = node.selectedReactionId
          ? recomputedSolution.availableReactions?.find(
              (r) => r.id === node.selectedReactionId,
            ) ?? recomputedSolution.activeReaction
          : recomputedSolution.activeReaction
        const clampedExtent =
          matchingRxn &&
          typeof node.reactionExtentMol === 'number' &&
          Number.isFinite(node.reactionExtentMol) &&
          node.reactionExtentMol > 0
            ? Math.min(matchingRxn.xMaxMol, node.reactionExtentMol)
            : 0
        return {
          ...node,
          vessel: hydratedVessel,
          temperatureC: tempC,
          stoppered: Boolean(node.stoppered),
          pourStepMl:
            node.pourStepMl !== undefined
              ? node.pourStepMl
              : hydratedVessel.defaultPourStepMl,
          solution: recomputedSolution,
          reactionExtentMol: clampedExtent,
          selectedReactionId: matchingRxn ? matchingRxn.id : undefined,
        }
      }
      return node
    })
    return {
      nodes: migratedNodes,
      discoveredSpeciesIds: parsed.discoveredSpeciesIds ?? [],
    }
  } catch {
    return { nodes: [], discoveredSpeciesIds: [] }
  }
}

export function saveWorkspaceSnapshot(snapshot: WorkspaceSnapshot): void {
  try {
    const db = getDb()
    db.prepare(`
      INSERT OR REPLACE INTO workspace_state (id, payload_json, updated_at)
      VALUES ('default', ?, ?)
    `).run(JSON.stringify(snapshot), new Date().toISOString())
  } catch {
    // Read-only runtime (e.g. Vercel): workspace persistence is handled client-side in localStorage.
  }
}
