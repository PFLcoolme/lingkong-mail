import type { Address, Contact } from '@shared/types'
import { generateId, getDb, now } from './db'

interface ContactRow {
  id: string
  account_id: string
  name: string
  email: string
  frequency: number
  last_used_at: number
}

function rowToContact(row: ContactRow): Contact {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    email: row.email,
    frequency: row.frequency,
    lastUsedAt: row.last_used_at
  }
}

export function listContacts(accountId?: string): Contact[] {
  const db = getDb()
  const rows = accountId
    ? (db.prepare('SELECT * FROM contacts WHERE account_id = ? ORDER BY frequency DESC, last_used_at DESC').all(accountId) as ContactRow[])
    : (db.prepare('SELECT * FROM contacts ORDER BY frequency DESC, last_used_at DESC').all() as ContactRow[])
  return rows.map(rowToContact)
}

export function saveContact(contact: Partial<Contact>): void {
  if (!contact.email) return
  const db = getDb()
  const existing = db
    .prepare('SELECT * FROM contacts WHERE account_id = ? AND email = ?')
    .get(contact.accountId ?? '', contact.email.toLowerCase()) as ContactRow | undefined
  if (existing) {
    db.prepare('UPDATE contacts SET name = ?, frequency = ?, last_used_at = ? WHERE id = ?').run(
      contact.name ?? existing.name,
      contact.frequency ?? existing.frequency,
      contact.lastUsedAt ?? existing.last_used_at,
      existing.id
    )
    return
  }
  db.prepare(
    `INSERT INTO contacts (id, account_id, name, email, frequency, last_used_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    contact.id || generateId('ctc'),
    contact.accountId ?? '',
    contact.name ?? '',
    contact.email.toLowerCase(),
    contact.frequency ?? 1,
    contact.lastUsedAt ?? now()
  )
}

export function deleteContact(id: string): void {
  getDb().prepare('DELETE FROM contacts WHERE id = ?').run(id)
}

/** 收发邮件时自动记录联系人 */
export function recordAddresses(accountId: string, addresses: Address[]): void {
  for (const addr of addresses) {
    if (!addr.address) continue
    const db = getDb()
    const existing = db
      .prepare('SELECT * FROM contacts WHERE account_id = ? AND email = ?')
      .get(accountId, addr.address.toLowerCase()) as ContactRow | undefined
    if (existing) {
      db.prepare('UPDATE contacts SET frequency = frequency + 1, last_used_at = ?, name = ? WHERE id = ?').run(
        now(),
        existing.name || addr.name || '',
        existing.id
      )
    } else {
      db.prepare('INSERT INTO contacts (id, account_id, name, email, frequency, last_used_at) VALUES (?, ?, ?, ?, 1, ?)').run(
        generateId('ctc'),
        accountId,
        addr.name ?? '',
        addr.address.toLowerCase(),
        now()
      )
    }
  }
}

export function searchContacts(query: string, accountId?: string): Contact[] {
  const db = getDb()
  const like = `%${query.toLowerCase()}%`
  const rows = accountId
    ? (db
        .prepare('SELECT * FROM contacts WHERE account_id = ? AND (email LIKE ? OR name LIKE ?) ORDER BY frequency DESC LIMIT 20')
        .all(accountId, like, like) as ContactRow[])
    : (db
        .prepare('SELECT * FROM contacts WHERE email LIKE ? OR name LIKE ? ORDER BY frequency DESC LIMIT 20')
        .all(like, like) as ContactRow[])
  return rows.map(rowToContact)
}
