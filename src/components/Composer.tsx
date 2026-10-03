import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material'
import SendIcon from '@mui/icons-material/SendRounded'
import SaveIcon from '@mui/icons-material/SaveRounded'
import AttachFileIcon from '@mui/icons-material/AttachFileRounded'
import CloseIcon from '@mui/icons-material/CloseRounded'
import ScheduleSendIcon from '@mui/icons-material/ScheduleSendRounded'
import FormatBoldIcon from '@mui/icons-material/FormatBoldRounded'
import FormatItalicIcon from '@mui/icons-material/FormatItalicRounded'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlinedRounded'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulletedRounded'
import FormatClearIcon from '@mui/icons-material/FormatClearRounded'
import LinkIcon from '@mui/icons-material/LinkRounded'
import type { Contact } from '@shared/types'
import { useApp, type ComposerState } from '@/store/app'
import { api, type PickedFile } from '@/lib/api'
import { Avatar, Field, Modal } from './ui'
import { formatSize } from '@/lib/format'
import { useT } from '@/lib/i18n'

export default function Composer(): React.ReactNode {
  const composer = useApp((s) => s.composer)
  const closeComposer = useApp((s) => s.closeComposer)
  const sendComposer = useApp((s) => s.sendComposer)
  const saveDraft = useApp((s) => s.saveDraft)
  const accounts = useApp((s) => s.accounts)
  const templates = useApp((s) => s.templates)
  const t = useT()
  const [sending, setSending] = useState(false)
  const [scheduleAnchor, setScheduleAnchor] = useState<HTMLElement | null>(null)
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [scheduleValue, setScheduleValue] = useState<string>(() => toInputValue(new Date(Date.now() + 3600_000)))
  const [suggestions, setSuggestions] = useState<Contact[]>([])
  const [suggestField, setSuggestField] = useState<'to' | 'cc' | 'bcc' | null>(null)
  const suggestTimer = useRef<number | undefined>(undefined)
  const editorRef = useRef<HTMLDivElement>(null)
  const editorKey = useRef<string>('')
  const theme = useTheme()

  const patch = (values: Partial<ComposerState>): void => {
    useApp.setState((s) => (s.composer ? { composer: { ...s.composer, ...values } } : {}))
  }

  useEffect(() => {
    void useApp.getState().loadTemplates()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void send()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!composer) return null

  useEffect(() => {
    const el = editorRef.current
    if (!el || !composer) return
    const key = `${composer.draftId ?? ''}|${composer.mode}|${composer.to}|${composer.subject}`
    if (editorKey.current === key) return
    editorKey.current = key
    el.innerHTML = composer.html || textToHtml(composer.text || '')
  }, [composer])

  function handleEditorInput(): void {
    const el = editorRef.current
    if (!el) return
    patch({ html: el.innerHTML, text: el.innerText })
  }

  function execCommand(command: string): void {
    if (command === 'createLink') {
      const url = window.prompt(t('editor.linkPrompt'), 'https://')
      if (url) document.execCommand('createLink', false, url)
    } else {
      document.execCommand(command)
    }
    handleEditorInput()
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    const dropped = Array.from(event.dataTransfer.files) as unknown as {
      name?: string
      path?: string
      size?: number
    }[]
    const state = useApp.getState().composer
    if (!dropped.length || !state) return
    const merged = [...state.attachments]
    for (const file of dropped) {
      if (!file.path || merged.some((f) => f.path === file.path)) continue
      merged.push({
        filename: file.name || file.path.split('/').pop() || 'attachment',
        path: file.path,
        size: file.size ?? 0,
        mimeType: ''
      })
    }
    patch({ attachments: merged })
  }

  function onAddressInput(field: 'to' | 'cc' | 'bcc', value: string): void {
    patch({ [field]: value } as Partial<ComposerState>)
    const tail = value.split(/[,;，；]/).pop()?.trim() ?? ''
    window.clearTimeout(suggestTimer.current)
    if (tail.length < 1) {
      setSuggestions([])
      return
    }
    suggestTimer.current = window.setTimeout(() => {
      void api.contactsSearch(tail).then((list) => {
        setSuggestions(list)
        setSuggestField(field)
      })
    }, 220)
  }

  function pickSuggestion(contact: Contact): void {
    const field = suggestField ?? 'to'
    const state = useApp.getState().composer
    if (!state) return
    const parts = state[field].split(/[,;，；]/)
    parts[parts.length - 1] = ` ${contact.email}`
    patch({ [field]: parts.join(',').replace(/^,/, '').trim() } as Partial<ComposerState>)
    setSuggestions([])
  }

  function applyTemplate(id: string): void {
    const template = templates.find((item) => item.id === id)
    const state = useApp.getState().composer
    if (!template || !state) return
    patch({
      subject: state.subject || template.subject,
      text: state.text ? `${state.text}\n${template.body}` : template.body
    })
  }

  async function addAttachments(): Promise<void> {
    const files = await api.attachmentsPick()
    const state = useApp.getState().composer
    if (!files.length || !state) return
    const merged = [...state.attachments]
    for (const file of files) {
      if (!merged.some((f) => f.path === file.path)) merged.push(file as PickedFile)
    }
    patch({ attachments: merged })
  }

  async function send(): Promise<void> {
    setSending(true)
    try {
      await sendComposer()
    } catch (error) {
      useApp.getState().pushToast('error', error instanceof Error ? error.message : '发送失败')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
    <Modal
      title={
        composer.mode === 'new'
          ? t('compose.write')
          : composer.mode === 'forward'
            ? t('compose.forward')
            : t('compose.reply')
      }
      subtitle={t('compose.hint')}
      onClose={closeComposer}
      width={780}
      footer={
        <>
          <Button variant="outlined" startIcon={<SaveIcon sx={{ fontSize: 16 }} />} onClick={() => void saveDraft()}>
            {t('compose.saveDraft')}
          </Button>
          <Button
            variant="contained"
            startIcon={<SendIcon sx={{ fontSize: 16 }} />}
            onClick={() => void send()}
            disabled={sending}
          >
            {sending ? t('compose.sending') : t('compose.send')}
          </Button>
          <Tooltip title="定时发送" disableInteractive>
            <IconButton
              size="small"
              onClick={(event) => setScheduleAnchor(event.currentTarget)}
              aria-label="定时发送"
              sx={{ ml: -0.5 }}
            >
              <ScheduleSendIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={scheduleAnchor}
            open={Boolean(scheduleAnchor)}
            onClose={() => setScheduleAnchor(null)}
          >
            {SCHEDULE_OPTIONS.map((option) => (
              <MenuItem
                key={option.label}
                sx={{ fontSize: 13 }}
                onClick={() => {
                  setScheduleAnchor(null)
                  void sendComposer(option.options)
                }}
              >
                {option.label}
              </MenuItem>
            ))}
            <MenuItem
              sx={{ fontSize: 13 }}
              onClick={() => {
                setScheduleAnchor(null)
                setScheduleValue(toInputValue(new Date(Date.now() + 3600_000)))
                setScheduleDialogOpen(true)
              }}
            >
              自定义时间…
            </MenuItem>
          </Menu>
        </>
      }
    >
      <Field label={t('compose.from')}>
        <TextField
          select
          fullWidth
          value={composer.accountId}
          onChange={(e) => patch({ accountId: e.target.value })}
        >
          {accounts.map((account) => (
            <MenuItem key={account.id} value={account.id} sx={{ fontSize: 13 }}>
              {account.name}（{account.email}）
            </MenuItem>
          ))}
        </TextField>
      </Field>

      <Field label={t('compose.template')}>
        <TextField
          select
          fullWidth
          value=""
          onChange={(e) => applyTemplate(e.target.value)}
          slotProps={{ select: { displayEmpty: true } }}
        >
          <MenuItem value="" sx={{ fontSize: 13 }}>
            {t('compose.template')}
          </MenuItem>
          {templates.map((template) => (
            <MenuItem key={template.id} value={template.id} sx={{ fontSize: 13 }}>
              {template.name}
            </MenuItem>
          ))}
        </TextField>
      </Field>

      <Box sx={{ position: 'relative' }}>
        <Field label={t('compose.to')}>
          <TextField
            fullWidth
            value={composer.to}
            onChange={(e) => onAddressInput('to', e.target.value)}
            placeholder="name@example.com，多个地址用逗号分隔"
          />
        </Field>
        {suggestions.length && suggestField === 'to' ? (
          <Paper
            elevation={0}
            sx={{ position: 'absolute', zIndex: 10, left: 0, right: 0, top: 68, borderRadius: 2, overflow: 'hidden', py: 0.5 }}
          >
            {suggestions.slice(0, 6).map((contact) => (
              <Box
                key={contact.id}
                onClick={() => pickSuggestion(contact)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 0.75,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' }
                }}
              >
                <Avatar name={contact.name || contact.email} size={20} />
                <Typography sx={{ fontSize: 12.5 }}>{contact.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {contact.email}
                </Typography>
              </Box>
            ))}
          </Paper>
        ) : null}
      </Box>

      {composer.showCc ? (
        <Stack direction="row" spacing={2}>
          <Box sx={{ flex: 1 }}>
            <Field label={t('compose.cc')}>
              <TextField fullWidth value={composer.cc} onChange={(e) => onAddressInput('cc', e.target.value)} />
            </Field>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Field label={t('compose.bcc')}>
              <TextField fullWidth value={composer.bcc} onChange={(e) => onAddressInput('bcc', e.target.value)} />
            </Field>
          </Box>
        </Stack>
      ) : (
        <Button size="small" onClick={() => patch({ showCc: true })} sx={{ mb: 2, borderRadius: 2 }}>
          {t('compose.showCc')}
        </Button>
      )}

      <Field label={t('compose.subject')}>
        <TextField fullWidth value={composer.subject} onChange={(e) => patch({ subject: e.target.value })} placeholder="邮件主题" />
      </Field>

      <Field label={t('compose.body')}>
        <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
          <Stack
            direction="row"
            spacing={0.25}
            sx={{ px: 1, py: 0.75, borderBottom: `1px solid ${theme.palette.divider}` }}
          >
            {[
              { cmd: 'bold', label: t('editor.bold'), icon: <FormatBoldIcon sx={{ fontSize: 16 }} /> },
              { cmd: 'italic', label: t('editor.italic'), icon: <FormatItalicIcon sx={{ fontSize: 16 }} /> },
              { cmd: 'underline', label: t('editor.underline'), icon: <FormatUnderlinedIcon sx={{ fontSize: 16 }} /> },
              { cmd: 'insertUnorderedList', label: t('editor.list'), icon: <FormatListBulletedIcon sx={{ fontSize: 16 }} /> },
              { cmd: 'createLink', label: t('editor.link'), icon: <LinkIcon sx={{ fontSize: 16 }} /> },
              { cmd: 'removeFormat', label: t('editor.clear'), icon: <FormatClearIcon sx={{ fontSize: 16 }} /> }
            ].map((item) => (
              <Tooltip key={item.cmd} title={item.label} disableInteractive>
                <IconButton
                  size="small"
                  aria-label={item.label}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    execCommand(item.cmd)
                  }}
                  sx={{ borderRadius: 1.5 }}
                >
                  {item.icon}
                </IconButton>
              </Tooltip>
            ))}
            <Box sx={{ flex: 1 }} />
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
              {t('editor.dropHint')}
            </Typography>
          </Stack>
          <Box
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label={t('compose.body')}
            onInput={handleEditorInput}
            onBlur={handleEditorInput}
            onDrop={handleDrop}
            onDragOver={(event) => event.preventDefault()}
            sx={{
              minHeight: 220,
              maxHeight: 420,
              overflowY: 'auto',
              px: 1.75,
              py: 1.25,
              fontSize: 14,
              lineHeight: 1.75,
              outline: 'none',
              '& a': { color: 'primary.main' },
              '& ul': { pl: 3, my: 1 },
              '&:empty:before': { content: '""', color: 'text.disabled' }
            }}
          />
        </Paper>
      </Field>

      <Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AttachFileIcon sx={{ fontSize: 15 }} />}
          onClick={() => void addAttachments()}
          sx={{ mb: 1.5, borderRadius: 2 }}
        >
          {t('compose.addAttachment')}
        </Button>
        {composer.attachments.length ? (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
            {composer.attachments.map((file) => (
              <Chip
                key={file.path}
                icon={<AttachFileIcon sx={{ fontSize: 14 }} />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <span>{file.filename}</span>
                    {file.size ? (
                      <Typography variant="caption" color="text.secondary">
                        {formatSize(file.size)}
                      </Typography>
                    ) : null}
                  </Box>
                }
                onDelete={() =>
                  patch({ attachments: composer.attachments.filter((f) => f.path !== file.path) })
                }
                deleteIcon={<CloseIcon sx={{ fontSize: 14 }} />}
                sx={{ borderRadius: 2, height: 30 }}
              />
            ))}
          </Stack>
        ) : null}
      </Box>
    </Modal>

      {scheduleDialogOpen ? (
      <Modal
        title="选择发送时间"
        subtitle="到时间后自动发送，期间可在左侧「待发送」中撤销"
        onClose={() => setScheduleDialogOpen(false)}
        width={460}
        footer={
          <>
            <Button variant="outlined" onClick={() => setScheduleDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                const time = new Date(scheduleValue).getTime()
                if (Number.isNaN(time)) {
                  useApp.getState().pushToast('error', '请选择有效的时间')
                  return
                }
                setScheduleDialogOpen(false)
                void sendComposer({ scheduledAt: time })
              }}
            >
              确定定时发送
            </Button>
          </>
        }
      >
        <Field label="发送时间">
          <TextField
            fullWidth
            type="datetime-local"
            value={scheduleValue}
            onChange={(e) => setScheduleValue(e.target.value)}
            slotProps={{ htmlInput: { step: 60 } }}
          />
        </Field>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {[
            { label: '1 小时后', at: () => Date.now() + 3600_000 },
            { label: '3 小时后', at: () => Date.now() + 3 * 3600_000 },
            { label: '今晚 20:00', at: () => atHourOffset(0, 20) },
            { label: '明天 9:00', at: () => atHourOffset(1, 9) },
            { label: '下周一 9:00', at: () => atHourOffset(((8 - new Date().getDay()) % 7) || 7, 9) }
          ].map((item) => (
            <Chip
              key={item.label}
              label={item.label}
              onClick={() => setScheduleValue(toInputValue(new Date(item.at())))}
              sx={{ cursor: 'pointer', borderRadius: 2 }}
            />
          ))}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          当前选择：{formatScheduleTime(scheduleValue)}
        </Typography>
      </Modal>
      ) : null}
    </>
  )
}

function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<div>${escapeHtml(paragraph).replace(/\n/g, '<br/>')}</div>`)
    .join('')
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

const SCHEDULE_OPTIONS: {
  label: string
  options: { delaySeconds?: number; scheduledAt?: number }
}[] = [
  { label: '立即发送（不撤销）', options: { delaySeconds: 0 } },
  { label: '1 小时后发送', options: { delaySeconds: 3600 } },
  { label: '明早 9:00 发送', options: { scheduledAt: atTomorrow(9) } }
]

function atTomorrow(hour: number): number {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(hour, 0, 0, 0)
  return date.getTime()
}

function toInputValue(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

function atHourOffset(dayOffset: number, hour: number): number {
  const date = new Date()
  date.setDate(date.getDate() + dayOffset)
  date.setHours(hour, 0, 0, 0)
  return date.getTime()
}

function formatScheduleTime(value: string): string {
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return '未选择'
  return new Date(time).toLocaleString()
}
