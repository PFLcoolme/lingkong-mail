import { useState } from 'react'
import {
  Box,
  Button,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  alpha,
  useTheme
} from '@mui/material'
import AddIcon from '@mui/icons-material/AddRounded'
import DeleteIcon from '@mui/icons-material/DeleteOutlineRounded'
import PersonAddIcon from '@mui/icons-material/PersonAddRounded'
import FolderIcon from '@mui/icons-material/FolderOpenRounded'
import type { Account, Rule, RuleActionType, RuleField, RuleOperator } from '@shared/types'
import { api } from '@/lib/api'
import { useApp } from '@/store/app'
import { Avatar, Field, Modal, SectionTitle, Switch } from './ui'
import { formatFullDate } from '@/lib/format'

const TABS = ['账户', '常规', '签名', '规则', '联系人', '关于']

export default function SettingsDialog(): React.ReactNode {
  const [tab, setTab] = useState(0)
  const close = useApp((s) => s.closeSettings)
  return (
    <Modal title="设置" onClose={close} width={900} fullHeight>
      <Stack direction="row" spacing={2.5} sx={{ height: '100%', minHeight: 420 }}>
        <Box sx={{ width: 118, flexShrink: 0 }}>
          <Tabs
            orientation="vertical"
            value={tab}
            onChange={(_, value: number) => setTab(value)}
            sx={{ '& .MuiTab-root': { alignItems: 'flex-start', minHeight: 34, fontSize: 13, borderRadius: 2 } }}
          >
            {TABS.map((label) => (
              <Tab key={label} label={label} />
            ))}
          </Tabs>
        </Box>
        <Divider orientation="vertical" flexItem />
        <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto', pr: 0.5 }}>
          {tab === 0 ? <AccountsTab /> : null}
          {tab === 1 ? <GeneralTab /> : null}
          {tab === 2 ? <SignatureTab /> : null}
          {tab === 3 ? <RulesTab /> : null}
          {tab === 4 ? <ContactsTab /> : null}
          {tab === 5 ? <AboutTab /> : null}
        </Box>
      </Stack>
    </Modal>
  )
}

function AccountsTab(): React.ReactNode {
  const theme = useTheme()
  const accounts = useApp((s) => s.accounts)
  const refresh = useApp((s) => s.refreshAccounts)
  const openWizard = useApp((s) => s.openWizard)
  const pushToast = useApp((s) => s.pushToast)
  const [editing, setEditing] = useState<Account | null>(null)

  async function remove(account: Account): Promise<void> {
    await api.accountsRemove(account.id)
    pushToast('success', '账户已删除')
    await refresh()
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <SectionTitle>已添加的账户</SectionTitle>
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="contained" startIcon={<AddIcon sx={{ fontSize: 15 }} />} onClick={openWizard} sx={{ borderRadius: 2, height: 30 }}>
          添加账户
        </Button>
      </Box>
      {accounts.length ? (
        accounts.map((account) => (
          <Paper
            key={account.id}
            elevation={0}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.5,
              mb: 1.25,
              borderRadius: 2.5,
              bgcolor: alpha(theme.palette.text.primary, 0.03)
            }}
          >
            <Avatar name={account.name} color={account.color} size={34} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{account.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {account.email} · {account.protocol.toUpperCase()} · {account.authType === 'oauth2' ? 'OAuth2' : '密码'}
                {account.status === 'error' || account.status === 'auth-error' ? (
                  <Box component="span" sx={{ color: 'error.main' }}>
                    {' '}
                    · {account.lastError || '连接失败'}
                  </Box>
                ) : null}
              </Typography>
            </Box>
            <Button size="small" variant="outlined" onClick={() => setEditing(account)} sx={{ borderRadius: 2, height: 28 }}>
              编辑
            </Button>
            <IconButton
              size="small"
              onClick={() => void remove(account)}
              aria-label="删除账户"
              sx={{ color: 'error.main' }}
            >
              <DeleteIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Paper>
        ))
      ) : (
        <Typography variant="caption" color="text.secondary">
          还没有账户，点击右上角添加。
        </Typography>
      )}

      {editing ? (
        <Modal title="编辑账户" onClose={() => setEditing(null)} width={520}>
          <AccountEditor
            account={editing}
            onDone={async () => {
              setEditing(null)
              await refresh()
            }}
          />
        </Modal>
      ) : null}
    </Box>
  )
}

