import { Menu, Tray, app, nativeImage } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getMainWindow } from './window'
import { listAccounts, settingsGet } from './services/accounts'
import { countUnread } from './services/messages'

let tray: Tray | null = null

function iconPath(): string {
  const candidates = [
    join(process.resourcesPath ?? '', 'build', 'icon.png'),
    join(__dirname, '../../build/icon.png'),
    join(__dirname, '../../../build/icon.png')
  ]
  return candidates.find((p) => existsSync(p)) ?? ''
}

function menuTemplate(unread: number): Electron.MenuItemConstructorOptions[] {
  return [
    { label: unread ? `${unread} 封未读` : '空灵邮箱', enabled: false },
    { type: 'separator' },
    {
      label: '打开主窗口',
      click: () => {
        const window = getMainWindow()
        if (window) {
          if (window.isMinimized()) window.restore()
          window.show()
          window.focus()
        }
      }
    },
    {
      label: '锁定应用',
      click: () => {
        const window = getMainWindow()
        if (window) {
          if (window.isMinimized()) window.restore()
          window.show()
          window.focus()
          window.webContents.send('main:event', { type: 'lock-now', payload: {} })
        }
      }
    },
    { label: '退出', click: () => app.quit() }
  ]
}

export function setupTray(): void {
  if (settingsGet<boolean>('trayEnabled', true) === false) return
  const path = iconPath()
  if (!path) return
  try {
    const image = nativeImage.createFromPath(path).resize({ width: 22, height: 22 })
    tray = new Tray(image)
    tray.setToolTip('空灵邮箱')
    tray.setContextMenu(Menu.buildFromTemplate(menuTemplate(0)))
    tray.on('click', () => {
      const window = getMainWindow()
      if (window) {
        if (window.isMinimized()) window.restore()
        window.show()
        window.focus()
      }
    })
    refreshTray()
  } catch (error) {
    console.warn('[托盘] 初始化失败', error)
  }
}

export function hasTray(): boolean {
  return Boolean(tray)
}

export function refreshTray(): void {
  if (!tray) return
  const unread = listAccounts()
    .filter((a) => a.enabled)
    .reduce((sum, account) => sum + countUnread(account.id), 0)
  tray.setToolTip(unread ? `空灵邮箱 · ${unread} 封未读` : '空灵邮箱')
  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate(unread)))
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
