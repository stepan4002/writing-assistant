import { useCallback, useEffect, useState } from 'react'
import type { OllamaStatus } from '../../../shared/types'

const POLL_MS = 5000

/** Polls Ollama status so the UI can gate LLM suggestions and show the right banner. */
export function useOllamaStatus(baseUrl: string): {
  status: OllamaStatus
  refresh: () => void
} {
  const [status, setStatus] = useState<OllamaStatus>({
    state: 'unknown',
    models: [],
    baseUrl
  })

  const refresh = useCallback(() => {
    window.api
      .ollamaStatus(baseUrl)
      .then(setStatus)
      .catch(() => setStatus({ state: 'unknown', models: [], baseUrl }))
  }, [baseUrl])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, POLL_MS)
    return () => clearInterval(t)
  }, [refresh])

  return { status, refresh }
}
