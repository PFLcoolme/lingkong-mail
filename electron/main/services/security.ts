import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { settingsGet, settingsSet } from './accounts'

interface LockConfig {
  enabled: boolean
  salt: string
  hash: string
}

const EMPTY: LockConfig = { enabled: false, salt: '', hash: '' }

function readConfig(): LockConfig {
  return { ...EMPTY, ...settingsGet<Partial<LockConfig>>('lock', {}) }
}

/** 是否开启了应用锁 */
export function lockStatus(): { enabled: boolean } {
  const config = readConfig()
  return { enabled: config.enabled && Boolean(config.hash) }
}

export function setPassword(password: string): void {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  const next: LockConfig = { enabled: true, salt, hash }
  settingsSet('lock', next)
}

export function clearPassword(): void {
  settingsSet('lock', EMPTY)
}

export function verifyPassword(password: string): boolean {
  const config = readConfig()
  if (!config.enabled || !config.hash) return true
  const candidate = scryptSync(password, config.salt, 64)
  const stored = Buffer.from(config.hash, 'hex')
  if (candidate.length !== stored.length) return false
  return timingSafeEqual(candidate, stored)
}
