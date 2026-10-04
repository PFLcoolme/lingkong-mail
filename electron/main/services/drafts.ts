import type { Draft, DraftSyncState } from '@shared/types'
import { generateId, getDb, now, parseJson } from './db'

interface DraftRow {
  id: string
  account_id: string
  to_text: string
  cc_text: string
  bcc_text: string
  subject: string
  body_text: string
  body_html: string
  in_reply_to: string
  references: string
  reply_folder_id: string
  reply_uid: number
  attachments_json: string
  updated_at: number
  server_uid: number
  server_folder_id: string
  sync_state: string
  synced_at: number
}

function rowToDraft(row: DraftRow): Draft {
  const stored = parseJson<{ attachments?: string[]; forward?: string[] }>(row.attachments_json, {})
  return {
    id: row.id,
    accountId: row.account_id,
    to: row.to_text,
    cc: row.cc_text,
    bcc: row.bcc_text,
    subject: row.subject,
    bodyText: row.body_text,
    bodyHtml: row.body_html,
    inReplyTo: row.in_reply_to,
    references: row.references,
    replyFolderId: row.reply_folder_id,
    replyUid: row.reply_uid,
    attachments: stored.attachments ?? [],
    forwardAttachments: stored.forward ?? [],
    updatedAt: row.updated_at,
    serverUid: row.server_uid ?? 0,
    serverFolderId: row.server_folder_id ?? '',
    syncState: (row.sync_state as DraftSyncState) || 'none',
    syncedAt: row.synced_at ?? 0
  }
}

export function listDrafts(accountId?: string): Draft[] {
  const db = getDb()
  const rows = accountId
    ? (db.prepare('SELECT * FROM drafts WHERE account_id = ? ORDER BY updated_at DESC').all(accountId) as DraftRow[])
    : (db.prepare('SELECT * FROM drafts ORDER BY updated_at DESC').all() as DraftRow[])
  return rows.map(rowToDraft)
}

export function getDraft(id: string): Draft | null {
  const row = getDb().prepare('SELECT * FROM drafts WHERE id = ?').get(id) as DraftRow | undefined
  return row ? rowToDraft(row) : null
}

export function saveDraft(draft: Partial<Draft>): Draft {
  const db = getDb()
  const id = draft.id || generateId('draft')
  const params = {
    id,
    account_id: draft.accountId ?? '',
    to_text: draft.to ?? '',
    cc_text: draft.cc ?? '',
    bcc_text: draft.bcc ?? '',
    subject: draft.subject ?? '',
    body_text: draft.bodyText ?? '',
    body_html: draft.bodyHtml ?? '',
    in_reply_to: draft.inReplyTo ?? '',
    references: draft.references ?? '',
    reply_folder_id: draft.replyFolderId ?? '',
    reply_uid: draft.replyUid ?? 0,
    attachments_json: JSON.stringify({
      attachments: draft.attachments ?? [],
      forward: draft.forwardAttachments ?? []
    }),
    updated_at: now()
  }
  const exists = db.prepare('SELECT id FROM drafts WHERE id = ?').get(id)
  if (exists) {
    db.prepare(
      `UPDATE drafts SET account_id=@account_id, to_text=@to_text, cc_text=@cc_text, bcc_text=@bcc_text,
        subject=@subject, body_text=@body_text, body_html=@body_html, in_reply_to=@in_reply_to,
        "references"=@references, reply_folder_id=@reply_folder_id, reply_uid=@reply_uid,
        attachments_json=@attachments_json, updated_at=@updated_at,
        sync_state = CASE WHEN sync_state = 'synced' THEN 'pending' ELSE sync_state END
        WHERE id=@id`
    ).run(params)
  } else {
    db.prepare(
      `INSERT INTO drafts (id, account_id, to_text, cc_text, bcc_text, subject, body_text, body_html,
        in_reply_to, "references", reply_folder_id, reply_uid, attachments_json, updated_at)
      VALUES (@id, @account_id, @to_text, @cc_text, @bcc_text, @subject, @body_text, @body_html,
        @in_reply_to, @references, @reply_folder_id, @reply_uid, @attachments_json, @updated_at)`
    ).run(params)
  }
  return rowToDraft(db.prepare('SELECT * FROM drafts WHERE id = ?').get(id) as DraftRow)
}

export function deleteDraft(id: string): void {
  getDb().prepare('DELETE FROM drafts WHERE id = ?').run(id)
}

/** 更新草稿与服务器的同步状态 */
export function setDraftSync(
  id: string,
  patch: { state: DraftSyncState; serverUid?: number; serverFolderId?: string; syncedAt?: number }
): void {
  getDb()
    .prepare(
      `UPDATE drafts SET sync_state = @state,
        server_uid = COALESCE(@serverUid, server_uid),
        server_folder_id = COALESCE(@serverFolderId, server_folder_id),
        synced_at = COALESCE(@syncedAt, synced_at)
      WHERE id = @id`
    )
    .run({
      id,
      state: patch.state,
      serverUid: patch.serverUid ?? null,
      serverFolderId: patch.serverFolderId ?? null,
      syncedAt: patch.syncedAt ?? null
    })
}
