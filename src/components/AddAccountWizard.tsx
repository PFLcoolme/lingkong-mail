import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material'
import LaunchIcon from '@mui/icons-material/LaunchRounded'
import KeyIcon from '@mui/icons-material/KeyRounded'
import CheckCircleIcon from '@mui/icons-material/CheckCircleRounded'
import MailIcon from '@mui/icons-material/MailOutlineRounded'
import type { AuthType, ProtocolType, SecurityType } from '@shared/types'
import { api, type TestResult } from '@/lib/api'
import { useApp } from '@/store/app'
import { Field, Modal } from './ui'

const SECURITIES: { value: SecurityType; label: string }[] = [
  { value: 'ssl', label: 'SSL/TLS' },
  { value: 'starttls', label: 'STARTTLS' },
  { value: 'none', label: '无' }
]

export default function AddAccountWizard(): React.ReactNode {
  const close = useApp((s) => s.closeWizard)
  const pushToast = useApp((s) => s.pushToast)
  const [step, setStep] = useState(0)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [protocol, setProtocol] = useState<ProtocolType>('imap')
  const [authType, setAuthType] = useState<AuthType>('password')
  const [incoming, setIncoming] = useState({ host: '', port: 993, security: 'ssl' as SecurityType, username: '' })
  const [outgoing, setOutgoing] = useState({ host: '', port: 465, security: 'ssl' as SecurityType, username: '' })
  const [ewsUrl, setEwsUrl] = useState('')
  const [oauthProvider, setOauthProvider] = useState('gmail')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [tenant, setTenant] = useState('')
  const [refreshToken, setRefreshToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)
  const [detectedFrom, setDetectedFrom] = useState('')

  async function detect(): Promise<void> {
    if (!email.includes('@')) {
      pushToast('error', '请输入完整的邮箱地址')
      return
    }
    setBusy(true)
    try {
      const found = await api.autoconfigDetect(email)
      if (found) {
        setIncoming({ ...found.imap, username: email })
        setOutgoing({ ...found.smtp, username: email })
        setDetectedFrom(
          found.source === 'guess' ? '按域名推测' : found.source.startsWith('preset') ? '内置服务商配置' : '自动发现'
        )
      } else {
        setDetectedFrom('未能自动发现，请手动填写')
      }
      setStep(1)
    } finally {
      setBusy(false)
    }
  }

  async function authorize(): Promise<void> {
    if (!clientId) {
      pushToast('error', '请先填写 OAuth 客户端 ID')
      return
    }
    setBusy(true)
    try {
      const token = await api.oauthAuthorize({ provider: oauthProvider, clientId, clientSecret, tenant, email })
      setRefreshToken(token.refreshToken)
      if (token.email && !email) setEmail(token.email)
      pushToast('success', '授权成功')
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : '授权失败')
    } finally {
      setBusy(false)
    }
  }

  async function test(): Promise<void> {
    setBusy(true)
    setResult(null)
    try {
      setResult(
        await api.accountsTest(
          {
            email,
            name: name || email,
            displayName: name || email.split('@')[0],
            protocol,
            authType,
            incoming,
            outgoing,
            ewsUrl,
            oauthProvider,
            oauthClientId: clientId,
            oauthClientSecret: clientSecret,
            oauthTenant: tenant
          },
          { password, refreshToken }
        )
      )
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : '测试失败', stage: 'unknown' })
    } finally {
      setBusy(false)
    }
  }

  async function finish(): Promise<void> {
    setBusy(true)
    try {
      await api.accountsAdd(
        {
          email,
          name: name || email,
          displayName: name || email.split('@')[0],
          protocol,
          authType,
          incoming,
          outgoing,
          ewsUrl,
          oauthProvider,
          oauthClientId: clientId,
          oauthClientSecret: clientSecret,
          oauthTenant: tenant
        },
        { password, refreshToken }
      )
      pushToast('success', '账户已添加，正在首次同步')
      close()
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : '添加失败')
    } finally {
      setBusy(false)
    }
  }

  const canFinish =
    Boolean(email) &&
    (protocol === 'ews' ? Boolean(ewsUrl) : Boolean(incoming.host && outgoing.host)) &&
    (authType === 'oauth2' ? Boolean(refreshToken) : Boolean(password))

  return (
    <Modal
      title="添加邮箱账户"
      onClose={close}
      width={720}
      footer={
        <>
          {step > 0 ? (
            <Button variant="outlined" onClick={() => setStep(step - 1)} disabled={busy}>
              上一步
            </Button>
          ) : null}
          {step === 0 ? (
            <Button variant="contained" onClick={() => void detect()} disabled={busy} endIcon={busy ? <CircularProgress size={14} /> : undefined}>
              自动检测并继续
            </Button>
          ) : null}
          {step === 1 ? (
            <Button variant="contained" onClick={() => setStep(2)}>
              下一步
            </Button>
          ) : null}
          {step === 2 ? (
            <>
              <Button variant="outlined" startIcon={<KeyIcon sx={{ fontSize: 15 }} />} onClick={() => void test()} disabled={busy || !canFinish}>
                测试连接
              </Button>
              <Button variant="contained" startIcon={<MailIcon sx={{ fontSize: 15 }} />} onClick={() => void finish()} disabled={busy || !canFinish}>
                完成添加
              </Button>
            </>
          ) : null}
        </>
      }
    >
      <Stepper activeStep={step} sx={{ mb: 3 }}>
        {['邮箱地址', '服务器配置', '登录方式'].map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {step === 0 ? (
        <Box>
          <Field label="邮箱地址" hint="我们会根据邮箱域名自动发现收发服务器配置">
            <TextField
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              placeholder="you@example.com"
            />
          </Field>
          <Field label="显示名称" hint="发送邮件时对方看到的名字">
            <TextField fullWidth value={name} onChange={(e) => setName(e.target.value)} placeholder="张三" />
          </Field>
          <Typography variant="caption" color="text.secondary">
            支持 IMAP / POP3 / Exchange；QQ、163、Gmail、Outlook 等常见邮箱会自动填充服务器地址。
          </Typography>
        </Box>
      ) : null}

      {step === 1 ? (
        <Box>
          {detectedFrom ? (
            <Alert severity="success" icon={<CheckCircleIcon fontSize="small" />} sx={{ mb: 2.5, borderRadius: 2.5 }}>
              服务器配置来源：{detectedFrom}
            </Alert>
          ) : null}

          <Field label="账户类型">
            <ToggleButtonGroup
              size="small"
              exclusive
              value={protocol}
              onChange={(_, value: ProtocolType | null) => value && setProtocol(value)}
              sx={{ '& .MuiToggleButton-root': { borderRadius: 2, px: 1.75 } }}
            >
              <ToggleButton value="imap">IMAP（推荐）</ToggleButton>
              <ToggleButton value="pop3">POP3</ToggleButton>
              <ToggleButton value="ews">Exchange</ToggleButton>
            </ToggleButtonGroup>
          </Field>

          {protocol === 'ews' ? (
            <Field label="Exchange 服务地址" hint="例如 https://outlook.office365.com/EWS/Exchange.asmx">
              <TextField fullWidth value={ewsUrl} onChange={(e) => setEwsUrl(e.target.value)} />
            </Field>
          ) : (
            <Box>
              <Stack direction="row" spacing={1.5}>
                <Box sx={{ flex: 1 }}>
                  <Field label={`${protocol.toUpperCase()} 服务器`}>
                    <TextField
                      fullWidth
                      value={incoming.host}
                      onChange={(e) => setIncoming({ ...incoming, host: e.target.value.trim() })}
                    />
                  </Field>
                </Box>
                <Box sx={{ width: 96 }}>
                  <Field label="端口">
                    <TextField
                      fullWidth
                      type="number"
                      value={incoming.port}
                      onChange={(e) => setIncoming({ ...incoming, port: Number(e.target.value) })}
                    />
                  </Field>
                </Box>
                <Box sx={{ width: 128 }}>
                  <Field label="加密">
                    <TextField
                      select
                      fullWidth
                      value={incoming.security}
                      onChange={(e) => setIncoming({ ...incoming, security: e.target.value as SecurityType })}
                    >
                      {SECURITIES.map((s) => (
                        <MenuItem key={s.value} value={s.value} sx={{ fontSize: 13 }}>
                          {s.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Field>
                </Box>
              </Stack>
              <Field label="收件用户名" hint="多数邮箱为完整邮箱地址">
                <TextField
                  fullWidth
                  value={incoming.username}
                  onChange={(e) => setIncoming({ ...incoming, username: e.target.value })}
                />
              </Field>
              <Stack direction="row" spacing={1.5}>
                <Box sx={{ flex: 1 }}>
                  <Field label="SMTP 服务器">
                    <TextField
                      fullWidth
                      value={outgoing.host}
                      onChange={(e) => setOutgoing({ ...outgoing, host: e.target.value.trim() })}
                    />
                  </Field>
                </Box>
                <Box sx={{ width: 96 }}>
                  <Field label="端口">
                    <TextField
                      fullWidth
                      type="number"
                      value={outgoing.port}
                      onChange={(e) => setOutgoing({ ...outgoing, port: Number(e.target.value) })}
                    />
                  </Field>
                </Box>
                <Box sx={{ width: 128 }}>
                  <Field label="加密">
                    <TextField
                      select
                      fullWidth
                      value={outgoing.security}
                      onChange={(e) => setOutgoing({ ...outgoing, security: e.target.value as SecurityType })}
                    >
                      {SECURITIES.map((s) => (
                        <MenuItem key={s.value} value={s.value} sx={{ fontSize: 13 }}>
                          {s.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Field>
                </Box>
              </Stack>
              <Field label="发件用户名">
                <TextField
                  fullWidth
                  value={outgoing.username}
                  onChange={(e) => setOutgoing({ ...outgoing, username: e.target.value })}
                />
              </Field>
            </Box>
          )}
        </Box>
      ) : null}

      {step === 2 ? (
        <Box>
          <Field label="登录方式">
            <ToggleButtonGroup
              size="small"
              exclusive
              value={authType}
              onChange={(_, value: AuthType | null) => value && setAuthType(value)}
              sx={{ '& .MuiToggleButton-root': { borderRadius: 2, px: 1.75 } }}
            >
              <ToggleButton value="password">密码 / 授权码</ToggleButton>
              <ToggleButton value="oauth2">OAuth2 授权登录</ToggleButton>
            </ToggleButtonGroup>
          </Field>

          {authType === 'password' ? (
            <Field label="密码或授权码" hint="QQ、163、Gmail 等邮箱通常需在网页端开启 IMAP/SMTP 并生成专用授权码">
              <TextField fullWidth type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          ) : (
            <Box>
              <Field label="OAuth 提供方">
                <TextField select fullWidth value={oauthProvider} onChange={(e) => setOauthProvider(e.target.value)}>
                  <MenuItem value="gmail" sx={{ fontSize: 13 }}>
                    Google / Gmail
                  </MenuItem>
                  <MenuItem value="outlook" sx={{ fontSize: 13 }}>
                    Microsoft / Outlook
                  </MenuItem>
                </TextField>
              </Field>
              <Field label="客户端 ID（Client ID）" hint="需在 Google Cloud / Azure 创建“桌面应用”类型的 OAuth 客户端">
                <TextField fullWidth value={clientId} onChange={(e) => setClientId(e.target.value.trim())} />
              </Field>
              {oauthProvider === 'outlook' ? (
                <Field label="租户（可选，默认 common）">
                  <TextField fullWidth value={tenant} onChange={(e) => setTenant(e.target.value.trim())} />
                </Field>
              ) : null}
              <Field label="客户端密钥（可选）">
                <TextField fullWidth type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
              </Field>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <Button
                  variant="outlined"
                  startIcon={<LaunchIcon sx={{ fontSize: 15 }} />}
                  onClick={() => void authorize()}
                  disabled={busy}
                  sx={{ borderRadius: 2 }}
                >
                  在浏览器中授权
                </Button>
                {refreshToken ? (
                  <Typography variant="caption" sx={{ color: 'success.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CheckCircleIcon sx={{ fontSize: 14 }} /> 已获得刷新令牌
                  </Typography>
                ) : null}
              </Stack>
            </Box>
          )}

          {result ? (
            <Alert severity={result.ok ? 'success' : 'error'} sx={{ mt: 2.5, borderRadius: 2.5 }}>
              {result.ok ? '连接测试通过，可以完成添加。' : `连接失败：${result.message}`}
            </Alert>
          ) : null}
        </Box>
      ) : null}
    </Modal>
  )
}
