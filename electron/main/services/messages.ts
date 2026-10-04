import type {
  Address,
  Attachment,
  ListQuery,
  Message,
  MessageSummary,
  SearchHit,
  SearchQuery
} from '@shared/types'
import { generateId, getDb, parseJson, toSearchText } from './db'

interface MessageRow {
  id: string
  account_id: string
  folder_id: string
  uid: number
  message_id: string
  in_reply_to: string
  subject: string
  from_json: string
  to_json: string
  cc_json: string
  bcc_json: string
  date: number
  size: number
  seen: number
  flagged: number
  answered: number
  draft: number
  attachment_count: number
  snippet: string
  body_text: string
  body_html: string
  search_text: string
  headers_json: string
  fetched: number
}

export function makeMessageId(accountId: string, folderId: string, uid: number): string {
  return `${accountId}::${folderId}::${uid}`
}

export function rowToSummary(row: MessageRow): MessageSummary {
  return {
    id: row.id,
    accountId: row.account_id,
    folderId: row.folder_id,
    uid: row.uid,
    messageId: row.message_id,
    inReplyTo: row.in_reply_to,
    subject: row.subject,
    from: parseJson<Address[]>(row.from_json, []),
    to: parseJson<Address[]>(row.to_json, []),
    cc: parseJson<Address[]>(row.cc_json, []),
    bcc: parseJson<Address[]>(row.bcc_json, []),
    date: row.date,
    size: row.size,
    seen: row.seen === 1,
    flagged: row.flagged === 1,
    answered: row.answered === 1,
    draft: row.draft === 1,
    attachmentCount: row.attachment_count,
    snippet: row.snippet,
    hasHtml: Boolean(row.body_html)
  }
}

export interface UpsertMessageInput {
  accountId: string
  folderId: string
  uid: number
  messageId?: string
  inReplyTo?: string
  subject?: string
  from?: Address[]
  to?: Address[]
  cc?: Address[]
  bcc?: Address[]
  date?: number
  size?: number
  seen?: boolean
  flagged?: boolean
  answered?: boolean
  draft?: boolean
  attachmentCount?: number
  snippet?: string
  bodyText?: string
  bodyHtml?: string
  headers?: Record<string, string>
}

export function upsertMessage(input: UpsertMessageInput): string {
  const db = getDb()
  const id = makeMessageId(input.accountId, input.folderId, input.uid)
  const existing = db.prepare('SELECT id, fetched FROM messages WHERE id = ?').get(id) as
    | { id: string; fetched: number }
    | undefined
  const bodyText = input.bodyText ?? ''
  const bodyHtml = input.bodyHtml ?? ''
  const searchText = toSearchText(
    `${input.subject ?? ''} ${bodyText.slice(0, 20000)} ${(input.from ?? []).map((a) => `${a.name} ${a.address}`).join(' ')}`
  )
  const params = {
    id,
    account_id: input.accountId,
    folder_id: input.folderId,
    uid: input.uid,
    message_id: input.messageId ?? '',
    in_reply_to: input.inReplyTo ?? '',
    subject: input.subject ?? '(无主题)',
    from_json: JSON.stringify(input.from ?? []),
    to_json: JSON.stringify(input.to ?? []),
    cc_json: JSON.stringify(input.cc ?? []),
    bcc_json: JSON.stringify(input.bcc ?? []),
    date: input.date ?? Date.now(),
    size: input.size ?? 0,
    seen: input.seen ? 1 : 0,
    flagged: input.flagged ? 1 : 0,
    answered: input.answered ? 1 : 0,
    draft: input.draft ? 1 : 0,
    attachment_count: input.attachmentCount ?? 0,
    snippet: (input.snippet ?? bodyText).slice(0, 220),
    body_text: bodyText,
    body_html: bodyHtml,
    search_text: searchText,
    headers_json: JSON.stringify(input.headers ?? {}),
    fetched: input.bodyText || input.bodyHtml ? 1 : 0
  }
  if (existing) {
    db.prepare(
      `UPDATE messages SET message_id=@message_id, in_reply_to=@in_reply_to, subject=@subject,
        from_json=@from_json, to_json=@to_json, cc_json=@cc_json, bcc_json=@bcc_json, date=@date, size=@size,
        seen=@seen, flagged=@flagged, answered=@answered, draft=@draft, attachment_count=@attachment_count,
        snippet=@snippet, body_text=@body_text, body_html=@body_html, search_text=@search_text,
        headers_json=@headers_json, fetched=@fetched
      WHERE id=@id`
    ).run(params)
  } else {
    db.prepare(
      `INSERT INTO messages (id, account_id, folder_id, uid, message_id, in_reply_to, subject,
        from_json, to_json, cc_json, bcc_json, date, size, seen, flagged, answered, draft,
        attachment_count, snippet, body_text, body_html, search_text, headers_json, fetched)
      VALUES (@id, @account_id, @folder_id, @uid, @message_id, @in_reply_to, @subject,
        @from_json, @to_json, @cc_json, @bcc_json, @date, @size, @seen, @flagged, @answered, @draft,
        @attachment_count, @snippet, @body_text, @body_html, @search_text, @headers_json, @fetched)`
    ).run(params)
  }
  return id
}

