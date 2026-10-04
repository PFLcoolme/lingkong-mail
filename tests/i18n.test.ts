import { describe, expect, it, vi } from 'vitest'

// i18n 模块间接依赖 store → api → window，这里只测纯函数，故把 store 打桩
vi.mock('@/store/app', () => ({
  useApp: Object.assign(() => undefined, {
    getState: () => ({ settings: { language: 'zh-CN' } }),
    setState: () => undefined
  })
}))

const { translateStatic } = await import('../src/lib/i18n')

describe('translateStatic', () => {
  it('默认输出中文', () => {
    expect(translateStatic('app.name')).toBe('空灵邮箱')
    expect(translateStatic('compose.send')).toBe('发送')
  })

  it('可切换英文', () => {
    expect(translateStatic('app.name', 'en')).toBe('Kongling Mail')
    expect(translateStatic('compose.send', 'en')).toBe('Send')
  })

  it('替换模板变量', () => {
    expect(translateStatic('sidebar.unread', 'zh-CN', { n: 3 })).toBe('3 封未读')
    expect(translateStatic('sidebar.unread', 'en', { n: 0 })).toBe('0 unread')
    expect(translateStatic('list.selected', 'zh-CN', { n: 12 })).toBe('已选 12')
  })

  it('缺少变量时保留占位符原样', () => {
    expect(translateStatic('sidebar.unread', 'zh-CN')).toBe('{n} 封未读')
  })

  it('未知键原样返回，便于发现漏配文案', () => {
    expect(translateStatic('not.exist.key')).toBe('not.exist.key')
  })

  it('变量值会被安全转成字符串', () => {
    expect(translateStatic('sidebar.unread', 'zh-CN', { n: '5' })).toBe('5 封未读')
  })
})
