import type { ElementBlock, ElementCategory } from '../../shared/chemistry.ts'

export interface ElementExtraData {
  block: ElementBlock
  electronConfiguration: string
  electronShells: number[]
  valenceElectrons: number
  oxidationStates: number[]
  atomicRadiusPm: number | null
  vdwRadiusPm: number | null
  ionizationEnergyKjMol: number | null
  electronAffinityKjMol: number | null
  meltingPointC: number | null
  boilingPointC: number | null
  densityGPerCm3: number | null
  discoveryYear: number | null
  discoveredBy: string | null
  radioactive: boolean
  synthetic: boolean
  crystalStructure: string | null
  summaryFr: string
}

// Subshells in strict Madelung filling order: [n, lLabel, maxElectrons]
const AUFBAU_ORDER: Array<[number, 's' | 'p' | 'd' | 'f', number]> = [
  [1, 's', 2],
  [2, 's', 2],
  [2, 'p', 6],
  [3, 's', 2],
  [3, 'p', 6],
  [4, 's', 2],
  [3, 'd', 10],
  [4, 'p', 6],
  [5, 's', 2],
  [4, 'd', 10],
  [5, 'p', 6],
  [6, 's', 2],
  [4, 'f', 14],
  [5, 'd', 10],
  [6, 'p', 6],
  [7, 's', 2],
  [5, 'f', 14],
  [6, 'd', 10],
  [7, 'p', 6],
]

// Exact IUPAC ground-state Aufbau exceptions (subshell overrides relative to noble gas core)
const CONFIG_EXCEPTIONS: Record<number, Record<string, number>> = {
  24: { '3d': 5, '4s': 1 }, // Cr
  29: { '3d': 10, '4s': 1 }, // Cu
  41: { '4d': 4, '5s': 1 }, // Nb
  42: { '4d': 5, '5s': 1 }, // Mo
  44: { '4d': 7, '5s': 1 }, // Ru
  45: { '4d': 8, '5s': 1 }, // Rh
  46: { '4d': 10, '5s': 0 }, // Pd
  47: { '4d': 10, '5s': 1 }, // Ag
  57: { '4f': 0, '5d': 1, '6s': 2 }, // La
  58: { '4f': 1, '5d': 1, '6s': 2 }, // Ce
  64: { '4f': 7, '5d': 1, '6s': 2 }, // Gd
  78: { '4f': 14, '5d': 9, '6s': 1 }, // Pt
  79: { '4f': 14, '5d': 10, '6s': 1 }, // Au
  89: { '5f': 0, '6d': 1, '7s': 2 }, // Ac
  90: { '5f': 0, '6d': 2, '7s': 2 }, // Th
  91: { '5f': 2, '6d': 1, '7s': 2 }, // Pa
  92: { '5f': 3, '6d': 1, '7s': 2 }, // U
  93: { '5f': 4, '6d': 1, '7s': 2 }, // Np
  96: { '5f': 7, '6d': 1, '7s': 2 }, // Cm
  103: { '5f': 14, '6d': 0, '7s': 2, '7p': 1 }, // Lr
}

const NOBLE_CORES: Array<{ z: number; label: string }> = [
  { z: 86, label: '[Rn]' },
  { z: 54, label: '[Xe]' },
  { z: 36, label: '[Kr]' },
  { z: 18, label: '[Ar]' },
  { z: 10, label: '[Ne]' },
  { z: 2, label: '[He]' },
]

const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
}

function toSuperscript(n: number): string {
  return String(n)
    .split('')
    .map((ch) => SUPERSCRIPTS[ch] ?? ch)
    .join('')
}

function computeElectronicStructure(
  z: number,
  groupNum: number | null,
  category: ElementCategory,
): {
  block: ElementBlock
  electronConfiguration: string
  electronShells: number[]
  valenceElectrons: number
} {
  const counts = new Map<string, number>()
  let remaining = z
  for (const [n, l, cap] of AUFBAU_ORDER) {
    if (remaining <= 0) break
    const take = Math.min(remaining, cap)
    counts.set(`${n}${l}`, take)
    remaining -= take
  }

  const exc = CONFIG_EXCEPTIONS[z]
  if (exc) {
    for (const [sub, val] of Object.entries(exc)) {
      if (val === 0) counts.delete(sub)
      else counts.set(sub, val)
    }
  }

  // Shells K..Q (n = 1..7)
  const shellMap = new Map<number, number>()
  for (const [sub, count] of counts.entries()) {
    const n = Number(sub[0])
    shellMap.set(n, (shellMap.get(n) ?? 0) + count)
  }
  const maxN = Math.max(...shellMap.keys())
  const electronShells: number[] = []
  for (let n = 1; n <= maxN; n++) {
    electronShells.push(shellMap.get(n) ?? 0)
  }

  // Determine block
  let block: ElementBlock = 'p'
  if (z === 2 || groupNum === 1 || groupNum === 2) {
    block = 's'
  } else if (category === 'lanthanide' || category === 'actinide') {
    block = z === 71 || z === 103 ? 'd' : 'f'
  } else if (groupNum !== null && groupNum >= 3 && groupNum <= 12) {
    block = 'd'
  } else {
    block = 'p'
  }

  // Noble gas core shorthand
  const core = NOBLE_CORES.find((c) => z > c.z)
  const coreCounts = new Map<string, number>()
  if (core) {
    let cRem = core.z
    for (const [n, l, cap] of AUFBAU_ORDER) {
      if (cRem <= 0) break
      const take = Math.min(cRem, cap)
      coreCounts.set(`${n}${l}`, take)
      cRem -= take
    }
  }

  // Format remaining subshells sorted by principal quantum number n, then l (s, p, d, f)
  const lOrder: Record<string, number> = { s: 0, p: 1, d: 2, f: 3 }
  const outerEntries = [...counts.entries()]
    .filter(([sub, cnt]) => cnt > (coreCounts.get(sub) ?? 0))
    .sort(([a], [b]) => {
      const na = Number(a[0])
      const nb = Number(b[0])
      if (na !== nb) return na - nb
      return (lOrder[a[1]] ?? 0) - (lOrder[b[1]] ?? 0)
    })

  const outerStr = outerEntries
    .map(([sub, cnt]) => `${sub}${toSuperscript(cnt)}`)
    .join(' ')
  const electronConfiguration = core ? `${core.label} ${outerStr}` : outerStr

  // Valence electrons
  let valenceElectrons = electronShells[electronShells.length - 1] ?? 1
  if (z === 2) {
    valenceElectrons = 2
  } else if (groupNum !== null) {
    if (groupNum <= 2) valenceElectrons = groupNum
    else if (groupNum >= 13) valenceElectrons = groupNum - 10
    else {
      // Transition metals: outer s + incomplete (n-1)d electrons (capped at groupNum)
      valenceElectrons = Math.min(groupNum, electronShells[electronShells.length - 1] + (counts.get(`${maxN - 1}d`) ?? 0))
    }
  }

  return { block, electronConfiguration, electronShells, valenceElectrons }
}

