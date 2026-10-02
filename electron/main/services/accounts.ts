import type { Account, AccountConfig, AccountStatus, FolderType } from '@shared/types'
import { decryptSecret, encryptSecret } from './crypto'
import { generateId, getDb, now, parseJson } from './db'
import { refreshAccessToken } from './oauth'

export interface AccountRow {
  id: string
  name: string
  email: string
  display_name: string
  protocol: string
  auth_type: string
  in_host: string
  in_port: number
  in_security: string
  in_username: string
  out_host: string
  out_port: number
  out_security: string
  out_username: string
  ews_url: string
  oauth_provider: string
  oauth_client_id: string
  oauth_client_secret: string
  oauth_tenant: string
  password_enc: string | null
  refresh_token_enc: string | null
  access_token_enc: string | null
  token_expires: number
  keep_on_server: number
  sync_days: number
  signature: string
  signature_html: string
  color: string
  enabled: number
  status: string
  last_error: string
  created_at: number
  sort_order: number
}

const PALETTE = ['#5b8def', '#e06c75', '#61afef', '#98c379', '#e5c07b', '#c678dd', '#56b6c2', '#d19a66']

export function rowToAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    displayName: row.display_name,
    protocol: row.protocol as Account['protocol'],
    authType: row.auth_type as Account['authType'],
    incoming: {
      host: row.in_host,
      port: row.in_port,
      security: row.in_security as AccountConfig['incoming']['security'],
      username: row.in_username
    },
    outgoing: {
      host: row.out_host,
      port: row.out_port,
      security: row.out_security as AccountConfig['outgoing']['security'],
      username: row.out_username
    },
    ewsUrl: row.ews_url,
    oauthProvider: row.oauth_provider,
    oauthClientId: row.oauth_client_id,
    oauthClientSecret: row.oauth_client_secret,
    oauthTenant: row.oauth_tenant,
    keepOnServer: row.keep_on_server === 1,
    syncDays: row.sync_days,
    signature: row.signature,
    signatureHtml: row.signature_html,
    color: row.color,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    sortOrder: row.sort_order,
    status: row.status as AccountStatus,
    lastError: row.last_error
  }
}

export interface AccountSecrets {
  password: string
  refreshToken: string
  accessToken: string
  tokenExpires: number
}

export function listAccountRows(): AccountRow[] {
  return getDb().prepare('SELECT * FROM accounts ORDER BY sort_order ASC, created_at ASC').all() as AccountRow[]
}

export function listAccounts(): Account[] {
  return listAccountRows().map(rowToAccount)
}

export function getAccountRow(id: string): AccountRow | null {
  return (getDb().prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRow | undefined) ?? null
}

export function getAccount(id: string): Account | null {
  const row = getAccountRow(id)
  return row ? rowToAccount(row) : null
}

export function getSecrets(row: AccountRow): AccountSecrets {
  return {
    password: decryptSecret(row.password_enc),
    refreshToken: decryptSecret(row.refresh_token_enc),
    accessToken: decryptSecret(row.access_token_enc),
    tokenExpires: row.token_expires
  }
}

