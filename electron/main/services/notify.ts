import { Notification, app, nativeImage, type NativeImage } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

let initialized = false

function ensureAppName(): void {
  if (initialized) return
  initialized = true
  if (process.platform === 'linux') {
    app.setName('空灵邮箱')
  }
}

export interface NewMailNotice {
  title: string
  body: string
}

export function showNewMailNotification(notices: NewMailNotice[], accountName: string): void {
  ensureAppName()
  if (!Notification.isSupported()) return
  if (notices.length === 1) {
    const notification = new Notification({
      title: notices[0].title,
      body: notices[0].body,
      subtitle: accountName
    })
    notification.show()
    return
  }
  const notification = new Notification({
    title: `${accountName}：${notices.length} 封新邮件`,
    body: notices
      .slice(0, 5)
      .map((n) => n.title)
      .join('\n')
  })
  notification.show()
}

export function getAppIconPath(): string | undefined {
  const candidates = [
    join(process.resourcesPath ?? '', 'icon.png'),
    join(__dirname, '../../build/icon.png')
  ]
  return candidates.find((p) => existsSync(p))
}

export function buildTrayIcon(): NativeImage | undefined {
  const path = getAppIconPath()
  if (!path) return undefined
  return nativeImage.createFromPath(path)
}
