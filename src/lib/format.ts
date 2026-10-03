export function formatDate(ts: number): string {
  if (!ts) return ''
  const date = new Date(ts)
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (sameDay) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }
  const yesterday = new Date(now.getTime() - 86400000)
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return '昨天'
  }
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

export function formatFullDate(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`
}

export function formatSize(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`
}

export function initials(input: string): string {
  const text = (input || '?').trim()
  const cjk = text.match(/[一-鿿]/)
  if (cjk) return cjk[0]
  const parts = text.split(/[\s._@-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return text.slice(0, 2).toUpperCase()
}

const PALETTE = ['#5b8def', '#e06c75', '#61afef', '#98c379', '#e5c07b', '#c678dd', '#56b6c2', '#d19a66']

export function colorFromString(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 100000
  }
  return PALETTE[hash % PALETTE.length]
}

export function shortAddress(list: { name?: string; address: string }[]): string {
  if (!list.length) return '(无发件人)'
  return list.map((a) => a.name || a.address).join('、')
}

/** 构造回复/转发时引用的原文 */
export function buildQuote(
  body: string,
  from: { name?: string; address: string }[],
  date: number,
  subject: string
): string {
  return [
    '',
    '',
    '---------- 原始邮件 ----------',
    `发件人: ${shortAddress(from)}`,
    `时间: ${formatFullDate(date)}`,
    `主题: ${subject}`,
    '',
    body ?? ''
  ].join('\n')
}

export function parseAddressInput(input: string): string[] {
  return input
    .split(/[,;，；\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}
