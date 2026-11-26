import { useCallback, useEffect, useState } from 'react'
import type {
  LewisAtom,
  LewisBond,
  MatchLewisResponse,
} from '../../../shared/chemistry.ts'
import { api } from '@/lib/api'

interface UseLewisRecognitionParams {
  atoms: LewisAtom[]
  bonds: LewisBond[]
}

export function useLewisRecognition({
  atoms,
  bonds,
}: UseLewisRecognitionParams) {
  const [matchResult, setMatchResult] = useState<MatchLewisResponse | null>(null)
  const [matching, setMatching] = useState(false)

  useEffect(() => {
    if (atoms.length === 0) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setMatching(true)
      api
        .matchLewis({ atoms, bonds })
        .then((res) => {
          if (cancelled) return
          setMatchResult(res)
          setMatching(false)
        })
        .catch(() => {
          if (cancelled) return
          setMatching(false)
        })
    }, 140)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [atoms, bonds])

  const clearRecognition = useCallback(() => {
    setMatchResult(null)
  }, [])

  return {
    activeMatch: atoms.length === 0 ? null : matchResult,
    matching,
    clearRecognition,
  }
}