function AccountEditor({ account, onDone }: { account: Account; onDone: () => Promise<void> }): React.ReactNode {
  const [name, setName] = useState(account.name)
  const [displayName, setDisplayName] = useState(account.displayName)
  const [color, setColor] = useState(account.color)
  const [syncDays, setSyncDays] = useState(account.syncDays)
  const [keepOnServer, setKeepOnServer] = useState(account.keepOnServer)
  const [enabled, setEnabled] = useState(account.enabled)
  const [password, setPassword] = useState('')
  const pushToast = useApp((s) => s.pushToast)

  async function save(): Promise<void> {
    await api.accountsUpdate(
      account.id,
      { name, displayName, color, syncDays, keepOnServer, enabled },
      password ? { password } : undefined
    )
    pushToast('success', '账户已更新')
    await onDone()
  }

  return (
    <Box>
      <Field label="账户名称">
        <TextField fullWidth value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="发件人显示名">
        <TextField fullWidth value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </Field>
      <Stack direction="row" spacing={2}>
        <Box sx={{ flex: 1 }}>
          <Field label="标识颜色">
            <TextField fullWidth type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </Field>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Field label="同步天数上限">
            <TextField fullWidth type="number" value={syncDays} onChange={(e) => setSyncDays(Number(e.target.value))} />
          </Field>
        </Box>
      </Stack>
      <Stack sx={{ gap: 0.5, mb: 2 }}>
        <Switch checked={enabled} onChange={setEnabled} label="启用该账户" />
        <Switch checked={keepOnServer} onChange={setKeepOnServer} label="POP3：在服务器保留邮件" />
      </Stack>
      <Field label="更新密码（留空表示不修改）">
        <TextField fullWidth type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={() => void save()}>
          保存
        </Button>
      </Box>
    </Box>
  )
}

function GeneralTab(): React.ReactNode {
  const settings = useApp((s) => s.settings)
  const update = useApp((s) => s.updateSettings)
  return (
    <Stack spacing={3}>
      <Box>
        <SectionTitle>外观</SectionTitle>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          {(['light', 'dark', 'system'] as const).map((theme) => (
            <Button
              key={theme}
              size="small"
              variant={settings.theme === theme ? 'contained' : 'outlined'}
              onClick={() => void update({ theme })}
              sx={{ borderRadius: 2, height: 30 }}
            >
              {theme === 'light' ? '浅色' : theme === 'dark' ? '深色' : '跟随系统'}
            </Button>
          ))}
        </Stack>
        <Stack sx={{ mb: 1.5 }}>
          <Switch
            checked={settings.transparentBackground}
            onChange={(value) => {
              void update({ transparentBackground: value })
              void api.windowSetTransparent(value)
            }}
            label="毛玻璃透明背景（关闭后窗口不透明，可解决个别桌面环境发黑）"
          />
        </Stack>
        <Typography variant="caption" color="text.secondary">
          正文字号：{settings.fontSize}px
        </Typography>
        <input
          type="range"
          min={12}
          max={20}
          value={settings.fontSize}
          onChange={(e) => void update({ fontSize: Number(e.target.value) })}
          style={{ width: '100%', accentColor: 'currentColor' }}
          aria-label="正文字号"
        />
      </Box>

      <Box>
        <SectionTitle>收取与通知</SectionTitle>
        <Stack sx={{ gap: 0.5 }}>
          <Switch checked={settings.notifications} onChange={(v) => void update({ notifications: v })} label="收到新邮件时显示桌面通知" />
          <Switch checked={settings.autoStartSync} onChange={(v) => void update({ autoStartSync: v })} label="启动时自动同步所有账户" />
          <Switch checked={settings.idleEnabled} onChange={(v) => void update({ idleEnabled: v })} label="IMAP 实时推送（IDLE，新邮件立即到达，重启后生效）" />
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              自动检查间隔（分钟）
            </Typography>
            <TextField
              size="small"
              type="number"
              value={settings.checkIntervalMinutes}
              onChange={(e) => void update({ checkIntervalMinutes: Math.max(1, Number(e.target.value)) })}
              sx={{ width: 96 }}
            />
          </Stack>
        </Stack>
      </Box>

      <Box>
        <SectionTitle>阅读</SectionTitle>
        <Stack sx={{ gap: 0.5 }}>
          <Switch checked={settings.showSnippet} onChange={(v) => void update({ showSnippet: v })} label="列表中显示邮件摘要" />
          <Switch checked={settings.confirmBeforeDelete} onChange={(v) => void update({ confirmBeforeDelete: v })} label="删除前弹出确认" />
        </Stack>
      </Box>
    </Stack>
  )
}

