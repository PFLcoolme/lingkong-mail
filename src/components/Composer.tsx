import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import SendIcon from '@mui/icons-material/SendRounded'
import SaveIcon from '@mui/icons-material/SaveRounded'
import AttachFileIcon from '@mui/icons-material/AttachFileRounded'
import CloseIcon from '@mui/icons-material/CloseRounded'
import type { Contact } from '@shared/types'
import { useApp, type ComposerState } from '@/store/app'
import { api, type PickedFile } from '@/lib/api'
import { Avatar, Field, Modal } from './ui'
import { formatSize } from '@/lib/format'

export default function Composer(): React.ReactNode {
  const composer = useApp((s) => s.composer)
  const closeComposer = useApp((s) => s.closeComposer)
  const sendComposer = useApp((s) => s.sendComposer)
  const saveDraft = useApp((s) => s.saveDraft)
  const accounts = useApp((s) => s.accounts)
  const [sending, setSending] = useState(false)
  const [suggestions, setSuggestions] = useState<Contact[]>([])
  const [suggestField, setSuggestField] = useState<'to' | 'cc' | 'bcc' | null>(null)
  const suggestTimer = useRef<number | undefined>(undefined)

  const patch = (values: Partial<ComposerState>): void => {
    useApp.setState((s) => (s.composer ? { composer: { ...s.composer, ...values } } : {}))
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void send()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!composer) return null

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
    <Modal
      title={composer.mode === 'new' ? '写邮件' : composer.mode === 'forward' ? '转发邮件' : '回复邮件'}
      subtitle="Ctrl + Enter 快速发送"
      onClose={closeComposer}
      width={780}
      footer={
        <>
          <Button variant="outlined" startIcon={<SaveIcon sx={{ fontSize: 16 }} />} onClick={() => void saveDraft()}>
            存草稿
          </Button>
          <Button variant="contained" startIcon={<SendIcon sx={{ fontSize: 16 }} />} onClick={() => void send()} disabled={sending}>
            {sending ? '发送中…' : '发送'}
          </Button>
        </>
      }
    >
      <Field label="发件账户">
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

      <Box sx={{ position: 'relative' }}>
        <Field label="收件人">
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
            <Field label="抄送">
              <TextField fullWidth value={composer.cc} onChange={(e) => onAddressInput('cc', e.target.value)} />
            </Field>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Field label="密送">
              <TextField fullWidth value={composer.bcc} onChange={(e) => onAddressInput('bcc', e.target.value)} />
            </Field>
          </Box>
        </Stack>
      ) : (
        <Button size="small" onClick={() => patch({ showCc: true })} sx={{ mb: 2, borderRadius: 2 }}>
          + 抄送 / 密送
        </Button>
      )}

      <Field label="主题">
        <TextField fullWidth value={composer.subject} onChange={(e) => patch({ subject: e.target.value })} placeholder="邮件主题" />
      </Field>

      <Field label="正文">
        <TextField
          fullWidth
          multiline
          minRows={12}
          value={composer.text}
          onChange={(e) => patch({ text: e.target.value })}
          placeholder="撰写邮件内容…"
          sx={{ '& .MuiInputBase-root': { alignItems: 'flex-start', lineHeight: 1.7 } }}
        />
      </Field>

      <Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AttachFileIcon sx={{ fontSize: 15 }} />}
          onClick={() => void addAttachments()}
          sx={{ mb: 1.5, borderRadius: 2 }}
        >
          添加附件
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
  )
}
