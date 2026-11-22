import {
  type AlloyRecord,
  type CanvasAtomNode,
  type CanvasSolidNode,
  type CatalogSpeciesRecord,
  type ElementRecord,
  type SolidComponent,
  getElementSolidColor,
  getSolidSpeciesIdForElement,
} from '../../shared/chemistry.ts'
import { createNodeId } from './workbench-helpers'

const ELEMENT_SOLID_DESCRIPTIONS: Record<string, string> = {
  Li: 'Métal alcalin blanc argenté très mou et léger (flotte sur l’eau), s’oxydant rapidement à l’air et réagissant vivement avec l’eau.',
  Be: 'Métal gris acier très léger, rigide et cassant à froid, transparent aux rayons X et résistant à la corrosion par passivation.',
  B: 'Métalloïde brun-noir extrêmement dur et réfractaire, semi-conducteur à l’état cristallin pur.',
  C: 'Solide noir mat conducteur sous forme de graphite feuilleté, ou cristal transparent isolant d’une dureté extrême sous forme de diamant.',
  Na: 'Métal alcalin argenté très mou (se coupe au couteau), terne à l’air par oxydation et réagissant violemment avec l’eau.',
  Mg: 'Métal gris argenté très léger et usinable, brûlant avec une flamme blanche intense à haute température.',
  Al: 'Métal blanc argenté léger, ductile et bon conducteur, protégé naturellement par une fine couche d’alumine.',
  Si: 'Métalloïde gris bleuté à éclat métallique, cassant, semi-conducteur de référence de l’électronique.',
  P: 'Solide cireux blanc-jaunâtre très réactif (phosphore blanc P₄) ou poudre amorphe rouge plus stable.',
  S: 'Cristaux jaune citron friables (octasoufre S₈), isolant électrique et thermique, insoluble dans l’eau.',
  K: 'Métal alcalin argenté extrêmement mou et réactif, s’enflammant au contact de l’eau avec une flamme lilas.',
  Ca: 'Métal alcalino-terreux gris argenté assez mou, qui se ternit rapidement à l’air et dégage du dihydrogène dans l’eau.',
  Sc: 'Métal blanc argenté léger à point de fusion élevé, utilisé pour renforcer les alliages d’aluminium haute performance.',
  Ti: 'Métal gris argenté léger, très résistant mécaniquement et pratiquement inaltérable grâce à sa couche passive de dioxyde.',
  V: 'Métal gris argenté ductile et résistant à la corrosion, utilisé principalement comme élément d’addition dans les aciers.',
  Cr: 'Métal gris acier très dur et brillant, hautement résistant à l’oxydation et responsable de la passivité des aciers inoxydables.',
  Mn: 'Métal gris argenté dur et cassant, essentiel en sidérurgie pour désoxyder l’acier et accroître sa résistance à l’usure.',
  Fe: 'Métal gris argenté ferromagnétique, malléable à l’état pur, qui s’oxyde en rouille à l’air humide.',
  Co: 'Métal gris bleuté dur et ferromagnétique, conservant sa résistance mécanique et son aimantation à haute température.',
  Ni: 'Métal blanc argenté légèrement doré, ductile, ferromagnétique et très résistant à la corrosion.',
  Cu: 'Métal rouge-orangé très ductile et malléable, excellent conducteur électrique et thermique, qui se patine en vert-de-gris.',
  Zn: 'Métal gris bleuté cassant à froid mais malléable vers 120 °C, utilisé pour la galvanisation protectrice de l’acier.',
  Ga: 'Métal blanc argenté très tendre fondant dans la main (29,8 °C), présentant une forte surfusion à l’état liquide.',
  Ge: 'Métalloïde gris argenté brillant et cassant, semi-conducteur transparent dans l’infrarouge.',
  As: 'Métalloïde gris métallique cassant, qui se sublime directement à pression atmosphérique en dégageant une odeur alliacée.',
  Se: 'Solide gris métallique semi-conducteur photoconducteur (ou allotrope rouge vitreux), sensible à la lumière.',
  Rb: 'Métal alcalin argenté très mou à bas point de fusion, pyrophorique à l’air et explosif au contact de l’eau.',
  Sr: 'Métal alcalino-terreux blanc argenté mou, jaunissant rapidement à l’air et réagissant vivement avec l’eau.',
  Y: 'Métal blanc argenté mou appartenant aux terres rares, stable à l’air grâce à une fine pellicule d’oxyde.',
  Zr: 'Métal gris argenté ductile très résistant à la corrosion acide et alcaline, à faible capture neutronique.',
  Nb: 'Métal gris brillant ductile et réfractaire, supraconducteur à basse température (9,2 K).',
  Mo: 'Métal gris argenté très réfractaire et rigide, conservant sa tenue mécanique bien au-delà de 1 000 °C.',
  Ru: 'Métal platinoïde blanc grisâtre très dur et cassant, inattaquable par la plupart des acides.',
  Rh: 'Métal noble blanc argenté très dur et hautement réfléchissant, quasiment inaltérable à la corrosion et excellent catalyseur.',
  Pd: 'Métal noble blanc argenté ductile et malléable, capable d’absorber jusqu’à 900 fois son volume de dihydrogène.',
  Ag: 'Métal précieux blanc très brillant, le meilleur conducteur électrique et thermique de tous les éléments, se ternissant au soufre.',
  Cd: 'Métal blanc bleuté très mou et ductile, facilement fusible et résistant à la corrosion atmosphérique.',
  In: 'Métal blanc argenté extrêmement mou et malléable, émettant un léger crépitement caractéristique lorsqu’on le plie.',
  Sn: 'Métal blanc argenté malléable à bas point de fusion, résistant à l’eau et non toxique (étain blanc β).',
  Sb: 'Métalloïde gris argenté brillant, lamellaire et cassant, qui se dilate légèrement lors de la solidification.',
  Te: 'Métalloïde gris argenté à éclat métallique, fragile et semi-conducteur.',
  I: 'Cristaux gris-violet foncé à éclat métallique (diiode I₂), se sublimant facilement en vapeurs violettes.',
  Cs: 'Métal alcalin doré pâle extrêmement mou, fondant à 28,5 °C et réagissant de manière explosive avec l’eau.',
  Ba: 'Métal alcalino-terreux gris argenté mou, s’oxydant instantanément à l’air et réagissant vivement avec l’eau.',
  La: 'Métal blanc argenté mou et ductile de la famille des lanthanides, s’oxydant rapidement à l’air humide.',
  Ce: 'Métal gris argenté mou et pyrophorique (produit des étincelles par frottement, utilisé dans les pierres à briquet).',
  Nd: 'Métal blanc argenté qui se ternit vite à l’air, constituant clé des aimants permanents néodyme-fer-bore.',
  Sm: 'Métal argenté assez dur des terres rares, utilisé dans les aimants samarium-cobalt stables à haute température.',
  Gd: 'Métal blanc argenté malléable, fortement paramagnétique et ferromagnétique en dessous de 20 °C.',
  Hf: 'Métal gris argenté ductile et réfractaire, chimiquement très proche du zirconium mais fort absorbeur de neutrons.',
  Ta: 'Métal gris bleuté très dense, ductile et réfractaire, résistant à presque tous les acides (y compris l’eau régale) à froid.',
  W: 'Métal gris acier très dense et dur, possédant le point de fusion le plus élevé de tous les métaux (3 422 °C).',
  Re: 'Métal blanc argenté extrêmement dense et réfractaire, très ductile même à haute température.',
  Os: 'Métal platinoïde gris-bleu très dur et cassant, l’élément naturel le plus dense connu (22,59 g/cm³).',
  Ir: 'Métal platinoïde blanc argenté extrêmement dense, dur et le plus résistant à la corrosion de tous les métaux.',
  Pt: 'Métal précieux gris-blanc très dense, ductile, inaltérable et catalyseur majeur en chimie.',
  Au: 'Métal précieux jaune brillant, extrêmement malléable et ductile, chimiquement inerte à l’air et aux acides usuels.',
  Tl: 'Métal gris bleuté très mou rappelant le plomb, qui se ternit rapidement à l’air humide.',
  Pb: 'Métal gris bleuté très dense, mou et malléable, à bas point de fusion et absorbant efficacement les rayons X et gamma.',
  Bi: 'Métal blanc argenté aux reflets rosés ou irisés, diamagnétique, cassant et se dilatant à la solidification.',
  Th: 'Métal gris argenté dense, ductile et faiblement radioactif, s’oxydant lentement à l’air.',
  U: 'Métal gris argenté très dense et radioactif, malléable et pyrophorique à l’état finement divisé.',
  Pu: 'Métal gris argenté très dense, radioactif et présentant six phases allotropiques complexes à l’état solide.',
}

