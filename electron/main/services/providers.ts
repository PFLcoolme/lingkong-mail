import { resolveSrv } from 'node:dns/promises'
import type { AutoconfigResult, ProviderPreset, SecurityType } from '@shared/types'

type Server = Omit<import('@shared/types').ServerConfig, 'username'>

function srv(host: string, port: number, security: SecurityType): Server {
  return { host, port, security }
}

export const PROVIDERS: ProviderPreset[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    domains: ['gmail.com', 'googlemail.com'],
    imap: srv('imap.gmail.com', 993, 'ssl'),
    smtp: srv('smtp.gmail.com', 465, 'ssl'),
    oauth: true,
    note: '需在 Google 账号中开启 IMAP；若开启了两步验证请使用应用专用密码或 OAuth2'
  },
  {
    id: 'outlook',
    name: 'Outlook / Hotmail',
    domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com'],
    imap: srv('outlook.office365.com', 993, 'ssl'),
    smtp: srv('smtp.office365.com', 587, 'starttls'),
    oauth: true,
    note: '微软个人邮箱推荐使用 OAuth2 登录'
  },
  {
    id: 'qq',
    name: 'QQ 邮箱',
    domains: ['qq.com', 'vip.qq.com', 'foxmail.com'],
    imap: srv('imap.qq.com', 993, 'ssl'),
    smtp: srv('smtp.qq.com', 465, 'ssl'),
    note: '需在邮箱设置中开启 IMAP/SMTP 服务，并使用授权码作为密码'
  },
  {
    id: 'netease-163',
    name: '网易 163 邮箱',
    domains: ['163.com'],
    imap: srv('imap.163.com', 993, 'ssl'),
    smtp: srv('smtp.163.com', 465, 'ssl'),
    note: '需开启 IMAP/SMTP 并使用授权码'
  },
  {
    id: 'netease-126',
    name: '网易 126 邮箱',
    domains: ['126.com'],
    imap: srv('imap.126.com', 993, 'ssl'),
    smtp: srv('smtp.126.com', 465, 'ssl'),
    note: '需开启 IMAP/SMTP 并使用授权码'
  },
  {
    id: 'netease-yeah',
    name: '网易 Yeah 邮箱',
    domains: ['yeah.net'],
    imap: srv('imap.yeah.net', 993, 'ssl'),
    smtp: srv('smtp.yeah.net', 465, 'ssl'),
    note: '需开启 IMAP/SMTP 并使用授权码'
  },
  {
    id: 'exmail-qq',
    name: '腾讯企业邮',
    domains: ['exmail.qq.com'],
    imap: srv('imap.exmail.qq.com', 993, 'ssl'),
    smtp: srv('smtp.exmail.qq.com', 465, 'ssl'),
    note: '企业邮箱，使用完整邮箱地址作为用户名'
  },
  {
    id: 'qiye-163',
    name: '网易企业邮',
    domains: ['qiye.163.com'],
    imap: srv('imaphm.qiye.163.com', 993, 'ssl'),
    smtp: srv('smtphm.qiye.163.com', 994, 'ssl'),
    note: '企业邮箱需要使用授权码登录'
  },
  {
    id: 'aliyun',
    name: '阿里云邮箱',
    domains: ['aliyun.com'],
    imap: srv('imap.aliyun.com', 993, 'ssl'),
    smtp: srv('smtp.aliyun.com', 465, 'ssl'),
    note: '需在设置中开启 IMAP/SMTP'
  },
  {
    id: '139',
    name: '中国移动 139 邮箱',
    domains: ['139.com'],
    imap: srv('imap.139.com', 993, 'ssl'),
    smtp: srv('smtp.139.com', 465, 'ssl'),
    note: '需在设置中开启 IMAP/SMTP'
  },
  {
    id: 'sina',
    name: '新浪邮箱',
    domains: ['sina.com', 'sina.cn'],
    imap: srv('imap.sina.com', 993, 'ssl'),
    smtp: srv('smtp.sina.com', 465, 'ssl'),
    note: '需在设置中开启 IMAP/SMTP'
  },
  {
    id: 'sohu',
    name: '搜狐邮箱',
    domains: ['sohu.com'],
    imap: srv('imap.sohu.com', 993, 'ssl'),
    smtp: srv('smtp.sohu.com', 465, 'ssl'),
    note: '需在设置中开启 IMAP/SMTP'
  },
  {
    id: 'yahoo',
    name: 'Yahoo Mail',
    domains: ['yahoo.com', 'yahoo.co.jp', 'yahoo.fr'],
    imap: srv('imap.mail.yahoo.com', 993, 'ssl'),
    smtp: srv('smtp.mail.yahoo.com', 465, 'ssl'),
    note: '需生成应用专用密码'
  },
  {
    id: 'icloud',
    name: 'iCloud Mail',
    domains: ['icloud.com', 'me.com', 'mac.com'],
    imap: srv('imap.mail.me.com', 993, 'ssl'),
    smtp: srv('smtp.mail.me.com', 587, 'starttls'),
    note: '需生成应用专用密码'
  },
  {
    id: 'zoho',
    name: 'Zoho Mail',
    domains: ['zoho.com', 'zohomail.com'],
    imap: srv('imap.zoho.com', 993, 'ssl'),
    smtp: srv('smtp.zoho.com', 465, 'ssl'),
    note: '需开启 IMAP 访问'
  },
  {
    id: 'fastmail',
    name: 'Fastmail',
    domains: ['fastmail.com', 'fastmail.fm'],
    imap: srv('imap.fastmail.com', 993, 'ssl'),
    smtp: srv('smtp.fastmail.com', 465, 'ssl'),
    note: '需生成应用专用密码'
  },
  {
    id: 'proton',
    name: 'Proton Mail（需 Bridge）',
    domains: ['proton.me', 'protonmail.com', 'pm.me'],
    imap: srv('127.0.0.1', 1143, 'none'),
    smtp: srv('127.0.0.1', 1025, 'none'),
    note: 'Proton 需先运行 Proton Mail Bridge 本地代理'
  },
  {
    id: 'gmx',
    name: 'GMX',
    domains: ['gmx.com', 'gmx.de', 'gmx.net'],
    imap: srv('imap.gmx.com', 993, 'ssl'),
    smtp: srv('mail.gmx.com', 587, 'starttls'),
    note: '需在设置中开启 IMAP/SMTP'
  },
  {
    id: 'yandex',
    name: 'Yandex Mail',
    domains: ['yandex.ru', 'yandex.com'],
    imap: srv('imap.yandex.com', 993, 'ssl'),
    smtp: srv('smtp.yandex.com', 465, 'ssl'),
    note: '需开启 IMAP 并使用应用密码'
  }
]