export function createAccount(
  config: Partial<AccountConfig>,
  secrets: { password?: string; refreshToken?: string; accessToken?: string; expiresAt?: number }
): Account {
  const db = getDb()
  const id = config.id || generateId('acc')
  const count = (db.prepare('SELECT COUNT(*) AS c FROM accounts').get() as { c: number }).c
  const email = config.email ?? ''
  db.prepare(
    `INSERT INTO accounts (
      id, name, email, display_name, protocol, auth_type,
      in_host, in_port, in_security, in_username,
      out_host, out_port, out_security, out_username,
      ews_url, oauth_provider, oauth_client_id, oauth_client_secret, oauth_tenant,
      password_enc, refresh_token_enc, access_token_enc, token_expires,
      keep_on_server, sync_days, signature, signature_html, color, enabled, status, created_at, sort_order
    ) VALUES (
      @id, @name, @email, @display_name, @protocol, @auth_type,
      @in_host, @in_port, @in_security, @in_username,
      @out_host, @out_port, @out_security, @out_username,
      @ews_url, @oauth_provider, @oauth_client_id, @oauth_client_secret, @oauth_tenant,
      @password_enc, @refresh_token_enc, @access_token_enc, @token_expires,
      @keep_on_server, @sync_days, @signature, @signature_html, @color, @enabled, 'idle', @created_at, @sort_order
    )`
  ).run({
    id,
    name: config.name || email || '未命名账户',
    email,
    display_name: config.displayName || config.name || email,
    protocol: config.protocol ?? 'imap',
    auth_type: config.authType ?? 'password',
    in_host: config.incoming?.host ?? '',
    in_port: config.incoming?.port ?? 993,
    in_security: config.incoming?.security ?? 'ssl',
    in_username: config.incoming?.username || email,
    out_host: config.outgoing?.host ?? '',
    out_port: config.outgoing?.port ?? 465,
    out_security: config.outgoing?.security ?? 'ssl',
    out_username: config.outgoing?.username || email,
    ews_url: config.ewsUrl ?? '',
    oauth_provider: config.oauthProvider ?? '',
    oauth_client_id: config.oauthClientId ?? '',
    oauth_client_secret: config.oauthClientSecret ?? '',
    oauth_tenant: config.oauthTenant ?? '',
    password_enc: encryptSecret(secrets.password ?? ''),
    refresh_token_enc: encryptSecret(secrets.refreshToken ?? ''),
    access_token_enc: encryptSecret(secrets.accessToken ?? ''),
    token_expires: secrets.expiresAt ?? 0,
    keep_on_server: config.keepOnServer === false ? 0 : 1,
    sync_days: config.syncDays ?? 30,
    signature: config.signature ?? '',
    signature_html: config.signatureHtml ?? '',
    color: config.color || PALETTE[count % PALETTE.length],
    enabled: config.enabled === false ? 0 : 1,
    created_at: config.createdAt ?? now(),
    sort_order: count
  })
  return getAccount(id) as Account
}

export function updateAccount(
  id: string,
  patch: Partial<AccountConfig>,
  secrets?: { password?: string; refreshToken?: string; accessToken?: string; expiresAt?: number }
): void {
  const db = getDb()
  const row = getAccountRow(id)
  if (!row) throw new Error('账户不存在')
  const merged = { ...rowToAccount(row), ...patch }
  db.prepare(
    `UPDATE accounts SET
      name=@name, email=@email, display_name=@display_name, protocol=@protocol, auth_type=@auth_type,
      in_host=@in_host, in_port=@in_port, in_security=@in_security, in_username=@in_username,
      out_host=@out_host, out_port=@out_port, out_security=@out_security, out_username=@out_username,
      ews_url=@ews_url, oauth_provider=@oauth_provider, oauth_client_id=@oauth_client_id,
      oauth_client_secret=@oauth_client_secret, oauth_tenant=@oauth_tenant,
      keep_on_server=@keep_on_server, sync_days=@sync_days, signature=@signature,
      signature_html=@signature_html, color=@color, enabled=@enabled
    WHERE id=@id`
  ).run({
    id,
    name: merged.name,
    email: merged.email,
    display_name: merged.displayName,
    protocol: merged.protocol,
    auth_type: merged.authType,
    in_host: merged.incoming.host,
    in_port: merged.incoming.port,
    in_security: merged.incoming.security,
    in_username: merged.incoming.username,
    out_host: merged.outgoing.host,
    out_port: merged.outgoing.port,
    out_security: merged.outgoing.security,
    out_username: merged.outgoing.username,
    ews_url: merged.ewsUrl,
    oauth_provider: merged.oauthProvider,
    oauth_client_id: merged.oauthClientId,
    oauth_client_secret: merged.oauthClientSecret,
    oauth_tenant: merged.oauthTenant,
    keep_on_server: merged.keepOnServer ? 1 : 0,
    sync_days: merged.syncDays,
    signature: merged.signature,
    signature_html: merged.signatureHtml,
    color: merged.color,
    enabled: merged.enabled ? 1 : 0
  })
  if (secrets) {
    const sets: string[] = []
    const params: Record<string, unknown> = { id }
    if (secrets.password !== undefined) {
      sets.push('password_enc=@password_enc')
      params.password_enc = encryptSecret(secrets.password)
    }
    if (secrets.refreshToken !== undefined) {
      sets.push('refresh_token_enc=@refresh_token_enc')
      params.refresh_token_enc = encryptSecret(secrets.refreshToken)
    }
    if (secrets.accessToken !== undefined) {
      sets.push('access_token_enc=@access_token_enc')
      params.access_token_enc = encryptSecret(secrets.accessToken)
    }
    if (secrets.expiresAt !== undefined) {
      sets.push('token_expires=@token_expires')
      params.token_expires = secrets.expiresAt
    }
    if (sets.length) {
      db.prepare(`UPDATE accounts SET ${sets.join(', ')} WHERE id=@id`).run(params)
    }
  }
}

