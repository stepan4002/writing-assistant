import type { Category, Suggestion } from './types'

const WEIGHT: Record<Category, number> = {
  correctness: 5,
  clarity: 3,
  engagement: 1,
  delivery: 1
}

/**
 * Overall writing score, 0–100. Penalizes issues per ~100 words so long clean text isn't punished
 * for a couple of nits and short text isn't flattered. Only live (undismissed, unfixed) suggestions
 * count. Empty text has no score.
 */
export function computeScore(text: string, suggestions: Suggestion[]): number | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const words = Math.max(1, trimmed.split(/\s+/).length)
  const penalty = suggestions.reduce((sum, s) => sum + (WEIGHT[s.category] ?? 1), 0)
  const per100 = (penalty / words) * 100
  return Math.max(1, Math.min(100, Math.round(100 - per100)))
}

/** Count live suggestions per category (for tab badges). */
export function countByCategory(suggestions: Suggestion[]): Record<Category, number> {
  const counts: Record<Category, number> = { correctness: 0, clarity: 0, engagement: 0, delivery: 0 }
  for (const s of suggestions) counts[s.category] += 1
  return counts
}
