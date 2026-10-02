import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi, PickedFile, TestResult } from '@shared/api'
import type {
  Account,
  AccountConfig,
  AccountCredentials,
  AppSettings,
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
} from '@shared/types'

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>
}

const api: AppApi = {
  accountsList: () => invoke<Account[]>('accounts:list'),
  accountsAdd: (config, credentials) => invoke<Account>('accounts:add', config, credentials),
  accountsUpdate: (id, patch, credentials) => invoke<void>('accounts:update', id, patch, credentials),
  accountsRemove: (id) => invoke<void>('accounts:remove', id),
  accountsTest: (config, credentials) => invoke<TestResult>('accounts:test', config, credentials),
  accountsSetEnabled: (id, enabled) => invoke<void>('accounts:set-enabled', id, enabled),

  providersList: () => invoke<ProviderPreset[]>('providers:list'),
  autoconfigDetect: (email) => invoke<AutoconfigResult | null>('autoconfig:detect', email),

  foldersList: (accountId) => invoke<Folder[]>('folders:list', accountId),
  foldersSync: (accountId) => invoke<Folder[]>('folders:sync', accountId),
  foldersCreate: (accountId, name, parentPath) => invoke<void>('folders:create', accountId, name, parentPath),
  foldersRename: (accountId, path, name) => invoke<void>('folders:rename', accountId, path, name),
  foldersDelete: (accountId, path) => invoke<void>('folders:delete', accountId, path),
  foldersMarkAllRead: (accountId, folderId) => invoke<void>('folders:mark-all-read', accountId, folderId),

  messagesList: (query) => invoke<MessageSummary[]>('messages:list', query),
  messageGet: (id) => invoke<Message | null>('message:get', id),
  messagesSync: (accountId, folderId, full) => invoke<number>('messages:sync', accountId, folderId, full),
  messagesMarkSeen: (ids, seen) => invoke<void>('messages:mark-seen', ids, seen),
  messagesFlag: (ids, flagged) => invoke<void>('messages:flag', ids, flagged),
  messagesMove: (ids, targetFolderPath) => invoke<void>('messages:move', ids, targetFolderPath),
  messagesDelete: (ids) => invoke<void>('messages:delete', ids),

  attachmentsPick: () => invoke<PickedFile[]>('attachments:pick'),
  attachmentSaveAs: (attachmentId) => invoke<string | null>('attachment:save-as', attachmentId),
  attachmentOpen: (attachmentId) => invoke<void>('attachment:open', attachmentId),

  mailSend: (payload) => invoke<void>('mail:send', payload),
  draftsList: (accountId) => invoke<Draft[]>('drafts:list', accountId),
  draftSave: (draft) => invoke<Draft>('draft:save', draft),
  draftDelete: (id) => invoke<void>('draft:delete', id),

  search: (query) => invoke<SearchHit[]>('search', query),

  contactsList: (accountId) => invoke<Contact[]>('contacts:list', accountId),
  contactSave: (contact) => invoke<void>('contact:save', contact),
  contactDelete: (id) => invoke<void>('contact:delete', id),
  rulesList: (accountId) => invoke<Rule[]>('rules:list', accountId),
  ruleSave: (rule) => invoke<Rule>('rule:save', rule),
  ruleDelete: (id) => invoke<void>('rule:delete', id),

  settingsGet: () => invoke<AppSettings>('settings:get'),
  settingsSet: (patch) => invoke<void>('settings:set', patch),
  oauthAuthorize: (input) =>
    invoke<{ refreshToken: string; email: string }>('oauth:authorize', input),
  appVersion: () => invoke<string>('app:version'),
  openPath: (path) => invoke<void>('app:open-path', path),
  windowAction: (action) => invoke<void>('window:action', action),

  onEvent: (listener: (event: MainEvent) => void) => {
    const handler = (_event: unknown, payload: MainEvent): void => listener(payload)
    ipcRenderer.on('main:event', handler)
    return () => {
      ipcRenderer.removeListener('main:event', handler)
    }
  }
}

const extra = {
  windowIsMaximized: () => invoke<boolean>('window:is-maximized'),
  windowSetTransparent: (enabled: boolean) => invoke<boolean>('window:set-transparent', enabled),
  onWindowState: (listener: (maximized: boolean) => void) => {
    const handler = (_event: unknown, value: boolean): void => listener(value)
    ipcRenderer.on('window:state', handler)
    return () => {
      ipcRenderer.removeListener('window:state', handler)
    }
  },
  accountsUpdateRaw: (config: AccountConfig, credentials: AccountCredentials) =>
    invoke<void>('accounts:update', config.id, config, credentials),
  messageSummary: (id: string) => invoke<MessageSummary | null>('message:summary', id),
  contactsSearch: (query: string, accountId?: string) => invoke<Contact[]>('contacts:search', query, accountId),
  folderRefreshStats: (folderId: string) => invoke<boolean>('folder:refresh-stats', folderId),
  messagesLocalDelete: (ids: string[]) => invoke<void>('messages:local-delete', ids),
  messagesCount: (folderId: string) => invoke<number>('messages:count', folderId),
  appToast: (level: 'info' | 'success' | 'error', message: string) => invoke<void>('app:toast', level, message)
}

contextBridge.exposeInMainWorld('api', { ...api, ...extra })

export type RendererApi = AppApi & typeof extra

declare global {
  interface Window {
    api: RendererApi
  }
}

export type { ListQuery, SearchQuery, SendPayload, Draft, MainEvent }
