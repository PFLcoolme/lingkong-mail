import { create } from 'zustand'
import { api, onMainEvent, type PickedFile } from '@/lib/api'
import { buildQuote, parseAddressInput } from '@/lib/format'
import { translateStatic } from '@/lib/i18n'
import type {
  Account,
  OutboxItem,
  SavedSearch,
  SnoozedItem,
  AppSettings,
  Contact,
  Draft,
  Folder,
  MainEvent,
  Message,
  MessageSummary,
  Rule,
  SearchHit,
  SyncState,
  Template
} from '@shared/types'

export interface ComposerState {
  draftId?: string
  accountId: string
  mode: 'new' | 'reply' | 'replyAll' | 'forward'
  to: string
  cc: string
  bcc: string
  subject: string
  text: string
  html: string
  attachments: PickedFile[]
  inReplyTo: string
  references: string
  replyFolderId: string
  replyUid: number
  showCc: boolean
}

export interface Toast {
  id: number
  level: 'info' | 'success' | 'error'
  message: string
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  fontSize: 14,
  checkIntervalMinutes: 5,
  notifications: true,
  readPanePosition: 'right',
  confirmBeforeDelete: true,
  showSnippet: true,
  autoStartSync: true,
  markReadDelayMs: 800,
  language: 'zh-CN',
  transparentBackground: false,
  idleEnabled: true,
  threadView: true,
  translateEnabled: true,
  translateTarget: 'zh-CN',
  translateEndpoint: '',
  trayEnabled: true,
  alwaysLoadImages: false,
  sendDelaySeconds: 10,
  closeToTray: true,
  openAtLogin: false
}

interface AppState {
  ready: boolean
  accounts: Account[]
  folders: Folder[]
  messages: MessageSummary[]
  hasMoreMessages: boolean
  loadingMore: boolean
  activeAccountId: string
  activeFolderId: string
  selectedId: string | null
  current: Message | null
  unreadOnly: boolean
  withAttachments: boolean
  filterQuery: string
  searchTerm: string
  searchResults: SearchHit[] | null
  searching: boolean
  loadingMessages: boolean
  loadingMessage: boolean
  composer: ComposerState | null
  settingsOpen: boolean
  wizardOpen: boolean
  settings: AppSettings
  toasts: Toast[]
  syncing: Record<string, SyncState>
  drafts: Draft[]
  contacts: Contact[]
  rules: Rule[]
  templates: Template[]
  outbox: OutboxItem[]
  snoozed: SnoozedItem[]
  savedSearches: SavedSearch[]
  allowedImageSenders: string[]
  translation: string
  translating: boolean

  bootstrap: () => Promise<void>
  refreshAccounts: () => Promise<void>
  selectAccount: (id: string) => Promise<void>
  selectFolder: (id: string) => Promise<void>
  reloadMessages: () => Promise<void>
  loadMoreMessages: () => Promise<void>
  openMessage: (id: string) => Promise<void>
  setFilterQuery: (value: string) => void
  toggleUnreadOnly: () => void
  toggleWithAttachments: () => void
  runSearch: (term: string) => Promise<void>
  clearSearch: () => void
  syncNow: (full?: boolean) => Promise<void>
  markSeen: (ids: string[], seen: boolean) => Promise<void>
  flag: (ids: string[], value: boolean) => Promise<void>
  moveTo: (ids: string[], path: string) => Promise<void>
  remove: (ids: string[]) => Promise<void>
  compose: (options?: Partial<ComposerState>) => void
  replyTo: (all?: boolean) => void
  forwardMessage: () => void
  selectRelative: (delta: number) => void
  closeComposer: () => void
  sendComposer: (options?: { delaySeconds?: number; scheduledAt?: number }) => Promise<void>
  saveDraft: () => Promise<void>
  openDraft: (draft: Draft) => void
  deleteDraft: (id: string) => Promise<void>
  loadDrafts: () => Promise<void>
  loadContacts: () => Promise<void>
  loadRules: () => Promise<void>
  loadTemplates: () => Promise<void>
  loadOutbox: () => Promise<void>
  loadSnoozed: () => Promise<void>
  loadSavedSearches: () => Promise<void>
  snoozeMessages: (ids: string[], wakeAt: number) => Promise<void>
  wakeSnoozed: (messageId: string) => Promise<void>
  cancelScheduledSend: (id: string) => Promise<void>
  sendScheduledNow: (id: string) => Promise<void>
  saveSearch: (name: string, query: string) => Promise<void>
  removeSearch: (id: string) => Promise<void>
  translateCurrent: () => Promise<void>
  clearTranslation: () => void
  allowSenderImages: (address: string) => void
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  openSettings: () => void
  closeSettings: () => void
  openWizard: () => void
  closeWizard: () => void
  pushToast: (level: Toast['level'], message: string) => void
  dismissToast: (id: number) => void
}

