import type { ImapFlow } from 'imapflow'
import type { Account, Folder, MainEvent, MessageSummary } from '@shared/types'
import {
  getAccount,
  getAccountRow,
  getSecrets,
  guessFolderType,
  listAccounts,
  resolveAccessToken,
  setAccountStatus,
  settingsGet
} from './accounts'
import { recordAddresses } from './contacts'
import { getDb, now } from './db'
import { EwsClient } from './ews'
import {
  deleteFolderMessages,
  deleteMessages,
  getMessageSummary,
  moveMessages as moveLocalMessages,
  refreshFolderStats,
  saveAttachments,
  setFlag,
  upsertMessage
} from './messages'
import {
  createImapClient,
  fetchFolders,
  fetchRemoteUids,
  fetchSummaries,
  getMailboxStatus,
  moveMessages
} from './imap'
import { getFolderById, listFolders, makeFolderId, updateFolderSync, upsertFolder } from './folders'
import { Pop3Client } from './pop3'
import { applyRules } from './rules'
import { buildSnippet, parseMessage, parseRawMail } from './mail-parse'
import { showNewMailNotification } from './notify'

type Sink = (event: MainEvent) => void

let sink: Sink = () => {}
const running = new Map<string, Promise<number>>()

export function setEventSink(fn: Sink): void {
  sink = fn
}

export function emit(event: MainEvent): void {
  try {
    sink(event)
  } catch (error) {
    console.error('[事件] 推送失败', error)
  }
}

function reportState(
  accountId: string,
  folderId: string,
  state: { running: boolean; progress?: number; message?: string; fetched?: number }
): void {
  sink({
    type: 'sync-state',
    payload: {
      accountId,
      folderId,
      running: state.running,
      progress: state.progress ?? 0,
      message: state.message ?? '',
      fetched: state.fetched ?? 0
    }
  })
}

async function clientFor(account: Account): Promise<ImapFlow> {
  const row = getAccountRow(account.id)
  if (!row) throw new Error('账户不存在')
  const secrets = getSecrets(row)
  const accessToken = account.authType === 'oauth2' ? await resolveAccessToken(account.id) : ''
  return createImapClient(
    account.incoming,
    { user: account.incoming.username || account.email, password: secrets.password, accessToken },
    account.authType === 'oauth2'
  )
}

export function ewsClientFor(account: Account): EwsClient {
  const row = getAccountRow(account.id)
  if (!row) throw new Error('账户不存在')
  const secrets = getSecrets(row)
  return new EwsClient({
    url: account.ewsUrl,
    username: account.incoming.username || account.email,
    password: secrets.password,
    accessToken: ''
  })
}

/** 同步整个账户（文件夹 + 邮件） */
export async function syncAccount(accountId: string, options: { full?: boolean } = {}): Promise<number> {
  const pending = running.get(accountId)
  if (pending) return pending
  const task = (async () => {
    const account = getAccount(accountId)
    if (!account || !account.enabled) return 0
    setAccountStatus(accountId, 'connecting')
    try {
      if (account.protocol === 'imap') return await syncImapAccount(account, options.full)
      if (account.protocol === 'pop3') return await syncPop3Account(account)
      return await syncEwsAccount(account)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setAccountStatus(accountId, /auth|login|credential|密码|授权|invalid/i.test(message) ? 'auth-error' : 'error', message)
      emit({ type: 'toast', payload: { level: 'error', message: `同步 ${account.name} 失败：${message}` } })
      throw error
    } finally {
      setAccountStatus(accountId, 'ready')
      emit({ type: 'folders-changed', payload: { accountId } })
    }
  })()
  running.set(accountId, task)
  try {
    return await task
  } finally {
    running.delete(accountId)
  }
}

async function syncImapAccount(account: Account, full = false): Promise<number> {
  const client = await clientFor(account)
  let total = 0
  try {
    const remote = await fetchFolders(client)
    for (const item of remote) {
      if (item.flags.includes('\\Noselect')) continue
      upsertFolder({
        accountId: account.id,
        path: item.path,
        name: item.name,
        delimiter: item.delimiter,
        type: guessFolderType(item.path, item.specialUse)
      })
    }
    const folders = listFolders(account.id)
    const targets = full ? folders : folders.filter((f) => f.type !== 'other' || f.syncedAt === 0)
    for (const folder of targets) {
      total += await syncImapFolder(client, account, folder, full)
    }
  } finally {
    await client.logout().catch(() => undefined)
  }
  return total
}

