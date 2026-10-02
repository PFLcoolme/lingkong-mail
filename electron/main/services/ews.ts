import type { SendPayload } from '@shared/types'

export interface EwsConfig {
  url: string
  username: string
  password: string
  accessToken: string
}

const NS = `xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types" xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages"`

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function envelope(body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?><soap:Envelope ${NS}><soap:Header><t:RequestServerVersion Version="Exchange2013"/></soap:Header><soap:Body>${body}</soap:Body></soap:Envelope>`
}

function extractAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g')
  const out: string[] = []
  let match: RegExpExecArray | null
  while ((match = re.exec(xml)) !== null) out.push(match[1])
  return out
}

function extractOne(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`))
  if (!match) return ''
  return match[1]
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function attr(block: string, name: string): string {
  return block.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? ''
}

export interface EwsFolder {
  id: string
  changeKey: string
  name: string
  distinguished: string
}

export interface EwsAttachmentRef {
  id: string
  name: string
  mimeType: string
  size: number
  contentId: string
  inline: boolean
}

export interface EwsMessage {
  itemId: string
  changeKey: string
  subject: string
  fromName: string
  fromAddress: string
  to: string[]
  cc: string[]
  date: number
  size: number
  hasAttachments: boolean
  isRead: boolean
  bodyHtml: string
  bodyText: string
  messageId: string
  inReplyTo: string
  attachments: EwsAttachmentRef[]
}

export class EwsError extends Error {}

/** Exchange Web Services (SOAP) 客户端 */
export class EwsClient {
  constructor(private readonly config: EwsConfig) {}

