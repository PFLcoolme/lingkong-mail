import { describe, expect, it } from 'vitest'
import { findPresetByEmail } from '../electron/main/services/providers'

describe('findPresetByEmail', () => {
  it('按域名精确匹配内置预设', () => {
    const qq = findPresetByEmail('user@qq.com')
    expect(qq).not.toBeNull()
    expect(qq?.domains).toContain('qq.com')
  })

  it('忽略大小写与首尾空白', () => {
    const lower = findPresetByEmail('user@qq.com')
    expect(findPresetByEmail('USER@QQ.COM')).toBe(lower)
    expect(findPresetByEmail('  user@qq.com  '.trim())).toBe(lower)
  })

  it('子域名回退到主域预设', () => {
    const qq = findPresetByEmail('user@qq.com')
    expect(findPresetByEmail('user@mail.qq.com')).toBe(qq)
  })

  it('相似域名不会被误匹配（防后缀绕过）', () => {
    expect(findPresetByEmail('user@mail.qq.com.evil.com')).toBeNull()
    expect(findPresetByEmail('user@notqq.com')).toBeNull()
  })

  it('未知域名与非法输入返回 null', () => {
    expect(findPresetByEmail('user@some-unknown-domain.tld')).toBeNull()
    expect(findPresetByEmail('no-at-sign')).toBeNull()
    expect(findPresetByEmail('')).toBeNull()
    // 只有 @ 没有域名
    expect(findPresetByEmail('user@')).toBeNull()
    expect(findPresetByEmail('@')).toBeNull()
  })

  it('仅给域名时也能匹配（函数只解析 @ 之后的部分）', () => {
    expect(findPresetByEmail('@qq.com')?.id).toBe('qq')
  })

  it('每个内置预设都带有可用的收发服务器配置', () => {
    const qq = findPresetByEmail('user@qq.com')
    expect(qq?.imap.host).toBeTruthy()
    expect(qq?.imap.port).toBeGreaterThan(0)
    expect(qq?.smtp.host).toBeTruthy()
    expect(['ssl', 'starttls', 'none']).toContain(qq?.imap.security)
  })
})
