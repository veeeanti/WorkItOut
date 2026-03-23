export {}

declare global {
  interface Window {
    modService: {
      getMods: () => Promise<any>
      downloadMod: (modId: string) => Promise<any>
      installMod: (modId: string, gameName?: string) => Promise<any>
      getInstalledMods: () => Promise<any>
      isModInstalled: (modId: string) => Promise<boolean>
      removeInstalledMod: (modId: string) => Promise<boolean>
      getConfig: () => Promise<any>
      addGameConfig: (gameName: string, gameModsDirectory: string) => Promise<any>
      removeGameConfig: (gameName: string) => Promise<any>
      setDefaultDirectories: (downloadsDirectory: string) => Promise<any>
      getPageData: () => Promise<any>
    }
  }
}
