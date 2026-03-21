import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

declare const process: any

export default defineConfig({
  main: {
    build: {
      outDir: 'dist-electron/main',
      rollupOptions: {
        input: resolve(process.cwd(), 'src/main.ts'),
        output: {
          format: 'cjs',
        },
        external: ['electron', 'electron-log'],
      },
    },
  },
  preload: {
    build: {
      outDir: 'dist-electron/preload',
      rollupOptions: {
        input: resolve(process.cwd(), 'src/preload.ts'),
        output: {
          format: 'cjs',
        },
        external: ['electron'],
      },
    },
  },
  renderer: {
    root: '.',
    resolve: {
      alias: {
        '@': resolve('src'),
      },
    },
    plugins: [react()],
    build: {
      outDir: 'dist-react',
      rollupOptions: {
        input: resolve(process.cwd(), 'index.html'),
      },
    },
  },
})
