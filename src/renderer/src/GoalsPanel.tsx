import type { ReactNode } from 'react'
import type { Goals } from '../../shared/types'
import type { Settings } from './settings'

interface GoalsPanelProps {
  settings: Settings
  availableModels: string[]
  onGoals: (patch: Partial<Goals>) => void
  onSettings: (patch: Partial<Settings>) => void
  onClose: () => void
}

const AUDIENCE: Goals['audience'][] = ['general', 'knowledgeable', 'expert']
const FORMALITY: Goals['formality'][] = ['informal', 'neutral', 'formal']
const DOMAIN: Goals['domain'][] = ['general', 'academic', 'business', 'email', 'creative']

/** Goals popover: tunes the Ollama prompt, plus model / server settings. */
export function GoalsPanel({
  settings,
  availableModels,
  onGoals,
  onSettings,
  onClose
}: GoalsPanelProps): JSX.Element {
  const { goals } = settings
  return (
    <>
      <div className="goals-backdrop" onClick={onClose} />
      <div className="goals-panel" role="dialog" aria-label="Set goals">
        <div className="goals-head">
          <span>Set goals</span>
          <button className="goals-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <GoalRow label="Audience">
          {AUDIENCE.map((a) => (
            <Chip key={a} active={goals.audience === a} onClick={() => onGoals({ audience: a })}>
              {a}
            </Chip>
          ))}
        </GoalRow>

        <GoalRow label="Formality">
          {FORMALITY.map((f) => (
            <Chip key={f} active={goals.formality === f} onClick={() => onGoals({ formality: f })}>
              {f}
            </Chip>
          ))}
        </GoalRow>

        <GoalRow label="Domain">
          {DOMAIN.map((d) => (
            <Chip key={d} active={goals.domain === d} onClick={() => onGoals({ domain: d })}>
              {d}
            </Chip>
          ))}
        </GoalRow>

        <div className="goals-sep" />

        <GoalRow label="AI model">
          {availableModels.length > 0 ? (
            <select
              className="goals-select"
              value={settings.model}
              onChange={(e) => onSettings({ model: e.target.value })}
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="goals-input"
              value={settings.model}
              onChange={(e) => onSettings({ model: e.target.value })}
              spellCheck={false}
            />
          )}
        </GoalRow>

        <GoalRow label="Ollama URL">
          <input
            className="goals-input"
            value={settings.baseUrl}
            onChange={(e) => onSettings({ baseUrl: e.target.value })}
            spellCheck={false}
          />
        </GoalRow>
      </div>
    </>
  )
}

function GoalRow({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="goal-row">
      <div className="goal-label">{label}</div>
      <div className="goal-opts">{children}</div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}): JSX.Element {
  return (
    <button className={`chip${active ? ' chip--active' : ''}`} onClick={onClick}>
      {children}
    </button>
  )
}
