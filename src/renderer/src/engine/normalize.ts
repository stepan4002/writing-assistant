import type { Category, Suggestion } from './types'

export interface RawOllamaSuggestion {
  category: Exclude<Category, 'correctness'>
  original: string
  replacement: string
  explanation: string
  offset: number
}

const TITLE: Record<Exclude<Category, 'correctness'>, string> = {
  clarity: 'Improve clarity',
  engagement: 'Strengthen word choice',
  delivery: 'Adjust tone'
}

const ANCHOR_WINDOW = 40

/** Find the real position of `original`, trusting the text over the model's claimed offset. */
function anchor(text: string, original: string, offset: number): { from: number; to: number } | null {
  if (!original) return null
  const near = text.indexOf(original, Math.max(0, offset - ANCHOR_WINDOW))
  const at = near !== -1 ? near : text.indexOf(original)
  if (at === -1) return null
  return { from: at, to: at + original.length }
}

export function overlaps(a: { from: number; to: number }, b: { from: number; to: number }): boolean {
  return a.from < b.to && b.from < a.to
}

/**
 * Turn raw Ollama output into positioned Suggestions:
 * - resolve each range by verifying `original` in the text (drop if not found),
 * - drop anything overlapping an earlier Ollama range (no double underlines),
 * - skip no-op replacements.
 *
 * Overlap with Harper (Correctness precedence) is applied at render time in useEngine — NOT here —
 * so that dismissing a Harper suggestion lets a previously-shadowed Ollama suggestion surface.
 */
export function resolveOllama(raw: RawOllamaSuggestion[], text: string): Suggestion[] {
  const occupied: Array<{ from: number; to: number }> = []
  const out: Suggestion[] = []
  for (const r of raw) {
    const range = anchor(text, r.original, r.offset)
    if (!range) continue
    if (occupied.some((o) => overlaps(range, o))) continue
    const original = text.slice(range.from, range.to)
    if (r.replacement.trim() === original.trim()) continue
    occupied.push(range)
    out.push({
      id: `o:${range.from}:${range.to}:${r.category}`,
      category: r.category,
      from: range.from,
      to: range.to,
      title: TITLE[r.category],
      message: r.explanation,
      original,
      replacements: r.replacement ? [r.replacement] : [],
      source: 'ollama'
    })
  }
  return out
}
