import type { Folder, FolderType } from '@shared/types'
import { getDb } from './db'

interface FolderRow {
  id: string
  account_id: string
  path: string
  name: string
  delimiter: string
  type: string
  unread: number
  total: number
  uid_validity: number
  last_uid: number
  synced_at: number
}

const FOLDER_LABELS: Record<FolderType, string> = {
  inbox: '收件箱',
  sent: '已发送',
  drafts: '草稿箱',
  trash: '已删除',
  junk: '垃圾邮件',
  archive: '归档',
  other: '文件夹'
}

export function rowToFolder(row: FolderRow): Folder {
  return {
    id: row.id,
    accountId: row.account_id,
    path: row.path,
    name: row.name,
    delimiter: row.delimiter,
    type: row.type as FolderType,
    unread: row.unread,
    total: row.total,
    uidValidity: row.uid_validity,
    lastUid: row.last_uid,
    syncedAt: row.synced_at
  }
}

export function makeFolderId(accountId: string, path: string): string {
  return `${accountId}::${path}`
}

export function listFolders(accountId: string): Folder[] {
  return (
    getDb()
      .prepare('SELECT * FROM folders WHERE account_id = ? ORDER BY type, name')
      .all(accountId) as FolderRow[]
  ).map(rowToFolder)
}

export function getFolderById(id: string): Folder | null {
  const row = getDb().prepare('SELECT * FROM folders WHERE id = ?').get(id) as FolderRow | undefined
  return row ? rowToFolder(row) : null
}

export function getFolderByPath(accountId: string, path: string): Folder | null {
  const row = getDb().prepare('SELECT * FROM folders WHERE account_id = ? AND path = ?').get(accountId, path) as
    | FolderRow
    | undefined
  return row ? rowToFolder(row) : null
}

export interface UpsertFolderInput {
  accountId: string
  path: string
  name?: string
  delimiter?: string
  type: FolderType
}

export function upsertFolder(input: UpsertFolderInput): Folder {
  const db = getDb()
  const id = makeFolderId(input.accountId, input.path)
  const existing = db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as FolderRow | undefined
  const name = input.name || FOLDER_LABELS[input.type] || input.path.split(input.delimiter || '/').pop() || input.path
  if (existing) {
    db.prepare('UPDATE folders SET name = ?, delimiter = ?, type = ? WHERE id = ?').run(
      name,
      input.delimiter ?? existing.delimiter,
      input.type,
      id
    )
  } else {
    db.prepare(
      `INSERT INTO folders (id, account_id, path, name, delimiter, type, unread, total, uid_validity, last_uid, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0)`
    ).run(id, input.accountId, input.path, name, input.delimiter ?? '/', input.type)
  }
  return getFolderById(id) as Folder
}

export function updateFolderSync(id: string, patch: Partial<Pick<Folder, 'uidValidity' | 'lastUid' | 'syncedAt'>>): void {
  const db = getDb()
  const sets: string[] = []
  const params: unknown[] = []
  if (patch.uidValidity !== undefined) {
    sets.push('uid_validity = ?')
    params.push(patch.uidValidity)
  }
  if (patch.lastUid !== undefined) {
    sets.push('last_uid = ?')
    params.push(patch.lastUid)
  }
  if (patch.syncedAt !== undefined) {
    sets.push('synced_at = ?')
    params.push(patch.syncedAt)
  }
  if (!sets.length) return
  params.push(id)
  db.prepare(`UPDATE folders SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

export function deleteFolder(id: string): void {
  getDb().prepare('DELETE FROM folders WHERE id = ?').run(id)
}

export function folderLabel(type: FolderType, name: string): string {
  return FOLDER_LABELS[type] || name
}
