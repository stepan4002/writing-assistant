export type Category = 'correctness' | 'clarity' | 'engagement' | 'delivery'

export const CATEGORY_ORDER: Category[] = ['correctness', 'clarity', 'engagement', 'delivery']

export const CATEGORY_LABEL: Record<Category, string> = {
  correctness: 'Correctness',
  clarity: 'Clarity',
  engagement: 'Engagement',
  delivery: 'Delivery'
}

/** A normalized suggestion from either engine, positioned by flat character offsets. */
export interface Suggestion {
  id: string
  category: Category
  from: number
  to: number
  /** Short card title, e.g. "Correct your spelling". */
  title: string
  /** One-line plain-English explanation. */
  message: string
  /** The exact text currently spanned (for before→after preview + anchor verification). */
  original: string
  /** Ordered replacement options; first is the primary. Empty = informational only. */
  replacements: string[]
  source: 'harper' | 'ollama'
}

/** Stable key for dismissals — category + normalized text, NOT raw offset, so a re-lint
 *  of the same issue elsewhere stays dismissed and doesn't resurrect on edits. */
export function dismissKey(s: Pick<Suggestion, 'category' | 'original' | 'replacements'>): string {
  const rep = s.replacements[0] ?? ''
  return `${s.category}|${s.original.trim().toLowerCase()}|${rep.trim().toLowerCase()}`
}
