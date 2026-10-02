declare module 'mailparser' {
  export interface AddressObject {
    value?: { name?: string; address?: string; group?: unknown[] }[]
    text?: string
    html?: string
  }

  export interface HeaderLine {
    key: string
    line: string | string[]
  }

  export interface Attachment {
    type?: string
    filename?: string
    contentType: string
    contentDisposition?: string
    contentId?: string
    cid?: string
    size: number
    content: Buffer
    checksum?: string
    headers?: Map<string, unknown>
  }

  export interface ParsedMail {
    subject?: string
    from?: AddressObject
    to?: AddressObject | AddressObject[]
    cc?: AddressObject | AddressObject[]
    bcc?: AddressObject | AddressObject[]
    replyTo?: AddressObject
    date?: Date
    messageId?: string
    inReplyTo?: string
    references?: string | string[]
    text?: string
    textAsHtml?: string
    html?: string | false
    attachments: Attachment[]
    headerLines: HeaderLine[]
    headers?: Map<string, unknown>
  }

  export interface ParserOptions {
    [key: string]: unknown
  }

  export function simpleParser(source: string | Buffer, options?: ParserOptions): Promise<ParsedMail>
}
