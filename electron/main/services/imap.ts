import { ImapFlow } from 'imapflow'
import type { Account, Folder } from '@shared/types'
import type { AccountSecrets } from './accounts'
import { resolveAccessToken } from './accounts'

export interface ServerEndpoint {
  host: string
  port: number
  security: 'none' | 'ssl' | 'starttls'
}

export interface ImapCredentials {
  user: string
  password?: string
  accessToken?: string
}

export interface RemoteFolder {
  path: string
  name: string
  delimiter: string
  specialUse: string
  flags: string[]
}

export interface RemoteSummary {
  uid: number
  flags: string[]
  subject: string
  from: { name?: string; address: string }[]
  to: { name?: string; address: string }[]
  cc: { name?: string; address: string }[]
  date: number
  size: number
  messageId: string
  inReplyTo: string
  hasAttachments: boolean
  seen: boolean
  flagged: boolean
  answered: boolean
  draft: boolean
}

function buildAuth(creds: ImapCredentials, useOAuth: boolean): { user: string; pass?: string; accessToken?: string } {
  if (useOAuth) {
    return { user: creds.user, accessToken: creds.accessToken ?? '' }
  }
  return { user: creds.user, pass: creds.password ?? '' }
}

export async function createImapClient(
  endpoint: ServerEndpoint,
  creds: ImapCredentials,
  useOAuth: boolean,
  options: { disableIdle?: boolean } = {}
): Promise<ImapFlow> {
  const client = new ImapFlow({
    host: endpoint.host,
    port: endpoint.port,
    secure: endpoint.security === 'ssl',
    auth: buildAuth(creds, useOAuth),
    logger: false,
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 120000,
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    disableAutoIdle: options.disableIdle ?? true,
    clientInfo: { name: '空灵邮箱', version: '0.1.0' }
  } as ConstructorParameters<typeof ImapFlow>[0])
  await client.connect()
  return client
}

export async function testImap(
  endpoint: ServerEndpoint,
  creds: ImapCredentials,
  useOAuth: boolean
): Promise<void> {
  const client = await createImapClient(endpoint, creds, useOAuth, { disableIdle: true })
  try {
    await client.list()
  } finally {
    try {
      await client.logout()
    } catch {
      /* ignore */
    }
  }
}

function normalizeAddresses(list: { name?: string; address?: string }[] | undefined): {
  name?: string
  address: string
}[] {
  if (!list) return []
  return list
    .filter((a) => Boolean(a?.address))
    .map((a) => ({ name: (a.name || '').trim() || undefined, address: (a.address as string).trim() }))
}

function countAttachments(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false
  const n = node as { disposition?: string; type?: string; childNodes?: unknown[] }
  if (n.disposition === 'attachment') return true
  if (Array.isArray(n.childNodes)) {
    return n.childNodes.some((child) => countAttachments(child))
  }
  return false
}

export async function fetchFolders(client: ImapFlow): Promise<RemoteFolder[]> {
  const list = await client.list()
  return list.map((item) => ({
    path: item.path,
    name: item.name || item.path.split(item.delimiter || '/').pop() || item.path,
    delimiter: item.delimiter || '/',
    specialUse: item.specialUse ?? '',
    flags: Array.from(item.flags ?? [])
  }))
}

export interface FetchOptions {
  sinceUid?: number
  limit?: number
  /** 是否同时抓取正文（首次同步少量邮件时使用） */
  withBody?: boolean
}

