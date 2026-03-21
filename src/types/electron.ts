declare global {
  interface Window {
    ipcRenderer?: {
      invoke(channel: string, ...args: unknown[]): Promise<unknown>
      on?(channel: string, func: (...args: unknown[]) => void): void
      removeListener?(channel: string, func: (...args: unknown[]) => void): void
    }
    dialog?: {
      openDirectory(): Promise<string | null>
      openFile?(options?: { filters?: { name: string; extensions: string[] }[] }): Promise<string | null>
    }
    shell?: {
      openPath(path: string): Promise<void>
      openExternal?(url: string): Promise<void>
      showItemInFolder?(path: string): Promise<void>
    }
    app?: {
      getVersion(): Promise<string>
      getPath?(name: string): Promise<string>
    }
  }
}

export {}
