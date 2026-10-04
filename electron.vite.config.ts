import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': resolve('shared') }
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'electron/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': resolve('shared') }
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'electron/preload/index.ts') }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src'),
    plugins: [react()],
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString())
    },
    resolve: {
      alias: {
        '@shared': resolve('shared'),
        '@': resolve(__dirname, 'src')
      }
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/index.html') }
      }
    }
  }
})
