import type { AccountConfig, AccountCredentials } from '@shared/types'
import { handle, toError } from './common'
import {
  createAccount,
  deleteAccount,
  getAccount,
  getAccountRow,
  getSecrets,
  listAccounts,
  setAccountStatus,
  updateAccount
} from '../services/accounts'
import { PROVIDERS, autodetect } from '../services/providers'
import { testImap } from '../services/imap'
import { testSmtp } from '../services/smtp'
import { testPop3 } from '../services/pop3'
import { testEws, guessEwsUrl } from '../services/ews'
import { listFolders } from '../services/folders'
import { startIdle, stopIdle, syncAccount } from '../services/sync'
import { setFlag, refreshFolderStats } from '../services/messages'
import { createImapClient } from '../services/imap'

function normalize(config: Partial<AccountConfig>): AccountConfig {
  return {
    id: config.id ?? '',
    name: config.name ?? config.email ?? '未命名账户',
    email: config.email ?? '',
    displayName: config.displayName ?? config.name ?? config.email ?? '',
    protocol: config.protocol ?? 'imap',
    authType: config.authType ?? 'password',
    incoming: {
      host: config.incoming?.host ?? '',
      port: config.incoming?.port ?? (config.protocol === 'pop3' ? 995 : 993),
      security: config.incoming?.security ?? 'ssl',
      username: config.incoming?.username ?? config.email ?? ''
    },
    outgoing: {
      host: config.outgoing?.host ?? '',
      port: config.outgoing?.port ?? 465,
      security: config.outgoing?.security ?? 'ssl',
      username: config.outgoing?.username ?? config.email ?? ''
    },
    ewsUrl: config.ewsUrl ?? '',
    oauthProvider: config.oauthProvider ?? '',
    oauthClientId: config.oauthClientId ?? '',
    oauthClientSecret: config.oauthClientSecret ?? '',
    oauthTenant: config.oauthTenant ?? '',
    keepOnServer: config.keepOnServer ?? true,
    syncDays: config.syncDays ?? 30,
    signature: config.signature ?? '',
    signatureHtml: config.signatureHtml ?? '',
    color: config.color ?? '#5b8def',
    enabled: config.enabled ?? true,
    createdAt: config.createdAt ?? Date.now(),
    sortOrder: config.sortOrder ?? 0
  }
}

