import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  AcidBaseCoupleRecord,
  RedoxCoupleRecord,
  SolubilityProductRecord,
} from '../../../shared/chemistry.ts'
export { CURATED_REACTIONS } from './curated-reactions.ts'

export interface ReactionConstantsDataset {
  redoxCouples: RedoxCoupleRecord[]
  solubilityProducts: SolubilityProductRecord[]
  acidBaseCouples: AcidBaseCoupleRecord[]
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONSTANTS_PATH = path.resolve(__dirname, './constants.json')

export function loadReactionConstants(): ReactionConstantsDataset {
  if (!fs.existsSync(CONSTANTS_PATH)) {
    return {
      redoxCouples: [],
      solubilityProducts: [],
      acidBaseCouples: [],
    }
  }
  try {
    return JSON.parse(fs.readFileSync(CONSTANTS_PATH, 'utf8')) as ReactionConstantsDataset
  } catch {
    return {
      redoxCouples: [],
      solubilityProducts: [],
      acidBaseCouples: [],
    }
  }
}
