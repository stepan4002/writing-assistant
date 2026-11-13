import { LocalLinter, Dialect, type Lint, type LintKind } from 'harper.js'
import { binaryInlined } from 'harper.js/binaryInlined'
import type { Category, Suggestion } from './types'

/**
 * harper.js runs a Rust grammar/spell engine compiled to WASM, entirely in-process.
 * We use LocalLinter + the *inlined* WASM binary (base64-embedded in JS): this removes any
 * WASM-asset URL resolution — no Vite asset handling, no asar-unpack, works offline and on
 * Windows where harper's file-URL loader is broken. Harper lints in milliseconds and we run it
 * on a debounce, so main-thread execution is fine. (Can move to a worker later if needed.)
 */
let linterPromise: Promise<LocalLinter> | null = null

function getLinter(): Promise<LocalLinter> {
  if (!linterPromise) {
    const linter = new LocalLinter({ binary: binaryInlined, dialect: Dialect.American })
    linterPromise = linter
      .setup()
      .then(() => linter)
      .catch((err) => {
        // Reset so a later call can retry; surface to caller as an empty lint set.
        linterPromise = null
        throw err
      })
  }
  return linterPromise
}

/**
 * Harper emits fine-grained lint kinds; map them onto our four suggestion categories.
 * Correctness = objective errors; Clarity = readability; Engagement = word choice;
 * Delivery = style/register. (Ollama also contributes clarity/engagement/delivery.)
 */
function kindToCategory(kind: LintKind | string): Category {
  switch (kind) {
    case 'Spelling':
    case 'Typo':
    case 'Grammar':
    case 'Agreement':
    case 'Capitalization':
    case 'Punctuation':
    case 'BoundaryError':
    case 'Malapropism':
    case 'Eggcorn':
      return 'correctness'
    case 'Readability':
    case 'Redundancy':
    case 'Repetition':
      return 'clarity'
    case 'WordChoice':
    case 'Enhancement':
      return 'engagement'
    case 'Style':
    case 'Usage':
    case 'Nonstandard':
    case 'Regionalism':
    case 'Formatting':
    case 'Miscellaneous':
      return 'delivery'
    default:
      return 'correctness'
  }
}

function prettyKind(lint: Lint): string {
  try {
    return lint.lint_kind_pretty()
  } catch {
    return lint.lint_kind()
  }
}

function lintToSuggestion(lint: Lint, text: string): Suggestion | null {
  const span = lint.span()
  const from = span.start
  const to = span.end
  if (from == null || to == null || from < 0 || to > text.length || from >= to) return null

  const kind = lint.lint_kind()
  const replacements = lint
    .suggestions()
    .map((s) => {
      try {
        return s.get_replacement_text()
      } catch {
        return ''
      }
    })
    .filter((r) => r.length > 0)

  const original = text.slice(from, to)
  return {
    id: `h:${from}:${to}:${kind}`,
    category: kindToCategory(kind),
    from,
    to,
    title: prettyKind(lint),
    message: lint.message(),
    original,
    replacements,
    source: 'harper'
  }
}

/** Lint plaintext (Harper defaults to markdown — we must pass plaintext for prose). */
export async function lintWithHarper(text: string): Promise<Suggestion[]> {
  if (!text.trim()) return []
  const linter = await getLinter()
  const lints = await linter.lint(text, { language: 'plaintext', dedup: true })
  const out: Suggestion[] = []
  for (const lint of lints) {
    const s = lintToSuggestion(lint, text)
    if (s) out.push(s)
  }
  return out
}
