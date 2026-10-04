import { app, BrowserWindow, dialog, shell } from 'electron'
import { copyFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

function attachmentKind(mime: string, filename: string): string {
  const ext = (filename.split('.').pop() ?? '').toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (/^(zip|rar|7z|tar|gz|bz2|xz)$/.test(ext) || /zip|compressed/.test(mime)) return 'archive'
  if (/^(docx?|xlsx?|pptx?|csv|txt|md|rtf)$/.test(ext)) return 'doc'
  if (mime.startsWith('video/') || /^(mp4|mkv|avi|mov)$/.test(ext)) return 'video'
  if (mime.startsWith('audio/') || /^(mp3|wav|flac|m4a)$/.test(ext)) return 'audio'
  return 'other'
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}
import type { Draft, ListQuery, SearchQuery, SendPayload } from '@shared/types'
import { handle } from './common'
import { getAccount, getAccountRow, getSecrets } from '../services/accounts'
import {
  deleteMessages,
  getMessage,
  getMessageSummary,
  listMessages,
  refreshFolderStats,
  searchMessages
} from '../services/messages'
import { deleteDraft, listDrafts, saveDraft } from '../services/drafts'
import { fetchMessageBody, markSeen, moveToFolder, removeMessages, toggleFlag } from '../services/actions'
import { syncAccount, syncFolder, ewsClientFor } from '../services/sync'
import { appendToSent, buildRawMessage, sendMail } from '../services/smtp'
import { getDb, parseJson } from '../services/db'
import { recordAddresses } from '../services/contacts'
import { getAttPath } from '../services/attachment-lookup'
import { buildEml, emlFilename } from '../services/eml'
import { enqueue, listOutbox, removeOutboxItem } from '../services/outbox'
import { listSnoozed, snoozeMessage, wakeMessage } from '../services/snooze'
import { deleteSavedSearch, listSavedSearches, saveSavedSearch } from '../services/saved-searches'
import { emit } from '../services/sync'
import { deliverOutboxItem } from '../scheduler'
import { getMainWindow } from '../window'
import { DEFAULT_SETTINGS as DEFAULTS } from '../settings-defaults'
import { settingsGet } from '../services/accounts'

export function registerMailHandlers(): void {
  handle('messages:list', async (_event, query: ListQuery) => listMessages(query))

  handle('message:get', async (_event, id: string) => {
    const message = await fetchMessageBody(id)
    return message ?? getMessage(id)
  })

  handle('messages:sync', async (_event, accountId: string, folderId: string, full?: boolean) => {
    const fetched = folderId ? await syncFolder(accountId, folderId, full) : await syncAccount(accountId, { full })
    return fetched
  })

  handle('messages:mark-seen', async (_event, ids: string[], seen: boolean) => {
    await markSeen(ids, seen)
    return true
  })

  handle('messages:flag', async (_event, ids: string[], flagged: boolean) => {
    await toggleFlag(ids, flagged)
    return true
  })

  handle('messages:move', async (_event, ids: string[], targetFolderPath: string) => {
    await moveToFolder(ids, targetFolderPath)
    return true
  })

  handle('messages:delete', async (_event, ids: string[]) => {
    await removeMessages(ids)
    return true
  })

  handle('attachments:pick', async () => {
    const window = getMainWindow()
    const result = window
      ? await dialog.showOpenDialog(window, { properties: ['openFile', 'multiSelections'] })
      : await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
    if (result.canceled) return []
    return result.filePaths.map((path) => ({
      filename: basename(path),
      path,
      size: 0,
      mimeType: ''
    }))
  })

  handle('attachment:save-as', async (_event, attachmentId: string) => {
    const path = getAttPath(attachmentId)
    if (!path) return null
    const window = getMainWindow()
    const result = window
      ? await dialog.showSaveDialog(window, { defaultPath: basename(path) })
      : await dialog.showSaveDialog({ defaultPath: basename(path) })
    if (result.canceled || !result.filePath) return null
    copyFileSync(path, result.filePath)
    return result.filePath
  })

  handle('attachment:open', async (_event, attachmentId: string) => {
    const path = getAttPath(attachmentId)
    if (path) await shell.openPath(path)
    return true
  })

  handle(
    'mail:send',
    async (
      _event,
      payload: SendPayload,
      options?: { delaySeconds?: number; scheduledAt?: number }
    ) => {
    const account = getAccount(payload.accountId)
    if (!account) throw new Error('账户不存在')
    const settings = { ...DEFAULTS, ...settingsGet<Partial<typeof DEFAULTS>>('app', {}) }
    const sendAt =
      options?.scheduledAt ??
      (typeof options?.delaySeconds === 'number'
        ? Date.now() + options.delaySeconds * 1000
        : settings.sendDelaySeconds > 0
          ? Date.now() + settings.sendDelaySeconds * 1000
          : 0)

    if (sendAt - Date.now() > 1500) {
      const item = enqueue(payload.accountId, payload, sendAt)
      emit({
        type: 'toast',
        payload: {
          level: 'info',
          message: `邮件已排队，将在 ${new Date(sendAt).toLocaleString()} 发送`
        }
      })
      return { scheduled: true, id: item.id, sendAt }
    }

    const row = getAccountRow(account.id)
    if (!row) throw new Error('账户不存在')
    const secrets = getSecrets(row)
    if (account.protocol === 'ews') {
      const client = ewsClientFor(account)
      await client.sendMessage(payload, account.email)
    } else {
      const messageId = await sendMail(account, secrets, payload)
      if (payload.saveToSent !== false) {
        await appendToSent(account, secrets, buildRawMessage(account, payload, messageId || `<${Date.now()}@kongling.local>`))
      }
    }
    recordAddresses(
      account.id,
      [...payload.to, ...payload.cc].map((address) => ({ address }))
    )
    void syncAccount(account.id).catch(() => undefined)
    return { scheduled: false }
  })

  handle('drafts:list', async (_event, accountId: string) => listDrafts(accountId))

  handle('draft:save', async (_event, draft: Partial<Draft>) => saveDraft(draft))

  handle('draft:delete', async (_event, id: string) => {
    deleteDraft(id)
    return true
  })

  handle('search', async (_event, query: SearchQuery) => searchMessages(query))

  handle('messages:count', async (_event, folderId: string) => {
    const row = getDb().prepare('SELECT COUNT(*) AS c FROM messages WHERE folder_id = ?').get(folderId) as { c: number }
    return row.c
  })

  handle('message:summary', async (_event, id: string) => getMessageSummary(id))

  handle('folder:refresh-stats', async (_event, folderId: string) => {
    refreshFolderStats(folderId)
    return true
  })

  handle('messages:local-delete', async (_event, ids: string[]) => {
    deleteMessages(ids)
    return true
  })

  handle('messages:export', async (_event, ids: string[]) => {
    const window = getMainWindow()
    const result = window
      ? await dialog.showOpenDialog(window, { properties: ['openDirectory'], title: '选择导出目录' })
      : await dialog.showOpenDialog({ properties: ['openDirectory'], title: '选择导出目录' })
    if (result.canceled || !result.filePaths.length) return null
    const dir = result.filePaths[0]
    let count = 0
    for (const index of ids.keys()) {
      const id = ids[index]
      const message = getMessage(id)
      if (!message) continue
      const name = emlFilename(message).replace(/\.eml$/, '')
      const target = join(dir, `${String(count + 1).padStart(3, '0')}-${name}.eml`)
      writeFileSync(target, buildEml(message), 'utf8')
      count += 1
    }
    return { dir, count }
  })

  handle('message:print', async (_event, id: string) => {
    const message = getMessage(id)
    if (!message) return false
    const body = message.bodyHtml
      ? message.bodyHtml
      : `<pre style="font-family:system-ui;font-size:14px;white-space:pre-wrap">${escapeHtml(message.bodyText)}</pre>`
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
      message.subject
    )}</title><style>body{font-family:'Noto Sans SC',system-ui,sans-serif;margin:32px;line-height:1.7}img{max-width:100%}</style></head><body><h2>${escapeHtml(
      message.subject
    )}</h2><p style="color:#666;font-size:12px">${escapeHtml(
      message.from.map((a) => a.address).join(', ')
    )} · ${new Date(message.date).toLocaleString()}</p><hr/>${body}</body></html>`
    const tempFile = join(app.getPath('temp'), `kongling-print-${Date.now()}.html`)
    writeFileSync(tempFile, html, 'utf8')
    const printWindow = new BrowserWindow({ show: false, width: 900, height: 1200 })
    try {
      await printWindow.loadFile(tempFile)
      await new Promise<void>((resolve) => {
        printWindow.webContents.print({ printBackground: true }, () => resolve())
      })
      return true
    } finally {
      printWindow.close()
    }
  })

  handle('outbox:list', () => listOutbox())

  handle('outbox:cancel', async (_event, id: string) => {
    removeOutboxItem(id)
    emit({ type: 'toast', payload: { level: 'info', message: '已取消发送' } })
    return true
  })

  handle('outbox:send-now', async (_event, id: string) => {
    await deliverOutboxItem(id)
    return true
  })

  handle('snooze:list', () => listSnoozed())

  handle(
    'snooze:add',
    async (
      _event,
      input: { messageId: string; accountId: string; folderId: string; wakeAt: number }
    ) => {
      snoozeMessage(input.messageId, input.accountId, input.folderId, input.wakeAt)
      emit({
        type: 'messages-changed',
        payload: { accountId: input.accountId, folderId: input.folderId }
      })
      return true
    }
  )

  handle('snooze:wake', async (_event, messageId: string) => {
    wakeMessage(messageId)
    emit({ type: 'messages-changed', payload: { accountId: '', folderId: '' } })
    return true
  })

  handle('searches:list', () => listSavedSearches())

  handle(
    'search:save',
    async (_event, search: { id?: string; name: string; query: string }) =>
      saveSavedSearch(search)
  )

  handle('search:delete', async (_event, id: string) => {
    deleteSavedSearch(id)
    return true
  })

  handle('attachments:all', async (_event, limit = 400) => {
    const rows = getDb()
      .prepare(
        `SELECT a.id, a.message_id, a.filename, a.mime_type, a.size, a.path, a.inline,
                m.subject, m.from_json, m.date, m.account_id, m.folder_id
         FROM attachments a
         JOIN messages m ON m.id = a.message_id
         WHERE a.inline = 0
         ORDER BY m.date DESC
         LIMIT ?`
      )
      .all(limit) as {
      id: string
      message_id: string
      filename: string
      mime_type: string
      size: number
      path: string
      inline: number
      subject: string
      from_json: string
      date: number
      account_id: string
      folder_id: string
    }[]
    return rows.map((row) => ({
      id: row.id,
      messageId: row.message_id,
      filename: row.filename,
      mimeType: row.mime_type,
      size: row.size,
      path: row.path,
      inline: row.inline === 1,
      kind: attachmentKind(row.mime_type, row.filename),
      subject: row.subject,
      from: parseJson<{ name?: string; address: string }[]>(row.from_json, [])[0]?.address ?? '',
      date: row.date,
      accountId: row.account_id,
      folderId: row.folder_id
    }))
  })

  handle('stats:overview', async () => {
    const db = getDb()
    const one = (sql: string, ...args: unknown[]): number => {
      const row = db.prepare(sql).get(...args) as { c: number } | undefined
      return row?.c ?? 0
    }
    const total = one('SELECT COUNT(*) AS c FROM messages')
    const unread = one('SELECT COUNT(*) AS c FROM messages WHERE seen = 0')
    const withAttachments = one('SELECT COUNT(*) AS c FROM messages WHERE attachment_count > 0')
    const accounts = one('SELECT COUNT(*) AS c FROM accounts WHERE enabled = 1')

    const dayMs = 86400000
    const seriesQuery = (folderType: string): { day: number; count: number }[] => {
      const rows = db
        .prepare(
          `SELECT (m.date / ${dayMs}) AS day, COUNT(*) AS count
           FROM messages m JOIN folders f ON f.id = m.folder_id
           WHERE f.type = ?
           GROUP BY day ORDER BY day DESC LIMIT 30`
        )
        .all(folderType) as { day: number; count: number }[]
      return rows.reverse()
    }

    const recent = db
      .prepare('SELECT from_json, account_id FROM messages ORDER BY date DESC LIMIT 600')
      .all() as { from_json: string; account_id: string }[]
    const senderMap = new Map<string, number>()
    for (const row of recent) {
      const list = parseJson<{ name?: string; address: string }[]>(row.from_json, [])
      const address = list[0]?.address
      if (!address) continue
      senderMap.set(address, (senderMap.get(address) ?? 0) + 1)
    }
    const topSenders = [...senderMap.entries()]
      .map(([address, count]) => ({ address, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    const perAccount = db
      .prepare(
        `SELECT a.id, a.name, a.color, COUNT(m.id) AS total,
                SUM(CASE WHEN m.seen = 0 THEN 1 ELSE 0 END) AS unread
         FROM accounts a LEFT JOIN messages m ON m.account_id = a.id
         GROUP BY a.id`
      )
      .all() as { id: string; name: string; color: string; total: number; unread: number }[]

    return {
      total,
      unread,
      withAttachments,
      accounts,
      received: seriesQuery('inbox'),
      sent: seriesQuery('sent'),
      topSenders,
      perAccount
    }
  })

  handle('message:export', async (_event, id: string) => {
    const message = getMessage(id)
    if (!message) return null
    const content = buildEml(message)
    const window = getMainWindow()
    const result = window
      ? await dialog.showSaveDialog(window, {
          defaultPath: emlFilename(message),
          filters: [{ name: '邮件文件', extensions: ['eml'] }]
        })
      : await dialog.showSaveDialog({
          defaultPath: emlFilename(message),
          filters: [{ name: '邮件文件', extensions: ['eml'] }]
        })
    if (result.canceled || !result.filePath) return null
    writeFileSync(result.filePath, content, 'utf8')
    return result.filePath
  })
}
