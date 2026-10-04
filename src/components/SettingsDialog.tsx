import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme
} from '@mui/material'
import AddIcon from '@mui/icons-material/AddRounded'
import ImageIcon from '@mui/icons-material/ImageRounded'
import PdfIcon from '@mui/icons-material/PictureAsPdfRounded'
import ZipIcon from '@mui/icons-material/FolderZipRounded'
import DocIcon from '@mui/icons-material/DescriptionRounded'
import VideoIcon from '@mui/icons-material/MovieRounded'
import AudioIcon from '@mui/icons-material/AudiotrackRounded'
import FileIcon from '@mui/icons-material/InsertDriveFileRounded'
import OpenIcon from '@mui/icons-material/OpenInNewRounded'
import JumpIcon from '@mui/icons-material/SubdirectoryArrowRightRounded'
import BackupIcon from '@mui/icons-material/BackupRounded'
import UpdateIcon from '@mui/icons-material/SystemUpdateAltRounded'
import RestoreIcon from '@mui/icons-material/SettingsBackupRestoreRounded'
import DeleteIcon from '@mui/icons-material/DeleteOutlineRounded'
import PersonAddIcon from '@mui/icons-material/PersonAddRounded'
import FolderIcon from '@mui/icons-material/FolderOpenRounded'
import type {
  Account,
  AttachmentRecord,
  Label,
  Rule,
  RuleActionType,
  RuleField,
  RuleOperator,
  StatsOverview,
  Template,
  UpdateState
} from '@shared/types'
import { api, BUILD_TIME } from '@/lib/api'
import { useApp } from '@/store/app'
import { Avatar, Field, Modal, SectionTitle, Switch } from './ui'
import { useT } from '@/lib/i18n'
import { formatFullDate } from '@/lib/format'

const TABS = [
  'accounts',
  'general',
  'signature',
  'rules',
  'contacts',
  'templates',
  'labels',
  'attachments',
  'stats',
  'about'
]

