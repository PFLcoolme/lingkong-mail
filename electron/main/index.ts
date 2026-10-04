import { app, ipcMain, nativeTheme } from 'electron'
import { join } from 'node:path'
import { initDatabase } from './services/db'
import { settingsGet } from './services/accounts'
import { setEventSink, startIdleAll, syncAllAccounts } from './services/sync'
import { registerAccountHandlers } from './ipc/accounts'
import { registerMailHandlers } from './ipc/mail'
import { registerMiscHandlers, DEFAULT_SETTINGS } from './ipc/misc'
import { registerUpdateHandlers } from './ipc/update'
import { scheduleUpdateCheck, setUpdateSink } from './services/update'
import { createMainWindow, getMainWindow, loadRenderer } from './window'
import { refreshTray, setupTray } from './tray'
import { startScheduler } from './scheduler'
import type { MainEvent } from '@shared/types'

process.env.DIST_ELECTRON = join(__dirname, '../')
process.env.DIST = process.env.DIST_ELECTRON
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, '../public')
  : process.env.DIST_ELECTRON

let syncTimer: NodeJS.Timeout | null = null

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

if (process.platform === 'linux') {
  // 让 X11/Wayland 下的透明窗口（毛玻璃）更容易生效
  app.commandLine.appendSwitch('enable-transparent-visuals')
}

function scheduleAutoSync(): void {
  if (syncTimer) clearInterval(syncTimer)
  const settings = { ...DEFAULT_SETTINGS, ...settingsGet<Partial<typeof DEFAULT_SETTINGS>>('app', {}) }
  const minutes = Math.max(1, settings.checkIntervalMinutes || 5)
  syncTimer = setInterval(() => {
    void syncAllAccounts()
  }, minutes * 60 * 1000)
}

function parseMailto(argv: string[]): { to: string; subject: string; body: string } | null {
  const link = argv.find((arg) => arg.startsWith('mailto:'))
  if (!link) return null
  try {
    const url = new URL(link)
    return {
      to: decodeURIComponent(url.pathname).replace(/^\/*/, ''),
      subject: url.searchParams.get('subject') ?? '',
      body: url.searchParams.get('body') ?? ''
    }
  } catch {
    return null
  }
}

function dispatchMailto(argv: string[]): void {
  const parsed = parseMailto(argv)
  if (!parsed) return
  setTimeout(() => {
    pushToRenderer({ type: 'compose-mailto', payload: parsed })
  }, 800)
}

function pushToRenderer(event: MainEvent): void {
  const window = getMainWindow()
  if (!window || window.isDestroyed()) return
  window.webContents.send('main:event', event)
}

app.on('second-instance', (_event, argv) => {
  const window = getMainWindow()
  if (window) {
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  }
  dispatchMailto(argv)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  const window = getMainWindow()
  if (!window || window.isDestroyed()) {
    const created = createMainWindow()
    loadRenderer(created)
  }
})

void app.whenReady().then(() => {
  initDatabase()
  registerAccountHandlers()
  registerMailHandlers()
  registerMiscHandlers()
  registerUpdateHandlers()
  const settings = { ...DEFAULT_SETTINGS, ...settingsGet<Partial<typeof DEFAULT_SETTINGS>>('app', {}) }
  nativeTheme.themeSource = settings.theme === 'system' ? 'system' : settings.theme
  setEventSink(pushToRenderer)
  setUpdateSink(pushToRenderer)
  const window = createMainWindow()
  loadRenderer(window)
  scheduleAutoSync()
  setupTray()
  setInterval(() => refreshTray(), 30000)
  startScheduler()
  if (settings.openAtLogin) {
    app.setLoginItemSettings({ openAtLogin: true })
  }
  ipcMain.on('settings:changed', () => scheduleAutoSync())
  // 首次启动若由 mailto: 链接唤起
  dispatchMailto(process.argv)
  app.setAsDefaultProtocolClient('mailto')

  if (settings.autoStartSync) {
    setTimeout(() => {
      void syncAllAccounts()
      void startIdleAll()
    }, 1500)
  } else {
    setTimeout(() => void startIdleAll(), 2000)
  }

  // 启动后静默检查一次更新（仅打包环境生效）
  scheduleUpdateCheck()
})
