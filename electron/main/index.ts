import { app, ipcMain, nativeTheme } from 'electron'
import { join } from 'node:path'
import { initDatabase } from './services/db'
import { settingsGet } from './services/accounts'
import { setEventSink, syncAllAccounts } from './services/sync'
import { registerAccountHandlers } from './ipc/accounts'
import { registerMailHandlers } from './ipc/mail'
import { registerMiscHandlers, DEFAULT_SETTINGS } from './ipc/misc'
import { createMainWindow, getMainWindow, loadRenderer } from './window'
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

function pushToRenderer(event: MainEvent): void {
  const window = getMainWindow()
  if (!window || window.isDestroyed()) return
  window.webContents.send('main:event', event)
}

app.on('second-instance', () => {
  const window = getMainWindow()
  if (window) {
    if (window.isMinimized()) window.restore()
    window.focus()
  }
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
  const settings = { ...DEFAULT_SETTINGS, ...settingsGet<Partial<typeof DEFAULT_SETTINGS>>('app', {}) }
  nativeTheme.themeSource = settings.theme === 'system' ? 'system' : settings.theme
  setEventSink(pushToRenderer)
  const window = createMainWindow()
  loadRenderer(window)
  scheduleAutoSync()
  ipcMain.on('settings:changed', () => scheduleAutoSync())
  if (settings.autoStartSync) {
    setTimeout(() => void syncAllAccounts(), 1200)
  }
})
