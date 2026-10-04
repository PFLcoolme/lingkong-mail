import { beforeEach, describe, expect, it, vi } from 'vitest'

// 捕获 listMessages 实际拼出的 SQL 与参数，避免依赖真实 sqlite（Electron ABI 无法在 Node 下加载）
const { captured } = vi.hoisted(() => ({
  captured: { sql: '', args: [] as unknown[] }
}))

vi.mock('../electron/main/services/db', () => ({
  getDb: () => ({
    prepare: (sql: string) => ({
      all: (...args: unknown[]) => {
        captured.sql = sql
        captured.args = args
        return []
      },
      get: () => undefined,
      run: () => undefined
    })
  }),
  generateId: (prefix: string) => `${prefix}_1`,
  now: () => 0,
  parseJson: <T,>(text: string, fallback: T): T => {
    try {
      return JSON.parse(text) as T
    } catch {
      return fallback
    }
  },
  getAttachmentsDir: () => '/tmp/kongling-test-attachments'
}))

const { listMessages } = await import('../electron/main/services/messages')

const baseQuery = {
  accountId: '',
  folderId: '',
  limit: 120,
  offset: 0,
  unreadOnly: false,
  flaggedOnly: false,
  withAttachmentsOnly: false,
  search: ''
}

beforeEach(() => {
  captured.sql = ''
  captured.args = []
})

describe('listMessages 文件夹过滤', () => {
  it('单文件夹查询使用等值条件', () => {
    listMessages({ ...baseQuery, folderId: 'inbox_a' })
    expect(captured.sql).toContain('m.folder_id = ?')
    expect(captured.args).toContain('inbox_a')
    expect(captured.sql).not.toContain('m.folder_id IN (')
  })

  it('聚合查询（统一收件箱）使用 IN 条件并带上全部文件夹', () => {
    listMessages({ ...baseQuery, folderIds: ['inbox_a', 'inbox_b', 'inbox_c'] })
    expect(captured.sql).toContain('m.folder_id IN (?, ?, ?)')
    expect(captured.args.slice(0, 3)).toEqual(['inbox_a', 'inbox_b', 'inbox_c'])
  })

  it('聚合查询优先于单个 folderId', () => {
    listMessages({ ...baseQuery, folderId: 'inbox_a', folderIds: ['inbox_b'] })
    expect(captured.sql).toContain('IN (?)')
    expect(captured.args).toContain('inbox_b')
    expect(captured.args).not.toContain('inbox_a')
  })

  it('聚合文件夹为空时不退化成查询全部，直接返回空结果', () => {
    const result = listMessages({ ...baseQuery, folderIds: [] })
    expect(result).toEqual([])
    expect(captured.sql).toBe('')
  })

  it('没有指定文件夹时不加文件夹条件（配合 accountId 使用）', () => {
    listMessages({ ...baseQuery, accountId: 'acc1' })
    expect(captured.sql).toContain('m.account_id = ?')
    expect(captured.sql).not.toContain('m.folder_id')
  })
})

describe('listMessages 其他条件', () => {
  it('未读与附件过滤会写入 SQL', () => {
    listMessages({ ...baseQuery, folderId: 'inbox_a', unreadOnly: true, withAttachmentsOnly: true })
    expect(captured.sql).toContain('m.seen = 0')
    expect(captured.sql).toContain('m.attachment_count > 0')
  })

  it('搜索词同时匹配主题、摘要与发件人', () => {
    listMessages({ ...baseQuery, folderId: 'inbox_a', search: '发票' })
    expect(captured.sql).toContain('m.subject LIKE ?')
    expect(captured.sql).toContain('m.from_json LIKE ?')
    expect(captured.args.filter((arg) => arg === '%发票%')).toHaveLength(3)
  })

  it('始终排除已稍后提醒的邮件', () => {
    listMessages({ ...baseQuery, folderId: 'inbox_a' })
    expect(captured.sql).toContain('NOT IN (SELECT message_id FROM snoozed)')
  })

  it('分页参数按 limit/offset 追加在最后', () => {
    listMessages({ ...baseQuery, folderId: 'inbox_a', limit: 50, offset: 100 })
    const tail = captured.args.slice(-2)
    expect(tail).toEqual([50, 100])
  })
})
