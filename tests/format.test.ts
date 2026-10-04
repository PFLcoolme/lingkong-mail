import { describe, expect, it } from 'vitest'
import {
  buildQuote,
  colorFromString,
  formatDate,
  formatFullDate,
  formatSize,
  initials,
  parseAddressInput,
  shortAddress
} from '../src/lib/format'

describe('formatSize', () => {
  it('零值与字节', () => {
    expect(formatSize(0)).toBe('0 B')
    expect(formatSize(512)).toBe('512 B')
  })

  it('小于 10 的单位保留一位小数，其余取整', () => {
    expect(formatSize(1024)).toBe('1.0 KB')
    expect(formatSize(1536)).toBe('1.5 KB')
    expect(formatSize(20 * 1024)).toBe('20 KB')
    expect(formatSize(1024 * 1024)).toBe('1.0 MB')
  })

  it('最大单位为 GB，不再继续进位', () => {
    expect(formatSize(3 * 1024 ** 3)).toBe('3.0 GB')
    expect(formatSize(2048 * 1024 ** 3)).toBe('2048 GB')
  })
})

describe('initials', () => {
  it('中文取首字', () => {
    expect(initials('张三')).toBe('张')
  })

  it('西文取前两段首字母并大写', () => {
    expect(initials('john doe')).toBe('JD')
    expect(initials('john@example.com')).toBe('JE')
  })

  it('单段文本取前两个字符', () => {
    expect(initials('ab')).toBe('AB')
  })

  it('空值回退为问号', () => {
    expect(initials('')).toBe('?')
  })
})

describe('parseAddressInput', () => {
  it('按中英文逗号、分号与空白切分', () => {
    expect(parseAddressInput('a@x.com, b@x.com')).toEqual(['a@x.com', 'b@x.com'])
    expect(parseAddressInput('a@x.com；b@x.com')).toEqual(['a@x.com', 'b@x.com'])
    expect(parseAddressInput('a@x.com  b@x.com')).toEqual(['a@x.com', 'b@x.com'])
  })

  it('过滤空片段', () => {
    expect(parseAddressInput('  ,  ;  ')).toEqual([])
    expect(parseAddressInput('')).toEqual([])
  })
})

describe('shortAddress', () => {
  it('优先显示姓名，多个用顿号连接', () => {
    expect(shortAddress([{ name: '张三', address: 'z@x.com' }])).toBe('张三')
    expect(
      shortAddress([
        { name: '张三', address: 'z@x.com' },
        { address: 'l@x.com' }
      ])
    ).toBe('张三、l@x.com')
  })

  it('无收件人时给出占位文案', () => {
    expect(shortAddress([])).toBe('(无发件人)')
  })
})

describe('buildQuote', () => {
  it('包含分隔标记、发件人、主题与原文', () => {
    const quoted = buildQuote('原始正文', [{ name: '张三', address: 'z@x.com' }], 0, '周报')
    expect(quoted).toContain('---------- 原始邮件 ----------')
    expect(quoted).toContain('发件人: 张三')
    expect(quoted).toContain('主题: 周报')
    expect(quoted).toContain('原始正文')
  })

  it('正文为空时不产生 undefined', () => {
    const quoted = buildQuote('', [], 0, '')
    expect(quoted).not.toContain('undefined')
  })
})

describe('时间格式化', () => {
  it('时间戳为 0 时返回空串', () => {
    expect(formatDate(0)).toBe('')
    expect(formatFullDate(0)).toBe('')
  })

  it('当天显示时分', () => {
    const now = new Date()
    now.setHours(9, 5, 0, 0)
    expect(formatDate(now.getTime())).toBe('09:05')
  })

  it('昨天显示“昨天”', () => {
    const yesterday = new Date(Date.now() - 86400000)
    // 避免跨天边界带来的歧义：仅当“昨天”仍是昨日时才断言
    const isYesterday = new Date().getDate() !== yesterday.getDate()
    if (isYesterday) expect(formatDate(yesterday.getTime())).toBe('昨天')
  })

  it('完整时间包含年月与时分', () => {
    expect(formatFullDate(new Date(2026, 0, 2, 3, 4).getTime())).toBe('2026年1月2日 03:04')
  })
})

describe('colorFromString', () => {
  it('同一输入稳定返回同一颜色', () => {
    expect(colorFromString('a@x.com')).toBe(colorFromString('a@x.com'))
  })

  it('返回十六进制色值', () => {
    expect(colorFromString('someone@example.com')).toMatch(/^#[0-9a-f]{6}$/)
  })
})
