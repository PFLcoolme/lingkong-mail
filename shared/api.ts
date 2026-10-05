import type {
  Account,
  OutboxItem,
  SavedSearch,
  SnoozedItem,
  UpdateState,
  AccountConfig,
  AccountCredentials,
  AppSettings,
  Attachment,
  AutoconfigResult,
  Contact,
  Draft,
  Folder,
  ListQuery,
  MainEvent,
  Message,
  MessageSummary,
  ProviderPreset,
  Rule,
  SearchHit,
  SearchQuery,
  SendPayload
} from './types'

export interface TestResult {
  ok: boolean
  message: string
  stage: 'incoming' | 'outgoing' | 'unknown'
}

export interface PickedFile {
  filename: string
  path: string
  size: number
  mimeType: string
}

/** 暴露给渲染进程的 API（经 preload 通过 contextBridge 提供） */
export interface AppApi {
  /* ---------- 账户 ---------- */
  accountsList(): Promise<Account[]>
  accountsAdd(config: Partial<AccountConfig>, credentials: Partial<AccountCredentials>): Promise<Account>
  accountsUpdate(id: string, patch: Partial<AccountConfig>, credentials?: Partial<AccountCredentials>): Promise<void>
  accountsRemove(id: string): Promise<void>
  accountsTest(config: Partial<AccountConfig>, credentials: Partial<AccountCredentials>): Promise<TestResult>
  accountsSetEnabled(id: string, enabled: boolean): Promise<void>

  /* ---------- 服务商自动配置 ---------- */
  providersList(): Promise<ProviderPreset[]>
  autoconfigDetect(email: string): Promise<AutoconfigResult | null>

  /* ---------- 文件夹 ---------- */
  foldersList(accountId: string): Promise<Folder[]>
  foldersSync(accountId: string): Promise<Folder[]>
  foldersCreate(accountId: string, name: string, parentPath: string): Promise<void>
  foldersRename(accountId: string, path: string, name: string): Promise<void>
  foldersDelete(accountId: string, path: string): Promise<void>
  foldersMarkAllRead(accountId: string, path: string): Promise<void>

  /* ---------- 邮件 ---------- */
  messagesList(query: ListQuery): Promise<MessageSummary[]>
  messageGet(id: string): Promise<Message | null>
  messagesSync(accountId: string, folderId: string, full?: boolean): Promise<number>
  messagesMarkSeen(ids: string[], seen: boolean): Promise<void>
  messagesFlag(ids: string[], flagged: boolean): Promise<void>
  messagesMove(ids: string[], targetFolderPath: string): Promise<void>
  messagesDelete(ids: string[]): Promise<void>

  /* ---------- 附件 ---------- */
  attachmentsPick(): Promise<PickedFile[]>
  attachmentSaveAs(attachmentId: string): Promise<string | null>
  attachmentOpen(attachmentId: string): Promise<void>

  /* ---------- 发送与草稿 ---------- */
  mailSend(
    payload: SendPayload,
    options?: { delaySeconds?: number; scheduledAt?: number }
  ): Promise<{ scheduled: boolean; id?: string; sendAt?: number }>
  outboxList(): Promise<OutboxItem[]>
  outboxCancel(id: string): Promise<void>
  outboxSendNow(id: string): Promise<void>
  snoozeList(): Promise<SnoozedItem[]>
  snoozeAdd(input: { messageId: string; accountId: string; folderId: string; wakeAt: number }): Promise<void>
  snoozeWake(messageId: string): Promise<void>
  searchesList(): Promise<SavedSearch[]>
  searchSave(search: { id?: string; name: string; query: string }): Promise<SavedSearch>
  searchDelete(id: string): Promise<void>
  draftsList(accountId: string): Promise<Draft[]>
  draftSave(draft: Partial<Draft>): Promise<Draft>
  draftDelete(id: string): Promise<void>
  draftSync(id: string): Promise<boolean>

  /* ---------- 搜索 ---------- */
  search(query: SearchQuery): Promise<SearchHit[]>

  /* ---------- 联系人与规则 ---------- */
  contactsList(accountId?: string): Promise<Contact[]>
  contactSave(contact: Partial<Contact>): Promise<void>
  contactDelete(id: string): Promise<void>
  rulesList(accountId?: string): Promise<Rule[]>
  ruleSave(rule: Partial<Rule>): Promise<Rule>
  ruleDelete(id: string): Promise<void>

  /* ---------- 设置与系统 ---------- */
  settingsGet(): Promise<AppSettings>
  settingsSet(patch: Partial<AppSettings>): Promise<void>
  oauthAuthorize(input: {
    provider: string
    clientId: string
    clientSecret: string
    tenant: string
    email: string
  }): Promise<{ refreshToken: string; email: string }>
  securityStatus(): Promise<{ enabled: boolean }>
  securityVerify(password: string): Promise<boolean>
  securitySetPassword(previous: string, next: string): Promise<boolean>
  securityClear(previous: string): Promise<boolean>
  appVersion(): Promise<string>
  updateState(): Promise<UpdateState>
  updateCheck(): Promise<UpdateState>
  updateDownload(): Promise<UpdateState>
  updateInstall(): Promise<boolean>
  backupCreate(): Promise<{ dir: string; size: number } | null>
  backupRestore(): Promise<boolean>
  openPath(path: string): Promise<void>
  openExternal(url: string): Promise<boolean>
  windowAction(action: 'minimize' | 'maximize' | 'close'): Promise<void>
  onEvent(listener: (event: MainEvent) => void): () => void
}

export type { Message, MessageSummary, Folder, Account, Attachment, Contact, Rule, Draft, SearchHit }
