import { Decoration, type DecorationSet, EditorView } from '@codemirror/view'
import { StateEffect, StateField, RangeSetBuilder } from '@codemirror/state'
import type { Category } from '../engine/types'

/** Minimal shape needed to draw an underline; kept separate from the full Suggestion. */
export interface DecoSpec {
  from: number
  to: number
  category: Category
  id: string
}

/** Replace the full set of underline decorations. */
export const setSuggestionsEffect = StateEffect.define<DecoSpec[]>()

/**
 * Holds the underline DecorationSet. On every transaction it maps existing decorations through
 * the document changes (so underlines follow edits), then rebuilds from a setSuggestions effect
 * when present. Ranges must be sorted and non-overlapping for RangeSetBuilder; we enforce both.
 */
export const suggestionField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes)
    for (const effect of tr.effects) {
      if (effect.is(setSuggestionsEffect)) {
        const docLen = tr.state.doc.length
        const specs = [...effect.value]
          .filter((s) => s.from >= 0 && s.to <= docLen && s.from < s.to)
          .sort((a, b) => a.from - b.from || a.to - b.to)
        const builder = new RangeSetBuilder<Decoration>()
        let lastTo = -1
        for (const s of specs) {
          if (s.from < lastTo) continue // drop overlaps; keep the earlier-starting one
          builder.add(
            s.from,
            s.to,
            Decoration.mark({
              class: `sq sq-${s.category}`,
              attributes: { 'data-sug': s.id }
            })
          )
          lastTo = s.to
        }
        deco = builder.finish()
      }
    }
    return deco
  },
  provide: (f) => EditorView.decorations.from(f)
})

/** Open the matching suggestion card when a squiggle is clicked. */
export function suggestionClicker(onOpen: (id: string) => void) {
  return EditorView.domEventHandlers({
    mousedown(event) {
      const target = event.target as HTMLElement | null
      const el = target?.closest('[data-sug]')
      if (el) onOpen(el.getAttribute('data-sug')!)
    }
  })
}
