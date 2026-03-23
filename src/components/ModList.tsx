import React, { useEffect, useState } from 'react'
import { Mod, ModManagerConfig } from '../types/index.ts'
import '../styles/ModList.css'

interface InstalledMod {
  modId: string
  modName: string
  gameName: string
  installedAt: string
}

interface ModListProps {
  mods: Mod[]
  config: ModManagerConfig | null
  onDownload: (modId: string, modName: string) => void
  onInstall: (modId: string, gameName: string) => void
}

function ModList({ mods, config, onDownload, onInstall }: ModListProps) {
  const [selectedMod, setSelectedMod] = useState<string | null>(null)
  const [selectedGame, setSelectedGame] = useState<string>('')
  const [selectedFilterGame, setSelectedFilterGame] = useState<string>('all')
  const [installedMods, setInstalledMods] = useState<InstalledMod[]>([])
  const [installing, setInstalling] = useState<string | null>(null)

  const installGames = config ? Object.keys(config.games) : []
  const filterGames = Array.from(
    new Set(mods.map(mod => mod.gameName?.trim()).filter((game): game is string => Boolean(game))),
  ).sort((left, right) => left.localeCompare(right))

  const filteredMods =
    selectedFilterGame === 'all'
      ? mods
      : mods.filter(mod => mod.gameName === selectedFilterGame)

  useEffect(() => {
    loadInstalledMods()
  }, [])

  const loadInstalledMods = async () => {
    try {
      if (window?.modService?.getInstalledMods) {
        const installed = await window.modService.getInstalledMods()
        setInstalledMods(installed)
      }
    } catch (error) {
      console.error('Error loading installed mods:', error)
    }
  }

  useEffect(() => {
    const nextVisibleMods =
      selectedFilterGame === 'all'
        ? mods
        : mods.filter(mod => mod.gameName === selectedFilterGame)

    if (nextVisibleMods.length === 0) {
      if (selectedMod !== null) {
        setSelectedMod(null)
      }
      return
    }

    if (!selectedMod || !nextVisibleMods.some(mod => mod.id === selectedMod)) {
      setSelectedMod(nextVisibleMods[0].id)
      setSelectedGame('')
    }
  }, [mods, selectedFilterGame, selectedMod])

  if (mods.length === 0) {
    return <div className="empty-state">No mods found. Try refreshing the list.</div>
  }

  const currentMod = filteredMods.find(mod => mod.id === selectedMod) || filteredMods[0] || null

  useEffect(() => {
    if (currentMod && currentMod.gameName && config?.games[currentMod.gameName]) {
      setSelectedGame(currentMod.gameName)
    }
  }, [config, currentMod])

  const isModInstalled = (modId: string): boolean => {
    return installedMods.some(m => m.modId === modId)
  }

  const handleInstall = async (modId: string) => {
    if (!window?.modService?.installMod) return
    
    setInstalling(modId)
    try {
      await window.modService.installMod(modId)
      await loadInstalledMods()
      alert(`Successfully installed mod!`)
    } catch (error) {
      console.error('Error installing mod:', error)
      alert(`Failed to install mod: ${error}`)
    } finally {
      setInstalling(null)
    }
  }

  const handleRemove = async (modId: string) => {
    if (!window?.modService?.removeInstalledMod) return
    
    const confirmed = confirm('Are you sure you want to remove this mod?')
    if (!confirmed) return

    try {
      await window.modService.removeInstalledMod(modId)
      await loadInstalledMods()
      alert('Mod removed successfully!')
    } catch (error) {
      console.error('Error removing mod:', error)
      alert(`Failed to remove mod: ${error}`)
    }
  }

  return (
    <div className="mod-list-container">
      <div className="mods-panel">
        <div className="mod-toolbar">
          <div className="filter-group">
            <label htmlFor="game-filter">Game Filter</label>
            <select
              id="game-filter"
              value={selectedFilterGame}
              onChange={event => setSelectedFilterGame(event.target.value)}
            >
              <option value="all">All games</option>
              {filterGames.map(game => (
                <option key={game} value={game}>
                  {game}
                </option>
              ))}
            </select>
          </div>

          <div className="mods-count">
            Showing {filteredMods.length} of {mods.length} mod{mods.length === 1 ? '' : 's'}
          </div>
        </div>

        {filteredMods.length === 0 ? (
          <div className="empty-state">No mods match the selected game filter.</div>
        ) : (
          <div className="mods-grid">
            {filteredMods.map(mod => (
              <div
                key={mod.id}
                className={`mod-card ${currentMod?.id === mod.id ? 'selected' : ''}`}
                onClick={() => setSelectedMod(mod.id)}
              >
                <div className="mod-image-frame">
                  {mod.imageUrl ? (
                    <img
                      src={mod.imageUrl}
                      alt={mod.name}
                      className="mod-image"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={event => {
                        event.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : null}
                  <div className="mod-image-placeholder">NO PREVIEW</div>
                </div>
                <div className="mod-card-content">
                  {mod.gameName ? <p className="mod-game">{mod.gameName}</p> : null}
                  <h3>{mod.name}</h3>
                  <p className="mod-author">by {mod.author}</p>
                  <p className="mod-version">v{mod.version}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {currentMod ? (
        <div className="mod-details">
          <div className="mod-detail-image-frame">
            {currentMod.imageUrl ? (
              <img
                src={currentMod.imageUrl}
                alt={currentMod.name}
                className="mod-detail-image"
                referrerPolicy="no-referrer"
                onError={event => {
                  event.currentTarget.style.display = 'none'
                }}
              />
            ) : null}
            <div className="mod-image-placeholder">NO PREVIEW</div>
          </div>

          <div>
            <h2>{currentMod.name}</h2>
            <p className="description">{currentMod.description}</p>
          </div>

          <div className="mod-meta">
            <span>Author: {currentMod.author}</span>
            {currentMod.gameName ? <span>Game: {currentMod.gameName}</span> : null}
            <span>Version: {currentMod.version}</span>
          </div>

          {currentMod.tags && currentMod.tags.length > 0 ? (
            <div className="mod-tags">
              {currentMod.tags.map(tag => (
                <span key={tag} className="mod-tag">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mod-actions">
            {isModInstalled(currentMod.id) ? (
              <>
                <span className="installed-badge">✓ Installed</span>
                <button
                  className="btn btn-remove"
                  onClick={() => handleRemove(currentMod.id)}
                >
                  🗑 Remove
                </button>
              </>
            ) : (
              <button
                className="btn btn-install"
                onClick={() => handleInstall(currentMod.id)}
                disabled={installing === currentMod.id}
              >
                {installing === currentMod.id ? 'Installing...' : '⬇ Download & Install'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mod-details mod-details-empty">Select a mod to see its details.</div>
      )}
    </div>
  )
}

export default ModList
