import { CATEGORY_LABEL, type Suggestion } from '../engine/types'

interface SuggestionCardProps {
  suggestion: Suggestion
  active: boolean
  onAccept: (s: Suggestion) => void
  onDismiss: (s: Suggestion) => void
  onFocus: (s: Suggestion) => void
}

export function SuggestionCard({
  suggestion: s,
  active,
  onAccept,
  onDismiss,
  onFocus
}: SuggestionCardProps): JSX.Element {
  const hasFix = s.replacements.length > 0
  return (
    <div
      className={`card${active ? ' card--active' : ''}`}
      data-cat={s.category}
      onMouseEnter={() => onFocus(s)}
      onClick={() => onFocus(s)}
    >
      <div className="card-cat">{CATEGORY_LABEL[s.category]}</div>
      <div className="card-title">{s.title}</div>

      {hasFix && (
        <div className="card-preview">
          <span className="prev-old">{s.original}</span>
          <span className="prev-arrow">→</span>
          <span className="prev-new">{s.replacements[0]}</span>
        </div>
      )}

      {s.message && <div className="card-msg">{s.message}</div>}

      <div className="card-actions">
        {hasFix && (
          <button
            className="btn-accept"
            onClick={(e) => {
              e.stopPropagation()
              onAccept(s)
            }}
          >
            Accept
          </button>
        )}
        <button
          className="btn-dismiss"
          onClick={(e) => {
            e.stopPropagation()
            onDismiss(s)
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