export function describeElementSolid(
  el: ElementRecord,
  solidSpecies?: CatalogSpeciesRecord | null,
): string {
  const curated = ELEMENT_SOLID_DESCRIPTIONS[el.symbol]
  if (curated) return curated

  const app = solidSpecies?.appearanceFr?.trim()
  if (
    app &&
    app !== 'Métal solide' &&
    app !== 'Solide élémentaire' &&
    app.length > 22
  ) {
    return app
  }

  const familyText =
    el.category === 'lanthanide'
      ? 'Métal blanc argenté de la famille des lanthanides'
      : el.category === 'actinide'
        ? 'Métal dense et radioactif de la famille des actinides'
        : el.category === 'alkali-metal'
          ? 'Métal alcalin argenté très réactif'
          : el.category === 'alkaline-earth'
            ? 'Métal alcalino-terreux gris argenté'
            : el.category === 'metalloid'
              ? 'Métalloïde cristallin à éclat semi-métallique'
              : el.category === 'nonmetal' || el.category === 'halogen'
                ? 'Solide moléculaire non métallique'
                : 'Métal solide à éclat gris argenté'

  const traits: string[] = []
  if (el.synthetic) traits.push('synthétique à durée de vie brève')
  else if (el.radioactive) traits.push('radioactif')
  if (el.crystalStructure) traits.push(`de réseau ${el.crystalStructure.toLowerCase()}`)
  if (el.meltingPointC !== null && el.meltingPointC >= 1800) {
    traits.push('à caractère fortement réfractaire')
  }

  return traits.length > 0 ? `${familyText}, ${traits.join(', ')}.` : `${familyText}.`
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const n = Number.parseInt(
    clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean,
    16,
  )
  if (!Number.isFinite(n)) return [160, 168, 178]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return `#${[clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

export function getSolidTotalMassG(node: CanvasSolidNode): number {
  return node.components.reduce((acc, c) => acc + Math.max(0, c.massG), 0)
}

export function getSolidVolumeCm3(node: CanvasSolidNode): number {
  const mass = getSolidTotalMassG(node)
  const rho = Math.max(0.1, node.densityGPerCm3)
  return mass / rho
}

export function estimateDensityFromComponents(
  components: SolidComponent[],
  elementsBySymbol: Map<string, ElementRecord>,
): number {
  let totalMass = 0
  let totalVol = 0
  for (const c of components) {
    const m = Math.max(0, c.massG)
    if (m <= 0) continue
    const el = elementsBySymbol.get(c.symbol)
    const rho = el?.densityGPerCm3 ?? 7.5
    totalMass += m
    totalVol += m / Math.max(0.2, rho)
  }
  if (totalVol <= 0 || totalMass <= 0) return 7.5
  return Math.round((totalMass / totalVol) * 100) / 100
}

export function estimateMeltingPointFromComponents(
  components: SolidComponent[],
  elementsBySymbol: Map<string, ElementRecord>,
): number | null {
  let weighted = 0
  let totalMass = 0
  for (const c of components) {
    const el = elementsBySymbol.get(c.symbol)
    if (el?.meltingPointC === null || el?.meltingPointC === undefined) continue
    const m = Math.max(0, c.massG)
    weighted += m * el.meltingPointC
    totalMass += m
  }
  if (totalMass <= 0) return null
  const distinct = components.filter((c) => c.massG > 0).length
  const factor = distinct > 1 ? 0.94 : 1
  return Math.round((weighted / totalMass) * factor)
}

export function estimateColorFromComponents(
  components: SolidComponent[],
  elementsBySymbol: Map<string, ElementRecord>,
): string {
  let r = 0
  let g = 0
  let b = 0
  let totalMass = 0
  for (const c of components) {
    const m = Math.max(0, c.massG)
    if (m <= 0) continue
    const el = elementsBySymbol.get(c.symbol)
    const [cr, cg, cb] = hexToRgb(getElementSolidColor(c.symbol, el?.category))
    r += cr * m
    g += cg * m
    b += cb * m
    totalMass += m
  }
  if (totalMass <= 0) return '#9ca3af'
  return rgbToHex(r / totalMass, g / totalMass, b / totalMass)
}

export interface AlloyMatchEvaluation {
  matched: AlloyRecord | null
  /** Alloys sharing the exact same set of elements (for 1-click re-proportioning hints) */
  sameElementAlloys: AlloyRecord[]
}

/**
 * Matches a mass breakdown against the SQLite alloys table.
 * Exact range matches win first (curated prioritized over wikipedia/wikidata).
 */
export function matchAlloyFromComponents(
  components: SolidComponent[],
  alloys: AlloyRecord[],
): AlloyMatchEvaluation {
  const nonZero = components.filter((c) => c.massG > 1e-6)
  if (nonZero.length < 2) return { matched: null, sameElementAlloys: [] }

  const totalMass = nonZero.reduce((acc, c) => acc + c.massG, 0)
  const pctBySymbol = new Map<string, number>()
  for (const c of nonZero) {
    pctBySymbol.set(
      c.symbol,
      (pctBySymbol.get(c.symbol) ?? 0) + (c.massG / totalMass) * 100,
    )
  }
  const presentSymbols = new Set(pctBySymbol.keys())

  let bestExact: { alloy: AlloyRecord; score: number } | null = null
  const sameElementAlloys: AlloyRecord[] = []

  for (const alloy of alloys) {
    const required = alloy.components.filter((c) => !c.optional && c.minPct > 0)
    const allowedSymbols = new Set(alloy.components.map((c) => c.symbol))

    // Every present element must be part of this alloy
    let allPresentAllowed = true
    for (const sym of presentSymbols) {
      if (!allowedSymbols.has(sym)) {
        allPresentAllowed = false
        break
      }
    }
    if (!allPresentAllowed) continue

    // Every required element of this alloy must be present
    const allRequiredPresent = required.every((c) => presentSymbols.has(c.symbol))
    if (!allRequiredPresent) continue

    sameElementAlloys.push(alloy)

    // Evaluate whether mass percentages fall inside [minPct, maxPct]
    let inRange = true
    let deviation = 0
    for (const spec of alloy.components) {
      const actual = pctBySymbol.get(spec.symbol) ?? 0
      if (actual === 0 && spec.optional) continue
      const tol = Math.max(0.5, (spec.maxPct - spec.minPct) * 0.08)
      if (actual < spec.minPct - tol || actual > spec.maxPct + tol) {
        inRange = false
        break
      }
      deviation += Math.abs(actual - spec.typicalPct)
    }

    if (inRange) {
      const sourceBonus = alloy.source === 'curated' ? 0 : alloy.source === 'wikidata' ? 15 : 25
      const score = deviation + sourceBonus
      if (!bestExact || score < bestExact.score) {
        bestExact = { alloy, score }
      }
    }
  }

  // Sort same-element suggestions: curated first, then closest typical composition
  sameElementAlloys.sort((a, b) => {
    const aCur = a.source === 'curated' ? 0 : 1
    const bCur = b.source === 'curated' ? 0 : 1
    if (aCur !== bCur) return aCur - bCur
    const devA = a.components.reduce(
      (s, c) => s + Math.abs((pctBySymbol.get(c.symbol) ?? 0) - c.typicalPct),
      0,
    )
    const devB = b.components.reduce(
      (s, c) => s + Math.abs((pctBySymbol.get(c.symbol) ?? 0) - c.typicalPct),
      0,
    )
    return devA - devB
  })

  return {
    matched: bestExact?.alloy ?? null,
    sameElementAlloys: sameElementAlloys.slice(0, 4),
  }
}

export function createSolidNodeFromElement(
  el: ElementRecord,
  x: number,
  y: number,
  volumeCm3 = 1,
): CanvasSolidNode {
  const density = el.densityGPerCm3 ?? 7.5
  const massG = Math.round(density * volumeCm3 * 100) / 100
  const isMetal =
    el.category !== 'nonmetal' &&
    el.category !== 'metalloid' &&
    el.category !== 'halogen' &&
    el.category !== 'noble-gas'
  return {
    id: createNodeId('solid'),
    kind: 'solid',
    x,
    y,
    nameFr: isMetal ? `${el.nameFr} métallique` : `${el.nameFr} solide`,
    alloyId: null,
    isAlloy: false,
    components: [
      {
        symbol: el.symbol,
        massG: Math.max(0.01, massG),
        speciesId: getSolidSpeciesIdForElement(el.symbol),
      },
    ],
    densityGPerCm3: density,
    meltingPointC: el.meltingPointC,
    colorHex: getElementSolidColor(el.symbol, el.category),
    usesFr: describeElementSolid(el),
  }
}

export function createSolidNodeFromAlloy(
  alloy: AlloyRecord,
  x: number,
  y: number,
  totalMassG = 10,
): CanvasSolidNode {
  const activeSpecs = alloy.components.filter((c) => c.typicalPct > 0)
  const pctSum = activeSpecs.reduce((s, c) => s + c.typicalPct, 0) || 100
  const components: SolidComponent[] = activeSpecs.map((c) => ({
    symbol: c.symbol,
    massG: Math.round(((totalMassG * c.typicalPct) / pctSum) * 1000) / 1000,
    speciesId: getSolidSpeciesIdForElement(c.symbol),
  }))

  return {
    id: createNodeId('solid'),
    kind: 'solid',
    x,
    y,
    nameFr: alloy.nameFr,
    alloyId: alloy.id,
    isAlloy: true,
    components,
    densityGPerCm3: alloy.densityGPerCm3,
    meltingPointC: alloy.meltingPointC,
    colorHex: alloy.colorHex,
    usesFr: alloy.usesFr,
  }
}

export function resolveSolidIdentity(
  components: SolidComponent[],
  alloys: AlloyRecord[],
  elementsBySymbol: Map<string, ElementRecord>,
): Omit<CanvasSolidNode, 'id' | 'kind' | 'x' | 'y'> {
  const mergedMap = new Map<string, number>()
  for (const c of components) {
    if (c.massG <= 1e-6) continue
    mergedMap.set(c.symbol, (mergedMap.get(c.symbol) ?? 0) + c.massG)
  }

  const normalized: SolidComponent[] = [...mergedMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([symbol, massG]) => ({
      symbol,
      massG: Math.round(massG * 10000) / 10000,
      speciesId: getSolidSpeciesIdForElement(symbol),
    }))

  if (normalized.length === 1) {
    const sym = normalized[0].symbol
    const el = elementsBySymbol.get(sym)
    const isMetal =
      el &&
      el.category !== 'nonmetal' &&
      el.category !== 'metalloid' &&
      el.category !== 'halogen' &&
      el.category !== 'noble-gas'
    return {
      nameFr: el
        ? isMetal
          ? `${el.nameFr} métallique`
          : `${el.nameFr} solide`
        : sym,
      alloyId: null,
      isAlloy: false,
      components: normalized,
      densityGPerCm3: el?.densityGPerCm3 ?? 7.5,
      meltingPointC: el?.meltingPointC ?? null,
      colorHex: getElementSolidColor(sym, el?.category),
      usesFr: el ? describeElementSolid(el) : null,
    }
  }

  const { matched } = matchAlloyFromComponents(normalized, alloys)
  if (matched) {
    return {
      nameFr: matched.nameFr,
      alloyId: matched.id,
      isAlloy: true,
      components: normalized,
      densityGPerCm3: matched.densityGPerCm3,
      meltingPointC: matched.meltingPointC,
      colorHex: matched.colorHex,
      usesFr: matched.usesFr,
    }
  }

  const symsLabel = normalized.map((c) => c.symbol).join('–')
  return {
    nameFr: `Alliage ${symsLabel}`,
    alloyId: null,
    isAlloy: true,
    components: normalized,
    densityGPerCm3: estimateDensityFromComponents(normalized, elementsBySymbol),
    meltingPointC: estimateMeltingPointFromComponents(normalized, elementsBySymbol),
    colorHex: estimateColorFromComponents(normalized, elementsBySymbol),
    usesFr: null,
  }
}

export function forgeAlloyFromNodes(
  sources: Array<CanvasSolidNode | CanvasAtomNode>,
  alloys: AlloyRecord[],
  elementsBySymbol: Map<string, ElementRecord>,
  x: number,
  y: number,
): CanvasSolidNode {
  const allComponents: SolidComponent[] = []
  for (const node of sources) {
    if (node.kind === 'solid') {
      allComponents.push(...node.components)
    } else {
      const el = elementsBySymbol.get(node.symbol)
      const density = el?.densityGPerCm3 ?? 7.5
      // Converting an atom directly into a merge contributes 1 cm³ (or 1% when carbon is added to a much larger iron block? Keep physical 1 cm³ = predictable!)
      allComponents.push({
        symbol: node.symbol,
        massG: Math.round(density * 100) / 100,
        speciesId: getSolidSpeciesIdForElement(node.symbol),
      })
    }
  }

  const identity = resolveSolidIdentity(allComponents, alloys, elementsBySymbol)
  return {
    id: createNodeId('solid'),
    kind: 'solid',
    x,
    y,
    ...identity,
  }
}

export function rescaleSolidMass(
  node: CanvasSolidNode,
  nextTotalMassG: number,
): CanvasSolidNode {
  const clamped = Math.max(0.01, Math.min(100000, nextTotalMassG))
  const currentTotal = getSolidTotalMassG(node)
  if (currentTotal <= 1e-9) return node
  const ratio = clamped / currentTotal
  return {
    ...node,
    components: node.components.map((c) => ({
      ...c,
      massG: Math.max(0.0001, Math.round(c.massG * ratio * 10000) / 10000),
    })),
  }
}

export function rescaleSolidVolume(
  node: CanvasSolidNode,
  nextVolumeCm3: number,
): CanvasSolidNode {
  const nextMassG = nextVolumeCm3 * Math.max(0.1, node.densityGPerCm3)
  return rescaleSolidMass(node, nextMassG)
}

export function updateSolidComponentMass(
  node: CanvasSolidNode,
  symbol: string,
  nextMassG: number,
  alloys: AlloyRecord[],
  elementsBySymbol: Map<string, ElementRecord>,
): CanvasSolidNode {
  const updated = node.components.map((c) =>
    c.symbol === symbol ? { ...c, massG: Math.max(0.001, nextMassG) } : c,
  )
  const identity = resolveSolidIdentity(updated, alloys, elementsBySymbol)
  return {
    ...node,
    ...identity,
  }
}

export function reproportionSolidToAlloy(
  node: CanvasSolidNode,
  alloy: AlloyRecord,
): CanvasSolidNode {
  const totalMassG = Math.max(0.1, getSolidTotalMassG(node))
  const activeSpecs = alloy.components.filter((c) => c.typicalPct > 0)
  const pctSum = activeSpecs.reduce((s, c) => s + c.typicalPct, 0) || 100
  return {
    ...node,
    nameFr: alloy.nameFr,
    alloyId: alloy.id,
    isAlloy: true,
    components: activeSpecs.map((c) => ({
      symbol: c.symbol,
      massG: Math.round(((totalMassG * c.typicalPct) / pctSum) * 10000) / 10000,
      speciesId: getSolidSpeciesIdForElement(c.symbol),
    })),
    densityGPerCm3: alloy.densityGPerCm3,
    meltingPointC: alloy.meltingPointC,
    colorHex: alloy.colorHex,
    usesFr: alloy.usesFr,
  }
}
