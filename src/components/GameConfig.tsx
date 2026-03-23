import React, { useState, useEffect, useMemo } from 'react'
import { ModManagerConfig } from '../types/index.ts'
import '../styles/GameConfig.css'

interface GameConfigProps {
  config: ModManagerConfig | null
  supportedGames: string[]
  onUpdate: () => void
}

function GameConfig({ config, supportedGames, onUpdate }: GameConfigProps) {
  const [gameName, setGameName] = useState('')
  const [gameModsDirectory, setGameModsDirectory] = useState('')
  const [defaultDownloadsDirectory, setDefaultDownloadsDirectory] = useState('')
  const [games, setGames] = useState<Record<string, string>>({})

  const availableGames = useMemo(
    () => supportedGames.filter(name => !games[name]),
    [games, supportedGames],
  )

  useEffect(() => {
    if (config) {
      const gamesList: Record<string, string> = {}
      Object.entries(config.games).forEach(([name, gameConfig]) => {
        gamesList[name] = gameConfig.modsDirectory
      })
      setGames(gamesList)
      setDefaultDownloadsDirectory(config.defaults?.downloadsDirectory || '')
    }
  }, [config])

  useEffect(() => {
    if (availableGames.length === 0) {
      setGameName('')
      return
    }

    if (!gameName || !availableGames.includes(gameName)) {
      setGameName(availableGames[0])
    }
  }, [availableGames, gameName])

  const handleAddGame = async () => {
    if (!gameName || !gameModsDirectory) {
      alert('Please select a game and enter a mods directory')
      return
    }

    try {
      if (!window?.ipcRenderer?.invoke) {
        alert('IPC bridge not available')
        return
      }
      await window.ipcRenderer.invoke('add-game-config', gameName, gameModsDirectory)
      setGames(prev => ({ ...prev, [gameName]: gameModsDirectory }))
      setGameName('')
      setGameModsDirectory('')
      onUpdate()
    } catch (error) {
      console.error('Error adding game config:', error)
      alert('Failed to add game configuration')
    }
  }

  const handleBrowseModsDir = async () => {
    try {
      const dir = await window.dialog?.openDirectory()
      if (dir) setGameModsDirectory(dir)
    } catch (err) {
      console.error('Failed to browse directory:', err)
    }
  }

  const handleBrowseDownloadsDir = async () => {
    try {
      const dir = await window.dialog?.openDirectory()
      if (dir) setDefaultDownloadsDirectory(dir)
    } catch (err) {
      console.error('Failed to browse directory:', err)
    }
  }

  const handleSaveDefaults = async () => {
    if (!defaultDownloadsDirectory) {
      alert('Please set a default downloads directory')
      return
    }

    try {
      if (!window?.ipcRenderer?.invoke) {
        alert('IPC bridge not available')
        return
      }
      await window.ipcRenderer.invoke('set-default-directories', defaultDownloadsDirectory)
      onUpdate()
    } catch (error) {
      console.error('Error saving default directories:', error)
      alert('Failed to save default directories')
    }
  }

  const handleRemoveGame = async (name: string) => {
    try {
      if (!window?.ipcRenderer?.invoke) {
        alert('IPC bridge not available')
        return
      }
      await window.ipcRenderer.invoke('remove-game-config', name)
      const newGames = { ...games }
      delete newGames[name]
      setGames(newGames)
      onUpdate()
    } catch (error) {
      console.error('Error removing game config:', error)
      alert('Failed to remove game configuration')
    }
  }

  return (
    <div className="game-config-container">
      <h2>Game Configuration</h2>
      <p>Set a default downloads directory and manage per-game mods directories.</p>

      <div className="add-game-form">
        <input
          type="text"
          placeholder="Default Downloads Directory"
          value={defaultDownloadsDirectory}
          onChange={e => setDefaultDownloadsDirectory(e.target.value)}
          className="input-field"
        />
        <button className="btn btn-secondary" onClick={handleBrowseDownloadsDir} type="button">
          Browse...
        </button>
        <button className="btn btn-primary" onClick={handleSaveDefaults}>
          Save Defaults
        </button>
      </div>

      <div className="add-game-form">
        <select
          value={gameName}
          onChange={e => setGameName(e.target.value)}
          className="input-field"
          disabled={availableGames.length === 0}
        >
          {availableGames.length === 0 ? (
            <option value="">All supported games are already configured</option>
          ) : (
            availableGames.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))
          )}
        </select>
        <input
          type="text"
          placeholder="Game Mods Directory"
          value={gameModsDirectory}
          onChange={e => setGameModsDirectory(e.target.value)}
          className="input-field"
        />
        <button className="btn btn-secondary" onClick={handleBrowseModsDir} type="button">
          Browse...
        </button>
        <button
          className="btn btn-primary"
          onClick={handleAddGame}
          disabled={availableGames.length === 0}
        >
          + Add Game
        </button>
      </div>

      <div className="games-list">
        <h3>Configured Games</h3>
        {Object.entries(games).length === 0 ? (
          <p className="empty-state">No games configured yet.</p>
        ) : (
          <table className="games-table">
            <thead>
              <tr>
                <th>Game Name</th>
                <th>Mods Directory</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(games).map(([name, path]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td className="path-cell">{path}</td>
                  <td>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleRemoveGame(name)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default GameConfig
