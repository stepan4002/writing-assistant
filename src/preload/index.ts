import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { OllamaStatus, RawSuggestion, Goals, PullProgress } from '../shared/types'

export type { Category, OllamaState, OllamaStatus, RawSuggestion, Goals, PullProgress } from '../shared/types'

const api = {
  ollamaStatus: (baseUrl?: string): Promise<OllamaStatus> =>
    ipcRenderer.invoke('ollama:status', baseUrl),
  ollamaStart: (): Promise<boolean> => ipcRenderer.invoke('ollama:start'),
  ollamaSuggest: (args: {
    text: string
    goals: Goals
    model?: string
    baseUrl?: string
    requestId: string
  }): Promise<{ suggestions: RawSuggestion[] }> => ipcRenderer.invoke('ollama:suggest', args),
  ollamaCancel: (requestId: string): Promise<void> => ipcRenderer.invoke('ollama:cancel', requestId),
  ollamaPull: (args: { model?: string; baseUrl?: string }): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('ollama:pull', args),
  ollamaPullCancel: (): Promise<void> => ipcRenderer.invoke('ollama:pull-cancel'),
  onPullProgress: (cb: (p: PullProgress) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, p: PullProgress): void => cb(p)
    ipcRenderer.on('ollama:pull-progress', listener)
    return () => ipcRenderer.removeListener('ollama:pull-progress', listener)
  },
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('app:openExternal', url)
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
