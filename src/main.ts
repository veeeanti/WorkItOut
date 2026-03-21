import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { ModService } from './services/modService.ts'

// Logging setup similar to UnionCrax.Direct
const isDev = !app.isPackaged
const appLogsPath = join(app.getPath('userData'), 'app-logs.txt')
const userPrefsPath = join(app.getPath('userData'), 'user-prefs.json')

const DEFAULT_PREFS = {
  accentColor: '#ff9900',
  autoRefreshOnStartup: false,
  refreshIntervalMinutes: 0,
  minimizeToTray: true,
}

function getAppVersion() {
  return app.getVersion()
}

function ucLog(message: string, level: 'info' | 'warn' | 'error' = 'info', data: unknown = null) {
  const timestamp = new Date().toISOString()
  const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : ''
  const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}\n`
  try {
    fs.appendFileSync(appLogsPath, logLine)
  } catch (err) {
    console.error('[WorkItOut] Failed to write log:', err)
  }
  const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  consoleMethod(`[WorkItOut] [${level.toUpperCase()}]`, message, data || '')
}

function clearLogs() {
  try {
    fs.writeFileSync(appLogsPath, `[${new Date().toISOString()}] [INFO ] === App Log Started (pid ${process.pid}) ===\n`)
    ucLog('Logs cleared')
  } catch (err) {
    console.error('[WorkItOut] Failed to clear logs:', err)
  }
}

// Initialize logging
clearLogs()
ucLog('WorkItOut! starting...', 'info')
ucLog(`Version: ${getAppVersion()}`, 'info')
ucLog(`Platform: ${process.platform} ${process.arch}`, 'info')
ucLog(`Electron: ${process.versions.electron}`, 'info')
ucLog(`Node: ${process.versions.node}`, 'info')

// Process error handlers
process.on('uncaughtException', (err) => ucLog('Uncaught exception', 'error', err))
process.on('unhandledRejection', (reason) => ucLog('Unhandled rejection', 'error', reason))

// Set app user model ID for Windows
if (process.platform === 'win32') {
  try {
    app.setAppUserModelId('com.workitout.app')
  } catch { }
}

// Track quitting state
let isQuitting = false

// Single instance lock similar to UnionCrax.Direct
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, argv) => {
    // Focus the main window if a second instance is launched
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

let mainWindow: BrowserWindow
const modService = new ModService()

function createWindow() {
  ucLog('Creating main window')

  const preloadCandidates = [
    join(__dirname, '../preload/preload.js'),
    join(__dirname, 'preload.js'),
    join(app.getAppPath(), 'dist-electron/preload/preload.js'),
  ]
  const preloadPath = preloadCandidates.find((p) => fs.existsSync(p)) || preloadCandidates[0]
  ucLog('Resolved preload path', 'info', { preloadPath })
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#121212',
    title: 'WorkItOut!',
    show: false,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  })

  // Show window when ready to prevent flashing
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    ucLog('Window shown')
  })

  // Handle window close - hide to tray or quit based on user prefs
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      let minimizeToTray = true
      try {
        const raw = fs.readFileSync(userPrefsPath, 'utf-8')
        const prefs = JSON.parse(raw)
        minimizeToTray = prefs.minimizeToTray !== false
      } catch { /* use default */ }

      if (minimizeToTray) {
        event.preventDefault()
        mainWindow.hide()
      }
    }
  })

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url) return
    if (url.startsWith('http://') || url.startsWith('https://')) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  // Load the app
  if (isDev) {
    const injectedDevUrl = typeof globalThis !== 'undefined' && 'VITE_DEV_SERVER_URL' in globalThis
      ? (globalThis as { VITE_DEV_SERVER_URL?: string }).VITE_DEV_SERVER_URL
      : undefined
    const devUrl = injectedDevUrl || process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    ucLog('Loading renderer (dev)', 'info', { devUrl })
    mainWindow.loadURL(devUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    const appPath = app.getAppPath()
    const candidatePaths = [
      join(appPath, 'dist-react/index.html'),
      join(appPath, 'dist-electron/../dist-react/index.html'),
      join(__dirname, '../dist-react/index.html'),
      join(__dirname, '../../dist-react/index.html'),
    ]
    const rendererPath = candidatePaths.find((p) => fs.existsSync(p)) || candidatePaths[0]
    ucLog('Loading renderer (prod)', 'info', { appPath, rendererPath })
    mainWindow.loadFile(rendererPath)
  }

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    ucLog('Renderer failed to load', 'error', { errorCode, errorDescription, validatedURL })
  })

  ucLog('Window created successfully')
}

app.on('ready', () => {
  createWindow()
  ucLog('App ready')
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  } else if (mainWindow) {
    mainWindow.show()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  ucLog('App before-quit')
})

// IPC Handlers for mods
ipcMain.handle('get-mods', async () => {
  ucLog('IPC: get-mods')
  return await modService.fetchMods()
})

ipcMain.handle('download-mod', async (event, modId: string) => {
  ucLog('IPC: download-mod', 'info', { modId })
  return await modService.downloadMod(modId)
})

ipcMain.handle('install-mod', async (event, modId: string, gameName: string) => {
  ucLog('IPC: install-mod', 'info', { modId, gameName })
  return await modService.installMod(modId, gameName)
})

ipcMain.handle('get-config', async () => {
  return await modService.loadConfig()
})

ipcMain.handle('get-page-data', async () => {
  return await modService.scrapePage()
})

ipcMain.handle('add-game-config', async (event, gameName: string, gameModsDirectory: string) => {
  return await modService.addGameConfig(gameName, gameModsDirectory)
})

ipcMain.handle('remove-game-config', async (event, gameName: string) => {
  return await modService.removeGameConfig(gameName)
})

ipcMain.handle(
  'set-default-directories',
  async (event, downloadsDirectory: string) => {
    return await modService.updateDefaultDirectories(downloadsDirectory)
  },
)

// Dialog handlers
ipcMain.handle('dialog:open-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
  })
  if (result.canceled || !result.filePaths?.length) {
    return null
  }
  return result.filePaths[0]
})

ipcMain.handle('dialog:open-file', async (_event, options: { filters?: { name: string; extensions: string[] }[] }) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: options?.filters,
  })
  if (result.canceled || !result.filePaths?.length) {
    return null
  }
  return result.filePaths[0]
})

// Shell handlers
ipcMain.handle('shell:show-item-in-folder', async (_event, path: string) => {
  shell.showItemInFolder(path)
})

ipcMain.handle('shell:open-path', async (_event, path: string) => {
  await shell.openPath(path)
})

ipcMain.handle('shell:open-external', async (_event, url: string) => {
  await shell.openExternal(url)
})

// App info handlers
ipcMain.handle('app:get-version', () => {
  return getAppVersion()
})

ipcMain.handle('app:get-path', (_event, name: string) => {
  return app.getPath(name as Parameters<typeof app.getPath>[0])
})

// User preferences handlers
ipcMain.handle('get-user-prefs', () => {
  try {
    const data = fs.readFileSync(userPrefsPath, 'utf-8')
    return { ...DEFAULT_PREFS, ...JSON.parse(data) }
  } catch {
    return DEFAULT_PREFS
  }
})

ipcMain.handle('set-user-prefs', (_event, prefs: object) => {
  fs.writeFileSync(userPrefsPath, JSON.stringify(prefs, null, 2))
  return true
})

ipcMain.handle('open-logs-folder', () => {
  shell.showItemInFolder(appLogsPath)
})

ucLog('Main process initialized')
