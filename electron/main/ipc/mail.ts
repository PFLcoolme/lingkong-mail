import { app, BrowserWindow, dialog, shell } from 'electron'
import { copyFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

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
import { getDb } from '../services/db'
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