export function saveAttachments(messageId: string, attachments: Attachment[]): void {
  if (!attachments.length) return
  const db = getDb()
  db.prepare('DELETE FROM attachments WHERE message_id = ?').run(messageId)
  const stmt = db.prepare(
    `INSERT INTO attachments (id, message_id, filename, mime_type, size, path, content_id, inline)
     VALUES (@id, @message_id, @filename, @mime_type, @size, @path, @content_id, @inline)`
  )
  const tx = db.transaction((items: Attachment[]) => {
    for (const item of items) {
      stmt.run({
        id: item.id || generateId('att'),
        message_id: messageId,
        filename: item.filename,
        mime_type: item.mimeType,
        size: item.size,
        path: item.path,
        content_id: item.contentId,
        inline: item.inline ? 1 : 0
      })
    }
  })
  tx(attachments)
}

export function getAttachments(messageId: string): Attachment[] {
  const rows = getDb().prepare('SELECT * FROM attachments WHERE message_id = ?').all(messageId) as {
    id: string
    message_id: string
    filename: string
    mime_type: string
    size: number
    path: string
    content_id: string
    inline: number
  }[]
  return rows.map((r) => ({
    id: r.id,
    messageId: r.message_id,
    filename: r.filename,
    mimeType: r.mime_type,
    size: r.size,
    path: r.path,
    contentId: r.content_id,
    inline: r.inline === 1
  }))
}

export interface SearchFilters {
  text: string
  from: string
  to: string
  subject: string
  hasAttachment: boolean
  unread?: boolean
  flagged: boolean
  before: number
  after: number
  folderName: string
}

