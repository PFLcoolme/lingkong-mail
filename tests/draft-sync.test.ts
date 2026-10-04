import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Draft } from '../shared/types'

const { state } = vi.hoisted(() => ({
  state: {
    draft: null as Draft | null,
    account: null as unknown,
    accountRow: null as unknown,
    folderRow: undefined as { id: string; path: string } | undefined,
    syncCalls: [] as { id: string; patch: Record<string, unknown> }[],
    appended: [] as { path: string; flags: string[] }[],
    deleted: [] as { path: string; uids: number[] }[],
    /** append 的返回：对象表示成功，false 表示 imapflow 的失败语义 */
    appendResult: { uid: 42 } as unknown,
    throwOnAppend: false,
    loggedOut: false
  }
}))

vi.mock('../electron/main/services/drafts', () => ({
  getDraft: () => state.draft,
  setDraftSync: (id: string, patch: Record<string, unknown>) => {
    state.syncCalls.push({ id, patch })
  }
}))

vi.mock('../electron/main/services/accounts', () => ({
  getAccount: () => state.account,
  getAccountRow: () => state.accountRow,
  getSecrets: () => ({ password: 'pw', accessToken: '', tokenExpires: 0 }),
  resolveAccessToken: async () => ''
}))

vi.mock('../electron/main/services/db', () => ({
  getDb: () => ({
    prepare: () => ({ get: () => state.folderRow })
  })
}))

vi.mock('../electron/main/services/imap', () => ({
  createImapClient: async () => ({
    append: async (path: string, _raw: Buffer, flags: string[]) => {
      if (state.throwOnAppend) throw new Error('connection reset')
      state.appended.push({ path, flags })
      return state.appendResult
    },
    logout: async () => {
      state.loggedOut = true
    }
  }),
  deleteMessagesRemote: async (_client: unknown, path: string, uids: number[]) => {
    state.deleted.push({ path, uids })
  }
}))

vi.mock('../electron/main/services/smtp', () => ({
  buildRawMessage: () => 'RAW MESSAGE CONTENT'
}))

const { removeServerDraft, uploadDraft } = await import('../electron/main/services/draft-sync')

function makeDraft(over: Partial<Draft> = {}): Draft {
  return {
    id: 'd1',
    accountId: 'acc1',
    to: 'a@x.com',
    cc: '',
    bcc: '',
    subject: '主题',
    bodyText: '正文',
    bodyHtml: '',
    inReplyTo: '',
    references: '',
    replyFolderId: '',
    replyUid: 0,
    attachments: [],
    forwardAttachments: [],
    updatedAt: 0,
    serverUid: 0,
    serverFolderId: '',
    syncState: 'none',
    syncedAt: 0,
    ...over
  }
}

beforeEach(() => {
  state.draft = makeDraft()
  state.account = {
    id: 'acc1',
    protocol: 'imap',
    authType: 'password',
    email: 'me@x.com',
    incoming: { username: '', host: 'imap.x.com', port: 993, security: 'ssl' }
  }
  state.accountRow = { id: 'acc1' }
  state.folderRow = { id: 'f_drafts', path: 'Drafts' }
  state.syncCalls = []
  state.appended = []
  state.deleted = []
  state.appendResult = { uid: 42 }
  state.throwOnAppend = false
  state.loggedOut = false
})

describe('uploadDraft', () => {
  it('草稿不存在时直接返回 false 且不联网', async () => {
    state.draft = null
    expect(await uploadDraft('missing')).toBe(false)
    expect(state.appended).toHaveLength(0)
  })

  it('找不到草稿箱文件夹时不上传', async () => {
    state.folderRow = undefined
    expect(await uploadDraft('d1')).toBe(false)
    expect(state.appended).toHaveLength(0)
  })

  it('非 IMAP 账户不同步（POP3/EWS 无草稿箱概念）', async () => {
    state.account = { id: 'acc1', protocol: 'pop3', email: 'me@x.com', incoming: {} }
    expect(await uploadDraft('d1')).toBe(false)
    expect(state.appended).toHaveLength(0)
  })

  it('上传成功：写入草稿箱并带上 \\Draft 标记，记录返回的 UID', async () => {
    expect(await uploadDraft('d1')).toBe(true)
    expect(state.appended).toEqual([{ path: 'Drafts', flags: ['\\Draft'] }])
    const last = state.syncCalls.at(-1)
    expect(last?.patch.state).toBe('synced')
    expect(last?.patch.serverUid).toBe(42)
    expect(last?.patch.serverFolderId).toBe('f_drafts')
    expect(typeof last?.patch.syncedAt).toBe('number')
  })

  it('上传过程中先标记为 pending', async () => {
    await uploadDraft('d1')
    expect(state.syncCalls[0].patch.state).toBe('pending')
  })

  it('重复保存已同步的草稿时，先删掉服务器上的旧副本再写新的', async () => {
    state.draft = makeDraft({ serverUid: 99, serverFolderId: 'f_drafts', syncState: 'synced' })
    await uploadDraft('d1')
    expect(state.deleted).toEqual([{ path: 'Drafts', uids: [99] }])
    expect(state.appended).toHaveLength(1)
  })

  it('草稿箱已变更时不误删旧文件夹里的邮件', async () => {
    state.draft = makeDraft({ serverUid: 99, serverFolderId: 'another_folder', syncState: 'synced' })
    await uploadDraft('d1')
    expect(state.deleted).toHaveLength(0)
    expect(state.appended).toHaveLength(1)
  })

  it('append 抛错时标记为 error 并返回 false', async () => {
    state.throwOnAppend = true
    expect(await uploadDraft('d1')).toBe(false)
    expect(state.syncCalls.at(-1)?.patch.state).toBe('error')
  })

  it('append 返回 false（imapflow 的失败语义）也视为失败，不能标成已同步', async () => {
    state.appendResult = false
    expect(await uploadDraft('d1')).toBe(false)
    expect(state.syncCalls.at(-1)?.patch.state).toBe('error')
    expect(state.syncCalls.at(-1)?.patch.serverUid).toBeUndefined()
  })
})

describe('removeServerDraft', () => {
  it('未同步过的草稿无需清理', async () => {
    await removeServerDraft(makeDraft())
    expect(state.deleted).toHaveLength(0)
  })

  it('已同步的草稿会从服务器删除对应 UID', async () => {
    await removeServerDraft(makeDraft({ serverUid: 7, serverFolderId: 'f_drafts' }))
    expect(state.deleted).toEqual([{ path: 'Drafts', uids: [7] }])
  })

  it('找不到文件夹路径时静默跳过', async () => {
    state.folderRow = undefined
    await removeServerDraft(makeDraft({ serverUid: 7, serverFolderId: 'gone' }))
    expect(state.deleted).toHaveLength(0)
  })
})
