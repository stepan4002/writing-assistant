import { describe, expect, it } from 'vitest'
import { computeScore, countByCategory } from '../src/renderer/src/engine/score'
import { overlaps, resolveOllama, type RawOllamaSuggestion } from '../src/renderer/src/engine/normalize'
import { dismissKey, type Suggestion } from '../src/renderer/src/engine/types'

function sug(category: Suggestion['category'], from = 0, to = 1): Suggestion {
  return { id: `${category}:${from}`, category, from, to, title: '', message: '', original: 'x', replacements: [], source: 'harper' }
}

describe('computeScore', () => {
  it('has no score for empty text', () => {
    expect(computeScore('   ', [])).toBeNull()
  })

  it('is 100 for clean text', () => {
    expect(computeScore('All good here.', [])).toBe(100)
  })

  it('penalizes per 100 words, weighting correctness highest', () => {
    const tenWords = 'one two three four five six seven eight nine ten'
    expect(computeScore(tenWords, [sug('correctness')])).toBe(50) // 5 / 10 words * 100
    expect(computeScore(tenWords, [sug('engagement')])).toBe(90) // 1 / 10 words * 100
  })

  it('never drops below 1', () => {
    const many = Array.from({ length: 50 }, (_, i) => sug('correctness', i, i + 1))
    expect(computeScore('two words', many)).toBe(1)
  })
})

describe('countByCategory', () => {
  it('counts each category', () => {
    expect(countByCategory([sug('correctness'), sug('correctness'), sug('delivery')])).toEqual({
      correctness: 2,
      clarity: 0,
      engagement: 0,
      delivery: 1
    })
  })
})

describe('dismissKey', () => {
  it('ignores case and surrounding whitespace so a dismissal survives re-lints', () => {
    const a = dismissKey({ category: 'correctness', original: ' Speling ', replacements: ['spelling'] })
    const b = dismissKey({ category: 'correctness', original: 'speling', replacements: [' Spelling'] })
    expect(a).toBe(b)
  })
})

describe('resolveOllama', () => {
  const text = 'We will utilize the tool. We will utilize it again.'
  const raw = (over: Partial<RawOllamaSuggestion>): RawOllamaSuggestion => ({
    category: 'clarity',
    original: 'utilize',
    replacement: 'use',
    explanation: 'Simpler word.',
    offset: 0,
    ...over
  })

  it('anchors on the occurrence near the claimed offset, even if the offset is a bit off', () => {
    const long = 'We will utilize the tool. ' + 'Filler sentence here. '.repeat(5) + 'Then we utilize it again.'
    const second = long.lastIndexOf('utilize')
    const [s] = resolveOllama([raw({ offset: second - 3 })], long)
    expect(long.slice(s.from, s.to)).toBe('utilize')
    expect(s.from).toBe(second)
  })

  it('drops suggestions whose original text is not in the document', () => {
    expect(resolveOllama([raw({ original: 'leverage' })], text)).toEqual([])
  })

  it('drops overlapping and no-op suggestions', () => {
    const out = resolveOllama(
      [raw({ offset: 0 }), raw({ original: 'will utilize', replacement: 'use', offset: 0 }), raw({ original: 'tool', replacement: 'tool' })],
      text
    )
    expect(out).toHaveLength(1)
    expect(out[0].replacements).toEqual(['use'])
  })
})

describe('overlaps', () => {
  it('treats touching ranges as non-overlapping', () => {
    expect(overlaps({ from: 0, to: 3 }, { from: 3, to: 5 })).toBe(false)
    expect(overlaps({ from: 0, to: 4 }, { from: 3, to: 5 })).toBe(true)
  })
})
