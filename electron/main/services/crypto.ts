import { safeStorage } from 'electron'

let warned = false

function warnOnce(): void {
  if (warned) return
  warned = true
  console.warn('[安全] 系统密钥环不可用，凭据将使用弱混淆方式保存')
}

/** 加密凭据，返回可安全存入数据库的字符串 */
export function encryptSecret(value: string): string | null {
  if (!value) return null
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(value).toString('base64')
  }
  warnOnce()
  return `plain:${Buffer.from(value, 'utf8').toString('base64')}`
}

/** 解密凭据，失败时返回空字符串 */
export function decryptSecret(value: string | null | undefined): string {
  if (!value) return ''
  try {
    if (value.startsWith('plain:')) {
      return Buffer.from(value.slice(6), 'base64').toString('utf8')
    }
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(value, 'base64'))
    }
  } catch (error) {
    console.error('[安全] 凭据解密失败', error)
  }
  return ''
}

export function isSecureStorageAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}
