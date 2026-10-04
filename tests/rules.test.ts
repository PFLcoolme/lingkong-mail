import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MessageSummary } from '../shared/types'

// rules 依赖 db（better-sqlite3 为 Electron ABI，Node 下加载会失败），这里只提供 listRules 需要的查询壳
const { state } = vi.hoisted(() => ({ state: { rows: [] as unknown[] } }))

vi.mock('../electron/main/services/db', () => ({
  getDb: () => ({ prepare: () => ({ all: () => state.rows }) }),
  generateId: (prefix: string) => `${prefix}_1`,
  parseJson: <T,>(text: string, fallback: T): T => {
    try {
      return JSON.parse(text) as T
    } catch {
      return fallback
    }
  }
}))

const { applyRules } = await import('../electron/main/services/rules')

interface ConditionInput {
  field: string
  operator: string
  value: string
}

function ruleRow(options: {
  enabled?: number
  matchAll?: number
  conditions?: ConditionInput[]
  actions?: { type: string; [key: string]: unknown }[]
}): unknown {
  return {
    id: 'r1',
    account_id: 'acc1',
    name: 'rule',
    enabled: options.enabled ?? 1,
    sort_order: 0,
    match_all: options.matchAll ?? 1,
    conditions_json: JSON.stringify(options.conditions ?? []),
    actions_json: JSON.stringify(options.actions ?? [{ type: 'markRead' }])
  }
}

function message(over: Partial<MessageSummary> = {}): MessageSummary {
  return {
    id: 'm1',
    accountId: 'acc1',
    folderId: 'inbox',
    uid: 1,
    subject: '本月发票已开具',
    snippet: '摘要内容',
    date: 0,
    from: [{ name: '张三', address: 'zhang@example.com' }],
    to: [{ name: '我', address: 'me@example.com' }],
    cc: [],
    bcc: [],
    unread: true,
    starred: false,
    hasAttachments: false,
    ...over
  } as MessageSummary
}

beforeEach(() => {
  state.rows = []
})

describe('applyRules 条件匹配', () => {
  it('主题包含关键词时返回动作', () => {
    state.rows = [
      ruleRow({ conditions: [{ field: 'subject', operator: 'contains', value: '发票' }] })
    ]
    expect(applyRules(message(), '')).toEqual([{ type: 'markRead' }])
  })

  it('不命中时返回空动作', () => {
    state.rows = [
      ruleRow({ conditions: [{ field: 'subject', operator: 'contains', value: '账单' }] })
    ]
    expect(applyRules(message(), '')).toEqual([])
  })

  it('匹配不区分大小写', () => {
    state.rows = [
      ruleRow({ conditions: [{ field: 'subject', operator: 'contains', value: 'INVOICE' }] })
    ]
    expect(applyRules(message({ subject: 'Your invoice is ready' }), '')).toEqual([
      { type: 'markRead' }
    ])
  })

  it('未启用的规则不生效', () => {
    state.rows = [
      ruleRow({
        enabled: 0,
        conditions: [{ field: 'subject', operator: 'contains', value: '发票' }]
      })
    ]
    expect(applyRules(message(), '')).toEqual([])
  })

  it('条件为空时不做任何事', () => {
    state.rows = [ruleRow({ conditions: [] })]
    expect(applyRules(message(), '')).toEqual([])
  })
})

