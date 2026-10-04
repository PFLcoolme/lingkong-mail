import type { Label } from '@shared/types'
import { generateId, getDb } from './db'

interface LabelRow {
  id: string
  name: string
  color: string
  sort_order: number
}

function rowToLabel(row: LabelRow): Label {
  return { id: row.id, name: row.name, color: row.color, sortOrder: row.sort_order }
}

export function listLabels(): Label[] {
  const rows = getDb()
    .prepare('SELECT * FROM labels ORDER BY sort_order ASC, name ASC')
    .all() as LabelRow[]
  const counts = new Map(
    (
      getDb()
        .prepare('SELECT label_id, COUNT(*) AS c FROM message_labels GROUP BY label_id')
        .all() as { label_id: string; c: number }[]
    ).map((row) => [row.label_id, row.c])
  )
  return rows.map((row) => ({ ...rowToLabel(row), count: counts.get(row.id) ?? 0 }))
}

export function saveLabel(label: Partial<Label>): Label {
  const db = getDb()
  const id = label.id || generateId('lbl')
  const order =
    label.sortOrder ?? (db.prepare('SELECT COUNT(*) AS c FROM labels').get() as { c: number }).c
  const exists = db.prepare('SELECT id FROM labels WHERE id = ?').get(id)
  if (exists) {
    db.prepare('UPDATE labels SET name = ?, color = ? WHERE id = ?').run(
      label.name ?? '',
      label.color ?? '#5b8def',
      id
    )
  } else {
    db.prepare('INSERT INTO labels (id, name, color, sort_order) VALUES (?, ?, ?, ?)').run(
      id,
      label.name ?? '新标签',
      label.color ?? '#5b8def',
      order
    )
  }
  const row = db.prepare('SELECT * FROM labels WHERE id = ?').get(id) as LabelRow
  return rowToLabel(row)
}

export function deleteLabel(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM message_labels WHERE label_id = ?').run(id)
  db.prepare('DELETE FROM labels WHERE id = ?').run(id)
}

export function setMessageLabels(messageId: string, labelIds: string[]): void {
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM message_labels WHERE message_id = ?').run(messageId)
    const insert = db.prepare('INSERT OR IGNORE INTO message_labels (message_id, label_id) VALUES (?, ?)')
    for (const labelId of labelIds) insert.run(messageId, labelId)
  })
  tx()
}

export function toggleMessageLabel(messageId: string, labelId: string): void {
  const db = getDb()
  const exists = db
    .prepare('SELECT 1 AS x FROM message_labels WHERE message_id = ? AND label_id = ?')
    .get(messageId, labelId)
  if (exists) {
    db.prepare('DELETE FROM message_labels WHERE message_id = ? AND label_id = ?').run(messageId, labelId)
  } else {
    db.prepare('INSERT OR IGNORE INTO message_labels (message_id, label_id) VALUES (?, ?)').run(messageId, labelId)
  }
}

/** 批量给多封邮件加/去标签 */
export function applyLabelToMessages(messageIds: string[], labelId: string, add: boolean): void {
  const db = getDb()
  const tx = db.transaction(() => {
    for (const messageId of messageIds) {
      if (add) {
        db.prepare('INSERT OR IGNORE INTO message_labels (message_id, label_id) VALUES (?, ?)').run(
          messageId,
          labelId
        )
      } else {
        db.prepare('DELETE FROM message_labels WHERE message_id = ? AND label_id = ?').run(messageId, labelId)
      }
    }
  })
  tx()
}

/** 某封邮件所属标签 id 列表 */
export function labelsOfMessages(messageIds: string[]): Record<string, string[]> {
  if (!messageIds.length) return {}
  const placeholders = messageIds.map(() => '?').join(',')
  const rows = getDb()
    .prepare(`SELECT message_id, label_id FROM message_labels WHERE message_id IN (${placeholders})`)
    .all(...messageIds) as { message_id: string; label_id: string }[]
  const result: Record<string, string[]> = {}
  for (const row of rows) {
    const list = result[row.message_id] ?? []
    list.push(row.label_id)
    result[row.message_id] = list
  }
  return result
}