export function registerAccountHandlers(): void {
  handle('accounts:list', () => listAccounts())

  handle('accounts:add', async (_event, config: Partial<AccountConfig>, credentials: Partial<AccountCredentials>) => {
    const account = createAccount(normalize(config), {
      password: credentials?.password ?? '',
      refreshToken: credentials?.refreshToken ?? '',
      accessToken: credentials?.accessToken ?? '',
      expiresAt: credentials?.expiresAt ?? 0
    })
    void syncAccount(account.id, { full: true }).catch(() => undefined)
    return account
  })

  handle('accounts:update', async (_event, id: string, patch: Partial<AccountConfig>, credentials?: Partial<AccountCredentials>) => {
    updateAccount(id, normalize({ ...patch, id }), credentials)
    return getAccount(id)
  })

  handle('accounts:remove', async (_event, id: string) => {
    stopIdle(id)
    deleteAccount(id)
    return true
  })

  handle('accounts:set-enabled', async (_event, id: string, enabled: boolean) => {
    updateAccount(id, { enabled })
    if (enabled) await startIdle(id)
    else stopIdle(id)
    return true
  })

  handle('accounts:test', async (_event, config: Partial<AccountConfig>, credentials: Partial<AccountCredentials>) => {
    const account = normalize(config)
    const password = credentials?.password ?? ''
    const accessToken = credentials?.accessToken ?? ''
    const useOAuth = account.authType === 'oauth2'
    try {
      if (account.protocol === 'imap') {
        await testImap(account.incoming, { user: account.incoming.username, password, accessToken }, useOAuth)
        await testSmtp({ ...account, id: account.id || 'test' }, {
          password,
          refreshToken: credentials?.refreshToken ?? '',
          accessToken,
          tokenExpires: credentials?.expiresAt ?? 0
        })
      } else if (account.protocol === 'pop3') {
        await testPop3({ ...account.incoming, username: account.incoming.username, password })
        await testSmtp({ ...account, id: account.id || 'test' }, {
          password,
          refreshToken: credentials?.refreshToken ?? '',
          accessToken,
          tokenExpires: credentials?.expiresAt ?? 0
        })
      } else {
        await testEws({
          url: account.ewsUrl || guessEwsUrl(account.email),
          username: account.incoming.username,
          password,
          accessToken
        })
      }
      return { ok: true, message: '连接成功', stage: 'incoming' as const }
    } catch (error) {
      const err = toError(error)
      return {
        ok: false,
        message: err.message,
        stage: /smtp|send|sender/i.test(err.message) ? ('outgoing' as const) : ('incoming' as const)
      }
    }
  })

  handle('providers:list', () => PROVIDERS)

  handle('autoconfig:detect', async (_event, email: string) => {
    return autodetect(email)
  })

  handle('folders:list', async (_event, accountId: string) => listFolders(accountId))

  handle('folders:sync', async (_event, accountId: string) => {
    await syncAccount(accountId, { full: true })
    return listFolders(accountId)
  })

  handle('folders:create', async (_event, accountId: string, name: string, parentPath: string) => {
    const account = getAccount(accountId)
    if (!account || account.protocol !== 'imap') throw new Error('当前账户不支持创建文件夹')
    const row = getAccountRow(accountId)
    if (!row) throw new Error('账户不存在')
    const secrets = getSecrets(row)
    const delimiter = parentPath.includes('/') ? '/' : (listFolders(accountId)[0]?.delimiter ?? '/')
    const path = parentPath ? `${parentPath}${delimiter}${name}` : name
    const client = await createImapClient(
      account.incoming,
      { user: account.incoming.username || account.email, password: secrets.password },
      false
    )
    try {
      await client.mailboxCreate(path)
    } finally {
      await client.logout().catch(() => undefined)
    }
    await syncAccount(accountId)
    return true
  })

  handle('folders:rename', async (_event, accountId: string, path: string, name: string) => {
    const account = getAccount(accountId)
    if (!account || account.protocol !== 'imap') throw new Error('当前账户不支持重命名文件夹')
    const row = getAccountRow(accountId)
    if (!row) throw new Error('账户不存在')
    const secrets = getSecrets(row)
    const delimiter = listFolders(accountId).find((f) => f.path === path)?.delimiter ?? '/'
    const parts = path.split(delimiter)
    parts[parts.length - 1] = name
    const target = parts.join(delimiter)
    const client = await createImapClient(
      account.incoming,
      { user: account.incoming.username || account.email, password: secrets.password },
      false
    )
    try {
      await client.mailboxRename(path, target)
    } finally {
      await client.logout().catch(() => undefined)
    }
    await syncAccount(accountId, { full: true })
    return true
  })

  handle('folders:delete', async (_event, accountId: string, path: string) => {
    const account = getAccount(accountId)
    if (!account || account.protocol !== 'imap') throw new Error('当前账户不支持删除文件夹')
    const row = getAccountRow(accountId)
    if (!row) throw new Error('账户不存在')
    const secrets = getSecrets(row)
    const client = await createImapClient(
      account.incoming,
      { user: account.incoming.username || account.email, password: secrets.password },
      false
    )
    try {
      await client.mailboxDelete(path)
    } finally {
      await client.logout().catch(() => undefined)
    }
    await syncAccount(accountId, { full: true })
    return true
  })

  handle('folders:mark-all-read', async (_event, accountId: string, folderId: string) => {
    const { getDb } = await import('../services/db')
    const rows = getDb().prepare('SELECT id FROM messages WHERE folder_id = ? AND seen = 0').all(folderId) as {
      id: string
    }[]
    if (rows.length) {
      setFlag(rows.map((r) => r.id), 'seen', true)
      const { markSeen } = await import('../services/actions')
      await markSeen(rows.map((r) => r.id), true)
    }
    refreshFolderStats(folderId)
    setAccountStatus(accountId, 'ready')
    return true
  })
}
