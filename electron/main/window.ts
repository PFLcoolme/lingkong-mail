import { BrowserWindow, nativeTheme, shell } from 'electron'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { settingsGet } from './services/accounts'
import { DEFAULT_SETTINGS as DEFAULTS } from './settings-defaults'

let window: BrowserWindow | null = null

export function createMainWindow(): BrowserWindow {
  const settings = { ...DEFAULTS, ...settingsGet<Partial<typeof DEFAULTS>>('app', {}) }
  const transparent = settings.transparentBackground === true
  const dark =
    settings.theme === 'dark' || (settings.theme === 'system' && nativeTheme.shouldUseDarkColors)
  const opaque = dark ? '#0c0c0e' : '#f4f4f5'
  window = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 960,
    minHeight: 620,
    show: false,
    frame: false,
    transparent,
    backgroundColor: transparent ? '#00000000' : opaque,
    title: '空灵邮箱',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  })

  window.once('ready-to-show', () => window?.show())

  // 调试用：设置 KONGLING_SCREENSHOT=/path.png 可自动截取界面
  if (process.env.KONGLING_SCREENSHOT) {
    const target = process.env.KONGLING_SCREENSHOT
    window.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        void window
          ?.capturePage()
          .then((image) => {
            writeFileSync(target, image.toPNG())
          })
          .catch(() => undefined)
      }, 3000)
    })
  }
  window.on('maximize', () => window?.webContents.send('window:state', true))
  window.on('unmaximize', () => window?.webContents.send('window:state', false))

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      void shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http') && !url.includes('localhost')) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  return window
}

export function getMainWindow(): BrowserWindow | null {
  return window
}

export function loadRenderer(window: BrowserWindow): void {
  if (process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    void window.loadFile(join(process.env.DIST_ELECTRON as string, 'renderer/index.html'))
  }
}
