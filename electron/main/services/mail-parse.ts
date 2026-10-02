import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { simpleParser, type AddressObject, type Attachment as ParserAttachment, type ParsedMail } from 'mailparser'
import type { Address, Attachment } from '@shared/types'
import { generateId, getAttachmentsDir } from './db'

export function toAddresses(input: AddressObject | AddressObject[] | undefined): Address[] {
  if (!input) return []
  const list = Array.isArray(input) ? input : [input]
  const result: Address[] = []
  for (const item of list) {
    for (const addr of item.value ?? []) {
      const address = (addr.address ?? '').trim()
      if (!address) continue
      result.push({ name: addr.name?.trim() || address, address })
    }
  }
  return result
}

export function addressesToText(list: Address[]): string {
  return list.map((a) => (a.name && a.name !== a.address ? `${a.name} <${a.address}>` : a.address)).join(', ')
}

export function addressesToJson(list: Address[]): string {
  return JSON.stringify(list)
}

export function buildSnippet(text: string, html: string): string {
  const plain = (text || html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
  return plain.slice(0, 220)
}

export function safeFilename(name: string): string {
  const base = (name || 'attachment').replace(/[/\\?%*:|"<>]/g, '_').slice(0, 120)
  return base || 'attachment'
}

export async function parseRawMail(source: string | Buffer): Promise<ParsedMail> {
  return simpleParser(source, { skipHtmlToText: false, skipTextToHtml: false })
}

/** 将附件写入本地磁盘，返回附件元数据 */
export function persistAttachments(messageId: string, items: ParserAttachment[]): Attachment[] {
  if (!items.length) return []
  const dir = join(getAttachmentsDir(), messageId.replace(/[^a-zA-Z0-9_-]/g, '_'))
  mkdirSync(dir, { recursive: true })
  const result: Attachment[] = []
  const used = new Set<string>()
  for (const item of items) {
    const filename = safeFilename(item.filename || `attachment-${item.contentId || result.length}`)
    let finalName = filename
    let counter = 1
    while (used.has(finalName)) {
      const dot = filename.lastIndexOf('.')
      finalName = dot > 0 ? `${filename.slice(0, dot)}-${counter}${filename.slice(dot)}` : `${filename}-${counter}`
      counter += 1
    }
    used.add(finalName)
    const path = join(dir, finalName)
    try {
      writeFileSync(path, item.content)
    } catch (error) {
      console.error('[附件] 写入失败', error)
      continue
    }
    result.push({
      id: generateId('att'),
      messageId,
      filename: finalName,
      mimeType: item.contentType || 'application/octet-stream',
      size: item.size || item.content.length,
      path,
      contentId: item.contentId ?? '',
      inline: Boolean(item.contentDisposition === 'inline' || item.contentId)
    })
  }
  return result
}

export interface ParsedMessagePayload {
  subject: string
  from: Address[]
  to: Address[]
  cc: Address[]
  bcc: Address[]
  date: number
  messageId: string
  inReplyTo: string
  bodyText: string
  bodyHtml: string
  snippet: string
  headers: Record<string, string>
  attachments: Attachment[]
}

export async function parseMessage(messageId: string, source: string | Buffer): Promise<ParsedMessagePayload> {
  const parsed = await parseRawMail(source)
  const headers: Record<string, string> = {}
  parsed.headerLines?.forEach((line) => {
    headers[line.key.toLowerCase()] = String(line.line)
  })
  const bodyHtml = typeof parsed.html === 'string' ? parsed.html : ''
  const bodyText = parsed.text ?? ''
  return {
    subject: parsed.subject ?? '(无主题)',
    from: toAddresses(parsed.from),
    to: toAddresses(parsed.to),
    cc: toAddresses(parsed.cc),
    bcc: [],
    date: parsed.date ? parsed.date.getTime() : Date.now(),
    messageId: parsed.messageId ?? '',
    inReplyTo: typeof parsed.inReplyTo === 'string' ? parsed.inReplyTo : '',
    bodyText,
    bodyHtml,
    snippet: buildSnippet(bodyText, bodyHtml),
    headers,
    attachments: persistAttachments(messageId, parsed.attachments ?? [])
  }
}
