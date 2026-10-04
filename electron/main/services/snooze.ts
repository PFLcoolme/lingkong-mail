import type { SnoozedItem } from '@shared/types'
import { generateId, getDb, now } from './db'

interface SnoozeRow {
  id: string
  message_id: string
  account_id: string
  folder_id: string
  wake_at: number
  created_at: number
}

function rowToItem(row: SnoozeRow): SnoozedItem {
  return {
    id: row.id,
    messageId: row.message_id,
    accountId: row.account_id,
    folderId: row.folder_id,
    wakeAt: row.wake_at,
    createdAt: row.created_at
  }
}

export function snoozeMessage(
  messageId: string,
  accountId: string,
  folderId: string,
  wakeAt: number
): void {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM snoozed WHERE message_id = ?').get(messageId)
  if (existing) {
    db.prepare('UPDATE snoozed SET wake_at = ? WHERE message_id = ?').run(wakeAt, messageId)
    return
  }
  db.prepare(
    `INSERT INTO snoozed (id, message_id, account_id, folder_id, wake_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(generateId('snz'), messageId, accountId, folderId, wakeAt, now())
}

export function listSnoozed(): SnoozedItem[] {
  return (getDb().prepare('SELECT * FROM snoozed ORDER BY wake_at ASC').all() as SnoozeRow[]).map(rowToItem)
}

export function wakeMessage(messageId: string): void {
  getDb().prepare('DELETE FROM snoozed WHERE message_id = ?').run(messageId)
}

/** 到期的提醒项 */
export function dueSnoozes(currentTime = Date.now()): SnoozedItem[] {
  return (getDb().prepare('SELECT * FROM snoozed WHERE wake_at <= ?').all(currentTime) as SnoozeRow[]).map(
    rowToItem
  )
}

/** 已被暂缓的邮件 id（用于列表过滤） */
export function snoozedIds(): string[] {
  return (getDb().prepare('SELECT message_id FROM snoozed').all() as { message_id: string }[]).map(
    (row) => row.message_id
  )
}
