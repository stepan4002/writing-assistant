import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Editor, { type EditorHandle } from './editor/Editor'
import { useEngine } from './engine/useEngine'
import { useOllamaStatus } from './engine/useOllamaStatus'
import { dismissKey, type Suggestion } from './engine/types'
import { computeScore } from './engine/score'
import { useSettings } from './settings'
import { Sidebar, type TabKey } from './sidebar/Sidebar'
import { FloatingIndicator } from './indicator/FloatingIndicator'
import { PenIcon } from './indicator/PenIcon'
import { OllamaBanner } from './OllamaBanner'
import { GoalsPanel } from './GoalsPanel'

const DOC_KEY = 'writing-assistant.doc'
const DISMISSED_KEY = 'writing-assistant.dismissed'

function loadDoc(): string {
  try {
    return localStorage.getItem(DOC_KEY) ?? ''
  } catch {
    return ''
  }
}

function loadDismissed(): Set<string> {
  try {
    const arr = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]') as string[]
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function App(): JSX.Element {
  const initialDoc = useRef(loadDoc())
  const [text, setText] = useState(initialDoc.current)
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [showGoals, setShowGoals] = useState(false)
  const editorRef = useRef<EditorHandle>(null)

  const { settings, update, setGoals } = useSettings()
  const { status, refresh } = useOllamaStatus(settings.baseUrl)

  // Persist the document (debounced) and dismissed set across launches.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DOC_KEY, text)
      } catch {
        /* ignore */
      }
    }, 500)
    return () => clearTimeout(t)
  }, [text])

  useEffect(() => {
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]))
    } catch {
      /* ignore */
    }
  }, [dismissed])

  const { suggestions, analyzing, error } = useEngine(text, dismissed, {
    ready: status.state === 'running',
    model: settings.model,
    baseUrl: settings.baseUrl,
    goals: settings.goals
  })

  // Push underline decorations whenever the suggestion set changes.
  useEffect(() => {
    editorRef.current?.setSuggestions(
      suggestions.map((s) => ({ from: s.from, to: s.to, category: s.category, id: s.id }))
    )
  }, [suggestions])

  // The suggestion's from/to are computed for the text at lint time. Between an edit and the
  // next debounced re-lint (~350ms), those offsets are stale while the live document has moved.
  // Re-anchor against the current editor text (verify, else search) before acting, so Accept
  // and focus never hit the wrong span.
  const resolveLiveRange = useCallback((s: Suggestion): { from: number; to: number } | null => {
    if (!s.original) return null
    const live = editorRef.current?.getText() ?? ''
    if (live.slice(s.from, s.to) === s.original) return { from: s.from, to: s.to }
    const near = live.indexOf(s.original, Math.max(0, s.from - 40))
    const at = near !== -1 ? near : live.indexOf(s.original)
    if (at === -1) return null
    return { from: at, to: at + s.original.length }
  }, [])

  const accept = useCallback(
    (s: Suggestion) => {
      if (!s.replacements.length) return
      const r = resolveLiveRange(s)
      if (r) editorRef.current?.applyAccept(r.from, r.to, s.replacements[0])
    },
    [resolveLiveRange]
  )

  const dismiss = useCallback((s: Suggestion) => {
    setDismissed((prev) => new Set(prev).add(dismissKey(s)))
  }, [])

  const focusSuggestion = useCallback(
    (s: Suggestion) => {
      setActiveId(s.id)
      const r = resolveLiveRange(s)
      if (r) editorRef.current?.focusRange(r.from, r.to)
    },
    [resolveLiveRange]
  )

  const openById = useCallback(
    (id: string) => {
      const s = suggestions.find((x) => x.id === id)
      if (s) focusSuggestion(s)
    },
    [suggestions, focusSuggestion]
  )

  const scrollSidebarTop = useCallback(() => {
    document.querySelector('.cards')?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const hasText = text.trim().length > 0
  const score = useMemo(() => computeScore(text, suggestions), [text, suggestions])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <PenIcon size={16} />
          </span>
          <span className="brand-name">Writing Assistant</span>
        </div>
        <div className="doc-title">Untitled document</div>
        <div className="topbar-right">
          <button className="goals-btn" onClick={() => setShowGoals((v) => !v)}>
            ⚙ Goals
          </button>
          <span
            className="local-badge"
            title="Everything runs locally. Your text never leaves this machine."
          >
            ● Local
          </span>
        </div>
      </header>

      {showGoals && (
        <GoalsPanel
          settings={settings}
          availableModels={status.models}
          onGoals={setGoals}
          onSettings={update}
          onClose={() => setShowGoals(false)}
        />
      )}

      <div className="workspace">
        <main className="editor-pane">
          <OllamaBanner
            state={status.state}
            model={settings.model}
            baseUrl={settings.baseUrl}
            onRefresh={refresh}
          />
          <div className="editor-col">
            {!hasText && (
              <div className="getting-started">
                <p>Paste your writing below, accept the fixes you like, then copy it back to your document.</p>
                <button
                  className="goals-btn"
                  onClick={() => {
                    const editor = editorRef.current
                    if (!editor || editor.getText().trim()) return
                    setDismissed(new Set())
                    editor.applyAccept(0, editor.getText().length, 'This is a sentnce with a speling mistake.')
                  }}
                >
                  Try an example
                </button>
              </div>
            )}
            {error && <p className="engine-error" role="alert">{error}</p>}
            <Editor
              ref={editorRef}
              initialDoc={initialDoc.current}
              placeholderText="Start writing, or paste your text here…"
              onChange={setText}
              onOpenSuggestion={openById}
            />
          </div>
        </main>

        {error ? (
          <aside className="engine-error-summary" aria-label="Grammar checker status">
            <h2>Checker unavailable</h2>
            <p>A writing score is available only after grammar checking succeeds.</p>
          </aside>
        ) : <Sidebar
          suggestions={suggestions}
          score={score}
          analyzing={analyzing}
          hasText={hasText}
          activeTab={activeTab}
          activeId={activeId}
          onTab={setActiveTab}
          onAccept={accept}
          onDismiss={dismiss}
          onFocus={focusSuggestion}
        />}
      </div>

      <FloatingIndicator issueCount={suggestions.length} analyzing={analyzing} onClick={scrollSidebarTop} />
    </div>
  )
}

export default App
