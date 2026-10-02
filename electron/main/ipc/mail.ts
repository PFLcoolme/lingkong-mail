import { BrowserWindow, dialog, shell } from 'electron'
import { copyFileSync } from 'node:fs'
import { basename } from 'node:path'
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
    const window = BrowserWindow.getFocusedWindow()
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
    const window = BrowserWindow.getFocusedWindow()
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

  handle('mail:send', async (_event, payload: SendPayload) => {
    const account = getAccount(payload.accountId)
    if (!account) throw new Error('账户不存在')
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
    return true
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
}