function SignatureTab(): React.ReactNode {
  const accounts = useApp((s) => s.accounts)
  const [selected, setSelected] = useState(accounts[0]?.id ?? '')
  const [text, setText] = useState('')
  const pushToast = useApp((s) => s.pushToast)
  const account = accounts.find((a) => a.id === selected) ?? accounts[0]

  return (
    <Box>
      <SectionTitle>邮件签名</SectionTitle>
      {accounts.length ? (
        <Box>
          <Field label="作用账户">
            <TextField select fullWidth value={account?.id ?? ''} onChange={(e) => { setSelected(e.target.value); setText('') }}>
              {accounts.map((a) => (
                <MenuItem key={a.id} value={a.id} sx={{ fontSize: 13 }}>
                  {a.name}（{a.email}）
                </MenuItem>
              ))}
            </TextField>
          </Field>
          <TextField
            fullWidth
            multiline
            minRows={6}
            defaultValue={account?.signature ?? ''}
            onChange={(e) => setText(e.target.value)}
            placeholder="例如：张三 | 产品部 | 电话 010-0000"
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              variant="contained"
              onClick={async () => {
                if (!account) return
                await api.accountsUpdate(account.id, { signature: text || account.signature })
                pushToast('success', '签名已保存')
              }}
            >
              保存签名
            </Button>
          </Box>
        </Box>
      ) : (
        <Typography variant="caption" color="text.secondary">
          请先添加账户。
        </Typography>
      )}
    </Box>
  )
}

const FIELD_LABEL: Record<RuleField, string> = { from: '发件人', to: '收件人', subject: '主题', body: '正文' }
const OPERATOR_LABEL: Record<RuleOperator, string> = {
  contains: '包含',
  notContains: '不包含',
  equals: '等于',
  startsWith: '开头是',
  regex: '正则匹配'
}
const ACTION_LABEL: Record<RuleActionType, string> = {
  markRead: '标记为已读',
  flag: '加星标',
  move: '移动到文件夹',
  delete: '删除',
  skipNotification: '不通知'
}

