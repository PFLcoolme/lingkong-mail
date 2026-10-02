import { create } from 'zustand'
import { api, onMainEvent, type PickedFile } from '@/lib/api'
import type {
  Account,
  AppSettings,
  Contact,
  Draft,
  Folder,
  MainEvent,
  Message,
  MessageSummary,
  Rule,
  SearchHit,
  SyncState
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
  transparentBackground: false
}

interface AppState {
  ready: boolean
  accounts: Account[]
  folders: Folder[]
  messages: MessageSummary[]
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

  bootstrap: () => Promise<void>
  refreshAccounts: () => Promise<void>
  selectAccount: (id: string) => Promise<void>
  selectFolder: (id: string) => Promise<void>
  reloadMessages: () => Promise<void>
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
  closeComposer: () => void
  sendComposer: () => Promise<void>
  saveDraft: () => Promise<void>
  openDraft: (draft: Draft) => void
  deleteDraft: (id: string) => Promise<void>
  loadDrafts: () => Promise<void>
  loadContacts: () => Promise<void>
  loadRules: () => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  openSettings: () => void
  closeSettings: () => void
  openWizard: () => void
  closeWizard: () => void
  pushToast: (level: Toast['level'], message: string) => void
  dismissToast: (id: number) => void
}

let toastSeq = 0
let searchTimer: number | undefined

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  accounts: [],
  folders: [],
  messages: [],
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

  async bootstrap() {
    const settings = await api.settingsGet()
    set({ settings })
    document.documentElement.dataset.theme = resolveTheme(settings.theme)
    document.documentElement.style.fontSize = `${settings.fontSize}px`
    await get().refreshAccounts()
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
      const messages = await api.messagesList({
        accountId: activeAccountId,
        folderId: activeFolderId,
        limit: 200,
        offset: 0,
        unreadOnly,
        flaggedOnly: false,
        withAttachmentsOnly: withAttachments,
        search: filterQuery
      })
      set({ messages })
    } finally {
      set({ loadingMessages: false })
    }
  },

  async openMessage(id: string) {
    set({ selectedId: id, loadingMessage: true })
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
      get().pushToast('success', '同步完成')
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
    get().pushToast('success', '已移动邮件')
  },

  async remove(ids: string[]) {
    await api.messagesDelete(ids)
    set({ messages: get().messages.filter((m) => !ids.includes(m.id)) })
    if (ids.includes(get().selectedId ?? '')) set({ selectedId: null, current: null })
    get().pushToast('success', '已删除邮件')
  },

  compose(options = {}) {
    const { activeAccountId, accounts, current } = get()
    set({
      composer: {
        accountId: options.accountId ?? activeAccountId ?? accounts[0]?.id ?? '',
        mode: 'new',
        to: '',
        cc: '',
        bcc: '',
        subject: '',
        text: '',
        attachments: [],
        inReplyTo: '',
        references: '',
        replyFolderId: '',
        replyUid: 0,
        showCc: false,
        ...options
      }
    })
    if (current && options.mode === 'reply') {
      // 引用原文占位由组件处理
    }
  },

  closeComposer() {
    set({ composer: null })
  },

  async sendComposer() {
    const composer = get().composer
    if (!composer) return
    const { parseAddressInput } = await import('@/lib/format')
    await api.mailSend({
      accountId: composer.accountId,
      to: parseAddressInput(composer.to),
      cc: parseAddressInput(composer.cc),
      bcc: parseAddressInput(composer.bcc),
      subject: composer.subject,
      text: composer.text,
      html: `<div style="white-space:pre-wrap">${escapeHtml(composer.text)}</div>`,
      attachments: composer.attachments.map((a) => ({ filename: a.filename, path: a.path })),
      inReplyTo: composer.inReplyTo,
      references: composer.references,
      saveToSent: true
    })
    if (composer.draftId) await api.draftDelete(composer.draftId)
    set({ composer: null })
    get().pushToast('success', '邮件已发送')
    await get().loadDrafts()
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
      bodyHtml: '',
      inReplyTo: composer.inReplyTo,
      references: composer.references,
      replyFolderId: composer.replyFolderId,
      replyUid: composer.replyUid,
      attachments: composer.attachments.map((a) => a.path)
    })
    set({ composer: { ...composer, draftId: draft.id } })
    await get().loadDrafts()
    get().pushToast('info', '草稿已保存')
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
