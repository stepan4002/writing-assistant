import { useEffect, useMemo, useRef, useState } from 'react'
import { lintWithHarper } from './harper'
import { resolveOllama, overlaps } from './normalize'
import { dismissKey, type Suggestion } from './types'
import type { Goals } from '../../../shared/types'

const DEBOUNCE_MS = 350

export interface OllamaParams {
  ready: boolean
  model: string
  baseUrl: string
  goals: Goals
}

/**
 * Debounced two-tier engine:
 *   1. Harper (WASM, milliseconds) → Correctness + basic clarity, shown immediately.
 *   2. Ollama (local LLM, slower) → clarity/engagement/delivery, merged in when it returns.
 *
 * Stale runs are ignored (runId guard) and the previous in-flight Ollama request is cancelled,
 * so suggestions never land on text the user has already changed.
 */
export function useEngine(
  text: string,
  dismissed: Set<string>,
  ollama: OllamaParams
): { suggestions: Suggestion[]; analyzing: boolean; error: string | null } {
  const [raw, setRaw] = useState<Suggestion[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const runIdRef = useRef(0)
  const reqIdRef = useRef<string | null>(null)

  useEffect(() => {
    const runId = ++runIdRef.current
    if (!text.trim()) {
      setRaw([])
      setAnalyzing(false)
      setError(null)
      return
    }

    const timer = setTimeout(async () => {
      // Tier 1 — Harper (deterministic, fast)
      let harper: Suggestion[] = []
      try {
        harper = await lintWithHarper(text)
      } catch (err) {
        console.error('Harper lint failed:', err)
        if (runId !== runIdRef.current) return
        setRaw([])
        setAnalyzing(false)
        setError('Grammar checking could not start. Your text is saved. Restart the app and try again.')
        return
      }
      if (runId !== runIdRef.current) return
      setError(null)
      setRaw(harper)

      // Tier 2 — Ollama (LLM) only when a local model is available
      if (!ollama.ready) {
        setAnalyzing(false)
        return
      }
      setAnalyzing(true)
      if (reqIdRef.current) window.api.ollamaCancel(reqIdRef.current).catch(() => {})
      const requestId = `req-${runId}`
      reqIdRef.current = requestId
      try {
        const { suggestions } = await window.api.ollamaSuggest({
          text,
          goals: ollama.goals,
          model: ollama.model,
          baseUrl: ollama.baseUrl,
          requestId
        })
        if (runId !== runIdRef.current) return
        const resolved = resolveOllama(suggestions, text)
        setRaw([...harper, ...resolved])
      } catch (err) {
        console.error('Ollama suggest failed:', err)
      } finally {
        if (runId === runIdRef.current) {
          setAnalyzing(false)
          reqIdRef.current = null
        }
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      if (reqIdRef.current) {
        window.api.ollamaCancel(reqIdRef.current).catch(() => {})
        reqIdRef.current = null
      }
    }
  }, [text, ollama.ready, ollama.model, ollama.baseUrl, ollama.goals])

  const suggestions = useMemo(() => {
    // 1) drop dismissed. 2) Correctness precedence: an Ollama suggestion overlapping a *surviving*
    // Harper suggestion is hidden — but a dismissed Harper one no longer shadows it.
    const live = raw.filter((s) => !dismissed.has(dismissKey(s)))
    const harperRanges = live
      .filter((s) => s.source === 'harper')
      .map((s) => ({ from: s.from, to: s.to }))
    return live.filter(
      (s) => s.source === 'harper' || !harperRanges.some((h) => overlaps(s, h))
    )
  }, [raw, dismissed])

  return { suggestions, analyzing, error }
}