function parseDateValue(input: string): number {
  const normalized = input.replace(/\//g, '-')
  const time = Date.parse(normalized)
  return Number.isNaN(time) ? 0 : time
}

/** 解析高级搜索语法：from: to: subject: has:attachment is:unread before: after: in: */
export function parseSearchQuery(input: string): SearchFilters {
  const filters: SearchFilters = {
    text: '',
    from: '',
    to: '',
    subject: '',
    hasAttachment: false,
    flagged: false,
    before: 0,
    after: 0,
    folderName: ''
  }
  const tokens = input.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? []
  const rest: string[] = []
  for (const token of tokens) {
    const matched = token.match(/^(from|to|subject|has|is|before|after|in):(.+)$/i)
    if (!matched) {
      rest.push(token)
      continue
    }
    const key = matched[1].toLowerCase()
    const value = matched[2].replace(/^["']|["']$/g, '')
    switch (key) {
      case 'from':
        filters.from = value
        break
      case 'to':
        filters.to = value
        break
      case 'subject':
        filters.subject = value
        break
      case 'has':
        if (/attachment|附件/i.test(value)) filters.hasAttachment = true
        break
      case 'is':
        if (/^unread|未读/i.test(value)) filters.unread = true
        else if (/^read|已读/i.test(value)) filters.unread = false
        else if (/flag|star|星标/i.test(value)) filters.flagged = true
        break
      case 'before':
        filters.before = parseDateValue(value)
        break
      case 'after':
        filters.after = parseDateValue(value)
        break
      case 'in':
        filters.folderName = value
        break
      default:
        break
    }
  }
  filters.text = rest.join(' ').trim()
  return filters
}

export function listMessages(query: ListQuery): MessageSummary[] {
  const db = getDb()
  const where: string[] = ['m.id NOT IN (SELECT message_id FROM snoozed)']
  const params: unknown[] = []
  if (query.labelId) {
    where.push('m.id IN (SELECT message_id FROM message_labels WHERE label_id = ?)')
    params.push(query.labelId)
  }
  if (query.accountId) {
    where.push('m.account_id = ?')
    params.push(query.accountId)
  }
  if (query.folderId) {
    where.push('m.folder_id = ?')
    params.push(query.folderId)
  }
  if (query.unreadOnly) where.push('m.seen = 0')
  if (query.flaggedOnly) where.push('m.flagged = 1')
  if (query.withAttachmentsOnly) where.push('m.attachment_count > 0')
  if (query.search) {
    where.push('(m.subject LIKE ? OR m.snippet LIKE ? OR m.from_json LIKE ?)')
    const like = `%${query.search}%`
    params.push(like, like, like)
  }
  params.push(query.limit ?? 100, query.offset ?? 0)
  const rows = db
    .prepare(
      `SELECT * FROM messages m WHERE ${where.join(' AND ')} ORDER BY m.date DESC LIMIT ? OFFSET ?`
    )
    .all(...params) as MessageRow[]
  return rows.map(rowToSummary)
}

export function getMessageRow(id: string): MessageRow | null {
  return (getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id) as MessageRow | undefined) ?? null
}

export function getMessageSummary(id: string): MessageSummary | null {
  const row = getMessageRow(id)
  return row ? rowToSummary(row) : null
}

export function getMessage(id: string): Message | null {
  const row = getMessageRow(id)
  if (!row) return null
  return {
    ...rowToSummary(row),
    bodyText: row.body_text,
    bodyHtml: row.body_html,
    headers: parseJson<Record<string, string>>(row.headers_json, {}),
    attachments: getAttachments(id)
  }
}

export function setFlag(ids: string[], field: 'seen' | 'flagged' | 'answered', value: boolean): void {
  if (!ids.length) return
  const db = getDb()
  const stmt = db.prepare(`UPDATE messages SET ${field} = ? WHERE id = ?`)
  const tx = db.transaction(() => {
    for (const id of ids) stmt.run(value ? 1 : 0, id)
  })
  tx()
}

export function deleteMessages(ids: string[]): void {
  if (!ids.length) return
  const db = getDb()
  const tx = db.transaction(() => {
    for (const id of ids) {
      db.prepare('DELETE FROM attachments WHERE message_id = ?').run(id)
      db.prepare('DELETE FROM messages WHERE id = ?').run(id)
    }
  })
  tx()
}

export function deleteFolderMessages(folderId: string): void {
  const db = getDb()
  db.prepare('DELETE FROM attachments WHERE message_id IN (SELECT id FROM messages WHERE folder_id = ?)').run(folderId)
  db.prepare('DELETE FROM messages WHERE folder_id = ?').run(folderId)
}

export function moveMessages(ids: string[], targetFolderId: string): void {
  if (!ids.length) return
  const db = getDb()
  const stmt = db.prepare('UPDATE messages SET folder_id = ? WHERE id = ?')
  const tx = db.transaction(() => {
    for (const id of ids) stmt.run(targetFolderId, id)
  })
  tx()
}

export function refreshFolderStats(folderId: string): void {
  const db = getDb()
  const row = db
    .prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN seen = 0 THEN 1 ELSE 0 END) AS unread FROM messages WHERE folder_id = ?')
    .get(folderId) as { total: number; unread: number | null }
  db.prepare('UPDATE folders SET total = ?, unread = ? WHERE id = ?').run(row.total, row.unread ?? 0, folderId)
}

function buildMatchExpression(input: string): string {
  const tokens = toSearchText(input)
    .split(/\s+/)
    .map((t) => t.replace(/"/g, ''))
    .filter(Boolean)
  if (!tokens.length) return ''
  return tokens.map((t) => `"${t}"`).join(' AND ')
}

export function searchMessages(query: SearchQuery): SearchHit[] {
  const filters = parseSearchQuery(query.query)
  const match = buildMatchExpression(filters.text)
  const db = getDb()
  const where: string[] = []
  const params: unknown[] = []
  if (match) {
    where.push('messages_fts MATCH ?')
    params.push(match)
  }
  if (query.accountId) {
    where.push('m.account_id = ?')
    params.push(query.accountId)
  }
  if (query.folderId) {
    where.push('m.folder_id = ?')
    params.push(query.folderId)
  }
  if (filters.from) {
    where.push('m.from_json LIKE ?')
    params.push(`%${filters.from}%`)
  }
  if (filters.to) {
    where.push('(m.to_json LIKE ? OR m.cc_json LIKE ?)')
    params.push(`%${filters.to}%`, `%${filters.to}%`)
  }
  if (filters.subject) {
    where.push('m.subject LIKE ?')
    params.push(`%${filters.subject}%`)
  }
  if (filters.hasAttachment) {
    where.push('m.attachment_count > 0')
  }
  if (filters.unread !== undefined) {
    where.push('m.seen = ?')
    params.push(filters.unread ? 0 : 1)
  }
  if (filters.flagged) {
    where.push('m.flagged = 1')
  }
  if (filters.before) {
    where.push('m.date <= ?')
    params.push(filters.before)
  }
  if (filters.after) {
    where.push('m.date >= ?')
    params.push(filters.after)
  }
  if (filters.folderName) {
    where.push('f.name LIKE ?')
    params.push(`%${filters.folderName}%`)
  }
  if (!where.length) return []
  params.push(query.limit ?? 100)
  const rows = db
    .prepare(
      `SELECT m.*, a.name AS account_name, a.color AS account_color, f.name AS folder_name
       FROM messages_fts
       JOIN messages m ON m.rowid = messages_fts.rowid
       JOIN accounts a ON a.id = m.account_id
       JOIN folders f ON f.id = m.folder_id
       WHERE ${where.join(' AND ')}
       ORDER BY m.date DESC LIMIT ?`
    )
    .all(...params) as (MessageRow & { account_name: string; account_color: string; folder_name: string })[]
  return rows.map((row) => ({
    ...rowToSummary(row),
    accountName: row.account_name,
    accountColor: row.account_color,
    folderName: row.folder_name
  }))
}

export function countUnread(accountId: string): number {
  const row = getDb()
    .prepare('SELECT SUM(CASE WHEN seen = 0 THEN 1 ELSE 0 END) AS unread FROM messages WHERE account_id = ?')
    .get(accountId) as { unread: number | null }
  return row.unread ?? 0
}
