/** Types shared across main, preload, and renderer. No runtime imports — safe everywhere. */

export type Category = 'correctness' | 'clarity' | 'engagement' | 'delivery'

export type OllamaState =
  | 'running'
  | 'no-model'
  | 'installed-stopped'
  | 'not-installed'
  | 'unknown'

export interface OllamaStatus {
  state: OllamaState
  models: string[]
  baseUrl: string
}

export interface RawSuggestion {
  category: Exclude<Category, 'correctness'>
  original: string
  replacement: string
  explanation: string
  offset: number
}

export interface Goals {
  audience: 'general' | 'knowledgeable' | 'expert'
  formality: 'informal' | 'neutral' | 'formal'
  domain: 'general' | 'academic' | 'business' | 'email' | 'creative'
}

export interface PullProgress {
  status: string
  total: number
  completed: number
}
