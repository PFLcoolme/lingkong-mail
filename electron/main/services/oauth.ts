import { shell } from 'electron'
import { createServer, type Server } from 'node:http'
import { createHash, randomBytes } from 'node:crypto'
import type { AddressInfo } from 'node:net'

interface ProviderDef {
  id: string
  name: string
  authUrl: string
  tokenUrl: string
  scope: string
}

export const OAUTH_PROVIDERS: Record<string, ProviderDef> = {
  gmail: {
    id: 'gmail',
    name: 'Google / Gmail',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email https://mail.google.com/'
  },
  outlook: {
    id: 'outlook',
    name: 'Microsoft / Outlook',
    authUrl: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token',
    scope: 'openid email offline_access https://outlook.office365.com/IMAP.AccessAsUser.All https://outlook.office365.com/SMTP.Send'
  }
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function buildUrl(base: string, params: Record<string, string>): string {
  const url = new URL(base)
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v)
  }
  return url.toString()
}

interface CallbackServer {
  port: number
  wait: Promise<string>
  close: () => void
}

function startCallbackServer(): Promise<CallbackServer> {
  const server: Server = createServer()
  const wait = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close()
      reject(new Error('等待授权超时（3 分钟），请重试'))
    }, 180000)
    server.on('request', (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      if (code) {
        res.end('<html lang="zh"><body style="font-family:sans-serif;text-align:center;padding:48px"><h2>授权成功</h2><p>回到空灵邮箱即可继续。</p></body></html>')
        clearTimeout(timer)
        setTimeout(() => server.close(), 500)
        resolve(code)
      } else {
        res.end(`<html lang="zh"><body style="font-family:sans-serif;text-align:center;padding:48px"><h2>授权失败</h2><p>${error ?? '未知错误'}</p></body></html>`)
        clearTimeout(timer)
        setTimeout(() => server.close(), 500)
        reject(new Error(error ?? '授权失败'))
      }
    })
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port
      resolve({ port, wait, close: () => server.close() })
    })
  })
}

async function postForm(url: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString()
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    throw new Error((json.error_description as string) ?? (json.error as string) ?? '令牌交换失败')
  }
  return json
}

async function fetchEmail(providerId: string, accessToken: string): Promise<string> {
  try {
    const url =
      providerId === 'gmail'
        ? 'https://www.googleapis.com/oauth2/v3/userinfo'
        : 'https://graph.microsoft.com/oidc/userinfo'
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) return ''
    const json = (await res.json()) as { email?: string; mail?: string; userPrincipalName?: string }
    return json.email ?? json.mail ?? json.userPrincipalName ?? ''
  } catch {
    return ''
  }
}

export interface AuthorizeInput {
  provider: string
  clientId: string
  clientSecret: string
  tenant: string
  email: string
}

export interface AuthorizeResult {
  refreshToken: string
  accessToken: string
  expiresAt: number
  email: string
}

/** 通过系统浏览器完成 OAuth2 授权码 + PKCE 流程 */
export async function authorizeWithBrowser(input: AuthorizeInput): Promise<AuthorizeResult> {
  const provider = OAUTH_PROVIDERS[input.provider]
  if (!provider) throw new Error(`不支持的 OAuth 提供方：${input.provider}`)
  if (!input.clientId) throw new Error('请填写 OAuth 客户端 ID')

  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  const { port, wait, close } = await startCallbackServer()
  const redirectUri = `http://127.0.0.1:${port}/callback`
  const tenant = input.tenant || (input.provider === 'outlook' ? 'common' : '')

  const authUrl = buildUrl(provider.authUrl.replace('{tenant}', tenant), {
    client_id: input.clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: provider.scope,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
    login_hint: input.email,
    state: base64url(randomBytes(8))
  })

  try {
    await shell.openExternal(authUrl)
    const code = await wait
    const json = await postForm(provider.tokenUrl.replace('{tenant}', tenant), {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code_verifier: verifier
    })
    const accessToken = String(json.access_token ?? '')
    const refreshToken = String(json.refresh_token ?? '')
    if (!refreshToken) throw new Error('未获取到刷新令牌，请重试授权')
    const expiresAt = Date.now() + Number(json.expires_in ?? 3600) * 1000 - 60_000
    const email = await fetchEmail(input.provider, accessToken)
    return { refreshToken, accessToken, expiresAt, email: email || input.email }
  } finally {
    close()
  }
}

export interface TokenResult {
  accessToken: string
  expiresAt: number
  refreshToken: string
}

/** 使用刷新令牌换取新的访问令牌 */
export async function refreshAccessToken(
  providerId: string,
  clientId: string,
  clientSecret: string,
  tenant: string,
  currentRefreshToken: string
): Promise<TokenResult> {
  const provider = OAUTH_PROVIDERS[providerId]
  if (!provider) throw new Error(`不支持的 OAuth 提供方：${providerId}`)
  const t = tenant || (providerId === 'outlook' ? 'common' : '')
  const json = await postForm(provider.tokenUrl.replace('{tenant}', t), {
    grant_type: 'refresh_token',
    refresh_token: currentRefreshToken,
    client_id: clientId,
    client_secret: clientSecret
  })
  return {
    accessToken: String(json.access_token ?? ''),
    expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000 - 60_000,
    refreshToken: String(json.refresh_token ?? currentRefreshToken)
  }
}
