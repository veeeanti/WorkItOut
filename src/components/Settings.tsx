import React, { useState, useEffect } from 'react'
import { UserPrefs } from '../types/index.ts'
import '../styles/Settings.css'

interface SettingsProps {
  prefs: UserPrefs
  onUpdate: (prefs: UserPrefs) => Promise<void>
  onMessage: (type: 'success' | 'error', text: string) => void
}

const ACCENT_PRESETS = [
  { name: 'Orange', color: '#ff9900' },
  { name: 'Blue', color: '#4f9eff' },
  { name: 'Green', color: '#22c55e' },
  { name: 'Purple', color: '#a855f7' },
  { name: 'Red', color: '#ef4444' },
  { name: 'Cyan', color: '#06b6d4' },
]

function Settings({ prefs, onUpdate, onMessage }: SettingsProps) {
  const [local, setLocal] = useState<UserPrefs>({ ...prefs })
  const [appVersion, setAppVersion] = useState<string>('...')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!window?.ipcRenderer?.invoke) return
    window.ipcRenderer.invoke('app:get-version').then(v => setAppVersion(v as string)).catch(() => {
      setAppVersion('unknown')
    })
  }, [])

  useEffect(() => {
    setLocal({ ...prefs })
  }, [prefs])

  const previewAccent = (color: string) => {
    applyAccentColor(color)
    setLocal(prev => ({ ...prev, accentColor: color }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(local)
      onMessage('success', 'Settings saved')
    } catch {
      onMessage('error', 'Failed to save settings')
      // Revert preview to saved prefs
      applyAccentColor(prefs.accentColor)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    const defaults: UserPrefs = {
      accentColor: '#ff9900',
      autoRefreshOnStartup: false,
      refreshIntervalMinutes: 0,
      minimizeToTray: true,
    }
    setLocal(defaults)
    applyAccentColor(defaults.accentColor)
  }

  const handleOpenLogs = () => {
    window.ipcRenderer?.invoke('open-logs-folder').catch(() => {})
  }

  const handleOpenUserData = async () => {
    try {
      const p = await window.ipcRenderer?.invoke('app:get-path', 'userData')
      if (p) {
        window.ipcRenderer?.invoke('shell:open-path', p as string)
      }
    } catch (err) {
      console.error('Failed to open user data:', err)
    }
  }

  return (
    <div className="settings-container">
      <h2>Settings</h2>
      <p className="settings-subtitle">Customize your WorkItOut! experience.</p>

      {/* Appearance */}
      <section className="settings-section">
        <h3 className="settings-section-title">Appearance</h3>

        <div className="settings-row">
          <div className="settings-label">
            <span>Accent Color</span>
            <small>Applies across the whole app</small>
          </div>
          <div className="accent-picker">
            <div className="accent-presets">
              {ACCENT_PRESETS.map(p => (
                <button
                  key={p.color}
                  className={`accent-swatch ${local.accentColor === p.color ? 'active' : ''}`}
                  style={{ background: p.color }}
                  title={p.name}
                  onClick={() => previewAccent(p.color)}
                />
              ))}
            </div>
            <div className="accent-custom">
              <label>Custom</label>
              <input
                type="color"
                value={local.accentColor}
                onChange={e => previewAccent(e.target.value)}
              />
              <span className="accent-hex">{local.accentColor}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Behavior */}
      <section className="settings-section">
        <h3 className="settings-section-title">Behavior</h3>

        <div className="settings-row">
          <div className="settings-label">
            <span>Auto-refresh on startup</span>
            <small>Fetch latest mods when the app launches</small>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={local.autoRefreshOnStartup}
              onChange={e => setLocal(prev => ({ ...prev, autoRefreshOnStartup: e.target.checked }))}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="settings-row">
          <div className="settings-label">
            <span>Minimize to tray on close</span>
            <small>Keep running in the system tray instead of quitting</small>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={local.minimizeToTray}
              onChange={e => setLocal(prev => ({ ...prev, minimizeToTray: e.target.checked }))}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="settings-row">
          <div className="settings-label">
            <span>Auto-refresh interval</span>
            <small>Minutes between background refreshes (0 = manual only)</small>
          </div>
          <div className="interval-picker">
            {[0, 5, 15, 30, 60].map(mins => (
              <button
                key={mins}
                className={`interval-btn ${local.refreshIntervalMinutes === mins ? 'active' : ''}`}
                onClick={() => setLocal(prev => ({ ...prev, refreshIntervalMinutes: mins }))}
              >
                {mins === 0 ? 'Off' : `${mins}m`}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Info */}
      <section className="settings-section">
        <h3 className="settings-section-title">Info &amp; Diagnostics</h3>

        <div className="settings-row">
          <div className="settings-label">
            <span>App Version</span>
          </div>
          <span className="settings-value">v{appVersion}</span>
        </div>

        <div className="settings-row">
          <div className="settings-label">
            <span>Logs &amp; Data</span>
            <small>Open app folders in Explorer</small>
          </div>
          <div className="settings-btn-group">
            <button className="btn btn-secondary" onClick={handleOpenLogs}>
              Open Logs
            </button>
            <button className="btn btn-secondary" onClick={handleOpenUserData}>
              Open User Data
            </button>
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="settings-actions">
        <button className="btn btn-secondary" onClick={handleReset}>
          Reset to Defaults
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}

function applyAccentColor(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const dr = Math.floor(r * 0.75)
  const dg = Math.floor(g * 0.75)
  const db = Math.floor(b * 0.75)
  const darker = `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`
  const root = document.documentElement
  root.style.setProperty('--accent', hex)
  root.style.setProperty('--accent-dark', darker)
  root.style.setProperty('--accent-dim', `rgba(${r}, ${g}, ${b}, 0.05)`)
  root.style.setProperty('--accent-low', `rgba(${r}, ${g}, ${b}, 0.1)`)
  root.style.setProperty('--accent-mid', `rgba(${r}, ${g}, ${b}, 0.2)`)
  root.style.setProperty('--accent-border', `rgba(${r}, ${g}, ${b}, 0.3)`)
  root.style.setProperty('--accent-bright', `rgba(${r}, ${g}, ${b}, 0.5)`)
  root.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.3)`)
}

export { applyAccentColor }
export default Settings
