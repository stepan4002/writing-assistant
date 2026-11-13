import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { suggestionField, setSuggestionsEffect, suggestionClicker, type DecoSpec } from './suggestionField'
import './decorations.css'

export interface EditorHandle {
  getText(): string
  setSuggestions(specs: DecoSpec[]): void
  /** Replace [from,to) with insert (an accepted suggestion). */
  applyAccept(from: number, to: number, insert: string): void
  /** Select + scroll a range into view (clicking a card). */
  focusRange(from: number, to: number): void
}

interface EditorProps {
  initialDoc?: string
  placeholderText?: string
  onChange: (text: string) => void
  onOpenSuggestion: (id: string) => void
}

const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  // Keep latest callbacks without re-creating the editor.
  const onChangeRef = useRef(props.onChange)
  const onOpenRef = useRef(props.onOpenSuggestion)
  onChangeRef.current = props.onChange
  onOpenRef.current = props.onOpenSuggestion

  useEffect(() => {
    if (!hostRef.current) return
    const state = EditorState.create({
      doc: props.initialDoc ?? '',
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.lineWrapping,
        placeholder(props.placeholderText ?? 'Start writing…'),
        suggestionField,
        suggestionClicker((id) => onOpenRef.current(id)),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString())
        })
      ]
    })
    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    onChangeRef.current(view.state.doc.toString())
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      getText: () => viewRef.current?.state.doc.toString() ?? '',
      setSuggestions: (specs) => {
        viewRef.current?.dispatch({ effects: setSuggestionsEffect.of(specs) })
      },
      applyAccept: (from, to, insert) => {
        const view = viewRef.current
        if (!view) return
        const len = view.state.doc.length
        if (from < 0 || to > len || from > to) return
        view.dispatch({ changes: { from, to, insert } })
        view.focus()
      },
      focusRange: (from, to) => {
        const view = viewRef.current
        if (!view) return
        const len = view.state.doc.length
        if (from < 0 || to > len) return
        view.dispatch({ selection: { anchor: from, head: to }, scrollIntoView: true })
        view.focus()
      }
    }),
    []
  )

  return <div className="cm-host" ref={hostRef} />
})

export default Editor
