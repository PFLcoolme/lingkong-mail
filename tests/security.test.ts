import { beforeEach, describe, expect, it, vi } from 'vitest'

// security 依赖 accounts → db（Electron ABI 的原生模块），用内存 Map 顶替设置存取
const { store } = vi.hoisted(() => ({ store: new Map<string, unknown>() }))

vi.mock('../electron/main/services/accounts', () => ({
  settingsGet: (key: string, fallback: unknown) => (store.has(key) ? store.get(key) : fallback),
  settingsSet: (key: string, value: unknown) => {
    store.set(key, value)
  }
}))

const { clearPassword, lockStatus, setPassword, verifyPassword } = await import(
  '../electron/main/services/security'
)

beforeEach(() => {
  store.clear()
})

describe('应用锁', () => {
  it('默认未启用', () => {
    expect(lockStatus()).toEqual({ enabled: false })
  })

  it('未设置密码时任何输入都放行（未上锁即无需校验）', () => {
    expect(verifyPassword('')).toBe(true)
    expect(verifyPassword('随便什么')).toBe(true)
  })

  it('设置密码后启用锁定', () => {
    setPassword('123456')
    expect(lockStatus()).toEqual({ enabled: true })
  })

  it('正确密码通过，错误密码拒绝', () => {
    setPassword('correct horse')
    expect(verifyPassword('correct horse')).toBe(true)
    expect(verifyPassword('correct hors')).toBe(false)
    expect(verifyPassword('')).toBe(false)
    expect(verifyPassword('CORRECT HORSE')).toBe(false)
  })

  it('密码不以明文落库', () => {
    setPassword('super-secret')
    const serialized = JSON.stringify([...store.entries()])
    expect(serialized).not.toContain('super-secret')
  })

  it('相同密码两次设置会产生不同哈希（随机盐）', () => {
    setPassword('same-password')
    const first = { ...(store.get('lock') as { salt: string; hash: string }) }
    setPassword('same-password')
    const second = { ...(store.get('lock') as { salt: string; hash: string }) }
    expect(second.salt).not.toBe(first.salt)
    expect(second.hash).not.toBe(first.hash)
    // 新哈希仍然验证通过
    expect(verifyPassword('same-password')).toBe(true)
  })

  it('清除密码后恢复为未上锁并放行', () => {
    setPassword('123456')
    clearPassword()
    expect(lockStatus()).toEqual({ enabled: false })
    expect(verifyPassword('whatever')).toBe(true)
  })

  it('启用标记为真但哈希缺失时视为未上锁（避免把人锁在门外）', () => {
    store.set('lock', { enabled: true, salt: 'abc', hash: '' })
    expect(lockStatus()).toEqual({ enabled: false })
    expect(verifyPassword('anything')).toBe(true)
  })

  it('空密码也可作为密码使用', () => {
    setPassword('')
    expect(verifyPassword('')).toBe(true)
    expect(verifyPassword('not-empty')).toBe(false)
  })
})
