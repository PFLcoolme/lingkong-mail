import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Checkbox,
  Chip,
  Divider,
  IconButton,
  InputBase,
  Paper,
  Select,
  Tooltip,
  Typography,
  MenuItem,
  alpha,
  useTheme
} from '@mui/material'
import StarIcon from '@mui/icons-material/StarRounded'
import StarBorderIcon from '@mui/icons-material/StarBorderRounded'
import AttachFileIcon from '@mui/icons-material/AttachFileRounded'
import MailIcon from '@mui/icons-material/MailOutlineRounded'
import MarkReadIcon from '@mui/icons-material/DraftsRounded'
import DeleteIcon from '@mui/icons-material/DeleteOutlineRounded'
import SearchIcon from '@mui/icons-material/SearchRounded'
import FilterAltIcon from '@mui/icons-material/FilterAltRounded'
import type { MessageSummary, SearchHit } from '@shared/types'
import { useApp } from '@/store/app'
import { Avatar, EmptyState, Spinner } from './ui'
import { formatDate, shortAddress } from '@/lib/format'

export default function MessageList(): React.ReactNode {
  const theme = useTheme()
  const messages = useApp((s) => s.messages)
  const loading = useApp((s) => s.loadingMessages)
  const selectedId = useApp((s) => s.selectedId)
  const openMessage = useApp((s) => s.openMessage)
  const unreadOnly = useApp((s) => s.unreadOnly)
  const withAttachments = useApp((s) => s.withAttachments)
  const toggleUnreadOnly = useApp((s) => s.toggleUnreadOnly)
  const toggleWithAttachments = useApp((s) => s.toggleWithAttachments)
  const setFilterQuery = useApp((s) => s.setFilterQuery)
  const filterQuery = useApp((s) => s.filterQuery)
  const searchResults = useApp((s) => s.searchResults)
  const searchTerm = useApp((s) => s.searchTerm)
  const clearSearch = useApp((s) => s.clearSearch)
  const markSeen = useApp((s) => s.markSeen)
  const flag = useApp((s) => s.flag)
  const remove = useApp((s) => s.remove)
  const moveTo = useApp((s) => s.moveTo)
  const folders = useApp((s) => s.folders)
  const selectAccount = useApp((s) => s.selectAccount)
  const selectFolder = useApp((s) => s.selectFolder)
  const showSnippet = useApp((s) => s.settings.showSnippet)

  const [checked, setChecked] = useState<string[]>([])
  useEffect(() => setChecked([]), [messages, searchResults])

  const rows: MessageSummary[] = useMemo(
    () => (searchResults ? (searchResults as MessageSummary[]) : messages),
    [searchResults, messages]
  )

  async function openHit(hit: SearchHit): Promise<void> {
    await selectAccount(hit.accountId)
    await selectFolder(hit.folderId)
    await openMessage(hit.id)
  }

  return (
    <Paper
      elevation={0}
      sx={{
        width: 404,
        flexShrink: 0,
        borderRadius: 0,
        borderTop: 'none',
        borderLeft: 'none',
        borderBottom: 'none',
        boxShadow: 'none',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box sx={{ p: 1.5, pb: 1 }}>
        {searchResults ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip size="small" icon={<SearchIcon sx={{ fontSize: 14 }} />} label={`“${searchTerm}” ${searchResults.length} 条`} />
            <Box sx={{ flex: 1 }} />
            <Chip size="small" variant="outlined" label="返回文件夹" onClick={clearSearch} sx={{ cursor: 'pointer' }} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                height: 32,
                borderRadius: 2.5,
                bgcolor: alpha(theme.palette.text.primary, 0.04),
                border: `1px solid ${theme.palette.divider}`
              }}
            >
              <FilterAltIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <InputBase
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="在当前文件夹中过滤"
                sx={{ flex: 1, fontSize: 13 }}
                inputProps={{ 'aria-label': '过滤当前文件夹' }}
              />
            </Box>
            <Tooltip title="仅未读" disableInteractive>
              <IconButton
                size="small"
                onClick={toggleUnreadOnly}
                aria-label="仅显示未读"
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 2.5,
                  border: `1px solid ${theme.palette.divider}`,
                  bgcolor: unreadOnly ? alpha(theme.palette.text.primary, 0.12) : 'transparent'
                }}
              >
                <MarkReadIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="仅含附件" disableInteractive>
              <IconButton
                size="small"
                onClick={toggleWithAttachments}
                aria-label="仅显示含附件的邮件"
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 2.5,
                  border: `1px solid ${theme.palette.divider}`,
                  bgcolor: withAttachments ? alpha(theme.palette.text.primary, 0.12) : 'transparent'
                }}
              >
                <AttachFileIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>

      {checked.length ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.5,
            py: 1,
            bgcolor: alpha(theme.palette.text.primary, 0.05),
            borderTop: `1px solid ${theme.palette.divider}`,
            borderBottom: `1px solid ${theme.palette.divider}`
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
            已选 {checked.length}
          </Typography>
          <Tooltip title="标记为已读" disableInteractive>
            <IconButton size="small" onClick={() => void markSeen(checked, true)} aria-label="标记已读">
              <MarkReadIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="加星标" disableInteractive>
            <IconButton size="small" onClick={() => void flag(checked, true)} aria-label="加星标">
              <StarIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
          <Select
            size="small"
            displayEmpty
            value=""
            onChange={(e) => {
              if (!e.target.value) return
              void moveTo(checked, e.target.value)
              setChecked([])
            }}
            renderValue={() => '移动到…'}
            sx={{ minWidth: 96, height: 30, fontSize: 12, borderRadius: 2.5 }}
          >
            {folders.map((folder) => (
              <MenuItem key={folder.id} value={folder.path} sx={{ fontSize: 13 }}>
                {folder.name}
              </MenuItem>
            ))}
          </Select>
          <Box sx={{ flex: 1 }} />
          <Tooltip title="删除" disableInteractive>
            <IconButton
              size="small"
              onClick={() => void remove(checked)}
              aria-label="删除所选邮件"
              sx={{ color: 'error.main' }}
            >
              <DeleteIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
        </Box>
      ) : null}

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <Spinner size={20} />
          </Box>
        ) : rows.length ? (
          rows.map((item) => {
            const hit = item as SearchHit
            const selected = item.id === selectedId
            return (
              <Box
                key={item.id}
                className={`msg-row ${selected ? 'selected' : ''} ${item.seen ? '' : 'unread'}`}
                onClick={() => (searchResults ? void openHit(hit) : void openMessage(item.id))}
                sx={{
                  display: 'flex',
                  gap: 1.25,
                  px: 1.5,
                  py: 1.25,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  bgcolor: selected ? alpha(theme.palette.text.primary, 0.09) : 'transparent'
                }}
              >
                <Box
                  onClick={(e) => e.stopPropagation()}
                  sx={{ display: 'flex', alignSelf: 'flex-start', mt: 0.25 }}
                >
                  <Checkbox
                    size="small"
                    checked={checked.includes(item.id)}
                    onChange={(e) =>
                      setChecked(e.target.checked ? [...checked, item.id] : checked.filter((id) => id !== item.id))
                    }
                    sx={{ p: 0.5 }}
                    slotProps={{ input: { 'aria-label': '选择邮件' } }}
                  />
                </Box>
                <Avatar name={item.from[0]?.name || item.from[0]?.address || '?'} size={32} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                    <Typography
                      className="msg-title"
                      sx={{
                        fontSize: 13,
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {shortAddress(item.from)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                      {formatDate(item.date)}
                    </Typography>
                  </Box>
                  <Typography
                    sx={{
                      fontSize: 13,
                      mt: 0.25,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {item.subject}
                  </Typography>
                  {showSnippet ? (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: 'block',
                        mt: 0.25,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {item.snippet}
                    </Typography>
                  ) : null}
                  {searchResults && hit.accountName ? (
                    <Chip
                      size="small"
                      label={`${hit.accountName} · ${hit.folderName}`}
                      sx={{ mt: 0.5, height: 18, fontSize: 10.5 }}
                    />
                  ) : null}
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                  <IconButton
                    size="small"
                    aria-label="切换星标"
                    onClick={(e) => {
                      e.stopPropagation()
                      void flag([item.id], !item.flagged)
                    }}
                    sx={{ p: 0.25 }}
                  >
                    {item.flagged ? (
                      <StarIcon sx={{ fontSize: 17, color: 'warning.main' }} />
                    ) : (
                      <StarBorderIcon sx={{ fontSize: 17, color: 'text.disabled' }} />
                    )}
                  </IconButton>
                  {item.attachmentCount ? (
                    <AttachFileIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  ) : null}
                  {!item.seen ? (
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', mt: 0.5 }} />
                  ) : null}
                </Box>
              </Box>
            )
          })
        ) : (
          <EmptyState
            icon={<MailIcon sx={{ fontSize: 30, color: 'text.disabled' }} />}
            title={searchResults ? '没有匹配的邮件' : '这里还没有邮件'}
            description={searchResults ? '换个关键词试试' : '点击左下角“同步”从服务器收取邮件'}
          />
        )}
      </Box>

      {!searchResults ? (
        <Box sx={{ px: 2, py: 1 }}>
          <Divider sx={{ mb: 1 }} />
          <Typography variant="caption" color="text.secondary">
            共 {messages.length} 封邮件
          </Typography>
        </Box>
      ) : null}
    </Paper>
  )
}
