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
  generatedAt: string
  redoxCouples: RedoxCoupleRecord[]
  solubilityProducts: SolubilityProductRecord[]
  acidBaseCouples: AcidBaseCoupleRecord[]
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONSTANTS_PATH = path.resolve(__dirname, '../generated/reaction-constants.json')

export function loadReactionConstants(): ReactionConstantsDataset {
  if (!fs.existsSync(CONSTANTS_PATH)) {
    return {
      generatedAt: '',
      redoxCouples: [],
      solubilityProducts: [],
      acidBaseCouples: [],
    }
  }
  try {
    return JSON.parse(fs.readFileSync(CONSTANTS_PATH, 'utf8')) as ReactionConstantsDataset
  } catch {
    return {
      generatedAt: '',
      redoxCouples: [],
      solubilityProducts: [],
      acidBaseCouples: [],
    }
  }
}
