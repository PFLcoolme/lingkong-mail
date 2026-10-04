import Database from 'better-sqlite3'
import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { SCHEMA, migrateSchema } from './schema'

let db: Database.Database | null = null

export function getAttachmentsDir(): string {
  const dir = join(app.getPath('userData'), 'attachments')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function getDatabasePath(): string {
  return join(app.getPath('userData'), 'mail.db')
}

export function initDatabase(): Database.Database {
  if (db) return db
  mkdirSync(app.getPath('userData'), { recursive: true })
  getAttachmentsDir()
  db = new Database(getDatabasePath())
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.exec(SCHEMA)
  migrateSchema(db)
  return db
}

export function getDb(): Database.Database {
  if (!db) throw new Error('数据库尚未初始化')
  return db
}

export function generateId(prefix: string): string {
  return `${prefix}_${randomUUID()}`
}

export function now(): number {
  return Date.now()
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

/** 把文本转换为适合 FTS 索引的形式：CJK 逐字拆分，其余保留原文 */
export function toSearchText(input: string): string {
  if (!input) return ''
  return input.replace(/[㐀-䶿一-鿿豈-﫿぀-ヿ]/g, (c) => ` ${c} `)
}
