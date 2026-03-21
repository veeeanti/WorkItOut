import { contextBridge, ipcRenderer } from 'electron'

// Expose mod service API similar to UnionCrax.Direct's pattern
contextBridge.exposeInMainWorld('modService', {
  // Mod operations
  getMods: () => ipcRenderer.invoke('get-mods'),
  downloadMod: (modId: string) => ipcRenderer.invoke('download-mod', modId),
  installMod: (modId: string, gameName: string) => ipcRenderer.invoke('install-mod', modId, gameName),
  
  // Config operations
  getConfig: () => ipcRenderer.invoke('get-config'),
  addGameConfig: (gameName: string, gameModsDirectory: string) => ipcRenderer.invoke('add-game-config', gameName, gameModsDirectory),
  removeGameConfig: (gameName: string) => ipcRenderer.invoke('remove-game-config', gameName),
  setDefaultDirectories: (downloadsDirectory: string) => ipcRenderer.invoke('set-default-directories', downloadsDirectory),
  
  // Page data
  getPageData: () => ipcRenderer.invoke('get-page-data'),
})

// Expose dialog API
contextBridge.exposeInMainWorld('dialog', {
  openDirectory: () => ipcRenderer.invoke('dialog:open-directory'),
  openFile: (options?: { filters?: { name: string; extensions: string[] }[] }) => ipcRenderer.invoke('dialog:open-file', options),
})

// Expose shell API
contextBridge.exposeInMainWorld('shell', {
  showItemInFolder: (path: string) => ipcRenderer.invoke('shell:show-item-in-folder', path),
  openPath: (path: string) => ipcRenderer.invoke('shell:open-path', path),
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
})

// Expose app API
contextBridge.exposeInMainWorld('app', {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  getPath: (name: string) => ipcRenderer.invoke('app:get-path', name),
})

// Expose generic IPC for any custom channels
contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, func: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => func(...args))
  },
  removeListener: (channel: string, func: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, (_event, ...args) => func(...args))
  },
})
