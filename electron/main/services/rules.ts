import type { MessageSummary, Rule, RuleAction } from '@shared/types'
import { generateId, getDb, parseJson } from './db'

interface RuleRow {
  id: string
  account_id: string
  name: string
  enabled: number
  sort_order: number
  match_all: number
  conditions_json: string
  actions_json: string
}

function rowToRule(row: RuleRow): Rule {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    enabled: row.enabled === 1,
    order: row.sort_order,
    matchAll: row.match_all === 1,
    conditions: parseJson<Rule['conditions']>(row.conditions_json, []),
    actions: parseJson<Rule['actions']>(row.actions_json, [])
  }
}

export function listRules(accountId?: string): Rule[] {
  const db = getDb()
  const rows = accountId
    ? (db.prepare('SELECT * FROM rules WHERE account_id = ? OR account_id = "" ORDER BY sort_order').all(accountId) as RuleRow[])
    : (db.prepare('SELECT * FROM rules ORDER BY sort_order').all() as RuleRow[])
  return rows.map(rowToRule)
}

export function saveRule(rule: Partial<Rule>): Rule {
  const db = getDb()
  const id = rule.id || generateId('rule')
  const order = rule.order ?? (db.prepare('SELECT COUNT(*) AS c FROM rules').get() as { c: number }).c
  db.prepare(
    `INSERT INTO rules (id, account_id, name, enabled, sort_order, match_all, conditions_json, actions_json)
     VALUES (@id, @account_id, @name, @enabled, @sort_order, @match_all, @conditions_json, @actions_json)
     ON CONFLICT(id) DO UPDATE SET name=@name, enabled=@enabled, sort_order=@sort_order,
       match_all=@match_all, conditions_json=@conditions_json, actions_json=@actions_json`
  ).run({
    id,
    account_id: rule.accountId ?? '',
    name: rule.name ?? '新规则',
    enabled: rule.enabled === false ? 0 : 1,
    sort_order: order,
    match_all: rule.matchAll === false ? 0 : 1,
    conditions_json: JSON.stringify(rule.conditions ?? []),
    actions_json: JSON.stringify(rule.actions ?? [])
  })
  return rowToRule(db.prepare('SELECT * FROM rules WHERE id = ?').get(id) as RuleRow)
}

export function deleteRule(id: string): void {
  getDb().prepare('DELETE FROM rules WHERE id = ?').run(id)
}

function fieldValue(message: MessageSummary, field: string, bodyText: string): string {
  switch (field) {
    case 'from':
      return message.from.map((a) => `${a.name ?? ''} <${a.address}>`).join(' ')
    case 'to':
      return message.to.map((a) => `${a.name ?? ''} <${a.address}>`).join(' ')
    case 'subject':
      return message.subject
    case 'body':
      return `${message.snippet} ${bodyText}`
    default:
      return ''
  }
}

function matches(condition: Rule['conditions'][number], value: string): boolean {
  const target = condition.value ?? ''
  if (condition.operator === 'regex') {
    try {
      return new RegExp(target, 'i').test(value)
    } catch {
      return false
    }
  }
  const a = value.toLowerCase()
  const b = target.toLowerCase()
  switch (condition.operator) {
    case 'contains':
      return a.includes(b)
    case 'notContains':
      return !a.includes(b)
    case 'equals':
      return a === b
    case 'startsWith':
      return a.startsWith(b)
    default:
      return false
  }
}

/** 对收到的邮件执行过滤规则，返回需要执行的动作 */
export function applyRules(message: MessageSummary, bodyText: string): RuleAction[] {
  const rules = listRules(message.accountId).filter((r) => r.enabled)
  const actions: RuleAction[] = []
  for (const rule of rules) {
    const results = rule.conditions.map((c) => matches(c, fieldValue(message, c.field, bodyText)))
    if (!results.length) continue
    const hit = rule.matchAll ? results.every(Boolean) : results.some(Boolean)
    if (hit) actions.push(...rule.actions)
  }
  return actions
}
