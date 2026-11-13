import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { WebContents } from 'electron'
import type { OllamaStatus, Goals, RawSuggestion } from '../shared/types'

export type { OllamaStatus, Goals, RawSuggestion } from '../shared/types'

export const DEFAULT_BASE_URL = 'http://127.0.0.1:11434'
export const DEFAULT_MODEL = 'llama3.2:3b'

const VALID_CATEGORIES = new Set(['clarity', 'engagement', 'delivery'])

function ollamaExePath(): string | null {
  const local = process.env['LOCALAPPDATA']
  if (local) {
    const p = join(local, 'Programs', 'Ollama', 'ollama.exe')
    if (existsSync(p)) return p
  }
  return null
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** Detect whether Ollama is running, installed-but-stopped, or absent — and which local models exist. */
export async function getStatus(baseUrl: string = DEFAULT_BASE_URL): Promise<OllamaStatus> {
  try {
    const res = await fetchWithTimeout(`${baseUrl}/api/tags`, {}, 1500)
    if (res.ok) {
      const data = (await res.json()) as { models?: Array<{ name: string }> }
      // Privacy: never surface cloud model tags — only local weights keep text on-device.
      const models = (data.models ?? [])
        .map((m) => m.name)
        .filter((n) => n && !n.endsWith('-cloud'))
      return { state: models.length > 0 ? 'running' : 'no-model', models, baseUrl }
    }
  } catch {
    // fall through to disk check
  }
  return { state: ollamaExePath() ? 'installed-stopped' : 'not-installed', models: [], baseUrl }
}

/** Launch `ollama serve` when it's installed but not running. */
export function startOllama(): boolean {
  const exe = ollamaExePath()
  if (!exe) return false
  try {
    const child = spawn(exe, ['serve'], { detached: true, stdio: 'ignore' })
    child.unref()
    return true
  } catch {
    return false
  }
}

function buildSystemPrompt(goals: Goals): string {
  return [
    'You are a writing assistant. You improve prose but DO NOT correct spelling,',
    'grammar, or punctuation — a separate engine handles those. Only return suggestions in these',
    'three categories:',
    '- "clarity": make wordy, convoluted, or unclear sentences more concise and readable.',
    '- "engagement": replace bland, vague, or repetitive word choices with more vivid, precise ones.',
    '- "delivery": adjust tone, politeness, and formality to fit the reader.',
    `Target audience: ${goals.audience}. Desired formality: ${goals.formality}. Domain: ${goals.domain}.`,
    'For each suggestion, "original" MUST be an exact substring copied verbatim from the user text,',
    '"replacement" is the improved wording, "explanation" is one short sentence, and "offset" is the',
    'character index where "original" begins. Only suggest genuine improvements; return an empty list',
    'if the text is already good. Never invent text that is not present.'
  ].join(' ')
}

const SUGGESTION_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['clarity', 'engagement', 'delivery'] },
          original: { type: 'string' },
          replacement: { type: 'string' },
          explanation: { type: 'string' },
          offset: { type: 'integer' }
        },
        required: ['category', 'original', 'replacement', 'explanation', 'offset']
      }
    }
  },
  required: ['suggestions']
} as const

/** Split long text into paragraph-aligned windows with overlap, tracking each window's base offset. */
function chunkText(text: string, maxChars = 12000, overlap = 1000): Array<{ text: string; base: number }> {
  if (text.length <= maxChars) return [{ text, base: 0 }]
  const chunks: Array<{ text: string; base: number }> = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length)
    if (end < text.length) {
      const nl = text.lastIndexOf('\n\n', end)
      if (nl > start + maxChars * 0.5) end = nl
    }
    chunks.push({ text: text.slice(start, end), base: start })
    if (end >= text.length) break
    start = Math.max(end - overlap, start + 1)
  }
  return chunks
}

async function chatOnce(
  chunk: string,
  goals: Goals,
  model: string,
  baseUrl: string,
  signal: AbortSignal
): Promise<RawSuggestion[]> {
  const body = {
    model,
    stream: false,
    format: SUGGESTION_SCHEMA,
    options: { temperature: 0.2 },
    messages: [
      { role: 'system', content: buildSystemPrompt(goals) },
      { role: 'user', content: chunk }
    ]
  }
  let res: Response
  try {
    res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    })
  } catch {
    return [] // network/abort — skip this cycle, Harper still covers the doc
  }
  if (!res.ok) return []

  let content: string
  try {
    const data = (await res.json()) as { message?: { content?: string } }
    content = data.message?.content ?? ''
  } catch {
    return []
  }

  try {
    const parsed = JSON.parse(content) as { suggestions?: RawSuggestion[] }
    const list = Array.isArray(parsed.suggestions) ? parsed.suggestions : []
    return list.filter(
      (s) =>
        s &&
        VALID_CATEGORIES.has(s.category) &&
        typeof s.original === 'string' &&
        s.original.length > 0 &&
        typeof s.replacement === 'string' &&
        typeof s.offset === 'number'
    )
  } catch {
    return [] // malformed JSON despite schema — skip
  }
}

/** Get clarity/engagement/delivery suggestions for the whole document (chunked, cancellable). */
export async function suggest(
  text: string,
  goals: Goals,
  model: string,
  baseUrl: string,
  signal: AbortSignal
): Promise<RawSuggestion[]> {
  if (!text.trim()) return []
  const out: RawSuggestion[] = []
  for (const { text: chunk, base } of chunkText(text)) {
    if (signal.aborted) break
    const res = await chatOnce(chunk, goals, model, baseUrl, signal)
    for (const s of res) out.push({ ...s, offset: s.offset + base })
  }
  return out
}

/** Stream a model pull, forwarding NDJSON progress to the renderer. */
export async function pullModel(
  model: string,
  baseUrl: string,
  wc: WebContents,
  signal: AbortSignal
): Promise<{ ok: boolean; error?: string }> {
  let res: Response
  try {
    res = await fetch(`${baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: true }),
      signal
    })
  } catch (err) {
    return { ok: false, error: String(err) }
  }
  if (!res.ok || !res.body) return { ok: false, error: `HTTP ${res.status}` }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const evt = JSON.parse(line) as {
            status?: string
            total?: number
            completed?: number
            error?: string
          }
          if (evt.error) return { ok: false, error: evt.error }
          wc.send('ollama:pull-progress', {
            status: evt.status ?? '',
            total: evt.total ?? 0,
            completed: evt.completed ?? 0
          })
        } catch {
          // ignore partial/non-JSON line
        }
      }
    }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
  return { ok: true }
}