export function findPresetByEmail(email: string): ProviderPreset | null {
  const domain = email.split('@')[1]?.toLowerCase().trim()
  if (!domain) return null
  const exact = PROVIDERS.find((p) => p.domains.includes(domain))
  if (exact) return exact
  const suffix = PROVIDERS.find((p) => p.domains.some((d) => domain.endsWith(`.${d}`)))
  return suffix ?? null
}

function parseAutoconfigXml(xml: string): AutoconfigResult | null {
  const pick = (tag: string): { host: string; port: number; security: SecurityType } | null => {
    const block = xml.match(new RegExp(`<${tag}[\\s\\S]*?</${tag}>`, 'i'))?.[0]
    if (!block) return null
    const host = block.match(/<hostname>([^<]+)<\/hostname>/i)?.[1]?.trim()
    const port = Number(block.match(/<port>([^<]+)<\/port>/i)?.[1]?.trim() ?? 0)
    const socket = block.match(/<socketType>([^<]+)<\/socketType>/i)?.[1]?.trim().toUpperCase()
    if (!host || !port) return null
    const security: SecurityType = socket === 'SSL' ? 'ssl' : socket === 'STARTTLS' ? 'starttls' : 'none'
    return { host, port, security }
  }
  const imap = pick('incomingServer')
  const smtp = pick('outgoingServer')
  if (!imap || !smtp) return null
  return { imap, smtp, source: 'autoconfig' }
}

async function fetchText(url: string, timeoutMs = 4000): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function detectBySrv(domain: string): Promise<AutoconfigResult | null> {
  try {
    const [imaps, submission] = await Promise.all([
      resolveSrv(`_imaps._tcp.${domain}`).catch(() => null),
      resolveSrv(`_submission._tcp.${domain}`).catch(() => null)
    ])
    const imapEntry = imaps?.[0]
    const smtpEntry = submission?.[0]
    if (!imapEntry || !smtpEntry) return null
    return {
      imap: { host: imapEntry.name.replace(/\.$/, ''), port: imapEntry.port, security: 'ssl' },
      smtp: { host: smtpEntry.name.replace(/\.$/, ''), port: smtpEntry.port, security: 'starttls' },
      source: 'srv'
    }
  } catch {
    return null
  }
}

/** 依据邮箱地址探测 IMAP/SMTP 服务器配置 */
export async function autodetect(email: string): Promise<AutoconfigResult | null> {
  const preset = findPresetByEmail(email)
  if (preset) {
    return { imap: { ...preset.imap }, smtp: { ...preset.smtp }, source: `preset:${preset.id}` }
  }
  const domain = email.split('@')[1]?.toLowerCase().trim()
  if (!domain) return null

  const urls = [
    `https://autoconfig.${domain}/mail/config-v1.1.xml?emailaddress=${encodeURIComponent(email)}`,
    `https://${domain}/.well-known/autoconfig/mail/config-v1.1.xml`,
    `http://autoconfig.${domain}/mail/config-v1.1.xml?emailaddress=${encodeURIComponent(email)}`
  ]
  for (const url of urls) {
    const xml = await fetchText(url)
    if (!xml) continue
    const parsed = parseAutoconfigXml(xml)
    if (parsed) return parsed
  }

  const guessed: AutoconfigResult = {
    imap: { host: `imap.${domain}`, port: 993, security: 'ssl' },
    smtp: { host: `smtp.${domain}`, port: 465, security: 'ssl' },
    source: 'guess'
  }

  const srvResult = await detectBySrv(domain)
  if (srvResult) return srvResult

  const probeHosts = [`mail.${domain}`, `imap.${domain}`]
  for (const host of probeHosts) {
    const ok = await canReach(host, 993)
    if (ok) {
      guessed.imap = { host, port: 993, security: 'ssl' }
      guessed.smtp = { host: host.replace(/^imap\./, 'smtp.'), port: 465, security: 'ssl' }
      guessed.source = 'probe'
      break
    }
  }
  return guessed
}

/** TCP 连通性探测（用于自动发现兜底） */
export async function canReach(host: string, port: number, timeoutMs = 2500): Promise<boolean> {
  const net = await import('node:net')
  return new Promise((resolve) => {
    const socket = new net.Socket()
    const done = (ok: boolean): void => {
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
    socket.connect(port, host)
  })
}