// Tuple format for all 118 elements (authoritative CRC / NIST / IUPAC values):
// [0] z
// [1] meltingPointC (°C, null if unknown/predicted unavailable)
// [2] boilingPointC (°C, null if unknown)
// [3] densityGPerCm3 (g/cm³ at STP, null if unknown)
// [4] atomicRadiusPm (empirical/covalent pm)
// [5] vdwRadiusPm (Van der Waals pm)
// [6] ionizationEnergyKjMol (1st IE, kJ/mol)
// [7] electronAffinityKjMol (kJ/mol)
// [8] oxidationStates (common oxidation numbers)
// [9] crystalStructure (French short label or null)
// [10] discoveryYear (null = Antiquité)
// [11] discoveredBy (French label)
// [12] summaryFr
type ExtraTuple = [
  z: number,
  meltingPointC: number | null,
  boilingPointC: number | null,
  densityGPerCm3: number | null,
  atomicRadiusPm: number | null,
  vdwRadiusPm: number | null,
  ionizationEnergyKjMol: number | null,
  electronAffinityKjMol: number | null,
  oxidationStates: number[],
  crystalStructure: string | null,
  discoveryYear: number | null,
  discoveredBy: string | null,
  summaryFr: string,
]

const RAW_EXTRA: ExtraTuple[] = [
  [1, -259.16, -252.87, 0.0000899, 31, 120, 1312.0, 72.8, [-1, 1], 'Hexagonal', 1766, 'Henry Cavendish', 'Élément le plus léger et le plus abondant de l’Univers ; forme le dihydrogène H₂, l’eau et l’ensemble des composés organiques.'],
  [2, -272.2, -268.93, 0.0001785, 28, 140, 2372.3, 0, [0], 'Hexagonal compact', 1868, 'Pierre Janssen & Norman Lockyer', 'Gaz noble inerte à très bas point d’ébullition, utilisé en cryogénie (aimants supraconducteurs) et comme gaz vecteur.'],
  [3, 180.5, 1342, 0.534, 128, 182, 520.2, 59.6, [1], 'Cubique centré', 1817, 'Johan August Arfwedson', 'Métal alcalin le plus léger ; très réducteur, incontournable dans les accumulateurs lithium-ion et la synthèse organométallique.'],
  [4, 1287, 2470, 1.85, 96, 153, 899.5, 0, [2], 'Hexagonal compact', 1798, 'Louis-Nicolas Vauquelin', 'Métal alcalino-terreux rigide, léger et transparent aux rayons X, présent dans le béryl et l’émeraude.'],
  [5, 2076, 3927, 2.34, 84, 192, 800.6, 27.0, [3], 'Rhomboédrique', 1808, 'Gay-Lussac, Thénard & H. Davy', 'Métalloïde réfractaire formant des liaisons covalentes déficientes en électrons ; base du verre borosilicaté (Pyrex).'],
  [6, 3550, 4027, 2.267, 76, 170, 1086.5, 121.8, [-4, -3, -2, -1, 0, 1, 2, 3, 4], 'Hexagonal / Diamant', null, 'Antiquité', 'Tétravalent par excellence, capable de former des chaînes et cycles stables (diamant, graphite, chimie organique).'],
  [7, -210.0, -195.79, 0.001251, 71, 155, 1402.3, 0, [-3, -2, -1, 1, 2, 3, 4, 5], 'Hexagonal', 1772, 'Daniel Rutherford', 'Constitue 78 % de l’air sous forme de N₂ (triple liaison très stable) ; essentiel aux acides aminés, nitrates et ammoniac.'],
  [8, -218.79, -182.96, 0.001429, 66, 152, 1313.9, 141.0, [-2, -1, 1, 2], 'Cubique', 1774, 'Carl W. Scheele & Joseph Priestley', 'Comburant majeur (21 % de l’air), très électronégatif ; élément le plus abondant de la croûte terrestre (oxydes, silicates, eau).'],
  [9, -219.67, -188.11, 0.001696, 57, 147, 1681.0, 328.2, [-1], 'Monoclinique', 1886, 'Henri Moissan', 'Élément le plus électronégatif du tableau périodique (χ = 3,98) ; oxydant extrêmement puissant formant des liaisons C–F très stables.'],
  [10, -248.59, -246.08, 0.000900, 58, 154, 2080.7, 0, [0], 'Cubique faces centrées', 1898, 'William Ramsay & Morris Travers', 'Gaz noble chimiquement inerte émettant une vive lumière rouge-orangé sous décharge électrique.'],
  [11, 97.79, 882.9, 0.968, 166, 227, 495.8, 52.8, [1], 'Cubique centré', 1807, 'Humphry Davy', 'Métal alcalin mou réagissant violemment avec l’eau en libérant H₂ ; omniprésent sous forme d’ion Na⁺ (sel gemme, soude).'],
  [12, 650, 1091, 1.738, 141, 173, 737.7, 0, [2], 'Hexagonal compact', 1755, 'Joseph Black', 'Métal léger brûlant avec une flamme blanche éblouissante (MgO) ; au cœur de la chlorophylle et des réactifs de Grignard.'],
  [13, 660.32, 2470, 2.70, 121, 184, 577.5, 41.8, [3], 'Cubique faces centrées', 1825, 'Hans Christian Ørsted', 'Métal le plus abondant de la croûte terrestre, protégé de la corrosion par une fine couche d’alumine Al₂O₃ ; puissant réducteur (aluminothermie).'],
  [14, 1414, 3265, 2.329, 111, 210, 786.5, 134.1, [-4, 2, 4], 'Diamant', 1824, 'Jöns Jacob Berzelius', 'Métalloïde semi-conducteur formant le squelette des silicates, du quartz (SiO₂) et des puces électroniques.'],
  [15, 44.15, 280.5, 1.823, 107, 180, 1011.8, 72.0, [-3, 3, 5], 'Triclinique / Monoclinique', 1669, 'Hennig Brand', 'Non-métal présentant plusieurs allotropes (blanc pyrophorique, rouge) ; central dans l’ADN, l’ATP et les phosphates.'],
  [16, 115.21, 444.6, 2.07, 105, 180, 999.6, 200.4, [-2, 2, 4, 6], 'Orthorhombique', null, 'Antiquité', 'Solide jaune formant des cycles S₈ ; précurseur de l’acide sulfurique H₂SO₄ et clé de la vulcanisation du caoutchouc.'],
  [17, -101.5, -34.04, 0.003214, 102, 175, 1251.2, 348.6, [-1, 1, 3, 5, 7], 'Orthorhombique', 1774, 'Carl Wilhelm Scheele', 'Halogène gazeux jaune-vert oxydant ; utilisé pour la désinfection de l’eau, le PVC et l’acide chlorhydrique.'],
  [18, -189.35, -185.85, 0.001784, 106, 188, 1520.6, 0, [0], 'Cubique faces centrées', 1894, 'Lord Rayleigh & William Ramsay', 'Troisième gaz le plus abondant de l’atmosphère (~0,93 %) ; atmosphère inerte idéale pour la soudure et la chimie sensible à l’air.'],
  [19, 63.5, 759, 0.89, 203, 275, 418.8, 48.4, [1], 'Cubique centré', 1807, 'Humphry Davy', 'Métal alcalin très réactif s’enflammant au contact de l’eau (flamme lilas) ; ion K⁺ indispensable aux cellules vivantes et aux engrais.'],
  [20, 842, 1484, 1.55, 176, 231, 589.8, 2.4, [2], 'Cubique faces centrées', 1808, 'Humphry Davy', 'Métal alcalino-terreux constitutif du calcaire (CaCO₃), du plâtre, des os et des coquilles.'],
  [21, 1541, 2836, 2.985, 170, 211, 633.1, 18.1, [3], 'Hexagonal compact', 1879, 'Lars Fredrik Nilson', 'Premier métal de transition (bloc d), employé dans des alliages aluminium-scandium à haute résistance mécanique.'],
  [22, 1668, 3287, 4.506, 160, 215, 658.8, 7.6, [2, 3, 4], 'Hexagonal compact', 1791, 'William Gregor', 'Métal léger, biocompatible et très résistant à la corrosion ; son dioxyde TiO₂ est le pigment blanc universel.'],
  [23, 1910, 3407, 6.11, 153, 207, 650.9, 50.7, [2, 3, 4, 5], 'Cubique centré', 1801, 'Andrés Manuel del Río', 'Métal de transition aux degrés d’oxydation vivement colorés en solution (+5 jaune, +4 bleu, +3 vert, +2 violet) ; renforce les aciers.'],
  [24, 1907, 2671, 7.19, 139, 206, 652.9, 64.3, [2, 3, 6], 'Cubique centré', 1797, 'Louis-Nicolas Vauquelin', 'Métal dur et brillant conférant leur résistance inoxydable aux aciers ; ses ions Cr³⁺ (vert) et Cr₂O₇²⁻ (orange) sont classiques en redox.'],
  [25, 1246, 2061, 7.21, 139, 205, 717.3, 0, [2, 3, 4, 6, 7], 'Cubique centré', 1774, 'Johan Gottlieb Gahn', 'Essentiel en sidérurgie ; le permanganate MnO₄⁻ (+VII, violet intense) est l’oxydant de référence des titrages colorimétriques.'],
  [26, 1538, 2862, 7.874, 132, 204, 762.5, 15.7, [2, 3], 'Cubique centré', null, 'Antiquité', 'Métal ferromagnétique pilier de la métallurgie (aciers) et du transport d’oxygène biologique (hémoglobine) ; ions Fe²⁺ vert pâle et Fe³⁺ rouille.'],
  [27, 1495, 2927, 8.90, 126, 200, 760.4, 63.9, [2, 3], 'Hexagonal compact', 1735, 'Georg Brandt', 'Métal ferromagnétique utilisé dans les superalliages, cathodes Li-ion, pigments bleus et la vitamine B12.'],
  [28, 1455, 2913, 8.908, 124, 163, 737.1, 111.7, [2, 3], 'Cubique faces centrées', 1751, 'Axel Fredrik Cronstedt', 'Métal ductile résistant à la corrosion, catalyseur d’hydrogénation (nickel de Raney) et composant des aciers inoxydables.'],
  [29, 1084.62, 2562, 8.96, 132, 140, 745.5, 119.2, [1, 2], 'Cubique faces centrées', null, 'Antiquité', 'Excellent conducteur électrique et thermique de couleur rouge-orangé ; forme l’ion Cu²⁺ bleu céleste et le complexe [Cu(NH₃)₄]²⁺.'],
  [30, 419.53, 907, 7.14, 122, 139, 906.4, 0, [2], 'Hexagonal compact', null, 'Antiquité', 'Métal bleuté protégeant l’acier par galvanisation ; réducteur classique en laboratoire (pile Daniell, attaque acide dégageant H₂).'],
  [31, 29.76, 2400, 5.91, 122, 187, 578.8, 41.5, [3], 'Orthorhombique', 1875, 'Paul-Émile Lecoq de Boisbaudran', 'Métal fondant dans la main (29,8 °C), célèbre pour avoir confirmé les prédictions de Mendeleïev ; clé des LED (GaN, GaAs).'],
  [32, 938.25, 2833, 5.323, 120, 211, 762.0, 118.9, [2, 4], 'Diamant', 1886, 'Clemens Winkler', 'Métalloïde semi-conducteur utilisé en optique infrarouge, fibres optiques et électronique haute fréquence.'],
  [33, 817, 614, 5.727, 119, 185, 947.0, 78.2, [-3, 3, 5], 'Rhomboédrique', null, 'Antiquité', 'Métalloïde se sublimant à pression atmosphérique ; utilisé comme dopant semi-conducteur (GaAs) et historiquement célèbre pour sa toxicité.'],
  [34, 221, 685, 4.81, 120, 190, 941.0, 195.0, [-2, 4, 6], 'Hexagonal', 1817, 'Jöns Jacob Berzelius', 'Non-métal photoconducteur apparenté au soufre, oligo-élément antioxydant et composant de cellules photovoltaïques.'],
  [35, -7.2, 58.8, 3.1028, 120, 185, 1139.9, 324.6, [-1, 1, 3, 5], 'Orthorhombique', 1826, 'Antoine-Jérôme Balard', 'Seul non-métal liquide à température ambiante (brun-rouge fumant) ; utilisé en synthèse organique (tests d’alcènes).'],
  [36, -157.37, -153.41, 0.003749, 116, 202, 1350.8, 0, [0, 2], 'Cubique faces centrées', 1898, 'William Ramsay & Morris Travers', 'Gaz noble utilisé dans les lampes flash haute vitesse et certains lasers excimères.'],
  [37, 39.31, 688, 1.532, 220, 303, 403.0, 46.9, [1], 'Cubique centré', 1861, 'Robert Bunsen & Gustav Kirchhoff', 'Alcalin très mou s’enflammant spontanément à l’air ; employé dans les horloges atomiques et les pièges magnéto-optiques.'],
  [38, 777, 1377, 2.64, 195, 249, 549.5, 5.0, [2], 'Cubique faces centrées', 1790, 'Adair Crawford', 'Alcalino-terreux proche du calcium, produisant une flamme rouge carmin intense en pyrotechnie.'],
  [39, 1526, 3336, 4.472, 190, 232, 600.0, 29.6, [3], 'Hexagonal compact', 1794, 'Johan Gadolin', 'Terre rare du groupe 3 utilisée dans les lasers YAG, les luminophores et les supraconducteurs à haute température (YBCO).'],
  [40, 1855, 4409, 6.52, 175, 223, 640.1, 41.1, [4], 'Hexagonal compact', 1789, 'Martin Heinrich Klaproth', 'Métal réfractaire très résistant aux acides et faiblement absorbant de neutrons ; sa zircone ZrO₂ est une céramique haute performance.'],
  [41, 2477, 4744, 8.57, 164, 218, 652.1, 88.5, [3, 5], 'Cubique centré', 1801, 'Charles Hatchett', 'Métal réfractaire supraconducteur (alliages NbTi pour IRM et accélérateurs de particules) et additif des aciers haute résistance.'],
  [42, 2623, 4639, 10.28, 154, 217, 684.3, 72.1, [2, 3, 4, 5, 6], 'Cubique centré', 1778, 'Carl Wilhelm Scheele', 'Métal à très haut point de fusion utilisé dans les aciers réfractaires, les lubrifiants (MoS₂) et les enzymes nitrogénases.'],
  [43, 2157, 4265, 11.0, 147, 216, 702.0, 53.0, [4, 7], 'Hexagonal compact', 1937, 'Carlo Perrier & Emilio Segrè', 'Élément le plus léger sans aucun isotope stable ; le technétium-99m est le traceur roi en scintigraphie médicale.'],
  [44, 2334, 4150, 12.45, 146, 213, 710.2, 101.0, [3, 4, 8], 'Hexagonal compact', 1844, 'Karl Ernst Claus', 'Métal de la mine du platine, catalyseur majeur en métathèse d’oléfines (catalyseur de Grubbs) et en électrochimie.'],
  [45, 1964, 3695, 12.41, 142, 210, 719.7, 110.3, [3], 'Cubique faces centrées', 1803, 'William Hyde Wollaston', 'Métal précieux blanc argenté extrêmement inerte, indispensable aux pots catalytiques automobiles (réduction des NOₓ).'],
  [46, 1554.9, 2963, 12.023, 139, 163, 804.4, 54.2, [2, 4], 'Cubique faces centrées', 1803, 'William Hyde Wollaston', 'Absorbe jusqu’à 900 fois son volume de H₂ ; catalyseur incontournable en synthèse organique (couplages de Suzuki, Heck).'],
  [47, 961.78, 2162, 10.49, 145, 172, 731.0, 125.6, [1], 'Cubique faces centrées', null, 'Antiquité', 'Meilleur conducteur électrique et thermique de tous les éléments ; Ag⁺ permet le test caractéristique des halogénures (AgCl blanc).'],
  [48, 321.07, 767, 8.65, 144, 158, 867.8, 0, [2], 'Hexagonal compact', 1817, 'Friedrich Stromeyer', 'Métal mou et toxique apparenté au zinc, utilisé dans les pigments jaunes/rouges historiques et les cellules solaires CdTe.'],
  [49, 156.6, 2072, 7.31, 142, 193, 558.3, 37.0, [1, 3], 'Tétragonal', 1863, 'Ferdinand Reich & Hieronymus Richter', 'Métal très malléable utilisé sous forme d’oxyde transparent conducteur (ITO) sur les écrans tactiles et LCD.'],
  [50, 231.93, 2602, 7.265, 139, 217, 708.6, 107.3, [2, 4], 'Tétragonal', null, 'Antiquité', 'Métal pauvre à bas point de fusion, constituant du bronze (Cu–Sn) et des brasures électroniques sans plomb.'],
  [51, 630.63, 1587, 6.697, 139, 206, 834.0, 101.1, [-3, 3, 5], 'Rhomboédrique', null, 'Antiquité', 'Métalloïde brillant durcissant les alliages de plomb et utilisé comme retardateur de flamme (Sb₂O₃).'],
  [52, 449.51, 988, 6.24, 138, 206, 869.3, 190.2, [-2, 4, 6], 'Hexagonal', 1782, 'Franz-Joseph Müller von Reichenstein', 'Métalloïde semi-conducteur rare, employé dans les modules thermoélectriques (Bi₂Te₃) et les panneaux photovoltaïques.'],
  [53, 113.7, 184.3, 4.933, 139, 198, 1008.4, 295.2, [-1, 1, 5, 7], 'Orthorhombique', 1811, 'Bernard Courtois', 'Halogène solide gris-violet se sublimant en vapeurs violettes ; réactif des titrages iodométriques (I₂/I⁻) et du test à l’amidon.'],
  [54, -111.75, -108.1, 0.005894, 140, 216, 1170.4, 0, [0, 2, 4, 6], 'Cubique faces centrées', 1898, 'William Ramsay & Morris Travers', 'Gaz noble lourd capable de former des fluorures (XeF₄) ; utilisé dans les moteurs ioniques spatiaux et les lampes à arc.'],
  [55, 28.5, 671, 1.93, 244, 343, 375.7, 45.5, [1], 'Cubique centré', 1860, 'Robert Bunsen & Gustav Kirchhoff', 'Alcalin doré fondant à 28,5 °C, le moins électronégatif des éléments stables ; définit la seconde internationale (horloge au ¹³³Cs).'],
  [56, 727, 1897, 3.51, 215, 268, 502.9, 14.0, [2], 'Cubique centré', 1808, 'Humphry Davy', 'Alcalino-terreux lourd ; le sulfate de baryum BaSO₄ est très insoluble et sert d’opacifiant radiologique (et de test des ions SO₄²⁻).'],
  [57, 920, 3464, 6.162, 207, 243, 538.1, 53.8, [3], 'Hexagonal compact', 1839, 'Carl Gustaf Mosander', 'Chef de file des lanthanides ; employé dans les verres optiques à haut indice de réfraction et les batteries NiMH.'],
  [58, 795, 3443, 6.77, 204, 242, 534.4, 55.0, [3, 4], 'Cubique faces centrées', 1803, 'Berzelius, Hisinger & Klaproth', 'Lanthanide le plus abondant ; utilisé dans les pierres à briquet (ferrocérium), les catalyseurs automobiles et le polissage du verre.'],
  [59, 935, 3520, 6.77, 203, 240, 527.0, 10.5, [3], 'Hexagonal compact', 1885, 'Carl Auer von Welsbach', 'Terre rare colorant les verres de protection des souffleurs de verre en jaune-vert et entrant dans des aimants haute puissance.'],
  [60, 1024, 3074, 7.01, 201, 239, 533.1, 18.5, [3], 'Hexagonal compact', 1885, 'Carl Auer von Welsbach', 'Élément clé des aimants permanents les plus puissants (Nd₂Fe₁₄B) et des lasers solides Nd:YAG.'],
  [61, 1042, 3000, 7.26, 199, 238, 540.0, 12.5, [3], 'Hexagonal compact', 1945, 'Marinsky, Glendenin & Coryell', 'Seul lanthanide exclusivement radioactif ; utilisé dans des micro-batteries nucléaires bêtavoltaïques.'],
  [62, 1072, 1794, 7.52, 198, 236, 544.5, 15.6, [2, 3], 'Rhomboédrique', 1879, 'Paul-Émile Lecoq de Boisbaudran', 'Forme avec le cobalt des aimants permanents (SmCo₅) résistants aux hautes températures.'],
  [63, 826, 1529, 5.244, 198, 235, 547.1, 11.2, [2, 3], 'Cubique centré', 1901, 'Eugène-Anatole Demarçay', 'Lanthanide le plus réactif ; émet une luminescence rouge et bleue exploitée dans les LED et les billets en euros.'],
  [64, 1312, 3273, 7.90, 196, 234, 593.4, 13.2, [3], 'Hexagonal compact', 1880, 'Jean Charles Galissard de Marignac', 'Fortement paramagnétique (7 électrons f célibataires), base des agents de contraste injectables en IRM.'],
  [65, 1356, 3230, 8.23, 194, 233, 565.8, 12.7, [3], 'Hexagonal compact', 1843, 'Carl Gustaf Mosander', 'Terre rare produisant une fluorescence verte vive et entrant dans les alliages magnétostrictifs (Terfenol-D).'],
  [66, 1407, 2567, 8.54, 192, 231, 573.0, 34.0, [3], 'Hexagonal compact', 1886, 'Paul-Émile Lecoq de Boisbaudran', 'Possède l’un des moments magnétiques les plus élevés ; stabilise les aimants au néodyme dans les moteurs électriques à chaud.'],
  [67, 1461, 2720, 8.79, 192, 230, 581.0, 32.6, [3], 'Hexagonal compact', 1878, 'Marc Delafontaine & Jacques-Louis Soret', 'Détient le moment magnétique le plus intense de tous les éléments naturels ; utilisé dans les lasers médicaux et concentrateurs de champ.'],
  [68, 1529, 2868, 9.066, 189, 229, 589.3, 30.1, [3], 'Hexagonal compact', 1843, 'Carl Gustaf Mosander', 'Les fibres optiques dopées à l’erbium (EDFA) amplifient les signaux lumineux des télécommunications intercontinentales.'],
  [69, 1545, 1950, 9.32, 190, 227, 596.7, 99.3, [3], 'Hexagonal compact', 1879, 'Per Teodor Cleve', 'Lanthanide stable le plus rare ; utilisé dans des lasers chirurgicaux infrarouges et sources portables de rayons X.'],
  [70, 824, 1196, 6.90, 187, 226, 603.4, 0, [2, 3], 'Cubique faces centrées', 1878, 'Jean Charles Galissard de Marignac', 'Utilisé dans les horloges optiques ultra-précises et les lasers à fibre de haute puissance.'],
  [71, 1652, 3402, 9.841, 187, 224, 523.5, 23.0, [3], 'Hexagonal compact', 1907, 'Georges Urbain & Carl Auer von Welsbach', 'Dernier et plus dense des lanthanides ; employé dans les scintillateurs TEP (tomographie par émission de positons).'],
  [72, 2233, 4603, 13.31, 175, 223, 658.5, 17.2, [4], 'Hexagonal compact', 1923, 'Dirk Coster & George de Hevesy', 'Très proche chimiquement du zirconium mais grand absorbeur de neutrons ; son oxyde HfO₂ sert de diélectrique dans les processeurs.'],
  [73, 3017, 5458, 16.69, 170, 222, 761.0, 31.0, [5], 'Cubique centré', 1802, 'Anders Gustaf Ekeberg', 'Métal ultra-résistant à la corrosion acide, utilisé dans les condensateurs miniaturisés et les implants chirurgicaux.'],
  [74, 3422, 5555, 19.25, 162, 218, 770.0, 78.8, [2, 4, 6], 'Cubique centré', 1783, 'Juan José & Fausto Elhuyar', 'Possède le point de fusion le plus élevé de tous les métaux (3 422 °C) ; filaments, électrodes TIG et carbure de tungstène WC.'],
  [75, 3186, 5596, 21.02, 151, 216, 760.0, 5.8, [4, 6, 7], 'Hexagonal compact', 1925, 'Noddack, Tacke & Berg', 'L’un des métaux les plus denses et les plus rares, vital pour les aubes de turbines d’avions en superalliages.'],
  [76, 3033, 5012, 22.59, 144, 216, 840.0, 104.0, [4, 8], 'Hexagonal compact', 1803, 'Smithson Tennant', 'Élément naturel le plus dense connu (22,59 g/cm³), métal bleu-gris dur de la famille du platine.'],
  [77, 2446, 4428, 22.56, 141, 213, 880.0, 150.9, [3, 4], 'Cubique faces centrées', 1803, 'Smithson Tennant', 'Métal le plus résistant à la corrosion (même face à l’eau régale) ; marqueur géologique de l’astéroïde de la limite K-Pg.'],
  [78, 1768.3, 3825, 21.45, 136, 175, 870.0, 205.0, [2, 4], 'Cubique faces centrées', 1735, 'Antonio de Ulloa', 'Métal noble catalytique par excellence (piles à combustible, pots catalytiques, électrodes inertes, cisplatine anticancéreux).'],
  [79, 1064.18, 2856, 19.30, 136, 166, 890.1, 222.7, [1, 3], 'Cubique faces centrées', null, 'Antiquité', 'Métal précieux jaune inoxydable et extrêmement malléable ; ne se dissout que dans l’eau régale (HNO₃ + 3 HCl).'],
  [80, -38.83, 356.73, 13.534, 132, 155, 1007.1, 0, [1, 2], 'Rhomboédrique', null, 'Antiquité', 'Seul métal liquide à température ambiante (effets relativistes sur l’orbitale 6s) ; forme des amalgames et est neurotoxique.'],
  [81, 304, 1473, 11.85, 145, 196, 589.4, 30.9, [1, 3], 'Hexagonal compact', 1861, 'William Crookes', 'Métal mou et très toxique nommé d’après sa raie spectrale verte caractéristique ; utilisé en optoélectronique infrarouge.'],
  [82, 327.46, 1749, 11.34, 146, 202, 715.6, 34.4, [2, 4], 'Cubique faces centrées', null, 'Antiquité', 'Métal dense et malléable arrêtant efficacement les rayons X/γ ; base des batteries au plomb (Pb/PbO₂) et du précipité jaune vif PbI₂.'],
  [83, 271.4, 1564, 9.78, 148, 207, 703.0, 91.0, [3, 5], 'Rhomboédrique', null, 'Antiquité', 'Métal lourd très faiblement toxique, fortement diamagnétique, formant des cristaux irisés en trémie et des alliages fusibles.'],
  [84, 254, 962, 9.196, 140, 197, 812.1, 136.0, [-2, 2, 4], 'Cubique simple', 1898, 'Marie et Pierre Curie', 'Élément intensément radioactif (émetteur α) découvert dans la pechblende ; nommé en hommage à la Pologne.'],
  [85, 302, 337, 7.0, 150, 202, 899.0, 233.0, [-1, 1], 'Cubique faces centrées', 1940, 'Corson, MacKenzie & Segrè', 'Halogène radioactif le plus rare de la croûte terrestre naturelle ; étudié en radiothérapie alpha ciblée.'],
  [86, -71, -61.7, 0.00973, 150, 220, 1037.0, 0, [0, 2], 'Cubique faces centrées', 1900, 'Friedrich Ernst Dorn', 'Gaz noble radioactif issu de la désintégration naturelle du radium dans les sous-sols granitiques.'],
  [87, 27, 677, 1.87, 260, 348, 380.0, 46.9, [1], 'Cubique centré', 1939, 'Marguerite Perey', 'Métal alcalin hautement radioactif à très courte demi-vie (22 min), dernier élément découvert dans la nature.'],
  [88, 700, 1737, 5.5, 221, 283, 509.3, 9.6, [2], 'Cubique centré', 1898, 'Marie et Pierre Curie', 'Alcalino-terreux radioactif radioluminescent isolé de la pechblende, à l’origine des études pionnières sur la radioactivité.'],
  [89, 1050, 3198, 10.07, 215, 247, 499.0, 33.8, [3], 'Cubique faces centrées', 1899, 'André-Louis Debierne', 'Chef de file de la série des actinides ; métal argenté radioactif brillant faiblement en bleu dans l’obscurité.'],
  [90, 1750, 4788, 11.72, 206, 245, 587.0, 58.6, [4], 'Cubique faces centrées', 1829, 'Jöns Jacob Berzelius', 'Actinide faiblement radioactif 3 fois plus abondant que l’uranium ; étudié comme combustible nucléaire fertile.'],
  [91, 1572, 4000, 15.37, 200, 243, 568.0, 53.0, [4, 5], 'Tétragonal', 1913, 'Kasimir Fajans & Oswald Göhring', 'Actinide rare et radioactif, intermédiaire dans les chaînes de désintégration naturelles de l’uranium.'],
  [92, 1135, 4131, 19.1, 196, 241, 597.6, 30.4, [3, 4, 5, 6], 'Orthorhombique', 1789, 'Martin Heinrich Klaproth', 'Métal lourd radioactif dont l’isotope fissile ²³⁵U alimente les réacteurs nucléaires civils ; ions uranyle UO₂²⁺ fluorescents.'],
  [93, 644, 3902, 20.45, 190, 239, 604.5, 45.9, [3, 4, 5, 6], 'Orthorhombique', 1940, 'Edwin McMillan & Philip Abelson', 'Premier élément transuranien synthétisé, formé en réacteur nucléaire par capture neutronique sur l’uranium.'],
  [94, 639.4, 3228, 19.816, 187, 243, 584.7, 0, [3, 4, 5, 6], 'Monoclinique', 1940, 'Glenn T. Seaborg et coll.', 'Actinide fissile (²³⁹Pu) ; le ²³⁸Pu sert de source thermique dans les générateurs radio-isotopiques des sondes spatiales (Voyager, Perseverance).'],
  [95, 1176, 2607, 13.67, 180, 244, 578.0, 9.9, [3, 4], 'Hexagonal compact', 1944, 'Glenn T. Seaborg et coll.', 'Actinide synthétique émetteur α utilisé en quantités infimes dans les détecteurs de fumée à ionisation.'],
  [96, 1345, 3110, 13.51, 169, 245, 581.0, 27.2, [3], 'Hexagonal compact', 1944, 'Glenn T. Seaborg et coll.', 'Actinide synthétique source de particules α pour les spectromètres APXS des rovers martiens.'],
  [97, 986, 2627, 14.78, 168, 244, 601.0, 0, [3, 4], 'Hexagonal compact', 1949, 'Lawrence Berkeley National Lab', 'Actinide synthétique produit en milligrammes, utilisé comme cible pour synthétiser des éléments superlourds (tennesse).'],
  [98, 900, 1470, 15.1, 168, 245, 608.0, 0, [3], 'Hexagonal compact', 1950, 'Lawrence Berkeley National Lab', 'Puissant émetteur de neutrons (²⁵²Cf) utilisé pour le démarrage de réacteurs nucléaires et l’analyse minière.'],
  [99, 860, 996, 8.84, 165, 245, 619.0, 0, [3], 'Cubique faces centrées', 1952, 'Albert Ghiorso et coll.', 'Actinide synthétique fortement radioactif dédié uniquement à la recherche fondamentale.'],
  [100, 1527, null, null, 167, 245, 627.0, 33.9, [3], null, 1952, 'Albert Ghiorso et coll.', 'Élément le plus lourd pouvant être produit par bombardement neutronique en réacteur.'],
  [101, 827, null, null, 173, 246, 635.0, 93.9, [2, 3], null, 1955, 'Lawrence Berkeley National Lab', 'Actinide synthétique nommé en hommage à Dmitri Mendeleïev, produit atome par atome en accélérateur.'],
  [102, 827, null, null, 176, 246, 642.0, 0, [2, 3], null, 1966, 'JINR (Doubna)', 'Actinide synthétique remarquable par la stabilité de son état d’oxydation +II en solution aqueuse.'],
  [103, 1627, null, null, 161, 246, 470.0, 0, [3], null, 1961, 'Lawrence Berkeley National Lab', 'Dernier élément de la série des actinides ; sa faible énergie d’ionisation reflète l’électron externe 7p¹.'],
  [104, 2100, 5500, 23.2, 157, null, 580.0, null, [4], null, 1964, 'JINR (Doubna) & LBNL', 'Premier élément transactinide (groupe 4), homologue chimique lourd du hafnium.'],
  [105, null, null, 29.3, 149, null, 665.0, null, [5], null, 1968, 'JINR (Doubna) & LBNL', 'Élément superlourd synthétique du groupe 5, nommé d’après le centre de recherche nucléaire de Doubna.'],
  [106, null, null, 35.0, 143, null, 757.0, null, [6], null, 1974, 'Lawrence Berkeley National Lab', 'Élément superlourd du groupe 6 (homologue du tungstène), capable de former l’hexacarbonyle Sg(CO)₆.'],
  [107, null, null, 37.1, 141, null, 740.0, null, [7], null, 1981, 'GSI (Darmstadt)', 'Élément superlourd du groupe 7 nommé en hommage au physicien Niels Bohr.'],
  [108, null, null, 40.7, 134, null, 730.0, null, [8], null, 1984, 'GSI (Darmstadt)', 'Élément superlourd du groupe 8, forme un tétroxyde volatil HsO₄ analogue à OsO₄.'],
  [109, null, null, 37.4, 129, null, 800.0, null, [3], null, 1982, 'GSI (Darmstadt)', 'Élément superlourd synthétique nommé en hommage à la physicienne Lise Meitner.'],
  [110, null, null, 34.8, 128, null, 960.0, null, [2], null, 1994, 'GSI (Darmstadt)', 'Élément superlourd synthétique du groupe 10 à très brève durée de vie (millisecondes à secondes).'],
  [111, null, null, 28.7, 121, null, 1020.0, 151.0, [3], null, 1994, 'GSI (Darmstadt)', 'Homologue superlourd de l’or, nommé en hommage à Wilhelm Röntgen (découvreur des rayons X).'],
  [112, null, 84, 23.7, 122, null, 1155.0, 0, [2], null, 1996, 'GSI (Darmstadt)', 'Élément superlourd extrêmement volatil du groupe 12, fortement influencé par les effets relativistes.'],
  [113, 430, 1130, 16.0, 136, null, 704.9, 66.6, [1], null, 2004, 'RIKEN (Japon)', 'Premier élément découvert en Asie (Nihon = Japon), élément synthétique superlourd du groupe 13.'],
  [114, null, -60, 14.0, 143, null, 823.9, 0, [2], null, 1998, 'JINR (Doubna) & LLNL', 'Élément superlourd du groupe 14 présentant un comportement quasi inerte proche des gaz nobles par effets relativistes.'],
  [115, 400, 1100, 13.5, 162, null, 538.0, 35.3, [1, 3], null, 2003, 'JINR (Doubna) & LLNL', 'Élément synthétique superlourd du groupe 15 (pnictogènes) à demi-vie de quelques fractions de seconde.'],
  [116, 435, 812, 12.9, 175, null, 663.9, 74.9, [2], null, 2000, 'JINR (Doubna) & LLNL', 'Élément synthétique superlourd du groupe 16 (chalcogènes), nommé d’après le laboratoire de Livermore.'],
  [117, 450, 610, 7.2, 165, null, 742.9, 165.9, [-1, 1], null, 2010, 'JINR (Doubna) & ORNL', 'Deuxième élément le plus lourd connu (groupe 17), aux propriétés attendues plus métalliques que les halogènes légers.'],
  [118, 52, 177, 5.0, 157, null, 860.0, 5.4, [0, 2, 4], null, 2002, 'JINR (Doubna) & LLNL', 'Élément le plus lourd du tableau périodique (Z = 118) ; les effets relativistes pourraient le rendre solide et polarisable à température ambiante.'],
]

