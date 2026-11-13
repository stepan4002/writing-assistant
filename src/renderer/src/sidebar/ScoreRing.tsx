interface ScoreRingProps {
  score: number | null
  analyzing: boolean
}

/** SVG progress ring showing the 0–100 score, colored by band (green/amber/red). */
export function ScoreRing({ score, analyzing }: ScoreRingProps): JSX.Element {
  const size = 54
  const stroke = 4
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = score ?? 0
  const dash = (pct / 100) * circ
  const color =
    score == null ? 'var(--wa-line)' : score >= 80 ? '#16a34a' : score >= 55 ? '#e0a411' : 'var(--cat-correctness)'

  return (
    <div className="score-ring-wrap" title="Overall score">
      <svg width={size} height={size} className={analyzing ? 'score-ring-spin' : ''}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--wa-line)" strokeWidth={stroke} />
        {score != null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <span className="score-num" style={{ color: score == null ? '#c2c9cf' : 'var(--wa-ink-strong)' }}>
        {score == null ? '—' : score}
      </span>
    </div>
  )
}
