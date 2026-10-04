import { readFileSync, statSync } from 'node:fs'
import type { Address, Message } from '@shared/types'

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

function encodeBase64(buffer: Buffer): string {
  return buffer.toString('base64').replace(/(.{76})/g, '$1\r\n')
}

function addressList(list: Address[]): string {
  return list
    .map((a) => (a.name && a.name !== a.address ? `"${a.name.replace(/"/g, '')}" <${a.address}>` : a.address))
    .join(', ')
}

function safeFilename(subject: string): string {
  const base = (subject || 'mail').replace(/[/\\?%*:|"<>]/g, '_').slice(0, 80)
  return base || 'mail'
}

/** 用本地缓存的数据重建 .eml 文件（正文 + 附件） */
export function buildEml(message: Message): string {
  const boundary = `----=_Kongling_${Date.now().toString(36)}`
  const lines: string[] = []
  lines.push(`From: ${addressList(message.from)}`)
  if (message.to.length) lines.push(`To: ${addressList(message.to)}`)
  if (message.cc.length) lines.push(`Cc: ${addressList(message.cc)}`)
  lines.push(`Subject: ${message.subject}`)
  lines.push(`Date: ${new Date(message.date).toUTCString()}`)
  if (message.messageId) lines.push(`Message-ID: ${message.messageId}`)
  if (message.inReplyTo) lines.push(`In-Reply-To: ${message.inReplyTo}`)
  lines.push('MIME-Version: 1.0')

  const attachments = message.attachments.filter((att) => {
    try {
      return statSync(att.path).size <= MAX_ATTACHMENT_BYTES
    } catch {
      return false
    }
  })

  if (attachments.length) {
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
    lines.push('')
    lines.push(`--${boundary}`)
  }

  if (message.bodyHtml) {
    lines.push('Content-Type: text/html; charset=utf-8')
    lines.push('Content-Transfer-Encoding: base64')
    lines.push('')
    lines.push(encodeBase64(Buffer.from(message.bodyHtml, 'utf8')))
  } else {
    lines.push('Content-Type: text/plain; charset=utf-8')
    lines.push('Content-Transfer-Encoding: base64')
    lines.push('')
    lines.push(encodeBase64(Buffer.from(message.bodyText ?? '', 'utf8')))
  }

  for (const att of attachments) {
    try {
      const data = readFileSync(att.path)
      lines.push(`--${boundary}`)
      lines.push(`Content-Type: ${att.mimeType || 'application/octet-stream'}; name="${att.filename}"`)
      lines.push('Content-Transfer-Encoding: base64')
      lines.push(`Content-Disposition: attachment; filename="${att.filename}"`)
      lines.push('')
      lines.push(encodeBase64(data))
    } catch {
      /* 跳过无法读取的附件 */
    }
  }

  if (attachments.length) lines.push(`--${boundary}--`)
  lines.push('')
  return lines.join('\r\n')
}

export function emlFilename(message: Message): string {
  return `${safeFilename(message.subject)}.eml`
}
