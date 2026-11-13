import { useCallback, useEffect, useState } from 'react'
import type { Goals } from '../../shared/types'

export interface Settings {
  model: string
  baseUrl: string
  goals: Goals
}

export const DEFAULT_SETTINGS: Settings = {
  model: 'llama3.2:3b',
  baseUrl: 'http://127.0.0.1:11434',
  goals: { audience: 'general', formality: 'neutral', domain: 'general' }
}

const KEY = 'writing-assistant.settings'

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      model: parsed.model || DEFAULT_SETTINGS.model,
      baseUrl: parsed.baseUrl || DEFAULT_SETTINGS.baseUrl,
      goals: { ...DEFAULT_SETTINGS.goals, ...(parsed.goals ?? {}) }
    }
  } catch {
    // Corrupt settings must never break startup — fall back to defaults.
    return DEFAULT_SETTINGS
  }
}

export function useSettings(): {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  setGoals: (patch: Partial<Goals>) => void
} {
  const [settings, setSettings] = useState<Settings>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      /* ignore quota/serialization errors */
    }
  }, [settings])

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const setGoals = useCallback((patch: Partial<Goals>) => {
    setSettings((prev) => ({ ...prev, goals: { ...prev.goals, ...patch } }))
  }, [])

  return { settings, update, setGoals }
}