async function syncImapFolder(
  client: ImapFlow,
  account: Account,
  folder: Folder,
  full: boolean
): Promise<number> {
  reportState(account.id, folder.id, { running: true, message: folder.name })
  let fetched = 0
  try {
    const status = await getMailboxStatus(client, folder.path)
    let lastUid = folder.lastUid
    if (folder.uidValidity && folder.uidValidity !== status.uidValidity) {
      deleteFolderMessages(folder.id)
      lastUid = 0
    }
    const sinceUid = full ? 0 : lastUid
    const summaries = await fetchSummaries(client, folder.path, { sinceUid, limit: full ? 500 : 200 })
    const fresh: MessageSummary[] = []
    let maxUid = lastUid
    for (const item of summaries) {
      const id = upsertMessage({
        accountId: account.id,
        folderId: folder.id,
        uid: item.uid,
        messageId: item.messageId,
        inReplyTo: item.inReplyTo,
        subject: item.subject,
        from: item.from,
        to: item.to,
        cc: item.cc,
        date: item.date,
        size: item.size,
        seen: item.seen,
        flagged: item.flagged,
        answered: item.answered,
        draft: item.draft,
        attachmentCount: item.hasAttachments ? 1 : 0
      })
      maxUid = Math.max(maxUid, item.uid)
      fetched += 1
      if (item.uid > sinceUid && folder.type === 'inbox') {
        const summary = getMessageSummary(id)
        if (summary) fresh.push(summary)
      }
    }
    updateFolderSync(folder.id, { uidValidity: status.uidValidity, lastUid: maxUid, syncedAt: now() })
    if (full) await pruneDeleted(client, folder)
    refreshFolderStats(folder.id)
    emit({ type: 'messages-changed', payload: { accountId: account.id, folderId: folder.id } })
    if (fresh.length) await handleIncoming(account, folder, fresh)
    return fetched
  } finally {
    reportState(account.id, folder.id, { running: false, progress: 1, message: folder.name, fetched })
  }
}

async function pruneDeleted(client: ImapFlow, folder: Folder): Promise<void> {
  try {
    const remoteUids = new Set(await fetchRemoteUids(client, folder.path))
    const db = getDb()
    const local = db.prepare('SELECT id, uid FROM messages WHERE folder_id = ?').all(folder.id) as {
      id: string
      uid: number
    }[]
    const stale = local.filter((m) => !remoteUids.has(m.uid))
    if (!stale.length) return
    deleteMessages(stale.map((m) => m.id))
  } catch (error) {
    console.warn('[同步] 清理已删除邮件失败', error)
  }
}

/** 新邮件：应用过滤规则并发送通知 */
async function handleIncoming(account: Account, folder: Folder, items: MessageSummary[]): Promise<void> {
  for (const item of items) {
    recordAddresses(account.id, [...item.from, ...item.to])
    const actions = applyRules(item, item.snippet)
    for (const action of actions) {
      try {
        if (action.type === 'markRead') {
          setFlag([item.id], 'seen', true)
        } else if (action.type === 'flag') {
          setFlag([item.id], 'flagged', true)
        } else if (action.type === 'move' && action.target) {
          const client = await clientFor(account)
          try {
            await moveMessages(client, folder.path, [item.uid], action.target)
          } finally {
            await client.logout().catch(() => undefined)
          }
          const targetId = makeFolderId(account.id, action.target)
          moveLocalMessages([item.id], targetId)
          refreshFolderStats(targetId)
        } else if (action.type === 'delete') {
          deleteMessages([item.id])
        }
      } catch (error) {
        console.warn('[规则] 执行失败', error)
      }
    }
    if (!actions.some((a) => a.type === 'skipNotification')) {
      emit({ type: 'new-message', payload: item })
    }
  }
  const notices = items
    .filter((i) => !i.seen)
    .map((i) => ({ title: i.from[0]?.name || i.from[0]?.address || '新邮件', body: i.subject }))
  if (notices.length && settingsGet<boolean>('notifications', true)) {
    showNewMailNotification(notices, account.name)
  }
}