function tr(key: string, vars?: Record<string, string | number>): string {
  const lang = useApp.getState().settings.language?.startsWith('en') ? 'en' : 'zh-CN'
  return translateStatic(key, lang, vars)
}

let toastSeq = 0
let searchTimer: number | undefined

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  accounts: [],
  folders: [],
  messages: [],
  hasMoreMessages: false,
  loadingMore: false,
  activeAccountId: '',
  activeFolderId: '',
  selectedId: null,
  current: null,
  unreadOnly: false,
  withAttachments: false,
  filterQuery: '',
  searchTerm: '',
  searchResults: null,
  searching: false,
  loadingMessages: false,
  loadingMessage: false,
  composer: null,
  settingsOpen: false,
  wizardOpen: false,
  settings: DEFAULT_SETTINGS,
  toasts: [],
  syncing: {},
  drafts: [],
  contacts: [],
  rules: [],
  templates: [],
  outbox: [],
  snoozed: [],
  savedSearches: [],
  allowedImageSenders: [],
  translation: '',
  translating: false,

  async loadTemplates() {
    set({ templates: await api.templatesList() })
  },

  async loadOutbox() {
    set({ outbox: await api.outboxList() })
  },

  async loadSnoozed() {
    set({ snoozed: await api.snoozeList() })
  },

  async loadSavedSearches() {
    set({ savedSearches: await api.searchesList() })
  },

  async snoozeMessages(ids: string[], wakeAt: number) {
    for (const id of ids) {
      const target = get().messages.find((m) => m.id === id)
      if (!target) continue
      await api.snoozeAdd({
        messageId: id,
        accountId: target.accountId,
        folderId: target.folderId,
        wakeAt
      })
    }
    await get().reloadMessages()
    await get().loadSnoozed()
    get().pushToast('info', '已设置稍后提醒')
  },

  async wakeSnoozed(messageId: string) {
    await api.snoozeWake(messageId)
    await get().reloadMessages()
    await get().loadSnoozed()
  },

  async cancelScheduledSend(id: string) {
    await api.outboxCancel(id)
    await get().loadOutbox()
    get().pushToast('info', '已取消发送')
  },

  async sendScheduledNow(id: string) {
    await api.outboxSendNow(id)
    await get().loadOutbox()
    get().pushToast('success', '已立即发送')
  },

  async saveSearch(name: string, query: string) {
    await api.searchSave({ name, query })
    await get().loadSavedSearches()
  },

  async removeSearch(id: string) {
    await api.searchDelete(id)
    await get().loadSavedSearches()
  },

  async translateCurrent() {
    const message = get().current
    if (!message) return
    if (get().translation) {
      set({ translation: '' })
      return
    }
    const settings = get().settings
    const source = message.bodyText || message.snippet
    if (!source.trim()) return
    set({ translating: true })
    try {
      const result = await api.translateText({
        text: source.slice(0, 20000),
        target: settings.translateTarget || 'zh-CN',
        endpoint: settings.translateEndpoint || undefined
      })
      set({ translation: result })
    } catch (error) {
      get().pushToast('error', error instanceof Error ? error.message : '翻译失败')
    } finally {
      set({ translating: false })
    }
  },

  clearTranslation() {
    set({ translation: '' })
  },

  allowSenderImages(address: string) {
    if (!address || get().allowedImageSenders.includes(address)) return
    set({ allowedImageSenders: [...get().allowedImageSenders, address] })
  },

  async bootstrap() {
    const settings = await api.settingsGet()
    set({ settings })
    document.documentElement.dataset.theme = resolveTheme(settings.theme)
    document.documentElement.style.fontSize = `${settings.fontSize}px`
    await get().refreshAccounts()
    await get().loadSavedSearches()
    await get().loadSnoozed()
    await get().loadOutbox()
    onMainEvent((event: MainEvent) => handleEvent(event, set, get))
    set({ ready: true })
  },

  async refreshAccounts() {
    const accounts = await api.accountsList()
    set({ accounts })
    const { activeAccountId } = get()
    const account = accounts.find((a) => a.id === activeAccountId) ?? accounts[0]
    if (account && (!get().folders.length || account.id !== activeAccountId)) {
      await get().selectAccount(account.id)
    } else if (!account) {
      set({ folders: [], messages: [], activeAccountId: '', activeFolderId: '' })
    }
  },

  async selectAccount(id: string) {
    set({ activeAccountId: id, selectedId: null, current: null })
    const folders = await api.foldersList(id)
    const inbox = folders.find((f) => f.type === 'inbox') ?? folders[0]
    set({ folders })
    if (inbox) await get().selectFolder(inbox.id)
  },

  async selectFolder(id: string) {
    set({ activeFolderId: id, selectedId: null, current: null, filterQuery: '' })
    await get().reloadMessages()
  },

  async reloadMessages() {
    const { activeAccountId, activeFolderId, unreadOnly, withAttachments, filterQuery } = get()
    if (!activeFolderId) return
    set({ loadingMessages: true })
    try {
      const pageSize = 120
      const messages = await api.messagesList({
        accountId: activeAccountId,
        folderId: activeFolderId,
        limit: pageSize,
        offset: 0,
        unreadOnly,
        flaggedOnly: false,
        withAttachmentsOnly: withAttachments,
        search: filterQuery
      })
      set({ messages, hasMoreMessages: messages.length >= pageSize })
    } finally {
      set({ loadingMessages: false })
    }
  },

  async loadMoreMessages() {
    const state = get()
    if (!state.hasMoreMessages || state.loadingMore || !state.activeFolderId) return
    set({ loadingMore: true })
    try {
      const pageSize = 120
      const more = await api.messagesList({
        accountId: state.activeAccountId,
        folderId: state.activeFolderId,
        limit: pageSize,
        offset: state.messages.length,
        unreadOnly: state.unreadOnly,
        flaggedOnly: false,
        withAttachmentsOnly: state.withAttachments,
        search: state.filterQuery
      })
      set({
        messages: [...state.messages, ...more],
        hasMoreMessages: more.length >= pageSize
      })
    } finally {
      set({ loadingMore: false })
    }
  },

  async openMessage(id: string) {
    set({ selectedId: id, loadingMessage: true, translation: '' })
    const message = await api.messageGet(id)
    set({ current: message, loadingMessage: false })
    const target = get().messages.find((m) => m.id === id)
    if (target && !target.seen) {
      set({ messages: get().messages.map((m) => (m.id === id ? { ...m, seen: true } : m)) })
      const folders = get().folders.map((f) =>
        f.id === target.folderId ? { ...f, unread: Math.max(0, f.unread - 1) } : f
      )
      set({ folders })
      void api.messagesMarkSeen([id], true).catch(() => undefined)
    }
  },

  setFilterQuery(value: string) {
    set({ filterQuery: value })
    window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => void get().reloadMessages(), 260)
  },

  toggleUnreadOnly() {
    set({ unreadOnly: !get().unreadOnly })
    void get().reloadMessages()
  },

  toggleWithAttachments() {
    set({ withAttachments: !get().withAttachments })
    void get().reloadMessages()
  },

  async runSearch(term: string) {
    if (!term.trim()) {
      set({ searchTerm: '', searchResults: null })
      return
    }
    set({ searchTerm: term, searching: true })
    try {
      const results = await api.search({
        query: term,
        accountId: '',
        folderId: '',
        limit: 100
      })
      set({ searchResults: results })
    } catch (error) {
      set({ searchResults: [] })
    } finally {
      set({ searching: false })
    }
  },

  clearSearch() {
    set({ searchTerm: '', searchResults: null })
  },

  async syncNow(full = false) {
    const { activeAccountId, activeFolderId } = get()
    if (!activeAccountId) return
    try {
      await api.messagesSync(activeAccountId, activeFolderId, full)
      const folders = await api.foldersList(activeAccountId)
      set({ folders })
      await get().reloadMessages()
      get().pushToast('success', tr('toast.synced'))
    } catch (error) {
      get().pushToast('error', error instanceof Error ? error.message : '同步失败')
    }
  },

  async markSeen(ids: string[], seen: boolean) {
    await api.messagesMarkSeen(ids, seen)
    set({ messages: get().messages.map((m) => (ids.includes(m.id) ? { ...m, seen } : m)) })
    void get().reloadMessages()
  },

  async flag(ids: string[], value: boolean) {
    await api.messagesFlag(ids, value)
    set({ messages: get().messages.map((m) => (ids.includes(m.id) ? { ...m, flagged: value } : m)) })
  },

  async moveTo(ids: string[], path: string) {
    await api.messagesMove(ids, path)
    set({ messages: get().messages.filter((m) => !ids.includes(m.id)) })
    if (ids.includes(get().selectedId ?? '')) set({ selectedId: null, current: null })
    get().pushToast('success', tr('toast.moved'))
  },

  async remove(ids: string[]) {
    if (get().settings.confirmBeforeDelete) {
      const label = ids.length > 1 ? `这 ${ids.length} 封邮件` : '这封邮件'
      if (!window.confirm(`确定删除${label}吗？`)) return
    }
    await api.messagesDelete(ids)
    set({ messages: get().messages.filter((m) => !ids.includes(m.id)) })
    if (ids.includes(get().selectedId ?? '')) set({ selectedId: null, current: null })
    get().pushToast('success', tr('toast.deleted'))
  },

  compose(options = {}) {
    const { activeAccountId, accounts } = get()
    const accountId = options.accountId ?? activeAccountId ?? accounts[0]?.id ?? ''
    const account = accounts.find((a) => a.id === accountId)
    const signature = account?.signature?.trim() ? `\n\n-- \n${account.signature.trim()}` : ''
    const body = options.text ? `${options.text.replace(/\s+$/, '')}${signature}` : signature
    set({
      composer: {
        accountId,
        mode: 'new',
        to: '',
        cc: '',
        bcc: '',
        subject: '',
        html: '',
        attachments: [],
        inReplyTo: '',
        references: '',
        replyFolderId: '',
        replyUid: 0,
        showCc: false,
        ...options,
        text: body
      }
    })
  },

  replyTo(all = false) {
    const message = get().current
    if (!message) return
    const recipients = all ? [...message.from, ...message.to] : message.from
    get().compose({
      mode: all ? 'replyAll' : 'reply',
      accountId: message.accountId,
      to: recipients.map((a) => a.address).join(', '),
      subject: /^re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`,
      text: buildQuote(message.bodyText, message.from, message.date, message.subject),
      inReplyTo: message.messageId,
      references: `${message.headers?.references ?? ''} ${message.messageId}`.trim(),
      replyFolderId: message.folderId,
      replyUid: message.uid
    })
  },

  forwardMessage() {
    const message = get().current
    if (!message) return
    get().compose({
      mode: 'forward',
      accountId: message.accountId,
      subject: /^fwd:/i.test(message.subject) ? message.subject : `Fwd: ${message.subject}`,
      text: buildQuote(message.bodyText, message.from, message.date, message.subject),
      attachments: message.attachments.map((a) => ({
        filename: a.filename,
        path: a.path,
        size: a.size,
        mimeType: a.mimeType
      }))
    })
  },

  selectRelative(delta: number) {
    const { messages, selectedId, openMessage } = get()
    if (!messages.length) return
    const index = messages.findIndex((m) => m.id === selectedId)
    const next = index < 0 ? 0 : Math.min(messages.length - 1, Math.max(0, index + delta))
    void openMessage(messages[next].id)
  },

  closeComposer() {
    set({ composer: null })
  },

  async sendComposer(options?: { delaySeconds?: number; scheduledAt?: number }) {
    const composer = get().composer
    if (!composer) return
    const result = await api.mailSend(
      {
      accountId: composer.accountId,
      to: parseAddressInput(composer.to),
      cc: parseAddressInput(composer.cc),
      bcc: parseAddressInput(composer.bcc),
      subject: composer.subject,
      text: composer.text,
      html: composer.html || `<div style="white-space:pre-wrap">${escapeHtml(composer.text)}</div>`,
      attachments: composer.attachments.map((a) => ({ filename: a.filename, path: a.path })),
      inReplyTo: composer.inReplyTo,
      references: composer.references,
        saveToSent: true
      },
      options
    )
    if (composer.draftId) await api.draftDelete(composer.draftId)
    set({ composer: null })
    if (result.scheduled && result.id) {
      get().pushToast('info', '邮件已排队，可在左侧「待发送」中撤销或立即发送')
    } else {
      get().pushToast('success', tr('toast.sent'))
    }
    await get().loadDrafts()
    await get().loadOutbox()
  },

  async saveDraft() {
    const composer = get().composer
    if (!composer) return
    const draft = await api.draftSave({
      id: composer.draftId,
      accountId: composer.accountId,
      to: composer.to,
      cc: composer.cc,
      bcc: composer.bcc,
      subject: composer.subject,
      bodyText: composer.text,
      bodyHtml: composer.html || '',
      inReplyTo: composer.inReplyTo,
      references: composer.references,
      replyFolderId: composer.replyFolderId,
      replyUid: composer.replyUid,
      attachments: composer.attachments.map((a) => a.path)
    })
    set({ composer: { ...composer, draftId: draft.id } })
    await get().loadDrafts()
    get().pushToast('info', tr('toast.draftSaved'))
  },

  openDraft(draft: Draft) {
    set({
      composer: {
        draftId: draft.id,
        accountId: draft.accountId,
        mode: 'new',
        to: draft.to,
        cc: draft.cc,
        bcc: draft.bcc,
        subject: draft.subject,
        text: draft.bodyText,
        html: draft.bodyHtml || '',
        attachments: draft.attachments.map((path) => ({
          filename: path.split('/').pop() ?? path,
          path,
          size: 0,
          mimeType: ''
        })),
        inReplyTo: draft.inReplyTo,
        references: draft.references,
        replyFolderId: draft.replyFolderId,
        replyUid: draft.replyUid,
        showCc: Boolean(draft.cc)
      }
    })
  },

  async deleteDraft(id: string) {
    await api.draftDelete(id)
    await get().loadDrafts()
  },

  async loadDrafts() {
    const drafts = await api.draftsList(get().activeAccountId)
    set({ drafts })
  },

  async loadContacts() {
    const contacts = await api.contactsList()
    set({ contacts })
  },

  async loadRules() {
    const rules = await api.rulesList()
    set({ rules })
  },

  async updateSettings(patch: Partial<AppSettings>) {
    const next = { ...get().settings, ...patch }
    set({ settings: next })
    document.documentElement.dataset.theme = resolveTheme(next.theme)
    document.documentElement.style.fontSize = `${next.fontSize}px`
    await api.settingsSet(patch)
  },

  openSettings() {
    set({ settingsOpen: true })
    void get().loadDrafts()
    void get().loadContacts()
    void get().loadRules()
    void get().loadTemplates()
  },

  closeSettings() {
    set({ settingsOpen: false })
  },

  openWizard() {
    set({ wizardOpen: true })
  },

  closeWizard() {
    set({ wizardOpen: false })
    void get().refreshAccounts()
  },

  pushToast(level, message) {
    toastSeq += 1
    const id = toastSeq
    set({ toasts: [...get().toasts, { id, level, message }] })
    window.setTimeout(() => get().dismissToast(id), level === 'error' ? 6000 : 3200)
  },

  dismissToast(id: number) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) })
  }
}))

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

function resolveTheme(theme: AppSettings['theme']): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

type SetState = (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void

function handleEvent(event: MainEvent, set: SetState, get: () => AppState): void {
  switch (event.type) {
    case 'sync-state': {
      const state = event.payload
      set({ syncing: { ...get().syncing, [state.folderId]: state } })
      break
    }
    case 'folders-changed': {
      if (event.payload.accountId === get().activeAccountId) {
        void api.foldersList(event.payload.accountId).then((folders) => set({ folders }))
      }
      break
    }
    case 'messages-changed': {
      if (event.payload.folderId === get().activeFolderId) {
        void get().reloadMessages()
      }
      break
    }
    case 'new-message': {
      if (event.payload.folderId === get().activeFolderId) {
        void get().reloadMessages()
      }
      break
    }
    case 'toast': {
      get().pushToast(event.payload.level, event.payload.message)
      break
    }
    case 'error': {
      get().pushToast('error', event.payload.message)
      break
    }
    case 'accounts-changed': {
      void get().refreshAccounts()
      break
    }
  }
}
