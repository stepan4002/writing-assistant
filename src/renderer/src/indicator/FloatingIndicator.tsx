import { PenIcon } from './PenIcon'

interface FloatingIndicatorProps {
  issueCount: number
  analyzing: boolean
  onClick: () => void
}

/**
 * Bottom-right status button: spinning while analyzing, pen mark when idle,
 * with a red badge showing the number of open suggestions.
 */
export function FloatingIndicator({ issueCount, analyzing, onClick }: FloatingIndicatorProps): JSX.Element {
  const state = analyzing ? 'analyzing' : issueCount > 0 ? 'issues' : 'clean'
  return (
    <button
      className={`floating-ind floating-ind--${state}`}
      onClick={onClick}
      aria-label={analyzing ? 'Analyzing' : `${issueCount} suggestions`}
      title={
        analyzing
          ? 'Analyzing…'
          : issueCount > 0
            ? `${issueCount} suggestion${issueCount === 1 ? '' : 's'}`
            : 'No issues'
      }
    >
      {analyzing ? (
        <span className="fi-spinner" />
      ) : (
        <span className="fi-icon">
          <PenIcon size={24} />
        </span>
      )}
      {!analyzing && issueCount > 0 && <span className="fi-badge">{issueCount}</span>}
    </button>
  )
}
