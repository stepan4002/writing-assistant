import { CATEGORY_ORDER, CATEGORY_LABEL, type Category, type Suggestion } from '../engine/types'
import { countByCategory } from '../engine/score'
import { ScoreRing } from './ScoreRing'
import { SuggestionCard } from './SuggestionCard'

export type TabKey = 'all' | Category

interface SidebarProps {
  suggestions: Suggestion[]
  score: number | null
  analyzing: boolean
  hasText: boolean
  activeTab: TabKey
  activeId: string | null
  onTab: (tab: TabKey) => void
  onAccept: (s: Suggestion) => void
  onDismiss: (s: Suggestion) => void
  onFocus: (s: Suggestion) => void
}

export function Sidebar(props: SidebarProps): JSX.Element {
  const { suggestions, score, analyzing, hasText, activeTab, activeId } = props
  const counts = countByCategory(suggestions)
  const total = suggestions.length
  const visible = activeTab === 'all' ? suggestions : suggestions.filter((s) => s.category === activeTab)

  return (
    <aside className="sidebar">
      <div className="score-header">
        <ScoreRing score={score} analyzing={analyzing} />
        <div className="score-meta">
          <div className="score-label">Overall score</div>
          <div className="score-sub">
            {analyzing
              ? 'Analyzing…'
              : !hasText
                ? 'No text yet'
                : total === 0
                  ? 'No issues found'
                  : `${total} suggestion${total === 1 ? '' : 's'}`}
          </div>
        </div>
      </div>

      <div className="tabs" role="tablist">
        <button
          className={`tab${activeTab === 'all' ? ' tab--active' : ''}`}
          onClick={() => props.onTab('all')}
        >
          All <span className="tab-count">{total}</span>
        </button>
        {CATEGORY_ORDER.map((cat) => (
          <button
            key={cat}
            className={`tab${activeTab === cat ? ' tab--active' : ''}`}
            data-cat={cat}
            onClick={() => props.onTab(cat)}
            title={CATEGORY_LABEL[cat]}
          >
            <span className="tab-dot" />
            {counts[cat]}
          </button>
        ))}
      </div>

      <div className="cards">
        {visible.length === 0 ? (
          <div className="cards-empty">
            <div className="cards-empty-check">✓</div>
            <div className="cards-empty-title">
              {total === 0 ? "You're all set!" : 'Nothing in this category'}
            </div>
            <div className="cards-empty-sub">
              {total === 0
                ? 'Suggestions will appear here as you write.'
                : 'Try the “All” tab to see other suggestions.'}
            </div>
          </div>
        ) : (
          visible.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              active={activeId === s.id}
              onAccept={props.onAccept}
              onDismiss={props.onDismiss}
              onFocus={props.onFocus}
            />
          ))
        )}
      </div>
    </aside>
  )
}
