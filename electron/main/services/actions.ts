import type { Message } from '@shared/types'
import { getAccount, getAccountRow, getSecrets, resolveAccessToken } from './accounts'
import { getFolderById, listFolders, makeFolderId } from './folders'
import { getMessage, getMessageRow, moveMessages as moveLocal, setFlag, deleteMessages } from './messages'
import { createImapClient, deleteMessagesRemote, fetchMessageSource, moveMessages, updateFlags } from './imap'
import { ewsClientFor } from './sync'
import { parseMessage } from './mail-parse'
import { getAttachmentsDir, getDb } from './db'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { refreshFolderStats, saveAttachments, upsertMessage } from './messages'
import type { Attachment } from '@shared/types'

interface Target {
  accountId: string
  folderId: string
  uid: number
  messageId: string
}

function targetsOf(ids: string[]): Target[] {
  return ids
    .map((id) => {
      const row = getMessageRow(id)
      return row
        ? {
            accountId: row.account_id,
            folderId: row.folder_id,
            uid: row.uid,
            messageId: row.id
          }
        : null
    })
    .filter((t): t is Target => Boolean(t))
}

function groupByAccountFolder(targets: Target[]): Map<string, Target[]> {
  const map = new Map<string, Target[]>()
  for (const target of targets) {
    const key = `${target.accountId}::${target.folderId}`
    const list = map.get(key) ?? []
    list.push(target)
    map.set(key, list)
  }
  return map
}

/** 按需下载邮件正文与附件 */
export async function fetchMessageBody(messageId: string): Promise<Message | null> {
  const row = getMessageRow(messageId)
  if (!row) return null
  if (row.fetched === 1 && (row.body_text || row.body_html)) return getMessage(messageId)

  const account = getAccount(row.account_id)
  const folder = getFolderById(row.folder_id)
  if (!account || !folder) return getMessage(messageId)

  if (account.protocol === 'imap') {
    const secrets = getSecrets(getAccountRow(account.id) as NonNullable<ReturnType<typeof getAccountRow>>)
    const accessToken = account.authType === 'oauth2' ? await resolveAccessToken(account.id) : ''
    const client = await createImapClient(
      account.incoming,
      { user: account.incoming.username || account.email, password: secrets.password, accessToken },
      account.authType === 'oauth2'
    )
    try {
      const source = await fetchMessageSource(client, folder.path, row.uid)
      const payload = await parseMessage(messageId, source)
      upsertMessage({
        accountId: account.id,
        folderId: folder.id,
        uid: row.uid,
        subject: payload.subject,
        from: payload.from,
        to: payload.to,
        cc: payload.cc,
        date: payload.date,
        size: row.size,
        seen: row.seen === 1,
        flagged: row.flagged === 1,
        answered: row.answered === 1,
        draft: row.draft === 1,
        attachmentCount: payload.attachments.length,
        snippet: payload.snippet,
        bodyText: payload.bodyText,
        bodyHtml: payload.bodyHtml,
        headers: payload.headers
      })
      saveAttachments(messageId, payload.attachments)
      return getMessage(messageId)
    } finally {
      await client.logout().catch(() => undefined)
    }
  }

  if (account.protocol === 'ews') {
    const headers = JSON.parse(row.headers_json) as Record<string, string>
    const itemId = headers['x-ews-itemid']
    const changeKey = headers['x-ews-changekey']
    if (!itemId) return getMessage(messageId)
    const client = ewsClientFor(account)
    const items = await client.getItems([{ id: itemId, changeKey }])
    const item = items[0]
    if (!item) return getMessage(messageId)
    const attachments: Attachment[] = []
    if (item.attachments.length) {
      const dir = join(getAttachmentsDir(), messageId.replace(/[^a-zA-Z0-9_-]/g, '_'))
      mkdirSync(dir, { recursive: true })
      for (const ref of item.attachments) {
        try {
          const data = await client.getAttachment(ref.id)
          const path = join(dir, ref.name || `attachment-${ref.id}`)
          writeFileSync(path, data.content)
          attachments.push({
            id: `att_${ref.id}`.slice(0, 60),
            messageId,
            filename: ref.name,
            mimeType: ref.mimeType,
            size: data.content.length,
            path,
            contentId: ref.contentId,
            inline: ref.inline
          })
        } catch (error) {
          console.warn('[EWS] 附件下载失败', error)
        }
      }
    }
    upsertMessage({
      accountId: account.id,
      folderId: folder.id,
      uid: row.uid,
      subject: item.subject,
      from: [{ name: item.fromName || item.fromAddress, address: item.fromAddress }],
      to: item.to.map((address) => ({ address })),
      cc: item.cc.map((address) => ({ address })),
      date: item.date,
      size: item.size,
      seen: item.isRead,
      attachmentCount: attachments.length,
      snippet: item.bodyText.slice(0, 200),
      bodyText: item.bodyText,
      bodyHtml: item.bodyHtml,
      headers
    })
    if (attachments.length) saveAttachments(messageId, attachments)
    return getMessage(messageId)
  }

  return getMessage(messageId)
}

