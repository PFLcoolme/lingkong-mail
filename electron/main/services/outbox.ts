import type { OutboxItem, OutboxStatus, SendPayload } from '@shared/types'
import { generateId, getDb, now } from './db'

interface OutboxRow {
  id: string
  account_id: string
  payload_json: string
  send_at: number
  created_at: number
  status: string
}

function rowToItem(row: OutboxRow): OutboxItem {
  return {
    id: row.id,
    accountId: row.account_id,
    payload: JSON.parse(row.payload_json) as SendPayload,
    sendAt: row.send_at,
    createdAt: row.created_at,
    status: row.status as OutboxStatus
  }
}

export function enqueue(accountId: string, payload: SendPayload, sendAt: number): OutboxItem {
  const db = getDb()
  const id = generateId('out')
  db.prepare(
    `INSERT INTO outbox (id, account_id, payload_json, send_at, created_at, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`
  ).run(id, accountId, JSON.stringify(payload), sendAt, now())
  return rowToItem(db.prepare('SELECT * FROM outbox WHERE id = ?').get(id) as OutboxRow)
}

export function listOutbox(): OutboxItem[] {
  return (getDb().prepare('SELECT * FROM outbox ORDER BY send_at ASC').all() as OutboxRow[]).map(rowToItem)
}

export function getOutboxItem(id: string): OutboxItem | null {
  const row = getDb().prepare('SELECT * FROM outbox WHERE id = ?').get(id) as OutboxRow | undefined
  return row ? rowToItem(row) : null
}

export function setOutboxStatus(id: string, status: OutboxStatus): void {
  getDb().prepare('UPDATE outbox SET status = ? WHERE id = ?').run(status, id)
}

export function removeOutboxItem(id: string): void {
  getDb().prepare('DELETE FROM outbox WHERE id = ?').run(id)
}

/** 取出所有到期待发项 */
export function dueItems(currentTime = Date.now()): OutboxItem[] {
  return (
    getDb()
      .prepare("SELECT * FROM outbox WHERE send_at <= ? AND status = 'pending' ORDER BY send_at ASC")
      .all(currentTime) as OutboxRow[]
  ).map(rowToItem)
}
