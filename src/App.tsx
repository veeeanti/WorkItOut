import React, { useEffect, useState } from 'react'
import './types/electron.ts'
import { Mod, ModManagerConfig, UserPrefs } from './types/index.ts'
import ModList from './components/ModList.tsx'
import GameConfig from './components/GameConfig.tsx'
import Settings, { applyAccentColor } from './components/Settings.tsx'
type Tab = 'mods' | 'config' | 'settings'

function App() {
  const [mods, setMods] = useState<Mod[]>([])
  const [config, setConfig] = useState<ModManagerConfig | null>(null)
  const [userPrefs, setUserPrefs] = useState<UserPrefs>({
    accentColor: '#ff9900',
    autoRefreshOnStartup: false,
    refreshIntervalMinutes: 0,
    minimizeToTray: true,
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('mods')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    setLoading(true)
    try {
      if (!window?.ipcRenderer?.invoke) {
        showMessage('error', 'IPC bridge not available')
        return
      }
      const [modsData, configData, prefsData] = await Promise.all([
        window.ipcRenderer.invoke('get-mods'),
        window.ipcRenderer.invoke('get-config'),
        window.ipcRenderer.invoke('get-user-prefs'),
      ])
      setMods(modsData as Mod[])
      setConfig(configData as ModManagerConfig)
      const prefs = prefsData as UserPrefs
      setUserPrefs(prefs)
      applyAccentColor(prefs.accentColor)
    } catch (error) {
      console.error('Error loading initial data:', error)
      showMessage('error', 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setLoading(true)
    try {
      if (!window?.ipcRenderer?.invoke) {
        showMessage('error', 'IPC bridge not available')
        return
      }
      const modsData = await window.ipcRenderer.invoke('get-mods')
      setMods(modsData as Mod[])
      showMessage('success', 'Mods list refreshed')
    } catch (error) {
      console.error('Error refreshing mods:', error)
      showMessage('error', 'Failed to refresh mods list')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (modId: string, modName: string) => {
    try {
      if (!window?.ipcRenderer?.invoke) {
        showMessage('error', 'IPC bridge not available')
        return
      }
      await window.ipcRenderer.invoke('download-mod', modId)
      showMessage('success', `Downloaded ${modName}`)
    } catch (error) {
      console.error('Error downloading mod:', error)
      showMessage('error', `Failed to download ${modName}`)
    }
  }

  const handleInstall = async (modId: string, gameName: string) => {
    try {
      if (!window?.ipcRenderer?.invoke) {
        showMessage('error', 'IPC bridge not available')
        return
      }
      await window.ipcRenderer.invoke('install-mod', modId, gameName)
      showMessage('success', `Installed mod to ${gameName}`)
    } catch (error) {
      console.error('Error installing mod:', error)
      showMessage('error', 'Failed to install mod')
    }
  }

  const handleUpdatePrefs = async (newPrefs: UserPrefs) => {
    if (!window?.ipcRenderer?.invoke) {
      showMessage('error', 'IPC bridge not available')
      return
    }
    await window.ipcRenderer.invoke('set-user-prefs', newPrefs)
    setUserPrefs(newPrefs)
    applyAccentColor(newPrefs.accentColor)
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>WorkItOut!</h1>
        <p>Mod manager for vee-anti.xyz/workshop</p>
      </header>

      <nav className="app-nav">
        <button
          className={`nav-btn ${activeTab === 'mods' ? 'active' : ''}`}
          onClick={() => setActiveTab('mods')}
        >
          Mods
        </button>
        <button
          className={`nav-btn ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          Game Config
        </button>
        <button
          className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </nav>

      {message && (
        <div className={`message message-${message.type}`}>
          {message.text}
        </div>
      )}

      <main className="app-content">
        {loading ? (
          <div className="loading">
            <div className="loading-spinner" />
            Loading...
          </div>
        ) : activeTab === 'mods' ? (
          <>
            <button className="refresh-btn" onClick={handleRefresh}>
              ↻ Refresh Mods List
            </button>
            <ModList
              mods={mods}
              config={config}
              onDownload={handleDownload}
              onInstall={handleInstall}
            />
          </>
        ) : activeTab === 'config' ? (
          <GameConfig config={config} onUpdate={loadInitialData} />
        ) : (
          <Settings
            prefs={userPrefs}
            onUpdate={handleUpdatePrefs}
            onMessage={showMessage}
          />
        )}
      </main>
    </div>
  )
}

export default App