  private async request(body: string): Promise<string> {
    const headers: Record<string, string> = {
      'Content-Type': 'text/xml; charset=utf-8'
    }
    if (this.config.accessToken) {
      headers.Authorization = `Bearer ${this.config.accessToken}`
    } else {
      const basic = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')
      headers.Authorization = `Basic ${basic}`
    }
    const res = await fetch(this.config.url, { method: 'POST', headers, body: envelope(body) })
    const text = await res.text()
    const fault = text.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/)
    if (fault) throw new EwsError(fault[1])
    const code = text.match(/<m:ResponseCode>([\s\S]*?)<\/m:ResponseCode>/)?.[1]?.trim()
    if (code && code !== 'NoError') {
      const msg = text.match(/<m:MessageText>([\s\S]*?)<\/m:MessageText>/)?.[1]
      throw new EwsError(`${code}${msg ? `: ${msg}` : ''}`)
    }
    return text
  }

  async listFolders(): Promise<EwsFolder[]> {
    const xml = await this.request(
      `<m:FindFolder Traversal="Deep"><m:FolderShape><t:BaseShape>Default</t:BaseShape></m:FolderShape><m:ParentFolderIds><t:DistinguishedFolderId Id="msgfolderroot"/></m:ParentFolderIds></m:FindFolder>`
    )
    const blocks = extractAll(xml, 't:Folder')
    const folders: EwsFolder[] = []
    for (const block of blocks) {
      const idBlock = block.match(/<t:FolderId[^>]*\/>/)?.[0] ?? ''
      const id = attr(idBlock, 'Id')
      if (!id) continue
      folders.push({
        id,
        changeKey: attr(idBlock, 'ChangeKey'),
        name: extractOne(block, 't:DisplayName'),
        distinguished: (block.match(/<t:DistinguishedFolderId Id="([^"]+)"/)?.[1] ?? '')
      })
    }
    return folders
  }

  async findItemIds(folderId: string, max = 100): Promise<{ id: string; changeKey: string }[]> {
    const xml = await this.request(
      `<m:FindItem Traversal="Shallow"><m:ItemShape><t:BaseShape>IdOnly</t:BaseShape></m:ItemShape>` +
        `<m:IndexedPageItemView MaxEntriesReturned="${max}" Offset="0" BasePoint="Beginning"/>` +
        `<m:SortOrder><t:FieldOrder Order="Descending"><t:FieldURI FieldURI="item:DateTimeReceived"/></t:FieldOrder></m:SortOrder>` +
        `<m:ParentFolderIds><t:FolderId Id="${folderId}"/></m:ParentFolderIds></m:FindItem>`
    )
    return extractAll(xml, 't:ItemId').map((block) => ({
      id: attr(block, 'Id'),
      changeKey: attr(block, 'ChangeKey')
    }))
  }

  async getItems(ids: { id: string; changeKey: string }[]): Promise<EwsMessage[]> {
    if (!ids.length) return []
    const idXml = ids
      .map((i) => `<t:ItemId Id="${i.id}" ChangeKey="${i.changeKey}"/>`)
      .join('')
    const xml = await this.request(
      `<m:GetItem><m:ItemShape><t:BaseShape>AllProperties</t:BaseShape><t:BodyType>Best</t:BodyType>` +
        `<t:AdditionalProperties><t:FieldURI FieldURI="item:TextBody"/><t:ExtendedFieldURI PropertyTag="0x1082" PropertyType="String"/></t:AdditionalProperties>` +
        `</m:ItemShape><m:ItemIds>${idXml}</m:ItemIds></m:GetItem>`
    )
    const blocks = extractAll(xml, 't:Message')
    const messages: EwsMessage[] = []
    for (const block of blocks) {
      const idBlock = block.match(/<t:ItemId[^>]*\/>/)?.[0] ?? ''
      const fromBlock = extractOne(block, 't:From')
      const attachments: EwsAttachmentRef[] = extractAll(block, 't:FileAttachment').map((att) => ({
        id: attr(att.match(/<t:AttachmentId[^>]*\/>/)?.[0] ?? '', 'Id'),
        name: extractOne(att, 't:Name'),
        mimeType: extractOne(att, 't:ContentType'),
        size: Number(extractOne(att, 't:Size')) || 0,
        contentId: extractOne(att, 't:ContentId'),
        inline: extractOne(att, 't:IsInline') === 'true'
      }))
      const bodyHtml = extractOne(block, 't:Body')
      const bodyText = extractOne(block, 't:TextBody')
      messages.push({
        itemId: attr(idBlock, 'Id'),
        changeKey: attr(idBlock, 'ChangeKey'),
        subject: extractOne(block, 't:Subject') || '(无主题)',
        fromName: fromBlock ? extractOne(fromBlock, 't:Name') : '',
        fromAddress: fromBlock ? extractOne(fromBlock, 't:EmailAddress') : '',
        to: extractAll(block, 't:ToRecipients').flatMap((b) => extractAll(b, 't:EmailAddress')),
        cc: extractAll(block, 't:CcRecipients').flatMap((b) => extractAll(b, 't:EmailAddress')),
        date: Date.parse(extractOne(block, 't:DateTimeReceived')) || Date.now(),
        size: Number(extractOne(block, 't:Size')) || 0,
        hasAttachments: extractOne(block, 't:HasAttachments') === 'true',
        isRead: extractOne(block, 't:IsRead') === 'true',
        bodyHtml: bodyHtml.includes('<') ? bodyHtml : '',
        bodyText: bodyText || (bodyHtml.includes('<') ? '' : bodyHtml),
        messageId: extractOne(block, 't:InternetMessageId'),
        inReplyTo: extractOne(block, 't:InReplyTo'),
        attachments
      })
    }
    return messages
  }

  async getAttachment(id: string): Promise<{ name: string; mimeType: string; content: Buffer }> {
    const xml = await this.request(`<m:GetAttachment><m:AttachmentIds><t:AttachmentId Id="${id}"/></m:AttachmentIds></m:GetAttachment>`)
    const content = extractOne(xml, 't:Content')
    return {
      name: extractOne(xml, 't:Name'),
      mimeType: extractOne(xml, 't:ContentType'),
      content: Buffer.from(content, 'base64')
    }
  }

  async sendMessage(payload: SendPayload, from: string): Promise<void> {
    const recipients = (list: string[]): string =>
      list.map((email) => `<t:Mailbox><t:EmailAddress>${escapeXml(email)}</t:EmailAddress></t:Mailbox>`).join('')
    const to = payload.to.length ? `<t:ToRecipients>${recipients(payload.to)}</t:ToRecipients>` : ''
    const cc = payload.cc.length ? `<t:CcRecipients>${recipients(payload.cc)}</t:CcRecipients>` : ''
    const bcc = payload.bcc.length ? `<t:BccRecipients>${recipients(payload.bcc)}</t:BccRecipients>` : ''
    const bodyType = payload.html ? 'HTML' : 'Text'
    const body = payload.html || payload.text
    await this.request(
      `<m:CreateItem MessageDisposition="SendAndSaveCopy">` +
        `<m:SavedItemFolderId><t:DistinguishedFolderId Id="sentitems"/></m:SavedItemFolderId>` +
        `<m:Items><t:Message><t:Subject>${escapeXml(payload.subject)}</t:Subject>` +
        `<t:Body BodyType="${bodyType}">${escapeXml(body)}</t:Body>` +
        `${to}${cc}${bcc}` +
        `<t:From><t:Mailbox><t:EmailAddress>${escapeXml(from)}</t:EmailAddress></t:Mailbox></t:From>` +
        `</t:Message></m:Items></m:CreateItem>`
    )
  }

  async setRead(item: { id: string; changeKey: string }, read: boolean): Promise<void> {
    await this.request(
      `<m:UpdateItem MessageDisposition="SaveOnly" ConflictResolution="AlwaysOverwrite"><m:ItemChanges><t:ItemChange>` +
        `<t:ItemId Id="${item.id}" ChangeKey="${item.changeKey}"/><t:Updates><t:SetItemField>` +
        `<t:FieldURI FieldURI="message:IsRead"/><t:Message><t:IsRead>${read ? 'true' : 'false'}</t:IsRead></t:Message>` +
        `</t:SetItemField></t:Updates></t:ItemChange></m:ItemChanges></m:UpdateItem>`
    )
  }

  async moveItem(item: { id: string; changeKey: string }, folderId: string): Promise<void> {
    await this.request(
      `<m:MoveItem><m:ToFolderId><t:FolderId Id="${folderId}"/></m:ToFolderId>` +
        `<m:ItemIds><t:ItemId Id="${item.id}" ChangeKey="${item.changeKey}"/></m:ItemIds></m:MoveItem>`
    )
  }

  async deleteItem(item: { id: string; changeKey: string }): Promise<void> {
    await this.request(
      `<m:DeleteItem DeleteType="MoveToDeletedItems"><m:ItemIds><t:ItemId Id="${item.id}" ChangeKey="${item.changeKey}"/></m:ItemIds></m:DeleteItem>`
    )
  }
}

export async function testEws(config: EwsConfig): Promise<void> {
  const client = new EwsClient(config)
  await client.listFolders()
}

export function guessEwsUrl(email: string): string {
  const domain = email.split('@')[1] ?? ''
  if (/outlook\.com|hotmail|live\.|office365/.test(domain)) {
    return 'https://outlook.office365.com/EWS/Exchange.asmx'
  }
  return `https://mail.${domain}/EWS/Exchange.asmx`
}
