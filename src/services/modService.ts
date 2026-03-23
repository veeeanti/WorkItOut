import axios from 'axios'
import * as cheerio from 'cheerio'
import * as fs from 'fs/promises'
import * as path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { Mod, ModManagerConfig, PageData } from '../types/index.ts'

const SITE_BASE = 'https://vee-anti.xyz'
const API_WORKSHOP_URL = `${SITE_BASE}/api/workshop`
const WORKSHOP_URL = `${SITE_BASE}/workshop`
const CONFIG_PATH = path.join(process.cwd(), 'config.json')
const INSTALLED_MODS_PATH = path.join(process.cwd(), 'installed-mods.json')
const DOWNLOADS_DIR = path.join(process.cwd(), 'mods-download')
const execFileAsync = promisify(execFile)

export interface InstalledMod {
  modId: string
  modName: string
  gameName: string
  installedAt: string
}

interface WorkshopApiMod {
  id: number
  workshop_id: string
  title: string
  app_id: string
  game_name: string
  author: string
  description: string
  tags: string[]
  preview_url: string
  images: string[]
  subscriptions: number
  file_size: string
  workshop_url: string
  local_download_url: string | null
  local_download_label: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export class ModService {
  private config: ModManagerConfig | null = null
  private readonly authorNameCache = new Map<string, string>()

  private looksLikeZipBuffer(buffer: Buffer): boolean {
    return buffer.length >= 4
      && buffer[0] === 0x50
      && buffer[1] === 0x4b
      && [0x03, 0x05, 0x07].includes(buffer[2])
      && [0x04, 0x06, 0x08].includes(buffer[3])
  }

  private getFilenameFromDisposition(contentDisposition?: string): string | undefined {
    if (!contentDisposition) {
      return undefined
    }

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1].trim().replace(/^"|"$/g, ''))
    }

    const plainMatch = contentDisposition.match(/filename=([^;]+)/i)
    if (plainMatch?.[1]) {
      return plainMatch[1].trim().replace(/^"|"$/g, '')
    }

    return undefined
  }

  private isZipResponse(downloadUrl: string, contentType: string | undefined, contentDisposition: string | undefined, fileBuffer: Buffer): boolean {
    const normalizedContentType = contentType?.toLowerCase() || ''
    const dispositionFilename = this.getFilenameFromDisposition(contentDisposition)?.toLowerCase() || ''

    return downloadUrl.toLowerCase().endsWith('.zip')
      || downloadUrl.toLowerCase().includes('.zip?')
      || dispositionFilename.endsWith('.zip')
      || normalizedContentType.includes('application/zip')
      || normalizedContentType.includes('application/x-zip-compressed')
      || normalizedContentType.includes('multipart/x-zip')
      || this.looksLikeZipBuffer(fileBuffer)
  }

  private normalizeConfig(config: ModManagerConfig): ModManagerConfig {
    const normalizedGames = Object.fromEntries(
      Object.entries(config.games || {}).map(([gameName, gameConfig]) => {
        const legacyConfig = gameConfig as { modsDirectory?: string; path?: string }
        const modsDirectory = legacyConfig.modsDirectory || legacyConfig.path || ''
        return [gameName, { modsDirectory }]
      }),
    )

    return {
      ...config,
      games: normalizedGames,
      defaults: {
        downloadsDirectory: config.defaults?.downloadsDirectory || DOWNLOADS_DIR,
      },
    }
  }

  private normalizeAssetUrl(url?: string | null): string | undefined {
    if (!url) return undefined

    const trimmedUrl = url.trim()
    if (!trimmedUrl) return undefined

    if (/^https?:\/\//i.test(trimmedUrl)) {
      return trimmedUrl
    }

    if (trimmedUrl.startsWith('//')) {
      return `https:${trimmedUrl}`
    }

    return `${SITE_BASE}${trimmedUrl.startsWith('/') ? '' : '/'}${trimmedUrl}`
  }

  private async resolveAuthorName(apiMod: WorkshopApiMod): Promise<string> {
    const authorId = apiMod.author?.trim()

    if (!authorId) {
      return 'Unknown'
    }

    if (/[a-z]/i.test(authorId)) {
      return authorId
    }

    const cachedAuthorName = this.authorNameCache.get(authorId)
    if (cachedAuthorName) {
      return cachedAuthorName
    }

    try {
      const response = await axios.get<string>(apiMod.workshop_url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
      })

      const $ = cheerio.load(response.data)
      const authorName = [
        $('.detailsStatRight .friendBlockContent a').first().text().trim(),
        $('.friendBlockContent a').first().text().trim(),
        $('a[href*="/myworkshopfiles"]').first().text().replace(/'s Workshop$/i, '').trim(),
      ].find(candidate => Boolean(candidate)) || authorId

      this.authorNameCache.set(authorId, authorName)
      return authorName
    } catch (error) {
      console.warn(`Failed to resolve author name for ${apiMod.workshop_id}:`, error)
      return authorId
    }
  }

  async loadConfig(): Promise<ModManagerConfig> {
    if (this.config) return this.config

    try {
      const configData = await fs.readFile(CONFIG_PATH, 'utf-8')
      this.config = this.normalizeConfig(JSON.parse(configData))
      await this.saveConfig()
    } catch {
      this.config = {
        games: {},
        defaults: {
          downloadsDirectory: DOWNLOADS_DIR,
        },
      }
      await this.saveConfig()
    }

    return this.config
  }

  async saveConfig(): Promise<void> {
    if (!this.config) return
    await fs.writeFile(CONFIG_PATH, JSON.stringify(this.config, null, 2))
  }

  private async loadInstalledMods(): Promise<InstalledMod[]> {
    try {
      const data = await fs.readFile(INSTALLED_MODS_PATH, 'utf-8')
      return JSON.parse(data)
    } catch {
      return []
    }
  }

  private async saveInstalledMods(mods: InstalledMod[]): Promise<void> {
    await fs.writeFile(INSTALLED_MODS_PATH, JSON.stringify(mods, null, 2))
  }

  async getInstalledMods(): Promise<InstalledMod[]> {
    return this.loadInstalledMods()
  }

  async isModInstalled(modId: string): Promise<boolean> {
    const installed = await this.loadInstalledMods()
    return installed.some(m => m.modId === modId)
  }

  async removeInstalledMod(modId: string): Promise<boolean> {
    const installed = await this.loadInstalledMods()
    const mod = installed.find(m => m.modId === modId)
    
    if (!mod) {
      return false
    }

    const config = await this.loadConfig()
    const gameConfig = config.games[mod.gameName]
    
    if (!gameConfig) {
      const filtered = installed.filter(m => m.modId !== modId)
      await this.saveInstalledMods(filtered)
      return true
    }

    let gameModPath = gameConfig.modsDirectory

    if (gameModPath.startsWith('~')) {
      const os = require('os')
      gameModPath = path.join(os.homedir(), gameModPath.slice(1))
    }

    gameModPath = gameModPath.replace(/%([^%]+)%/g, (_, varName) => process.env[varName] || '')

    try {
      const entries = await fs.readdir(gameModPath)
      for (const entry of entries) {
        if (entry.toLowerCase().includes(mod.modName.toLowerCase()) || 
            entry.toLowerCase().includes(modId.toLowerCase())) {
          const entryPath = path.join(gameModPath, entry)
          const stat = await fs.stat(entryPath)
          if (stat.isDirectory()) {
            await fs.rm(entryPath, { recursive: true })
          } else {
            await fs.unlink(entryPath)
          }
        }
      }
    } catch (error) {
      console.warn('Could not clean mod directory:', error)
    }

    const filtered = installed.filter(m => m.modId !== modId)
    await this.saveInstalledMods(filtered)
    return true
  }

  private mapApiModToMod(apiMod: WorkshopApiMod, authorName: string): Mod {
    return {
      id: apiMod.workshop_id,
      name: apiMod.title,
      description: apiMod.description.replace(/\r\n/g, '\n').trim(),
      author: authorName,
      version: '1.0',
      downloadUrl: apiMod.local_download_url || apiMod.workshop_url,
      imageUrl: this.normalizeAssetUrl(apiMod.preview_url || apiMod.images?.[0]),
      tags: apiMod.tags || [],
      gameName: apiMod.game_name?.trim(),
    }
  }

  async fetchMods(): Promise<Mod[]> {
    try {
      const response = await axios.get<WorkshopApiMod[] | { data: WorkshopApiMod[] }>(API_WORKSHOP_URL, {
        timeout: 15000,
      })

      const rawData = response.data
      const mods = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.data)
          ? rawData.data
          : []

      return Promise.all(
        mods.map(async mod => this.mapApiModToMod(mod, await this.resolveAuthorName(mod))),
      )
    } catch (error) {
      console.error('Error fetching mods from API:', error)
      return []
    }
  }

  async scrapePage(): Promise<PageData> {
    try {
      const response = await axios.get(WORKSHOP_URL)
      const $ = cheerio.load(response.data)

      const mods: Mod[] = []

      $('[data-mod-id]').each((i, elem) => {
        const modId = $(elem).attr('data-mod-id') || `mod-${i}`
        const name = $(elem).find('[data-mod-name]').text() || 'Unknown Mod'
        const description = $(elem).find('[data-mod-desc]').text() || ''
        const author = $(elem).find('[data-mod-author]').text() || 'Unknown'
        const version = $(elem).find('[data-mod-version]').text() || '1.0'
        const downloadUrl = $(elem).find('[data-download]').attr('href') || ''
        const imageUrl = $(elem).find('img').attr('src')

        mods.push({
          id: modId,
          name,
          description,
          author,
          version,
          downloadUrl,
          imageUrl: this.normalizeAssetUrl(imageUrl),
        })
      })

      return {
        mods,
        lastUpdated: new Date().toISOString(),
      }
    } catch (error) {
      console.error('Error scraping workshop page:', error)
      return { mods: [], lastUpdated: new Date().toISOString() }
    }
  }

  private getDownloadUrl(mod: Mod): string {
    const url = mod.downloadUrl

    if (/^https?:\/\//i.test(url)) {
      return url
    }

    if (url.startsWith('/')) {
      return `${SITE_BASE}/api/public-file?path=${encodeURIComponent(url)}`
    }

    return `${SITE_BASE}/api/public-file?path=${encodeURIComponent('/workshop/' + url)}`
  }

  async downloadMod(modId: string): Promise<string> {
    try {
      const config = await this.loadConfig()
      const downloadsDir = config.defaults.downloadsDirectory || DOWNLOADS_DIR

      const mods = await this.fetchMods()
      const mod = mods.find(m => m.id === modId)

      if (!mod) {
        throw new Error(`Mod ${modId} not found`)
      }

      const downloadUrl = this.getDownloadUrl(mod)
      console.log(`Downloading from: ${downloadUrl}`)

      await fs.mkdir(downloadsDir, { recursive: true })

      const response = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
      })

      const fileBuffer = Buffer.from(response.data)
      const isZip = this.isZipResponse(
        downloadUrl,
        response.headers['content-type'],
        response.headers['content-disposition'],
        fileBuffer,
      )
      const extension = isZip ? '.zip' : ''
      const downloadPath = path.join(downloadsDir, `${modId}${extension}`)

      await fs.writeFile(downloadPath, fileBuffer)
      console.log(`Downloaded to: ${downloadPath}`)
      return downloadPath
    } catch (error) {
      console.error('Error downloading mod:', error)
      throw error
    }
  }

  private async extractZip(zipPath: string, targetDir: string): Promise<void> {
    try {
      const AdmZip = require('adm-zip')
      const zip = new AdmZip(zipPath)

      zip.extractAllTo(targetDir, true)
      console.log(`Extracted to: ${targetDir}`)
    } catch (error) {
      console.log('adm-zip not available, trying native extraction...')
      await this.extractZipNative(zipPath, targetDir)
    }
  }

  private async extractZipNative(zipPath: string, targetDir: string): Promise<void> {
    await fs.mkdir(targetDir, { recursive: true })

    if (process.platform === 'win32') {
      await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force',
        zipPath,
        targetDir,
      ])
      console.log(`Extracted to: ${targetDir}`)
      return
    }

    throw new Error('ZIP extraction fallback is only implemented for Windows.')
  }

  async installMod(modId: string, gameName?: string): Promise<boolean> {
    try {
      const config = await this.loadConfig()
      const mods = await this.fetchMods()
      const mod = mods.find(m => m.id === modId)

      if (!mod) {
        throw new Error(`Mod ${modId} not found`)
      }

      const modName = mod.name || modId
      const detectedGameName = mod.gameName || gameName

      if (!detectedGameName) {
        throw new Error('Could not determine game for this mod. Please specify manually.')
      }

      const targetGameName = detectedGameName
      const gameConfig = config.games[targetGameName]

      if (!gameConfig) {
        throw new Error(`Game "${targetGameName}" is not configured. Please add it in Game Configuration first.`)
      }

      let gameModPath = gameConfig.modsDirectory

      if (gameModPath.startsWith('~')) {
        const os = require('os')
        gameModPath = path.join(os.homedir(), gameModPath.slice(1))
      }

      gameModPath = gameModPath.replace(/%([^%]+)%/g, (_, varName) => process.env[varName] || '')

      console.log(`Installing to: ${gameModPath}`)

      const downloadPath = await this.downloadMod(modId)

      const isZip = downloadPath.toLowerCase().endsWith('.zip')

      if (isZip) {
        await this.extractZip(downloadPath, gameModPath)
        console.log(`Successfully installed "${modName}" to ${targetGameName}`)
      } else {
        await fs.mkdir(gameModPath, { recursive: true })
        const fileName = path.basename(downloadPath)
        const destPath = path.join(gameModPath, fileName)
        await fs.copyFile(downloadPath, destPath)
        console.log(`Copied "${modName}" to ${destPath}`)
      }

      const installedMods = await this.loadInstalledMods()
      installedMods.push({
        modId,
        modName,
        gameName: targetGameName,
        installedAt: new Date().toISOString(),
      })
      await this.saveInstalledMods(installedMods)

      try {
        await fs.unlink(downloadPath)
        console.log(`Deleted cached download: ${downloadPath}`)
      } catch {
        console.warn('Could not delete cached download')
      }

      return true
    } catch (error) {
      console.error('Error installing mod:', error)
      throw error
    }
  }

  async addGameConfig(gameName: string, gameModsDirectory: string): Promise<void> {
    const config = await this.loadConfig()
    config.games[gameName] = { modsDirectory: gameModsDirectory }
    this.config = config
    await this.saveConfig()
  }

  async updateDefaultDirectories(downloadsDirectory: string): Promise<void> {
    const config = await this.loadConfig()
    config.defaults = {
      downloadsDirectory,
    }
    this.config = config
    await this.saveConfig()
  }

  async removeGameConfig(gameName: string): Promise<void> {
    const config = await this.loadConfig()
    delete config.games[gameName]
    this.config = config
    await this.saveConfig()
  }
}