async function syncPop3Account(account: Account): Promise<number> {
  const row = getAccountRow(account.id)
  if (!row) return 0
  const secrets = getSecrets(row)
  const folder = upsertFolder({ accountId: account.id, path: 'INBOX', name: '收件箱', type: 'inbox' })
  reportState(account.id, folder.id, { running: true, message: '收取邮件' })
  const client = new Pop3Client({
    host: account.incoming.host,
    port: account.incoming.port,
    security: account.incoming.security,
    username: account.incoming.username || account.email,
    password: secrets.password
  })
  let fetched = 0
  try {
    await client.connect()
    const refs = await client.uidl()
    const db = getDb()
    const fresh: MessageSummary[] = []
    let nextUid = folder.lastUid || 0
    for (const ref of refs) {
      const headerRaw = await client.top(ref.index, 0).catch(() => Buffer.from(''))
      let messageId = ref.uid
      try {
        const parsed = await parseRawMail(headerRaw)
        messageId = parsed.messageId || ref.uid
      } catch {
        /* 头部解析失败时退回 UIDL */
      }
      const exists = db
        .prepare('SELECT id FROM messages WHERE folder_id = ? AND message_id = ?')
        .get(folder.id, messageId) as { id: string } | undefined
      if (exists) continue
      const raw = await client.retr(ref.index)
      const uid = ++nextUid
      const id = `${account.id}::${folder.id}::${uid}`
      const payload = await parseMessage(id, raw)
      upsertMessage({
        accountId: account.id,
        folderId: folder.id,
        uid,
        messageId: payload.messageId || messageId,
        inReplyTo: payload.inReplyTo,
        subject: payload.subject,
        from: payload.from,
        to: payload.to,
        cc: payload.cc,
        date: payload.date,
        size: ref.size,
        seen: false,
        attachmentCount: payload.attachments.length,
        snippet: payload.snippet,
        bodyText: payload.bodyText,
        bodyHtml: payload.bodyHtml,
        headers: { ...payload.headers, 'x-pop3-uid': ref.uid }
      })
      saveAttachments(id, payload.attachments)
      const summary = getMessageSummary(id)
      if (summary) fresh.push(summary)
      fetched += 1
      if (!account.keepOnServer) await client.dele(ref.index)
    }
    updateFolderSync(folder.id, { lastUid: nextUid, syncedAt: now() })
    refreshFolderStats(folder.id)
    emit({ type: 'messages-changed', payload: { accountId: account.id, folderId: folder.id } })
    if (fresh.length) await handleIncoming(account, folder, fresh)
    return fetched
  } finally {
    await client.quit().catch(() => undefined)
    reportState(account.id, folder.id, { running: false, progress: 1, message: '完成', fetched })
  }
}

async function syncEwsAccount(account: Account): Promise<number> {
  const client = ewsClientFor(account)
  const folders = await client.listFolders()
  for (const item of folders) {
    upsertFolder({
      accountId: account.id,
      path: item.id,
      name: item.name,
      type: guessFolderType(item.name, item.distinguished ? `\\${capitalize(item.distinguished)}` : '')
    })
  }
  let fetched = 0
  const db = getDb()
  for (const folder of listFolders(account.id)) {
    reportState(account.id, folder.id, { running: true, message: folder.name })
    let folderFetched = 0
    try {
      const ids = await client.findItemIds(folder.path, 50)
      const items = await client.getItems(ids)
      const fresh: MessageSummary[] = []
      let nextUid = folder.lastUid || 0
      for (const item of items) {
        const existing = db
          .prepare(`SELECT id, uid FROM messages WHERE folder_id = ? AND json_extract(headers_json, '$."x-ews-itemid"') = ?`)
          .get(folder.id, item.itemId) as { id: string; uid: number } | undefined
        const uid = existing?.uid ?? ++nextUid
        const id = existing?.id ?? `${account.id}::${folder.id}::${uid}`
        upsertMessage({
          accountId: account.id,
          folderId: folder.id,
          uid,
          messageId: item.messageId,
          inReplyTo: item.inReplyTo,
          subject: item.subject,
          from: [{ name: item.fromName || item.fromAddress, address: item.fromAddress }],
          to: item.to.map((address) => ({ address })),
          cc: item.cc.map((address) => ({ address })),
          date: item.date,
          size: item.size,
          seen: item.isRead,
          attachmentCount: item.attachments.length,
          snippet: buildSnippet(item.bodyText, item.bodyHtml),
          bodyText: item.bodyText,
          bodyHtml: item.bodyHtml,
          headers: { 'x-ews-itemid': item.itemId, 'x-ews-changekey': item.changeKey }
        })
        if (!existing) {
          folderFetched += 1
          const summary = getMessageSummary(id)
          if (summary && folder.type === 'inbox') fresh.push(summary)
        }
      }
      fetched += folderFetched
      updateFolderSync(folder.id, { lastUid: nextUid, syncedAt: now() })
      refreshFolderStats(folder.id)
      emit({ type: 'messages-changed', payload: { accountId: account.id, folderId: folder.id } })
      if (fresh.length) await handleIncoming(account, folder, fresh)
    } finally {
      reportState(account.id, folder.id, { running: false, progress: 1, message: folder.name, fetched: folderFetched })
    }
  }
  return fetched
}

function capitalize(input: string): string {
  return input.charAt(0).toUpperCase() + input.slice(1)
}

/** 同步指定文件夹 */
export async function syncFolder(accountId: string, folderId: string, full = false): Promise<number> {
  const account = getAccount(accountId)
  const folder = getFolderById(folderId)
  if (!account || !folder) return 0
  if (account.protocol !== 'imap') return syncAccount(accountId, { full })
  const client = await clientFor(account)
  try {
    return await syncImapFolder(client, account, folder, full)
  } finally {
    await client.logout().catch(() => undefined)
  }
}

/** 启动后同步全部账户 */
export async function syncAllAccounts(): Promise<void> {
  for (const account of listAccounts().filter((a) => a.enabled)) {
    await syncAccount(account.id).catch(() => undefined)
  }
}
