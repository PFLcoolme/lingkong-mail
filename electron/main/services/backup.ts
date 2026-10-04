import { app } from 'electron'
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { getAttachmentsDir, getDatabasePath, getDb } from './db'

function directorySize(dir: string): number {
  let total = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) total += directorySize(path)
    else {
      try {
        total += statSync(path).size
      } catch {
        /* 忽略无法读取的文件 */
      }
    }
  }
  return total
}

/** 备份数据库与附件到指定目录 */
export function createBackup(targetDir: string): { dir: string; size: number } {
  // 先把 WAL 落盘，保证 mail.db 单文件完整
  getDb().pragma('wal_checkpoint(TRUNCATE)')
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const dir = join(targetDir, `kongling-backup-${stamp}`)
  mkdirSync(dir, { recursive: true })
  copyFileSync(getDatabasePath(), join(dir, 'mail.db'))
  const attachments = getAttachmentsDir()
  if (existsSync(attachments)) {
    cpSync(attachments, join(dir, 'attachments'), { recursive: true })
  }
  return { dir, size: directorySize(dir) }
}

/** 从备份目录恢复（调用后需重启应用） */
export function restoreBackup(sourceDir: string): void {
  const sourceDb = join(sourceDir, 'mail.db')
  if (!existsSync(sourceDb)) {
    throw new Error('所选目录不是有效的备份（未找到 mail.db）')
  }
  const dataDir = app.getPath('userData')
  getDb().close()

  // 先把当前数据另存一份，避免误操作
  const currentDb = getDatabasePath()
  if (existsSync(currentDb)) {
    copyFileSync(currentDb, join(dataDir, `mail.db.before-restore-${Date.now()}`))
  }

  copyFileSync(sourceDb, currentDb)
  for (const suffix of ['-wal', '-shm']) {
    const file = `${currentDb}${suffix}`
    if (existsSync(file)) rmSync(file)
  }

  const sourceAttachments = join(sourceDir, 'attachments')
  if (existsSync(sourceAttachments)) {
    cpSync(sourceAttachments, getAttachmentsDir(), { recursive: true, force: true })
  }
}

/** 目录大小（供界面展示） */
export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`
}