const EXTRA_BY_Z = new Map<number, ExtraTuple>(RAW_EXTRA.map((row) => [row[0], row]))

export function buildElementExtra(
  z: number,
  category: ElementCategory,
  groupNum: number | null,
  commonIonCharges: number[],
): ElementExtraData {
  const elec = computeElectronicStructure(z, groupNum, category)
  const row = EXTRA_BY_Z.get(z)

  const radioactive = z === 43 || z === 61 || z >= 84
  const synthetic = z === 43 || z === 61 || z >= 95

  return {
    block: elec.block,
    electronConfiguration: elec.electronConfiguration,
    electronShells: elec.electronShells,
    valenceElectrons: elec.valenceElectrons,
    oxidationStates: row ? row[8] : commonIonCharges,
    atomicRadiusPm: row ? row[4] : null,
    vdwRadiusPm: row ? row[5] : null,
    ionizationEnergyKjMol: row ? row[6] : null,
    electronAffinityKjMol: row ? row[7] : null,
    meltingPointC: row ? row[1] : null,
    boilingPointC: row ? row[2] : null,
    densityGPerCm3: row ? row[3] : null,
    discoveryYear: row ? row[10] : null,
    discoveredBy: row ? row[11] : null,
    radioactive,
    synthetic,
    crystalStructure: row ? row[9] : null,
    summaryFr: row ? row[12] : '',
  }
}
