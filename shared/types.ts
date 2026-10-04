/** 主进程与渲染进程共享的类型定义 */

export type ProtocolType = 'imap' | 'pop3' | 'ews'
export type AuthType = 'password' | 'oauth2'
export type SecurityType = 'none' | 'ssl' | 'starttls'
export type FolderType = 'inbox' | 'sent' | 'drafts' | 'trash' | 'junk' | 'archive' | 'other'

export interface ServerConfig {
  host: string
  port: number
  security: SecurityType
  username: string
}

export interface AccountConfig {
  id: string
  name: string
  email: string
  displayName: string
  protocol: ProtocolType
  authType: AuthType
  incoming: ServerConfig
  outgoing: ServerConfig
  /** Exchange Web Services 地址 */
  ewsUrl: string
  /** OAuth2 提供方标识，如 gmail / outlook */
  oauthProvider: string
  oauthClientId: string
  oauthClientSecret: string
  oauthTenant: string
  /** POP3 收取后是否在服务器保留（默认保留） */
  keepOnServer: boolean
  /** 已同步的历史天数上限 */
  syncDays: number
  signature: string
  signatureHtml: string
  color: string
  enabled: boolean
  createdAt: number
  sortOrder: number
}

export interface AccountCredentials {
  password: string
  refreshToken: string
  accessToken: string
  expiresAt: number
}

export interface Account extends AccountConfig {
  status: AccountStatus
  lastError: string
}

export type AccountStatus = 'idle' | 'connecting' | 'ready' | 'error' | 'auth-error'

export interface Folder {
  id: string
  accountId: string
  path: string
  name: string
  delimiter: string
  type: FolderType
  unread: number
  total: number
  uidValidity: number
  lastUid: number
  syncedAt: number
}

export interface Address {
  name?: string
  address: string
}

export interface Attachment {
  id: string
  messageId: string
  filename: string
  mimeType: string
  size: number
  path: string
  contentId: string
  inline: boolean
}

export interface MessageSummary {
  id: string
  accountId: string
  folderId: string
  uid: number
  messageId: string
  inReplyTo: string
  subject: string
  from: Address[]
  to: Address[]
  cc: Address[]
  bcc: Address[]
  date: number
  size: number
  seen: boolean
  flagged: boolean
  answered: boolean
  draft: boolean
  attachmentCount: number
  snippet: string
  hasHtml: boolean
}

export interface Message extends MessageSummary {
  bodyText: string
  bodyHtml: string
  headers: Record<string, string>
  attachments: Attachment[]
}

export interface Contact {
  id: string
  accountId: string
  name: string
  email: string
  frequency: number
  lastUsedAt: number
}

export type OutboxStatus = 'pending' | 'sending' | 'sent' | 'failed'

export interface OutboxItem {
  id: string
  accountId: string
  payload: SendPayload
  sendAt: number
  createdAt: number
  status: OutboxStatus
}

export interface SnoozedItem {
  id: string
  messageId: string
  accountId: string
  folderId: string
  wakeAt: number
  createdAt: number
}

export interface SavedSearch {
  id: string
  name: string
  query: string
  createdAt: number
}

export interface Label {
  id: string
  name: string
  color: string
  sortOrder: number
  count?: number
}

export interface AttachmentRecord {
  id: string
  messageId: string
  filename: string
  mimeType: string
  size: number
  path: string
  inline: boolean
  kind: string
  subject: string
  from: string
  date: number
  accountId: string
  folderId: string
}

export interface StatsSeriesPoint {
  day: number
  count: number
}

export interface StatsOverview {
  total: number
  unread: number
  withAttachments: number
  accounts: number
  received: StatsSeriesPoint[]
  sent: StatsSeriesPoint[]
  topSenders: { address: string; count: number }[]
  perAccount: { id: string; name: string; color: string; total: number; unread: number }[]
}

export interface Template {
  id: string
  name: string
  subject: string
  body: string
  createdAt: number
}

export type RuleField = 'from' | 'to' | 'subject' | 'body'
export type RuleOperator = 'contains' | 'notContains' | 'equals' | 'startsWith' | 'regex'
export type RuleActionType = 'markRead' | 'flag' | 'move' | 'delete' | 'skipNotification'

export interface RuleCondition {
  field: RuleField
  operator: RuleOperator
  value: string
}

export interface RuleAction {
  type: RuleActionType
  target: string
}

export interface Rule {
  id: string
  accountId: string
  name: string
  enabled: boolean
  order: number
  matchAll: boolean
  conditions: RuleCondition[]
  actions: RuleAction[]
}

/** 草稿与服务器同步的状态 */
export type DraftSyncState = 'none' | 'pending' | 'synced' | 'error'