export async function fetchSummaries(
  client: ImapFlow,
  path: string,
  options: FetchOptions = {}
): Promise<RemoteSummary[]> {
  const lock = await client.getMailboxLock(path, { readOnly: true })
  const result: RemoteSummary[] = []
  try {
    const mailbox = client.mailbox as unknown as { uidNext?: number; exists?: number; uidValidity?: number } | null
    const total = mailbox?.exists ?? 0
    let range: string
    if (options.sinceUid && options.sinceUid > 0) {
      range = `${options.sinceUid + 1}:*`
    } else if (options.limit && total > options.limit) {
      range = `${Math.max(1, total - options.limit + 1)}:*`
    } else if (total > 0) {
      range = '1:*'
    } else {
      return []
    }
    const iterator = client.fetch({ uid: range }, {
      uid: true,
      flags: true,
      envelope: true,
      size: true,
      internalDate: true,
      bodyStructure: true
    })
    for await (const msg of iterator) {
      const flags = Array.from(msg.flags ?? [])
      const env = msg.envelope as {
        subject?: string
        from?: { name?: string; address?: string }[]
        to?: { name?: string; address?: string }[]
        cc?: { name?: string; address?: string }[]
        date?: Date
        messageId?: string
        inReplyTo?: string
      }
      result.push({
        uid: msg.uid,
        flags,
        subject: env?.subject || '(无主题)',
        from: normalizeAddresses(env?.from) as RemoteSummary['from'],
        to: normalizeAddresses(env?.to) as RemoteSummary['to'],
        cc: normalizeAddresses(env?.cc) as RemoteSummary['cc'],
        date: new Date(msg.internalDate ?? env?.date ?? Date.now()).getTime(),
        size: msg.size ?? 0,
        messageId: env?.messageId ?? '',
        inReplyTo: env?.inReplyTo ?? '',
        hasAttachments: countAttachments(msg.bodyStructure),
        seen: flags.includes('\\Seen'),
        flagged: flags.includes('\\Flagged'),
        answered: flags.includes('\\Answered'),
        draft: flags.includes('\\Draft')
      })
    }
  } finally {
    lock.release()
  }
  return result
}

export async function fetchRemoteUids(client: ImapFlow, path: string): Promise<number[]> {
  const lock = await client.getMailboxLock(path, { readOnly: true })
  const uids: number[] = []
  try {
    for await (const msg of client.fetch({ uid: '1:*' }, { uid: true })) {
      uids.push(msg.uid)
    }
  } finally {
    lock.release()
  }
  return uids
}

export async function fetchMessageSource(client: ImapFlow, path: string, uid: number): Promise<Buffer> {
  const lock = await client.getMailboxLock(path, { readOnly: true })
  try {
    const msg = await client.fetchOne(String(uid), { source: true, uid: true }, { uid: true })
    if (!msg) throw new Error('未能获取邮件原文')
    const source = (msg as { source?: string | Buffer }).source
    if (!source) throw new Error('邮件原文为空')
    return Buffer.isBuffer(source) ? source : Buffer.from(String(source), 'utf8')
  } finally {
    lock.release()
  }
}

export async function updateFlags(
  client: ImapFlow,
  path: string,
  uids: number[],
  flags: string[],
  action: 'add' | 'remove' | 'set'
): Promise<void> {
  if (!uids.length) return
  const lock = await client.getMailboxLock(path)
  try {
    const range = uids.join(',')
    if (action === 'add') await client.messageFlagsAdd(range, flags, { uid: true })
    else if (action === 'remove') await client.messageFlagsRemove(range, flags, { uid: true })
    else await client.messageFlagsSet(range, flags, { uid: true })
  } finally {
    lock.release()
  }
}

export async function moveMessages(client: ImapFlow, path: string, uids: number[], target: string): Promise<void> {
  if (!uids.length) return
  const lock = await client.getMailboxLock(path)
  try {
    await client.messageMove(uids.join(','), target, { uid: true })
  } finally {
    lock.release()
  }
}

export async function deleteMessagesRemote(client: ImapFlow, path: string, uids: number[]): Promise<void> {
  if (!uids.length) return
  const lock = await client.getMailboxLock(path)
  try {
    await client.messageDelete(uids.join(','), { uid: true })
  } finally {
    lock.release()
  }
}

export async function getMailboxStatus(
  client: ImapFlow,
  path: string
): Promise<{ uidValidity: number; uidNext: number; exists: number }> {
  const status = await client.status(path, { uidValidity: true, uidNext: true, messages: true })
  if (!status) throw new Error('无法读取文件夹状态')
  return {
    uidValidity: Number(status.uidValidity ?? 0),
    uidNext: Number(status.uidNext ?? 0),
    exists: Number(status.messages ?? 0)
  }
}

/** 建立可用于长时间监听的连接（IDLE） */
export async function openIdleConnection(account: Account, secrets: AccountSecrets): Promise<ImapFlow> {
  const accessToken = account.authType === 'oauth2' ? await resolveAccessToken(account.id) : ''
  const client = await createImapClient(
    account.incoming,
    { user: account.incoming.username || account.email, password: secrets.password, accessToken },
    account.authType === 'oauth2',
    { disableIdle: true }
  )
  return client
}

export function folderPath(folder: Folder): string {
  return folder.path
}
