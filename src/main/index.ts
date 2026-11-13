import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import {
  getStatus,
  startOllama,
  suggest,
  pullModel,
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  type Goals
} from './ollama'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 860,
    minHeight: 560,
    show: false,
    title: 'Writing Assistant',
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Open external links in the system browser, never in-app.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // electron-vite injects ELECTRON_RENDERER_URL in dev; load the built file otherwise.
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function registerIpc(): void {
  // Abort controllers keyed by renderer-supplied request id (suggest) + a single pull controller.
  const suggestAborts = new Map<string, AbortController>()
  let pullAbort: AbortController | null = null

  ipcMain.handle('ollama:status', async (_evt, baseUrl?: string) => {
    return getStatus(baseUrl || DEFAULT_BASE_URL)
  })

  ipcMain.handle('ollama:start', async () => {
    return startOllama()
  })

  ipcMain.handle(
    'ollama:suggest',
    async (
      _evt,
      args: { text: string; goals: Goals; model?: string; baseUrl?: string; requestId: string }
    ) => {
      const { text, goals, requestId } = args
      // Cancel any prior in-flight request from this renderer before starting a new one.
      suggestAborts.get(requestId)?.abort()
      const ctrl = new AbortController()
      suggestAborts.set(requestId, ctrl)
      try {
        const suggestions = await suggest(
          text,
          goals,
          args.model || DEFAULT_MODEL,
          args.baseUrl || DEFAULT_BASE_URL,
          ctrl.signal
        )
        return { suggestions }
      } catch {
        return { suggestions: [] }
      } finally {
        if (suggestAborts.get(requestId) === ctrl) suggestAborts.delete(requestId)
      }
    }
  )

  ipcMain.handle('ollama:cancel', async (_evt, requestId: string) => {
    suggestAborts.get(requestId)?.abort()
    suggestAborts.delete(requestId)
  })

  ipcMain.handle(
    'ollama:pull',
    async (evt, args: { model?: string; baseUrl?: string }) => {
      pullAbort?.abort()
      pullAbort = new AbortController()
      const result = await pullModel(
        args.model || DEFAULT_MODEL,
        args.baseUrl || DEFAULT_BASE_URL,
        evt.sender,
        pullAbort.signal
      )
      pullAbort = null
      return result
    }
  )

  ipcMain.handle('ollama:pull-cancel', async () => {
    pullAbort?.abort()
    pullAbort = null
  })

  ipcMain.handle('app:openExternal', async (_evt, url: string) => {
    if (typeof url === 'string' && /^https?:\/\//.test(url)) await shell.openExternal(url)
  })
}
