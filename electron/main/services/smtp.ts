import nodemailer, { type Transporter } from 'nodemailer'
import type { AccountConfig, SendPayload } from '@shared/types'
import type { AccountSecrets } from './accounts'
import { resolveAccessToken } from './accounts'
import { createImapClient } from './imap'

/** 发送邮件所需的账户信息（不要求运行时状态字段） */
export type MailAccount = AccountConfig & { id: string }

export function createTransport(account: MailAccount, secrets: AccountSecrets, accessToken: string): Transporter {
  const useOAuth = account.authType === 'oauth2'
  const auth = useOAuth
    ? ({
        type: 'OAuth2',
        user: account.outgoing.username || account.email,
        accessToken,
        clientId: account.oauthClientId,
        clientSecret: account.oauthClientSecret || undefined,
        refreshToken: secrets.refreshToken || undefined
      })
    : {
        user: account.outgoing.username || account.email,
        pass: secrets.password
      }
  const options = {
    host: account.outgoing.host,
    port: account.outgoing.port,
    secure: account.outgoing.security === 'ssl',
    requireTLS: account.outgoing.security === 'starttls',
    auth,
    tls: { minVersion: 'TLSv1.2' },
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 60000
  } as unknown as Parameters<typeof nodemailer.createTransport>[0]
  return nodemailer.createTransport(options)
}

export async function testSmtp(account: MailAccount, secrets: AccountSecrets): Promise<void> {
  const accessToken =
    account.authType === 'oauth2'
      ? secrets.accessToken && secrets.tokenExpires > Date.now() + 5000
        ? secrets.accessToken
        : await resolveAccessToken(account.id)
      : ''
  const transport = createTransport(account, secrets, accessToken)
  try {
    await transport.verify()
  } finally {
    transport.close()
  }
}

export async function sendMail(account: MailAccount, secrets: AccountSecrets, payload: SendPayload): Promise<string> {
  const accessToken = account.authType === 'oauth2' ? await resolveAccessToken(account.id) : ''
  const transport = createTransport(account, secrets, accessToken)
  try {
    const from = account.displayName
      ? `"${account.displayName}" <${account.email}>`
      : account.email
    const info = await transport.sendMail({
      from,
      to: payload.to.join(', '),
      cc: payload.cc.length ? payload.cc.join(', ') : undefined,
      bcc: payload.bcc.length ? payload.bcc.join(', ') : undefined,
      subject: payload.subject,
      text: payload.text,
      html: payload.html || undefined,
      inReplyTo: payload.inReplyTo || undefined,
      references: payload.references || undefined,
      attachments: payload.attachments.map((a) => ({ filename: a.filename, path: a.path }))
    })
    return info.messageId ?? ''
  } finally {
    transport.close()
  }
}

/** 将已发送邮件追加到服务器的“已发送”文件夹（IMAP APPEND） */
export async function appendToSent(account: MailAccount, secrets: AccountSecrets, raw: string): Promise<void> {
  if (account.protocol !== 'imap') return
  const { getDb } = await import('./db')
  const folder = getDb()
    .prepare("SELECT * FROM folders WHERE account_id = ? AND (type = 'sent' OR lower(path) LIKE '%sent%') LIMIT 1")
    .get(account.id) as { path: string } | undefined
  if (!folder) return
  const accessToken = account.authType === 'oauth2' ? await resolveAccessToken(account.id) : ''
  const client = await createImapClient(
    account.incoming,
    { user: account.incoming.username || account.email, password: secrets.password, accessToken },
    account.authType === 'oauth2'
  )
  try {
    await client.append(folder.path, Buffer.from(raw, 'utf8'), ['\\Seen'])
  } catch (error) {
    console.warn('[SMTP] 保存到已发送文件夹失败', error)
  } finally {
    try {
      await client.logout()
    } catch {
      /* ignore */
    }
  }
}

/** 构造原始邮件文本（用于保存到已发送文件夹） */
export function buildRawMessage(account: MailAccount, payload: SendPayload, messageId: string): string {
  const lines: string[] = []
  const addr = (list: string[]): string => (list.length ? list.join(', ') : '')
  lines.push(`From: ${account.displayName ? `"${account.displayName}" <${account.email}>` : account.email}`)
  if (payload.to.length) lines.push(`To: ${addr(payload.to)}`)
  if (payload.cc.length) lines.push(`Cc: ${addr(payload.cc)}`)
  lines.push(`Subject: ${payload.subject}`)
  lines.push(`Date: ${new Date().toUTCString()}`)
  lines.push(`Message-ID: ${messageId}`)
  if (payload.inReplyTo) lines.push(`In-Reply-To: ${payload.inReplyTo}`)
  if (payload.references) lines.push(`References: ${payload.references}`)
  lines.push('MIME-Version: 1.0')
  if (payload.html) {
    lines.push('Content-Type: text/html; charset=utf-8')
    lines.push('Content-Transfer-Encoding: base64')
    lines.push('')
    lines.push(Buffer.from(payload.html, 'utf8').toString('base64'))
  } else {
    lines.push('Content-Type: text/plain; charset=utf-8')
    lines.push('Content-Transfer-Encoding: base64')
    lines.push('')
    lines.push(Buffer.from(payload.text, 'utf8').toString('base64'))
  }
  return lines.join('\r\n')
}
