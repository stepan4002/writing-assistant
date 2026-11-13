import { useEffect, useState } from 'react'
import type { OllamaState, PullProgress } from '../../shared/types'

interface OllamaBannerProps {
  state: OllamaState
  model: string
  baseUrl: string
  onRefresh: () => void
}

const OLLAMA_DOWNLOAD = 'https://ollama.com/download'

/**
 * Non-blocking banner shown when the LLM tier is unavailable. The editor keeps working on the
 * Harper tier throughout. Offers Install / Start / Download-model actions as appropriate.
 */
export function OllamaBanner({
  state,
  model,
  baseUrl,
  onRefresh
}: OllamaBannerProps): JSX.Element | null {
  const [pulling, setPulling] = useState(false)
  const [progress, setProgress] = useState<PullProgress | null>(null)
  const [pullError, setPullError] = useState<string | null>(null)

  useEffect(() => {
    if (!pulling) return
    const off = window.api.onPullProgress(setProgress)
    return off
  }, [pulling])

  if (state === 'running' || state === 'unknown') return null

  const startPull = async (): Promise<void> => {
    setPulling(true)
    setPullError(null)
    setProgress({ status: 'starting', total: 0, completed: 0 })
    const res = await window.api.ollamaPull({ model, baseUrl }).catch((err) => ({
      ok: false,
      error: String(err)
    }))
    setPulling(false)
    if (res.ok) {
      onRefresh()
    } else {
      setPullError(res.error || 'Download failed')
    }
  }

  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
      : null

  return (
    <div className="ollama-banner">
      <div className="ob-dot" />
      <div className="ob-body">
        {state === 'not-installed' && (
          <>
            <span className="ob-text">
              Ollama isn&rsquo;t installed. Spelling &amp; grammar still work — install Ollama to add
              AI clarity, word-choice, and tone suggestions.
            </span>
            <div className="ob-actions">
              <button className="ob-btn" onClick={() => window.api.openExternal(OLLAMA_DOWNLOAD)}>
                Install Ollama
              </button>
              <button className="ob-btn ob-ghost" onClick={onRefresh}>
                Recheck
              </button>
            </div>
          </>
        )}

        {state === 'installed-stopped' && (
          <>
            <span className="ob-text">Ollama is installed but not running.</span>
            <div className="ob-actions">
              <button
                className="ob-btn"
                onClick={async () => {
                  await window.api.ollamaStart()
                  setTimeout(onRefresh, 1200)
                }}
              >
                Start Ollama
              </button>
              <button className="ob-btn ob-ghost" onClick={onRefresh}>
                Recheck
              </button>
            </div>
          </>
        )}

        {state === 'no-model' && !pulling && (
          <>
            <span className="ob-text">
              {pullError ? `Download failed: ${pullError}. ` : ''}
              No AI model found. Download <code>{model}</code> (~2&nbsp;GB) to enable AI suggestions.
            </span>
            <div className="ob-actions">
              <button className="ob-btn" onClick={startPull}>
                Download model
              </button>
              <button className="ob-btn ob-ghost" onClick={onRefresh}>
                Recheck
              </button>
            </div>
          </>
        )}

        {pulling && (
          <>
            <span className="ob-text">
              Downloading <code>{model}</code>… {progress?.status}
              {pct != null ? ` — ${pct}%` : ''}
            </span>
            <div className="ob-progress">
              <div className="ob-progress-fill" style={{ width: `${pct ?? 5}%` }} />
            </div>
            <div className="ob-actions">
              <button
                className="ob-btn ob-ghost"
                onClick={() => {
                  window.api.ollamaPullCancel()
                  setPulling(false)
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
