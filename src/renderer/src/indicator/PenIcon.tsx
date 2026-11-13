interface PenIconProps {
  size?: number
  /** Color of the nib slit; use the background the icon sits on. */
  cutColor?: string
}

/** Writing Assistant logo mark: a fountain-pen nib. Inherits its fill from `color`. */
export function PenIcon({ size = 18, cutColor = 'var(--wa-accent)' }: PenIconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5 18.5 10 12 21.5 5.5 10Z" fill="currentColor" />
      <path d="M12 21.5V12.6" stroke={cutColor} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="11" r="1.7" fill={cutColor} />
    </svg>
  )
}
