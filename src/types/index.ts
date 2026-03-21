export interface Mod {
  id: string
  name: string
  description: string
  author: string
  version: string
  downloadUrl: string
  imageUrl?: string
  tags?: string[]
  gameName?: string // Add game name for filtering
}

export interface GameConfig {
  [gameName: string]: {
    modsDirectory: string
  }
}

export interface ModManagerConfig {
  games: GameConfig
  defaults: {
    downloadsDirectory: string
  }
}

export interface PageData {
  mods: Mod[]
  lastUpdated: string
}

export interface UserPrefs {
  accentColor: string
  autoRefreshOnStartup: boolean
  refreshIntervalMinutes: number
  minimizeToTray: boolean
}
