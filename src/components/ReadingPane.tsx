import { useMemo, useState } from 'react'
import DOMPurify from 'dompurify'
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  alpha,
  useTheme
} from '@mui/material'
import ReplyIcon from '@mui/icons-material/ReplyRounded'
import ReplyAllIcon from '@mui/icons-material/ReplyAllRounded'
import ForwardIcon from '@mui/icons-material/ForwardRounded'
import StarIcon from '@mui/icons-material/StarRounded'
import StarBorderIcon from '@mui/icons-material/StarBorderRounded'
import MailUnreadIcon from '@mui/icons-material/MarkEmailUnreadRounded'
import DeleteIcon from '@mui/icons-material/DeleteOutlineRounded'
import AttachFileIcon from '@mui/icons-material/AttachFileRounded'
import PrivacyTipIcon from '@mui/icons-material/PrivacyTipOutlined'
import { useApp } from '@/store/app'
import { api } from '@/lib/api'
import { Avatar, EmptyState, Spinner } from './ui'
import { formatFullDate, formatSize, shortAddress } from '@/lib/format'

const ALLOWED_URI = /^(?:(?:https?|mailto|file|data|cid):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i

export default function ReadingPane(): React.ReactNode {
  const theme = useTheme()
  const message = useApp((s) => s.current)
  const loading = useApp((s) => s.loadingMessage)
  const compose = useApp((s) => s.compose)
  const markSeen = useApp((s) => s.markSeen)
  const flag = useApp((s) => s.flag)
  const remove = useApp((s) => s.remove)
  const settings = useApp((s) => s.settings)
  const [showRemoteImages, setShowRemoteImages] = useState(false)

  const html = useMemo(() => {
    if (!message?.bodyHtml) return ''
    let doc = message.bodyHtml
    for (const att of message.attachments) {
      if (att.inline && att.contentId) {
        const cid = att.contentId.replace(/[<>]/g, '')
        doc = doc.split(`cid:${cid}`).join(`file://${att.path}`)
      }
    }
    let clean = DOMPurify.sanitize(doc, {
      ALLOWED_URI_REGEXP: ALLOWED_URI,
      FORBID_TAGS: ['script', 'style', 'form', 'input', 'iframe', 'object', 'embed', 'link', 'meta'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'srcset']
    })
    if (!showRemoteImages) {
      clean = clean.replace(/(<img\b[^>]*?)\ssrc=(["'])https?:/gi, '$1 data-blocked-src=$2https:')
    }
    return clean
  }, [message, showRemoteImages])

  if (loading) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size={24} />
      </Box>
    )
  }

  if (!message) {
    return (
      <Box sx={{ flex: 1, display: 'flex' }}>
        <EmptyState
          title="选择一封邮件开始阅读"
          description="在左侧列表中点击邮件即可查看正文、下载附件或进行回复"
        />
      </Box>
    )
  }

  const remoteBlocked = /data-blocked-src=/i.test(html)
  const textColor = theme.palette.text.primary

  const actionButton = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    color?: 'error'
  ) => (
    <Button
      size="small"
      variant="outlined"
      startIcon={icon}
      onClick={onClick}
      sx={{
        borderRadius: 2.5,
        height: 30,
        color: color === 'error' ? 'error.main' : 'text.primary',
        borderColor: color === 'error' ? alpha(theme.palette.error.main, 0.4) : theme.palette.divider
      }}
    >
      {label}
    </Button>
  )

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <Paper
        elevation={0}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.25,
          borderRadius: 0,
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none',
          boxShadow: 'none'
        }}
      >
        <Tooltip title="标为未读" disableInteractive>
          <IconButton size="small" onClick={() => void markSeen([message.id], false)} aria-label="标为未读">
            <MailUnreadIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={message.flagged ? '取消星标' : '加星标'} disableInteractive>
          <IconButton size="small" onClick={() => void flag([message.id], !message.flagged)} aria-label="切换星标">
            {message.flagged ? (
              <StarIcon sx={{ fontSize: 18, color: 'warning.main' }} />
            ) : (
              <StarBorderIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        {actionButton(
          '回复',
          <ReplyIcon sx={{ fontSize: 16 }} />,
          () =>
            compose({
              mode: 'reply',
              accountId: message.accountId,
              to: message.from.map((a) => a.address).join(', '),
              subject: /^re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`,
              text: quote(message.bodyText, message.from, message.date, message.subject),
              inReplyTo: message.messageId,
              references: `${message.headers?.references ?? ''} ${message.messageId}`.trim(),
              replyFolderId: message.folderId,
              replyUid: message.uid
            })
        )}
        {actionButton(
          '全部回复',
          <ReplyAllIcon sx={{ fontSize: 16 }} />,
          () =>
            compose({
              mode: 'replyAll',
              accountId: message.accountId,
              to: [...message.from, ...message.to].map((a) => a.address).join(', '),
              subject: /^re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`,
              text: quote(message.bodyText, message.from, message.date, message.subject),
              inReplyTo: message.messageId,
              references: `${message.headers?.references ?? ''} ${message.messageId}`.trim(),
              replyFolderId: message.folderId,
              replyUid: message.uid
            })
        )}
        {actionButton(
          '转发',
          <ForwardIcon sx={{ fontSize: 16 }} />,
          () =>
            compose({
              mode: 'forward',
              accountId: message.accountId,
              subject: /^fwd:/i.test(message.subject) ? message.subject : `Fwd: ${message.subject}`,
              text: quote(message.bodyText, message.from, message.date, message.subject),
              attachments: message.attachments.map((a) => ({
                filename: a.filename,
                path: a.path,
                size: a.size,
                mimeType: a.mimeType
              }))
            })
        )}
        <Tooltip title="删除" disableInteractive>
          <IconButton
            size="small"
            onClick={() => void remove([message.id])}
            aria-label="删除邮件"
            sx={{ color: 'error.main' }}
          >
            <DeleteIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Paper>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 3.5, py: 2.5 }}>
        <Typography sx={{ fontSize: 19, fontWeight: 650, lineHeight: 1.4, mb: 2 }}>{message.subject}</Typography>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', mb: 2 }}>
          <Avatar name={message.from[0]?.name || message.from[0]?.address || '?'} size={38} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{shortAddress(message.from)}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              发送至 {message.to.length ? shortAddress(message.to) : '(无收件人)'}
              {message.cc.length ? ` · 抄送 ${shortAddress(message.cc)}` : ''}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, pt: 0.25 }}>
            {formatFullDate(message.date)}
          </Typography>
        </Stack>

        {remoteBlocked ? (
          <Alert
            severity="info"
            icon={<PrivacyTipIcon fontSize="small" />}
            action={
              <Button size="small" onClick={() => setShowRemoteImages(true)} sx={{ borderRadius: 2 }}>
                显示图片
              </Button>
            }
            sx={{ mb: 2, borderRadius: 2.5, py: 0.5 }}
          >
            为保护隐私，已阻止加载邮件中的远程图片
          </Alert>
        ) : null}

        {message.bodyHtml ? (
          <iframe
            title="邮件正文"
            sandbox=""
            srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent;color:${textColor};font-family:'Inter','Noto Sans SC',system-ui,sans-serif;font-size:${settings.fontSize}px;line-height:1.7;word-break:break-word}img{max-width:100%;height:auto}a{color:#3f6fd8}blockquote{border-left:3px solid rgba(140,140,150,.5);padding-left:10px;margin:8px 0;opacity:.85}table{max-width:100%}</style></head><body>${html}</body></html>`}
            style={{ width: '100%', height: '56vh', border: 'none' }}
          />
        ) : (
          <Typography
            component="pre"
            sx={{
              m: 0,
              whiteSpace: 'pre-wrap',
              fontSize: settings.fontSize,
              lineHeight: 1.75,
              fontFamily: 'inherit'
            }}
          >
            {message.bodyText || '(此邮件没有正文)'}
          </Typography>
        )}

        {message.attachments.length ? (
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ mb: 1.5 }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
              附件（{message.attachments.length}）
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {message.attachments
                .filter((a) => !a.inline)
                .map((att) => (
                  <Paper
                    key={att.id}
                    elevation={0}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1.5,
                      py: 1,
                      borderRadius: 2.5,
                      bgcolor: alpha(theme.palette.text.primary, 0.03)
                    }}
                  >
                    <AttachFileIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {att.filename}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatSize(att.size)}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label="打开"
                      onClick={() => void api.attachmentOpen(att.id)}
                      sx={{ height: 22, fontSize: 11.5, cursor: 'pointer' }}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label="另存为"
                      onClick={() => void api.attachmentSaveAs(att.id)}
                      sx={{ height: 22, fontSize: 11.5, cursor: 'pointer' }}
                    />
                  </Paper>
                ))}
            </Stack>
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}

function quote(body: string, from: { name?: string; address: string }[], date: number, subject: string): string {
  return [
    '',
    '',
    '---------- 原始邮件 ----------',
    `发件人: ${shortAddress(from)}`,
    `时间: ${formatFullDate(date)}`,
    `主题: ${subject}`,
    '',
    body ?? ''
  ].join('\n')
}