export interface Draft {
  id: string
  accountId: string
  to: string
  cc: string
  bcc: string
  subject: string
  bodyText: string
  bodyHtml: string
  inReplyTo: string
  references: string
  replyFolderId: string
  replyUid: number
  forwardAttachments: string[]
  attachments: string[]
  updatedAt: number
  /** 服务器上对应草稿的 UID（0 表示尚未上传） */
  serverUid: number
  /** 服务器草稿所在文件夹 id */
  serverFolderId: string
  syncState: DraftSyncState
  syncedAt: number
}

export interface SendPayload {
  accountId: string
  to: string[]
  cc: string[]
  bcc: string[]
  subject: string
  text: string
  html: string
  attachments: { filename: string; path: string }[]
  inReplyTo: string
  references: string
  saveToSent: boolean
  /** 由草稿发送时携带，发送成功后需要清理该草稿（含服务器副本） */
  draftId?: string
}

/** 统一收件箱的虚拟文件夹 id：跨账户聚合所有收件箱 */
export const UNIFIED_INBOX_ID = '__unified_inbox__'

export interface ListQuery {
  accountId: string
  folderId: string
  /** 提供时按多个文件夹聚合查询（统一收件箱用），此时忽略 folderId */
  folderIds?: string[]
  labelId?: string
  limit: number
  offset: number
  unreadOnly: boolean
  flaggedOnly: boolean
  withAttachmentsOnly: boolean
  search: string
}

export interface SearchQuery {
  query: string
  accountId: string
  folderId: string
  limit: number
}

export interface SearchHit extends MessageSummary {
  accountName: string
  accountColor: string
  folderName: string
}

export interface SyncState {
  accountId: string
  folderId: string
  running: boolean
  progress: number
  message: string
  fetched: number
}

/** 自动更新状态（主进程维护，通过 update-state 事件推送给界面） */
export interface UpdateState {
  status:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error'
  /** 远端或本地版本号 */
  version?: string
  /** 下载进度百分比（0-100） */
  percent?: number
  /** 出错时的说明 */
  message?: string
}

export type MainEvent =
  | { type: 'sync-state'; payload: SyncState }
  | { type: 'update-state'; payload: UpdateState }
  | { type: 'messages-changed'; payload: { accountId: string; folderId: string } }
  | { type: 'folders-changed'; payload: { accountId: string } }
  | { type: 'accounts-changed'; payload: null }
  | { type: 'new-message'; payload: MessageSummary }
  | { type: 'error'; payload: { title: string; message: string } }
  | { type: 'toast'; payload: { level: 'info' | 'success' | 'error'; message: string } }
  | { type: 'compose-mailto'; payload: { to: string; subject: string; body: string } }
  | { type: 'lock-now'; payload: Record<string, never> }
  | { type: 'drafts-changed'; payload: null }

export interface AppSettings {
  theme: 'system' | 'light' | 'dark'
  fontSize: number
  checkIntervalMinutes: number
  notifications: boolean
  readPanePosition: 'right' | 'bottom'
  confirmBeforeDelete: boolean
  showSnippet: boolean
  autoStartSync: boolean
  markReadDelayMs: number
  language: string
  /** 毛玻璃透明背景（个别 Linux 合成器下关闭可避免窗口发黑） */
  transparentBackground: boolean
  /** IMAP IDLE 实时推送（新邮件即时到达） */
  idleEnabled: boolean
  /** 会话视图：同一主题的往来邮件折叠显示 */
  threadView: boolean
  /** 启用邮件自动翻译 */
  translateEnabled: boolean
  /** 翻译目标语言，如 zh-CN / en */
  translateTarget: string
  /** 自定义翻译服务地址（留空使用内置免费接口） */
  translateEndpoint: string
  /** 显示系统托盘图标（含未读提示） */
  trayEnabled: boolean
  /** 总是加载邮件中的远程图片（关闭隐私防护） */
  alwaysLoadImages: boolean
  /** 点击发送后的撤销窗口（秒，0 = 立即发送） */
  sendDelaySeconds: number
  /** 关闭主窗口时最小化到托盘而不是退出 */
  closeToTray: boolean
  syncDraftsToServer: boolean
  /** 开机自动启动 */
  openAtLogin: boolean
  /** 邮件列表密度 */
  listDensity: 'comfortable' | 'compact'
  /** 邮件列表栏宽度 */
  listWidth: number
}

export interface ProviderPreset {
  id: string
  name: string
  domains: string[]
  imap: Omit<ServerConfig, 'username'>
  smtp: Omit<ServerConfig, 'username'>
  oauth?: boolean
  note: string
}

export interface AutoconfigResult {
  imap: Omit<ServerConfig, 'username'>
  smtp: Omit<ServerConfig, 'username'>
  source: string
}
