export {}

declare global {
  interface Window {
    modService: {
      getMods: () => Promise<any>
      downloadMod: (modId: string) => Promise<any>
      installMod: (modId: string, gameName: string) => Promise<any>
      getConfig: () => Promise<any>
      addGameConfig: (gameName: string, gameModsDirectory: string) => Promise<any>
      removeGameConfig: (gameName: string) => Promise<any>
      setDefaultDirectories: (downloadsDirectory: string) => Promise<any>
      getPageData: () => Promise<any>
    }
  }
}