export default function SettingsDialog(): React.ReactNode {
  const [tab, setTab] = useState(0)
  const close = useApp((s) => s.closeSettings)
  const t = useT()
  return (
    <Modal title={t('settings.title')} onClose={close} width={900} fullHeight>
      <Stack direction="row" spacing={2.5} sx={{ height: '100%', minHeight: 420 }}>
        <Box sx={{ width: 118, flexShrink: 0 }}>
          <Tabs
            orientation="vertical"
            value={tab}
            onChange={(_, value: number) => setTab(value)}
            sx={{ '& .MuiTab-root': { alignItems: 'flex-start', minHeight: 34, fontSize: 13, borderRadius: 2 } }}
          >
            {TABS.map((key) => (
              <Tab key={key} label={t(`settings.${key}`)} />
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
          {tab === 5 ? <TemplatesTab /> : null}
          {tab === 6 ? <LabelsTab /> : null}
          {tab === 7 ? <AttachmentsTab /> : null}
          {tab === 8 ? <StatsTab /> : null}
          {tab === 9 ? <AboutTab /> : null}
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
  const t = useT()
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
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          {[
            { value: 'comfortable', label: '列表：舒适' },
            { value: 'compact', label: '列表：紧凑' }
          ].map((item) => (
            <Button
              key={item.value}
              size="small"
              variant={settings.listDensity === item.value ? 'contained' : 'outlined'}
              onClick={() => void update({ listDensity: item.value as 'comfortable' | 'compact' })}
              sx={{ borderRadius: 2, height: 30 }}
            >
              {item.label}
            </Button>
          ))}
          <Button
            size="small"
            variant="outlined"
            onClick={() => void update({ listWidth: 404 })}
            sx={{ borderRadius: 2, height: 30 }}
          >
            重置栏宽
          </Button>
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
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          {[
            { code: 'zh-CN', label: '中文' },
            { code: 'en', label: 'English' }
          ].map((item) => (
            <Button
              key={item.code}
              size="small"
              variant={settings.language.startsWith(item.code) ? 'contained' : 'outlined'}
              onClick={() => void update({ language: item.code })}
              sx={{ borderRadius: 2, height: 30 }}
            >
              {item.label}
            </Button>
          ))}
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
        <SectionTitle>{t('settings.translate')}</SectionTitle>
        <Stack sx={{ gap: 0.5 }}>
          <Switch
            checked={settings.translateEnabled}
            onChange={(v) => void update({ translateEnabled: v })}
            label={t('settings.translateEnable')}
          />
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {t('settings.translateTarget')}
            </Typography>
            <TextField
              size="small"
              value={settings.translateTarget}
              onChange={(e) => void update({ translateTarget: e.target.value })}
              placeholder="zh-CN"
              sx={{ width: 120 }}
            />
          </Stack>
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {t('settings.translateEndpoint')}
            </Typography>
            <TextField
              size="small"
              fullWidth
              value={settings.translateEndpoint}
              onChange={(e) => void update({ translateEndpoint: e.target.value })}
              placeholder="https://translate.googleapis.com/translate_a/single"
              sx={{ mt: 0.75 }}
            />
          </Box>
        </Stack>
      </Box>

      <LockSection />

      <Box>
        <SectionTitle>收取与通知</SectionTitle>
        <Stack sx={{ gap: 0.5 }}>
          <Switch checked={settings.notifications} onChange={(v) => void update({ notifications: v })} label="收到新邮件时显示桌面通知" />
          <Switch checked={settings.autoStartSync} onChange={(v) => void update({ autoStartSync: v })} label="启动时自动同步所有账户" />
          <Switch checked={settings.idleEnabled} onChange={(v) => void update({ idleEnabled: v })} label="IMAP 实时推送（IDLE，新邮件立即到达，重启后生效）" />
          <Switch checked={settings.trayEnabled} onChange={(v) => void update({ trayEnabled: v })} label="显示系统托盘图标（含未读提示，重启后生效）" />
          <Switch checked={settings.closeToTray} onChange={(v) => void update({ closeToTray: v })} label="关闭窗口时最小化到托盘（而不是退出程序）" />
          <Switch checked={settings.openAtLogin} onChange={(v) => void update({ openAtLogin: v })} label="开机自动启动" />
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              发送后撤销窗口（秒，0 = 立即发送）
            </Typography>
            <TextField
              size="small"
              type="number"
              value={settings.sendDelaySeconds}
              onChange={(e) => void update({ sendDelaySeconds: Math.max(0, Number(e.target.value)) })}
              sx={{ width: 96 }}
            />
          </Stack>
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
          <Switch checked={settings.threadView} onChange={(v) => void update({ threadView: v })} label={t('settings.threadView')} />
          <Switch
            checked={settings.alwaysLoadImages}
            onChange={(v) => void update({ alwaysLoadImages: v })}
            label={t('settings.alwaysLoadImages')}
          />
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
  const update = useApp((s) => s.updateState)
  const [version, setVersion] = useState('')

  useEffect(() => {
    void api.appVersion().then(setVersion)
    void api.updateState().then((state) => useApp.setState({ updateState: state }))
  }, [])

  const updateBusy = update.status === 'checking' || update.status === 'downloading'
  const updateLabel: Record<UpdateState['status'], string> = {
    idle: '检查更新',
    checking: '正在检查更新…',
    'not-available': '已是最新版本',
    available: `发现新版本 v${update.version ?? ''}`,
    downloading: `正在下载… ${update.percent ?? 0}%`,
    downloaded: `新版本 v${update.version ?? ''} 已就绪`,
    error: `检查更新失败：${update.message ?? ''}`
  }

  return (
    <Box>
      <SectionTitle>空灵邮箱</SectionTitle>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        本地优先的桌面邮件客户端，邮件内容缓存在本机 SQLite 数据库中，支持离线全文检索。
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2.5 }}>
        当前版本 <b>v{version || '…'}</b>
        {BUILD_TIME ? ` · 构建于 ${new Date(BUILD_TIME).toLocaleString()}` : ''}
      </Typography>
      <Stack spacing={1.25}>
        <Box>
          <Button
            variant="outlined"
            startIcon={<UpdateIcon sx={{ fontSize: 16 }} />}
            sx={{ justifyContent: 'flex-start', borderRadius: 2, width: '100%' }}
            disabled={updateBusy}
            onClick={() => void api.updateCheck()}
          >
            {updateLabel[update.status]}
          </Button>
          {update.status === 'downloading' ? (
            <LinearProgress
              variant="determinate"
              value={update.percent ?? 0}
              sx={{ mt: 1, borderRadius: 1, height: 6 }}
            />
          ) : null}
          {update.status === 'available' ? (
            <Button
              size="small"
              variant="contained"
              startIcon={<UpdateIcon sx={{ fontSize: 15 }} />}
              sx={{ mt: 1, borderRadius: 2 }}
              onClick={() => void api.updateDownload()}
            >
              下载 v{update.version}
            </Button>
          ) : null}
          {update.status === 'downloaded' ? (
            <Button
              size="small"
              variant="contained"
              color="success"
              sx={{ mt: 1, borderRadius: 2 }}
              onClick={() => void api.updateInstall()}
            >
              重启并安装 v{update.version}
            </Button>
          ) : null}
        </Box>
        <Button
          variant="outlined"
          startIcon={<FolderIcon sx={{ fontSize: 16 }} />}
          sx={{ justifyContent: 'flex-start', borderRadius: 2 }}
          onClick={() => void api.openPath('~')}
        >
          打开主目录
        </Button>
        <Button
          variant="outlined"
          startIcon={<BackupIcon sx={{ fontSize: 16 }} />}
          sx={{ justifyContent: 'flex-start', borderRadius: 2 }}
          onClick={async () => {
            const result = await api.backupCreate()
            if (result) pushToast('success', `备份完成：${result.dir}`)
          }}
        >
          备份邮件数据（数据库 + 附件）
        </Button>
        <Button
          variant="outlined"
          color="warning"
          startIcon={<RestoreIcon sx={{ fontSize: 16 }} />}
          sx={{ justifyContent: 'flex-start', borderRadius: 2 }}
          onClick={async () => {
            if (!window.confirm('从备份恢复会覆盖当前所有邮件数据，并自动重启应用。确定继续吗？')) return
            const ok = await api.backupRestore()
            if (!ok) pushToast('info', '已取消恢复')
          }}
        >
          从备份恢复数据（会重启应用）
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

function TemplatesTab(): React.ReactNode {
  const theme = useTheme()
  const templates = useApp((s) => s.templates)
  const loadTemplates = useApp((s) => s.loadTemplates)
  const pushToast = useApp((s) => s.pushToast)
  const t = useT()
  const [draft, setDraft] = useState<Template | null>(null)

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <SectionTitle>{t('settings.templates')}</SectionTitle>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon sx={{ fontSize: 15 }} />}
          sx={{ borderRadius: 2, height: 30 }}
          onClick={() => setDraft({ id: '', name: '新模板', subject: '', body: '', createdAt: 0 })}
        >
          {t('template.new')}
        </Button>
      </Box>

      {templates.length ? (
        templates.map((template) => (
          <Paper
            key={template.id}
            elevation={0}
            sx={{ p: 1.5, mb: 1.25, borderRadius: 2.5, bgcolor: alpha(theme.palette.text.primary, 0.03) }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{template.name}</Typography>
              <Button size="small" variant="outlined" onClick={() => setDraft(template)} sx={{ borderRadius: 2, height: 26 }}>
                {t('settings.edit')}
              </Button>
              <IconButton
                size="small"
                onClick={async () => {
                  await api.templateDelete(template.id)
                  await loadTemplates()
                }}
                aria-label="删除模板"
                sx={{ color: 'error.main' }}
              >
                <DeleteIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Box>
            {template.subject ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                主题：{template.subject}
              </Typography>
            ) : null}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, maxHeight: 40, overflow: 'hidden' }}>
              {template.body.slice(0, 140)}
            </Typography>
          </Paper>
        ))
      ) : (
        <Typography variant="caption" color="text.secondary">
          {t('template.empty')}
        </Typography>
      )}

      {draft ? (
        <Modal
          title={draft.id ? t('template.edit') : t('template.new')}
          onClose={() => setDraft(null)}
          width={620}
          footer={
            <Button
              variant="contained"
              onClick={async () => {
                await api.templateSave(draft)
                setDraft(null)
                await loadTemplates()
                pushToast('success', t('template.saved'))
              }}
            >
              {t('settings.save')}
            </Button>
          }
        >
          <Field label={t('template.name')}>
            <TextField fullWidth value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label={t('template.subject')}>
            <TextField fullWidth value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
          </Field>
          <Field label={t('template.body')}>
            <TextField
              fullWidth
              multiline
              minRows={8}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
          </Field>
        </Modal>
      ) : null}
    </Box>
  )
}