export async function markSeen(ids: string[], seen: boolean): Promise<void> {
  const targets = targetsOf(ids)
  setFlag(ids, 'seen', seen)
  for (const [key, list] of groupByAccountFolder(targets)) {
    const [accountId, folderId] = key.split('::')
    const account = getAccount(accountId)
    const folder = getFolderById(folderId)
    if (!account || !folder) continue
    try {
      if (account.protocol === 'imap') {
        const secrets = getSecrets(getAccountRow(accountId) as NonNullable<ReturnType<typeof getAccountRow>>)
        const accessToken = account.authType === 'oauth2' ? await resolveAccessToken(accountId) : ''
        const client = await createImapClient(
          account.incoming,
          { user: account.incoming.username || account.email, password: secrets.password, accessToken },
          account.authType === 'oauth2'
        )
        try {
          await updateFlags(client, folder.path, list.map((t) => t.uid), ['\\Seen'], seen ? 'add' : 'remove')
        } finally {
          await client.logout().catch(() => undefined)
        }
      } else if (account.protocol === 'ews') {
        const client = ewsClientFor(account)
        for (const target of list) {
          const headers = (JSON.parse(getMessageRow(target.messageId)?.headers_json ?? '{}') as Record<string, string>)
          if (headers['x-ews-itemid']) {
            await client.setRead({ id: headers['x-ews-itemid'], changeKey: headers['x-ews-changekey'] ?? '' }, seen)
          }
        }
      }
    } catch (error) {
      console.warn('[标记已读] 远程操作失败', error)
    }
    refreshFolderStats(folderId)
  }
}

export async function toggleFlag(ids: string[], flagged: boolean): Promise<void> {
  const targets = targetsOf(ids)
  setFlag(ids, 'flagged', flagged)
  for (const [key, list] of groupByAccountFolder(targets)) {
    const [accountId, folderId] = key.split('::')
    const account = getAccount(accountId)
    const folder = getFolderById(folderId)
    if (!account || !folder || account.protocol !== 'imap') continue
    try {
      const secrets = getSecrets(getAccountRow(accountId) as NonNullable<ReturnType<typeof getAccountRow>>)
      const accessToken = account.authType === 'oauth2' ? await resolveAccessToken(accountId) : ''
      const client = await createImapClient(
        account.incoming,
        { user: account.incoming.username || account.email, password: secrets.password, accessToken },
        account.authType === 'oauth2'
      )
      try {
        await updateFlags(client, folder.path, list.map((t) => t.uid), ['\\Flagged'], flagged ? 'add' : 'remove')
      } finally {
        await client.logout().catch(() => undefined)
      }
    } catch (error) {
      console.warn('[标记星标] 远程操作失败', error)
    }
    refreshFolderStats(folderId)
  }
}