describe('applyRules 匹配模式与运算符', () => {
  it('matchAll 为真时需要全部条件满足', () => {
    state.rows = [
      ruleRow({
        matchAll: 1,
        conditions: [
          { field: 'subject', operator: 'contains', value: '发票' },
          { field: 'from', operator: 'contains', value: 'other.com' }
        ]
      })
    ]
    expect(applyRules(message(), '')).toEqual([])
  })

  it('matchAll 为假时任一条件满足即可', () => {
    state.rows = [
      ruleRow({
        matchAll: 0,
        conditions: [
          { field: 'subject', operator: 'contains', value: '发票' },
          { field: 'from', operator: 'contains', value: 'other.com' }
        ]
      })
    ]
    expect(applyRules(message(), '')).toEqual([{ type: 'markRead' }])
  })

  it('支持 equals 与 startsWith', () => {
    state.rows = [
      ruleRow({ conditions: [{ field: 'subject', operator: 'equals', value: '本月发票已开具' }] })
    ]
    expect(applyRules(message(), '')).toHaveLength(1)

    state.rows = [
      ruleRow({ conditions: [{ field: 'subject', operator: 'startsWith', value: '本月' }] })
    ]
    expect(applyRules(message(), '')).toHaveLength(1)
  })

  it('支持 notContains', () => {
    state.rows = [
      ruleRow({ conditions: [{ field: 'subject', operator: 'notContains', value: '广告' }] })
    ]
    expect(applyRules(message(), '')).toHaveLength(1)
  })

  it('正则匹配忽略大小写', () => {
    state.rows = [
      ruleRow({ conditions: [{ field: 'subject', operator: 'regex', value: 'fa\\d+ture' }] })
    ]
    expect(applyRules(message({ subject: 'Invoice FA-2026' }), '')).toEqual([])
    expect(applyRules(message({ subject: 'Invoice FA123ture' }), '')).toHaveLength(1)
  })

  it('非法正则不会抛错，视为不匹配', () => {
    state.rows = [
      ruleRow({ conditions: [{ field: 'subject', operator: 'regex', value: '([未闭合' }] })
    ]
    expect(() => applyRules(message(), '')).not.toThrow()
    expect(applyRules(message(), '')).toEqual([])
  })

  it('未知运算符视为不匹配', () => {
    state.rows = [
      ruleRow({ conditions: [{ field: 'subject', operator: 'unknownOp', value: '发票' }] })
    ]
    expect(applyRules(message(), '')).toEqual([])
  })
})

describe('applyRules 字段取值', () => {
  it('正文匹配同时包含摘要与完整正文', () => {
    state.rows = [
      ruleRow({ conditions: [{ field: 'body', operator: 'contains', value: '关键词' }] })
    ]
    expect(applyRules(message({ snippet: '' }), '这里有关键词')).toHaveLength(1)
    expect(applyRules(message({ snippet: '关键词在摘要' }), '')).toHaveLength(1)
  })

  it('发件人匹配同时覆盖姓名与地址', () => {
    state.rows = [
      ruleRow({ conditions: [{ field: 'from', operator: 'contains', value: 'zhang@example.com' }] })
    ]
    expect(applyRules(message(), '')).toHaveLength(1)

    state.rows = [
      ruleRow({ conditions: [{ field: 'from', operator: 'contains', value: '张三' }] })
    ]
    expect(applyRules(message(), '')).toHaveLength(1)
  })

  it('收件人字段可匹配', () => {
    state.rows = [
      ruleRow({ conditions: [{ field: 'to', operator: 'contains', value: 'me@example.com' }] })
    ]
    expect(applyRules(message(), '')).toHaveLength(1)
  })

  it('未知字段取空串，contains 空值恒为真（记录当前行为）', () => {
    state.rows = [
      ruleRow({ conditions: [{ field: 'unknownField', operator: 'contains', value: 'x' }] })
    ]
    expect(applyRules(message(), '')).toEqual([])
  })
})

describe('applyRules 动作聚合', () => {
  it('多条规则命中时动作按顺序合并', () => {
    state.rows = [
      ruleRow({
        conditions: [{ field: 'subject', operator: 'contains', value: '发票' }],
        actions: [{ type: 'markRead' }]
      }),
      ruleRow({
        conditions: [{ field: 'from', operator: 'contains', value: 'zhang' }],
        actions: [{ type: 'star' }, { type: 'move', folderId: 'f2' }]
      })
    ]
    expect(applyRules(message(), '')).toEqual([
      { type: 'markRead' },
      { type: 'star' },
      { type: 'move', folderId: 'f2' }
    ])
  })
})