function RulesTab(): React.ReactNode {
  const theme = useTheme()
  const rules = useApp((s) => s.rules)
  const loadRules = useApp((s) => s.loadRules)
  const accounts = useApp((s) => s.accounts)
  const pushToast = useApp((s) => s.pushToast)
  const [draft, setDraft] = useState<Rule | null>(null)

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <SectionTitle>邮件过滤规则</SectionTitle>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon sx={{ fontSize: 15 }} />}
          sx={{ borderRadius: 2, height: 30 }}
          onClick={() =>
            setDraft({
              id: '',
              accountId: accounts[0]?.id ?? '',
              name: '新规则',
              enabled: true,
              order: rules.length,
              matchAll: true,
              conditions: [{ field: 'from', operator: 'contains', value: '' }],
              actions: [{ type: 'markRead', target: '' }]
            })
          }
        >
          新建规则
        </Button>
      </Box>

      {rules.length ? (
        rules.map((rule) => (
          <Paper
            key={rule.id}
            elevation={0}
            sx={{ p: 1.5, mb: 1.25, borderRadius: 2.5, bgcolor: alpha(theme.palette.text.primary, 0.03) }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{rule.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {rule.enabled ? '已启用' : '已停用'}
              </Typography>
              <Button size="small" variant="outlined" onClick={() => setDraft(rule)} sx={{ borderRadius: 2, height: 26 }}>
                编辑
              </Button>
              <IconButton
                size="small"
                onClick={async () => {
                  await api.ruleDelete(rule.id)
                  await loadRules()
                }}
                aria-label="删除规则"
                sx={{ color: 'error.main' }}
              >
                <DeleteIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
              条件：
              {rule.conditions.map((c) => `${FIELD_LABEL[c.field]} ${OPERATOR_LABEL[c.operator]} “${c.value}”`).join(rule.matchAll ? ' 且 ' : ' 或 ')}
              ｜动作：{rule.actions.map((a) => `${ACTION_LABEL[a.type]}${a.target ? ` → ${a.target}` : ''}`).join('，')}
            </Typography>
          </Paper>
        ))
      ) : (
        <Typography variant="caption" color="text.secondary">
          还没有规则。规则会在收到新邮件时自动执行。
        </Typography>
      )}

      {draft ? (
        <Modal
          title="编辑规则"
          onClose={() => setDraft(null)}
          width={640}
          footer={
            <Button
              variant="contained"
              onClick={async () => {
                await api.ruleSave(draft)
                setDraft(null)
                await loadRules()
                pushToast('success', '规则已保存')
              }}
            >
              保存规则
            </Button>
          }
        >
          <Field label="规则名称">
            <TextField fullWidth value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="作用于账户">
            <TextField select fullWidth value={draft.accountId} onChange={(e) => setDraft({ ...draft, accountId: e.target.value })}>
              {accounts.map((a) => (
                <MenuItem key={a.id} value={a.id} sx={{ fontSize: 13 }}>
                  {a.name}
                </MenuItem>
              ))}
            </TextField>
          </Field>

          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <SectionTitle>条件（{draft.matchAll ? '全部满足' : '任一满足'}）</SectionTitle>
              <Button size="small" onClick={() => setDraft({ ...draft, matchAll: !draft.matchAll })}>
                切换为{draft.matchAll ? '任一满足' : '全部满足'}
              </Button>
            </Box>
            {draft.conditions.map((condition, index) => (
              <Stack direction="row" spacing={1} key={index} sx={{ mb: 1 }}>
                <TextField
                  select
                  size="small"
                  value={condition.field}
                  sx={{ width: 104 }}
                  onChange={(e) => {
                    const conditions = [...draft.conditions]
                    conditions[index] = { ...condition, field: e.target.value as RuleField }
                    setDraft({ ...draft, conditions })
                  }}
                >
                  {Object.entries(FIELD_LABEL).map(([key, label]) => (
                    <MenuItem key={key} value={key} sx={{ fontSize: 13 }}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  value={condition.operator}
                  sx={{ width: 112 }}
                  onChange={(e) => {
                    const conditions = [...draft.conditions]
                    conditions[index] = { ...condition, operator: e.target.value as RuleOperator }
                    setDraft({ ...draft, conditions })
                  }}
                >
                  {Object.entries(OPERATOR_LABEL).map(([key, label]) => (
                    <MenuItem key={key} value={key} sx={{ fontSize: 13 }}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="匹配值"
                  value={condition.value}
                  onChange={(e) => {
                    const conditions = [...draft.conditions]
                    conditions[index] = { ...condition, value: e.target.value }
                    setDraft({ ...draft, conditions })
                  }}
                />
                <IconButton
                  size="small"
                  onClick={() => setDraft({ ...draft, conditions: draft.conditions.filter((_, i) => i !== index) })}
                  aria-label="删除条件"
                >
                  <DeleteIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Stack>
            ))}
            <Button
              size="small"
              onClick={() =>
                setDraft({ ...draft, conditions: [...draft.conditions, { field: 'subject', operator: 'contains', value: '' }] })
              }
            >
              + 添加条件
            </Button>
          </Box>

          <Box>
            <SectionTitle>执行动作</SectionTitle>
            {draft.actions.map((action, index) => (
              <Stack direction="row" spacing={1} key={index} sx={{ mb: 1 }}>
                <TextField
                  select
                  size="small"
                  value={action.type}
                  sx={{ width: 156 }}
                  onChange={(e) => {
                    const actions = [...draft.actions]
                    actions[index] = { ...action, type: e.target.value as RuleActionType }
                    setDraft({ ...draft, actions })
                  }}
                >
                  {Object.entries(ACTION_LABEL).map(([key, label]) => (
                    <MenuItem key={key} value={key} sx={{ fontSize: 13 }}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
                {action.type === 'move' ? (
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="目标文件夹路径，如 INBOX/通知"
                    value={action.target}
                    onChange={(e) => {
                      const actions = [...draft.actions]
                      actions[index] = { ...action, target: e.target.value }
                      setDraft({ ...draft, actions })
                    }}
                  />
                ) : null}
                <IconButton
                  size="small"
                  onClick={() => setDraft({ ...draft, actions: draft.actions.filter((_, i) => i !== index) })}
                  aria-label="删除动作"
                >
                  <DeleteIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Stack>
            ))}
            <Button size="small" onClick={() => setDraft({ ...draft, actions: [...draft.actions, { type: 'flag', target: '' }] })}>
              + 添加动作
            </Button>
          </Box>
        </Modal>
      ) : null}
    </Box>
  )
}

function ContactsTab(): React.ReactNode {
  const theme = useTheme()
  const contacts = useApp((s) => s.contacts)
  const loadContacts = useApp((s) => s.loadContacts)
  const accounts = useApp((s) => s.accounts)
  const pushToast = useApp((s) => s.pushToast)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  async function add(): Promise<void> {
    if (!email.includes('@')) {
      pushToast('error', '请输入有效邮箱')
      return
    }
    await api.contactSave({ name, email, accountId: accounts[0]?.id ?? '' })
    setName('')
    setEmail('')
    await loadContacts()
  }

  return (
    <Box>
      <SectionTitle>地址簿（自动收集 + 手动添加）</SectionTitle>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField size="small" fullWidth placeholder="姓名" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField size="small" fullWidth placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button variant="outlined" startIcon={<PersonAddIcon sx={{ fontSize: 15 }} />} onClick={() => void add()} sx={{ borderRadius: 2 }}>
          添加
        </Button>
      </Stack>
      <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
        {contacts.length ? (
          contacts.map((contact) => (
            <Paper
              key={contact.id}
              elevation={0}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.75,
                mb: 0.75,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.text.primary, 0.03)
              }}
            >
              <Avatar name={contact.name || contact.email} size={22} />
              <Typography sx={{ fontSize: 12.5, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {contact.name}{' '}
                <Typography component="span" variant="caption" color="text.secondary">
                  {contact.email}
                </Typography>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {contact.frequency} 次
              </Typography>
              <IconButton
                size="small"
                onClick={async () => {
                  await api.contactDelete(contact.id)
                  await loadContacts()
                }}
                aria-label="删除联系人"
              >
                <DeleteIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Paper>
          ))
        ) : (
          <Typography variant="caption" color="text.secondary">
            暂无联系人，收发邮件后会自动记录。
          </Typography>
        )}
      </Box>
    </Box>
  )
}

function AboutTab(): React.ReactNode {
  const accounts = useApp((s) => s.accounts)
  const pushToast = useApp((s) => s.pushToast)
  return (
    <Box>
      <SectionTitle>空灵邮箱</SectionTitle>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2.5 }}>
        本地优先的桌面邮件客户端，邮件内容缓存在本机 SQLite 数据库中，支持离线全文检索。
      </Typography>
      <Stack spacing={1.25}>
        <Button
          variant="outlined"
          sx={{ justifyContent: 'flex-start', borderRadius: 2 }}
          onClick={async () => {
            const version = await api.appVersion()
            pushToast('info', `当前版本 ${version}`)
          }}
        >
          查看版本号
        </Button>
        <Button
          variant="outlined"
          startIcon={<FolderIcon sx={{ fontSize: 16 }} />}
          sx={{ justifyContent: 'flex-start', borderRadius: 2 }}
          onClick={() => void api.openPath('~')}
        >
          打开主目录
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
        账户数量：{accounts.length}
        <br />
        创建时间：{accounts[0] ? formatFullDate(accounts[0].createdAt) : '—'}
      </Typography>
    </Box>
  )
}
