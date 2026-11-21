import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useState,
} from 'react'
import type {
  LewisAtom,
  LewisBond,
  MatchLewisResponse,
  SpeciesRecord,
} from '../../../shared/chemistry.ts'
import { api } from '@/lib/api'

interface UseLewisRecognitionParams {
  atoms: LewisAtom[]
  bonds: LewisBond[]
  atomsRef: MutableRefObject<LewisAtom[]>
  bondsRef: MutableRefObject<LewisBond[]>
  onSpeciesDiscovered: (species: SpeciesRecord) => void
}

export function useLewisRecognition({
  atoms,
  bonds,
  atomsRef,
  bondsRef,
  onSpeciesDiscovered,
}: UseLewisRecognitionParams) {
  const [matchResult, setMatchResult] = useState<MatchLewisResponse | null>(null)
  const [matching, setMatching] = useState(false)
  const [pubchemLoading, setPubchemLoading] = useState(false)
  const [pubchemError, setPubchemError] = useState<string | null>(null)

  useEffect(() => {
    if (atoms.length === 0) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setMatching(true)
      setPubchemError(null)
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

  const handleLookupPubChem = useCallback(async () => {
    if (atomsRef.current.length === 0 || pubchemLoading) return
    setPubchemLoading(true)
    setPubchemError(null)
    try {
      const res = await api.lookupPubChem({
        atoms: atomsRef.current,
        bonds: bondsRef.current,
      })
      if (!res.found) {
        setPubchemError(res.reasonFr)
        return
      }
      setMatchResult({
        matched: true,
        exactLewisValid: res.exactLewisValid,
        species: res.species,
        expectedLewis: res.expectedLewis,
        issuesFr: res.issuesFr,
      })
      if (!res.alreadyInDb) {
        onSpeciesDiscovered(res.species)
      }
    } catch {
      setPubchemError('Impossible de joindre PubChem pour le moment.')
    } finally {
      setPubchemLoading(false)
    }
  }, [atomsRef, bondsRef, onSpeciesDiscovered, pubchemLoading])

  const clearRecognition = useCallback(() => {
    setMatchResult(null)
    setPubchemError(null)
  }, [])

  return {
    activeMatch: atoms.length === 0 ? null : matchResult,
    matching,
    pubchemLoading,
    pubchemError,
    setPubchemError,
    clearRecognition,
    handleLookupPubChem,
  }
}