export function deleteAccount(id: string): void {
  const db = getDb()
  const folderIds = (db.prepare('SELECT id FROM folders WHERE account_id = ?').all(id) as { id: string }[]).map(
    (f) => f.id
  )
  const tx = db.transaction(() => {
    for (const folderId of folderIds) {
      db.prepare('DELETE FROM attachments WHERE message_id IN (SELECT id FROM messages WHERE folder_id = ?)').run(folderId)
      db.prepare('DELETE FROM messages WHERE folder_id = ?').run(folderId)
    }
    db.prepare('DELETE FROM folders WHERE account_id = ?').run(id)
    db.prepare('DELETE FROM drafts WHERE account_id = ?').run(id)
    db.prepare('DELETE FROM contacts WHERE account_id = ?').run(id)
    db.prepare('DELETE FROM rules WHERE account_id = ?').run(id)
    db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
  })
  tx()
}

export function setAccountStatus(id: string, status: AccountStatus, error = ''): void {
  getDb().prepare('UPDATE accounts SET status = ?, last_error = ? WHERE id = ?').run(status, error, id)
}

/** 获取可用的访问令牌（OAuth2 账户会自动刷新） */
export async function resolveAccessToken(id: string): Promise<string> {
  const row = getAccountRow(id)
  if (!row) throw new Error('账户不存在')
  if (row.auth_type !== 'oauth2') return ''
  const secrets = getSecrets(row)
  if (secrets.accessToken && secrets.tokenExpires > Date.now() + 5000) return secrets.accessToken
  if (!secrets.refreshToken) throw new Error('缺少 OAuth 刷新令牌，请重新授权')
  const token = await refreshAccessToken(
    row.oauth_provider,
    row.oauth_client_id,
    row.oauth_client_secret,
    row.oauth_tenant,
    secrets.refreshToken
  )
  updateAccount(id, {}, {
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: token.expiresAt
  })
  return token.accessToken
}

export function guessFolderType(path: string, specialUse?: string): FolderType {
  const lower = path.toLowerCase()
  if (specialUse === '\\Inbox' || lower === 'inbox') return 'inbox'
  if (specialUse === '\\Sent' || lower.includes('sent')) return 'sent'
  if (specialUse === '\\Drafts' || lower.includes('draft')) return 'drafts'
  if (specialUse === '\\Trash' || lower.includes('trash') || lower.includes('deleted')) return 'trash'
  if (specialUse === '\\Junk' || lower.includes('junk') || lower.includes('spam')) return 'junk'
  if (specialUse === '\\Archive' || lower.includes('archive')) return 'archive'
  return 'other'
}

export const FOLDER_ICONS: Record<FolderType, string> = {
  inbox: 'Inbox',
  sent: 'Send',
  drafts: 'File',
  trash: 'Trash2',
  junk: 'ShieldAlert',
  archive: 'Archive',
  other: 'Folder'
}

export function settingsGet<T>(key: string, fallback: T): T {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  if (!row) return fallback
  return parseJson<T>(row.value, fallback)
}

export function settingsSet(key: string, value: unknown): void {
  getDb().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    key,
    JSON.stringify(value)
  )
}