const KIND_ICON: Record<string, typeof FileIcon> = {
  image: ImageIcon,
  pdf: PdfIcon,
  doc: DocIcon,
  archive: ZipIcon,
  video: VideoIcon,
  audio: AudioIcon,
  other: FileIcon
}

const KIND_LABEL: Record<string, string> = {
  all: '全部',
  image: '图片',
  pdf: 'PDF',
  doc: '文档',
  archive: '压缩包',
  video: '视频',
  audio: '音频',
  other: '其他'
}

function humanSize(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`
}

function AttachmentsTab(): React.ReactNode {
  const theme = useTheme()
  const t = useT()
  const pushToast = useApp((s) => s.pushToast)
  const [items, setItems] = useState<AttachmentRecord[]>([])
  const [kind, setKind] = useState('all')
  const [term, setTerm] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void api
      .attachmentsAll(600)
      .then((list) => setItems(list))
      .finally(() => setLoading(false))
  }, [])

  const filtered = items.filter(
    (item) =>
      (kind === 'all' || item.kind === kind) &&
      (!term || item.filename.toLowerCase().includes(term.toLowerCase()))
  )
  const totalSize = filtered.reduce((sum, item) => sum + item.size, 0)

  async function jumpToMessage(item: AttachmentRecord): Promise<void> {
    const state = useApp.getState()
    await state.selectAccount(item.accountId)
    await state.selectFolder(item.folderId)
    await state.openMessage(item.messageId)
    state.closeSettings()
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <SectionTitle>{t('settings.attachments')}</SectionTitle>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">
          {filtered.length} 个文件 · 共 {humanSize(totalSize)}
        </Typography>
      </Box>

      <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
        {Object.entries(KIND_LABEL).map(([value, label]) => (
          <Chip
            key={value}
            size="small"
            label={label}
            variant={kind === value ? 'filled' : 'outlined'}
            onClick={() => setKind(value)}
            sx={{ cursor: 'pointer', borderRadius: 2 }}
          />
        ))}
      </Stack>

      <TextField
        fullWidth
        size="small"
        placeholder="按文件名筛选"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        sx={{ mb: 1.5 }}
      />

      <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
        {loading ? (
          <Typography variant="caption" color="text.secondary">
            正在读取附件…
          </Typography>
        ) : filtered.length ? (
          filtered.map((item) => {
            const Icon = KIND_ICON[item.kind] ?? FileIcon
            return (
              <Paper
                key={item.id}
                elevation={0}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  p: 1.25,
                  mb: 1,
                  borderRadius: 2.5,
                  bgcolor: alpha(theme.palette.text.primary, 0.03)
                }}
              >
                <Icon sx={{ fontSize: 20, color: 'text.secondary' }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.filename}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {humanSize(item.size)} · {item.from} · {new Date(item.date).toLocaleDateString()}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {item.subject}
                  </Typography>
                </Box>
                <Tooltip title="查看邮件" disableInteractive>
                  <IconButton size="small" onClick={() => void jumpToMessage(item)} aria-label="查看邮件">
                    <JumpIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="用系统程序打开" disableInteractive>
                  <IconButton size="small" onClick={() => void api.attachmentOpen(item.id)} aria-label="打开">
                    <OpenIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={async () => {
                    const path = await api.attachmentSaveAs(item.id)
                    if (path) pushToast('success', `已保存到 ${path}`)
                  }}
                  sx={{ borderRadius: 2, height: 26 }}
                >
                  另存为
                </Button>
              </Paper>
            )
          })
        ) : (
          <Typography variant="caption" color="text.secondary">
            没有匹配的附件（附件在打开邮件正文后才会下载到本地）
          </Typography>
        )}
      </Box>
    </Box>
  )
}

function StatsTab(): React.ReactNode {
  const theme = useTheme()
  const t = useT()
  const accounts = useApp((s) => s.accounts)
  const [stats, setStats] = useState<StatsOverview | null>(null)

  useEffect(() => {
    void api.statsOverview().then(setStats)
  }, [])

  if (!stats) {
    return (
      <Typography variant="caption" color="text.secondary">
        正在统计…
      </Typography>
    )
  }

  const maxReceived = Math.max(1, ...stats.received.map((p) => p.count))
  const maxSent = Math.max(1, ...stats.sent.map((p) => p.count))
  const maxBar = Math.max(maxReceived, maxSent)
  const days = stats.received.map((p) => p.day)
  const sentMap = new Map(stats.sent.map((p) => [p.day, p.count]))
  const maxSender = Math.max(1, ...stats.topSenders.map((s) => s.count))
  const maxAccount = Math.max(1, ...stats.perAccount.map((a) => a.total))

  const card = (label: string, value: number | string) => (
    <Paper
      key={label}
      elevation={0}
      sx={{ flex: 1, p: 1.5, borderRadius: 2.5, bgcolor: alpha(theme.palette.text.primary, 0.03) }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 650, mt: 0.25 }}>{value}</Typography>
    </Paper>
  )

  return (
    <Box>
      <SectionTitle>{t('settings.stats')}</SectionTitle>

      <Stack direction="row" spacing={1.25} sx={{ mb: 2.5 }}>
        {card('邮件总数', stats.total)}
        {card('未读', stats.unread)}
        {card('含附件', stats.withAttachments)}
        {card('启用账户', stats.accounts)}
      </Stack>

      <SectionTitle>近 30 天收发趋势</SectionTitle>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '3px',
          height: 110,
          p: 1,
          borderRadius: 2.5,
          bgcolor: alpha(theme.palette.text.primary, 0.03),
          mb: 0.75
        }}
      >
        {days.map((day) => {
          const received = stats.received.find((p) => p.day === day)?.count ?? 0
          const sent = sentMap.get(day) ?? 0
          return (
            <Tooltip
              key={day}
              title={`${new Date(day * 86400000).toLocaleDateString()} · 收 ${received} / 发 ${sent}`}
              disableInteractive
            >
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '2px', minWidth: 4 }}>
                <Box
                  sx={{
                    height: `${Math.max(2, (sent / maxBar) * 80)}px`,
                    bgcolor: alpha(theme.palette.text.primary, 0.35),
                    borderRadius: 0.5
                  }}
                />
                <Box
                  sx={{
                    height: `${Math.max(2, (received / maxBar) * 80)}px`,
                    bgcolor: 'primary.main',
                    borderRadius: 0.5
                  }}
                />
              </Box>
            </Tooltip>
          )
        })}
      </Box>
      <Typography variant="caption" color="text.secondary">
        深色为发出，浅色为收到
      </Typography>

      <Box sx={{ mt: 2.5 }}>
        <SectionTitle>最常联系</SectionTitle>
        {stats.topSenders.length ? (
          stats.topSenders.map((sender) => (
            <Box key={sender.address} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.75 }}>
              <Typography
                variant="caption"
                sx={{ width: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {sender.address}
              </Typography>
              <Box
                sx={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  bgcolor: alpha(theme.palette.text.primary, 0.07),
                  overflow: 'hidden'
                }}
              >
                <Box
                  sx={{
                    width: `${(sender.count / maxSender) * 100}%`,
                    height: '100%',
                    bgcolor: 'primary.main',
                    borderRadius: 4
                  }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ width: 40, textAlign: 'right' }}>
                {sender.count}
              </Typography>
            </Box>
          ))
        ) : (
          <Typography variant="caption" color="text.secondary">
            暂无数据
          </Typography>
        )}
      </Box>

      <Box sx={{ mt: 2.5 }}>
        <SectionTitle>各账户邮件量</SectionTitle>
        {stats.perAccount.map((account) => (
          <Box key={account.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.75 }}>
            <Typography variant="caption" sx={{ width: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {account.name}
            </Typography>
            <Box
              sx={{
                flex: 1,
                height: 8,
                borderRadius: 4,
                bgcolor: alpha(theme.palette.text.primary, 0.07),
                overflow: 'hidden'
              }}
            >
              <Box
                sx={{
                  width: `${(account.total / maxAccount) * 100}%`,
                  height: '100%',
                  bgcolor: account.color || 'primary.main',
                  borderRadius: 4
                }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ width: 70, textAlign: 'right' }}>
              {account.total} / 未读 {account.unread ?? 0}
            </Typography>
          </Box>
        ))}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2.5 }}>
        统计基于本地已缓存的邮件（账户数：{accounts.length}）
      </Typography>
    </Box>
  )
}

function LabelsTab(): React.ReactNode {
  const theme = useTheme()
  const t = useT()
  const labels = useApp((s) => s.labels)
  const saveLabel = useApp((s) => s.saveLabel)
  const deleteLabel = useApp((s) => s.deleteLabel)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#5b8def')

  return (
    <Box>
      <SectionTitle>{t('settings.labels')}</SectionTitle>

      <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="标签名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ flex: 1 }}
        />
        <TextField
          size="small"
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          sx={{ width: 70 }}
        />
        <Button
          variant="contained"
          sx={{ borderRadius: 2, height: 32 }}
          onClick={async () => {
            if (!name.trim()) return
            await saveLabel({ name: name.trim(), color })
            setName('')
          }}
        >
          新建标签
        </Button>
      </Stack>

      {labels.length ? (
        labels.map((label: Label) => (
          <Paper
            key={label.id}
            elevation={0}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              p: 1.25,
              mb: 1,
              borderRadius: 2.5,
              bgcolor: alpha(theme.palette.text.primary, 0.03)
            }}
          >
            <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: label.color }} />
            <Typography sx={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{label.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {label.count ?? 0} 封
            </Typography>
            <TextField
              size="small"
              type="color"
              value={label.color}
              onChange={(e) => void saveLabel({ id: label.id, name: label.name, color: e.target.value })}
              sx={{ width: 56 }}
            />
            <IconButton
              size="small"
              onClick={() => void deleteLabel(label.id)}
              aria-label="删除标签"
              sx={{ color: 'error.main' }}
            >
              <DeleteIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Paper>
        ))
      ) : (
        <Typography variant="caption" color="text.secondary">
          还没有标签。创建后可在阅读窗格给邮件打标签，侧边栏点标签即可筛选。
        </Typography>
      )}
    </Box>
  )
}

function LockSection(): React.ReactNode {
  const pushToast = useApp((s) => s.pushToast)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    void api.securityStatus().then((status) => setEnabled(status.enabled))
  }, [])

  async function apply(): Promise<void> {
    if (!next || next.length < 4) {
      pushToast('error', '新密码至少 4 位')
      return
    }
    const ok = await api.securitySetPassword(current, next)
    if (ok) {
      pushToast('success', '应用锁已开启，下次启动需要输入密码')
      setEnabled(true)
      setCurrent('')
      setNext('')
    } else {
      pushToast('error', '当前密码不正确')
    }
  }

  async function disable(): Promise<void> {
    const ok = await api.securityClear(current)
    if (ok) {
      pushToast('success', '应用锁已关闭')
      setEnabled(false)
      setCurrent('')
      setNext('')
    } else {
      pushToast('error', '当前密码不正确')
    }
  }

  return (
    <Box>
      <SectionTitle>安全</SectionTitle>
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            type="password"
            placeholder={enabled ? '当前密码' : '当前密码（首次可留空）'}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <TextField
            size="small"
            type="password"
            placeholder="新密码（至少 4 位）"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <Button variant="contained" onClick={() => void apply()} sx={{ borderRadius: 2, height: 32, whiteSpace: 'nowrap' }}>
            {enabled ? '修改密码' : '开启应用锁'}
          </Button>
          {enabled ? (
            <Button variant="outlined" color="warning" onClick={() => void disable()} sx={{ borderRadius: 2, height: 32 }}>
              关闭
            </Button>
          ) : null}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          应用锁用于防止他人直接打开查看邮件；它不会加密数据库文件，如需更强保护建议同时使用系统磁盘加密。
        </Typography>
      </Stack>
    </Box>
  )
}