export async function moveToFolder(ids: string[], targetPath: string): Promise<void> {
  const targets = targetsOf(ids)
  for (const [key, list] of groupByAccountFolder(targets)) {
    const [accountId, folderId] = key.split('::')
    const account = getAccount(accountId)
    const folder = getFolderById(folderId)
    const targetFolder = listFolders(accountId).find((f) => f.path === targetPath)
    if (!account || !folder || !targetFolder) continue
    try {
      if (account.protocol === 'imap') {
        const secrets = getSecrets(getAccountRow(accountId) as NonNullable<ReturnType<typeof getAccountRow>>)
        const accessToken = account.authType === 'oauth2' ? await resolveAccessToken(accountId) : ''
        const client = await createImapClient(
          account.incoming,
          { user: account.incoming.username || account.email, password: secrets.password, accessToken },
          account.authType === 'oauth2'
        )
        try {
          await moveMessages(client, folder.path, list.map((t) => t.uid), targetPath)
        } finally {
          await client.logout().catch(() => undefined)
        }
      } else if (account.protocol === 'ews') {
        const client = ewsClientFor(account)
        for (const target of list) {
          const headers = (JSON.parse(getMessageRow(target.messageId)?.headers_json ?? '{}') as Record<string, string>)
          if (headers['x-ews-itemid']) {
            await client.moveItem({ id: headers['x-ews-itemid'], changeKey: headers['x-ews-changekey'] ?? '' }, targetFolder.path)
          }
        }
      }
    } catch (error) {
      console.warn('[移动邮件] 远程操作失败', error)
      throw error
    }
    moveLocal(list.map((t) => t.messageId), targetFolder.id)
    refreshFolderStats(folderId)
    refreshFolderStats(targetFolder.id)
  }
}

export async function removeMessages(ids: string[]): Promise<void> {
  const targets = targetsOf(ids)
  for (const [key, list] of groupByAccountFolder(targets)) {
    const [accountId, folderId] = key.split('::')
    const account = getAccount(accountId)
    const folder = getFolderById(folderId)
    if (!account || !folder) continue
    const trash = listFolders(accountId).find((f) => f.type === 'trash')
    try {
      if (folder.type === 'trash' || !trash) {
        if (account.protocol === 'imap') {
          const secrets = getSecrets(getAccountRow(accountId) as NonNullable<ReturnType<typeof getAccountRow>>)
          const accessToken = account.authType === 'oauth2' ? await resolveAccessToken(accountId) : ''
          const client = await createImapClient(
            account.incoming,
            { user: account.incoming.username || account.email, password: secrets.password, accessToken },
            account.authType === 'oauth2'
          )
          try {
            await deleteMessagesRemote(client, folder.path, list.map((t) => t.uid))
          } finally {
            await client.logout().catch(() => undefined)
          }
        } else if (account.protocol === 'ews') {
          const client = ewsClientFor(account)
          for (const target of list) {
            const headers = (JSON.parse(getMessageRow(target.messageId)?.headers_json ?? '{}') as Record<string, string>)
            if (headers['x-ews-itemid']) {
              await client.deleteItem({ id: headers['x-ews-itemid'], changeKey: headers['x-ews-changekey'] ?? '' })
            }
          }
        }
        deleteMessages(list.map((t) => t.messageId))
      } else {
        await moveToFolder(list.map((t) => t.messageId), trash.path)
      }
    } catch (error) {
      console.warn('[删除邮件] 远程操作失败', error)
      throw error
    }
    refreshFolderStats(folderId)
  }
}

export function messageFolderId(messageId: string): string | null {
  return getMessageRow(messageId)?.folder_id ?? null
}

export function folderIdOf(accountId: string, path: string): string {
  return makeFolderId(accountId, path)
}

export function dbInstance() {
  return getDb()
}
