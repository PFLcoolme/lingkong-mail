import type { Draft, SendPayload } from '@shared/types'
import type { ImapFlow } from 'imapflow'
import { getAccount, getAccountRow, getSecrets, resolveAccessToken } from './accounts'
import { getDb } from './db'
import { getDraft, setDraftSync } from './drafts'
import { createImapClient, deleteMessagesRemote } from './imap'
import { buildRawMessage, type MailAccount } from './smtp'

interface DraftFolderRef {
  id: string
  path: string
}

/** 找到账户的草稿箱文件夹（优先按类型，其次按路径名兜底） */
function findDraftsFolder(accountId: string): DraftFolderRef | null {
  const row = getDb()
    .prepare(
      `SELECT id, path FROM folders
       WHERE account_id = ? AND (type = 'drafts' OR lower(path) LIKE '%draft%')
       ORDER BY CASE WHEN type = 'drafts' THEN 0 ELSE 1 END LIMIT 1`
    )
    .get(accountId) as DraftFolderRef | undefined
  return row ?? null
}

function folderPathById(folderId: string): string | null {
  const row = getDb().prepare('SELECT path FROM folders WHERE id = ?').get(folderId) as
    | { path: string }
    | undefined
  return row?.path ?? null
}

function splitAddresses(text: string): string[] {
  return text
    .split(/[,;，；\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

/** 建立一个临时 IMAP 连接执行操作（草稿同步不需要长连接） */
async function withClient<T>(
  accountId: string,
  job: (client: ImapFlow) => Promise<T>
): Promise<T | null> {
  const account = getAccount(accountId)
  const row = getAccountRow(accountId)
  if (!account || !row || account.protocol !== 'imap') return null
  const secrets = getSecrets(row)
  const accessToken = account.authType === 'oauth2' ? await resolveAccessToken(accountId) : ''
  const client = await createImapClient(
    account.incoming,
    {
      user: account.incoming.username || account.email,
      password: secrets.password,
      accessToken
    },
    account.authType === 'oauth2'
  )
  try {
    return await job(client)
  } finally {
    try {
      await client.logout()
    } catch {
      /* 关闭失败不影响主流程 */
    }
  }
}

function toSendPayload(draft: Draft): SendPayload {
  return {
    accountId: draft.accountId,
    to: splitAddresses(draft.to),
    cc: splitAddresses(draft.cc),
    bcc: splitAddresses(draft.bcc),
    subject: draft.subject,
    text: draft.bodyText,
    html: draft.bodyHtml,
    attachments: draft.attachments.map((path) => ({
      filename: path.split('/').pop() ?? path,
      path
    })),
    inReplyTo: draft.inReplyTo,
    references: draft.references,
    saveToSent: false
  }
}

/**
 * 把草稿上传到服务器草稿箱。
 * 若该草稿此前已上传过，会先删掉服务器上的旧副本，避免草稿箱里堆出一串重复项。
 */
export async function uploadDraft(draftId: string): Promise<boolean> {
  const draft = getDraft(draftId)
  if (!draft || !draft.accountId) return false
  const folder = findDraftsFolder(draft.accountId)
  if (!folder) return false

  setDraftSync(draftId, { state: 'pending' })
  try {
    const account = getAccount(draft.accountId) as MailAccount | null
    if (!account || account.protocol !== 'imap') return false
    const raw = buildRawMessage(account, toSendPayload(draft), `<${draft.id}@kongling.local>`)
    const previousUid = draft.serverUid

    const result = await withClient(draft.accountId, async (client) => {
      if (previousUid > 0 && draft.serverFolderId === folder.id) {
        // 旧副本清不掉不阻塞新副本上传
        await deleteMessagesRemote(client, folder.path, [previousUid]).catch(() => undefined)
      }
      return client.append(folder.path, Buffer.from(raw, 'utf8'), ['\\Draft'])
    })

    // imapflow 写入失败时返回 false 而不抛错，这里必须当成失败处理，
    // 否则会标记成已同步却没有 UID，下次再传就会在草稿箱里堆重复件
    if (!result || typeof result !== 'object') throw new Error('草稿写入服务器失败')
    const uid = Number(result.uid ?? 0)
    setDraftSync(draftId, {
      state: 'synced',
      serverUid: uid,
      serverFolderId: folder.id,
      syncedAt: Date.now()
    })
    return true
  } catch (error) {
    console.warn('[draft] 上传草稿到服务器失败', error)
    setDraftSync(draftId, { state: 'error' })
    return false
  }
}

/** 删除服务器上的草稿副本（本地删除或发送成功时调用） */
export async function removeServerDraft(draft: Draft): Promise<void> {
  if (!draft.serverUid || !draft.serverFolderId) return
  const path = folderPathById(draft.serverFolderId)
  if (!path) return
  try {
    await withClient(draft.accountId, (client) => deleteMessagesRemote(client, path, [draft.serverUid]))
  } catch (error) {
    console.warn('[draft] 删除服务器草稿失败', error)
  }
}
