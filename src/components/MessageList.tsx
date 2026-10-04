import { useEffect, useMemo, useRef, useState } from 'react'
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
import FileDownloadIcon from '@mui/icons-material/FileDownloadRounded'
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreRounded'
import ExpandLessIcon from '@mui/icons-material/ExpandLessRounded'
import StarIcon from '@mui/icons-material/StarRounded'
import StarBorderIcon from '@mui/icons-material/StarBorderRounded'
import AttachFileIcon from '@mui/icons-material/AttachFileRounded'
import MailIcon from '@mui/icons-material/MailOutlineRounded'
import MarkReadIcon from '@mui/icons-material/DraftsRounded'
import DeleteIcon from '@mui/icons-material/DeleteOutlineRounded'
import SearchIcon from '@mui/icons-material/SearchRounded'
import FilterAltIcon from '@mui/icons-material/FilterAltRounded'
import { UNIFIED_INBOX_ID, type MessageSummary, type SearchHit } from '@shared/types'
import { useApp } from '@/store/app'
import { Avatar, EmptyState, Spinner } from './ui'
import { formatDate, shortAddress } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { api } from '@/lib/api'

export default function MessageList({ layout = 'row' }: { layout?: 'row' | 'column' }): React.ReactNode {
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
  const accounts = useApp((s) => s.accounts)
  const activeFolderId = useApp((s) => s.activeFolderId)
  // 统一收件箱下，同一列表里混有多个账户的邮件，需要标出归属
  const unifiedMode = activeFolderId === UNIFIED_INBOX_ID
  const accountOf = (accountId: string): { name: string; color: string } | undefined => {
    const account = accounts.find((a) => a.id === accountId)
    return account ? { name: account.name || account.email, color: account.color } : undefined
  }
  const selectFolder = useApp((s) => s.selectFolder)
  const showSnippet = useApp((s) => s.settings.showSnippet)
  const hasMore = useApp((s) => s.hasMoreMessages)
  const loadingMore = useApp((s) => s.loadingMore)
  const loadMoreMessages = useApp((s) => s.loadMoreMessages)
  const saveSearch = useApp((s) => s.saveSearch)
  const labels = useApp((s) => s.labels)
  const messageLabelMap = useApp((s) => s.messageLabelMap)
  const density = useApp((s) => s.settings.listDensity)
  const storedWidth = useApp((s) => s.settings.listWidth)
  const updateSettings = useApp((s) => s.updateSettings)
  const [width, setWidth] = useState(storedWidth || 404)
  const widthRef = useRef(width)
  widthRef.current = width
  const compact = density === 'compact'

  useEffect(() => {
    if (storedWidth && Math.abs(storedWidth - widthRef.current) > 60) setWidth(storedWidth)
  }, [storedWidth])

  function startResize(event: React.MouseEvent): void {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = widthRef.current
    const onMove = (moveEvent: MouseEvent): void => {
      const next = Math.min(760, Math.max(280, startWidth + (moveEvent.clientX - startX)))
      setWidth(next)
    }
    const onUp = (): void => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      void updateSettings({ listWidth: widthRef.current })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const threadView = useApp((s) => s.settings.threadView)
  const [checked, setChecked] = useState<string[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const t = useT()

  useEffect(() => setChecked([]), [messages, searchResults])

  const rows: MessageSummary[] = useMemo(
    () => (searchResults ? (searchResults as MessageSummary[]) : messages),
    [searchResults, messages]
  )

  const threadKey = (subject: string): string => {
    let key = subject
    for (let i = 0; i < 3; i += 1) {
      key = key.replace(/^\s*(re|fwd?|fw|aw|回复|转发)\s*[:：]\s*/i, '')
    }
    return key.trim().toLowerCase() || '(无主题)'
  }

  const threads = useMemo(() => {
    if (!threadView || searchResults) return null
    const groups = new Map<string, MessageSummary[]>()
    for (const item of messages) {
      const key = threadKey(item.subject)
      const list = groups.get(key) ?? []
      list.push(item)
      groups.set(key, list)
    }
    return [...groups.values()]
  }, [messages, threadView, searchResults])

  const threadHeadIds = useMemo(() => {
    const ids = new Set<string>()
    if (threads) {
      for (const group of threads) {
        if (group.length > 1 && group[0]) ids.add(group[0].id)
      }
    }
    return ids
  }, [threads])

  const displayRows: MessageSummary[] = useMemo(() => {
    if (!threads) return rows
    const out: MessageSummary[] = []
    for (const group of threads) {
      if (!group.length) continue
      out.push(group[0])
      if (expanded[threadKey(group[0].subject)]) out.push(...group.slice(1))
    }
    return out
  }, [rows, threads, expanded])

  function toggleThread(id: string): void {
    const item = messages.find((m) => m.id === id)
    if (!item) return
    const key = threadKey(item.subject)
    setExpanded({ ...expanded, [key]: !expanded[key] })
  }

  async function exportSelected(): Promise<void> {
    const result = await api.messagesExport(checked)
    if (result) useApp.getState().pushToast('success', t('toast.exported', { n: result.count }))
    setChecked([])
  }

  async function openHit(hit: SearchHit): Promise<void> {
    await selectAccount(hit.accountId)
    await selectFolder(hit.folderId)
    await openMessage(hit.id)
  }

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        width: layout === 'row' ? width : '100%',
        height: layout === 'row' ? '100%' : '46%',
        flexShrink: 0,
        borderRadius: 0,
        borderTop: 'none',
        borderLeft: 'none',
        borderBottom: layout === 'row' ? 'none' : `1px solid ${theme.palette.divider}`,
        borderRight: layout === 'row' ? `1px solid ${theme.palette.divider}` : 'none',
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
            <Chip
              size="small"
              variant="outlined"
              label="保存为智能文件夹"
              onClick={() => {
                const name = window.prompt('给这个智能文件夹起个名字', searchTerm)
                if (name) void saveSearch(name, searchTerm)
              }}
              sx={{ cursor: 'pointer' }}
            />
            <Chip
              size="small"
              variant="outlined"
              label="保存为智能文件夹"
              onClick={() => {
                const name = window.prompt('给这个智能文件夹起个名字', searchTerm)
                if (name) void saveSearch(name, searchTerm)
              }}
              sx={{ cursor: 'pointer' }}
            />
            <Chip size="small" variant="outlined" label={t('list.backToFolder')} onClick={clearSearch} sx={{ cursor: 'pointer' }} />
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
                placeholder={t('list.filter')}
                sx={{ flex: 1, fontSize: 13 }}
                inputProps={{ 'aria-label': '过滤当前文件夹' }}
              />
            </Box>
            <Tooltip title={t('list.unreadOnly')} disableInteractive>
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
            {t('list.selected', { n: checked.length })}
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
          <Tooltip title={t('list.export')} disableInteractive>
            <IconButton size="small" onClick={() => void exportSelected()} aria-label={t('list.export')}>
              <FileDownloadIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Tooltip>
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

      <Box
        sx={{ flex: 1, overflowY: 'auto' }}
        onScroll={(event) => {
          const el = event.currentTarget
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) void loadMoreMessages()
        }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <Spinner size={20} />
          </Box>
        ) : rows.length ? (
          displayRows.map((item) => {
            const hit = item as SearchHit
            const selected = item.id === selectedId
            return (
              <Box
                key={item.id}
                className={`msg-row ${selected ? 'selected' : ''} ${item.seen ? '' : 'unread'}`}
                onClick={() => {
                  if (searchResults) {
                    void openHit(hit)
                    return
                  }
                  const isHead = threadHeadIds.has(item.id)
                  const isOpen = isHead && expanded[threadKey(item.subject)]
                  if (isHead && !isOpen) {
                    toggleThread(item.id)
                    return
                  }
                  void openMessage(item.id)
                }}
                sx={{
                  display: 'flex',
                  gap: 1.25,
                  px: 1.5,
                  py: compact ? 0.6 : 1.25,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  bgcolor: selected ? alpha(theme.palette.text.primary, 0.09) : 'transparent'
                }}
              >
                <Box
                  onClick={(e) => e.stopPropagation()}
                  sx={{ display: 'flex', alignSelf: 'flex-start', mt: compact ? 0 : 0.25 }}
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
                <Box sx={{ position: 'relative', flexShrink: 0 }}>
                  <Avatar name={item.from[0]?.name || item.from[0]?.address || '?'} size={compact ? 24 : 32} />
                  {unifiedMode && accountOf(item.accountId) ? (
                    <Tooltip title={accountOf(item.accountId)?.name ?? ''} disableInteractive>
                      <Box
                        sx={{
                          position: 'absolute',
                          right: -2,
                          bottom: -2,
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          bgcolor: accountOf(item.accountId)?.color ?? 'primary.main',
                          border: `1.5px solid ${theme.palette.background.paper}`
                        }}
                      />
                    </Tooltip>
                  ) : null}
                </Box>
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
                  {showSnippet && !compact ? (
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
                  {threadHeadIds.has(item.id) ? (
                    <Chip
                      size="small"
                      icon={
                        expanded[threadKey(item.subject)] ? (
                          <ExpandLessIcon sx={{ fontSize: 13 }} />
                        ) : (
                          <ExpandMoreIcon sx={{ fontSize: 13 }} />
                        )
                      }
                      label={t('list.threadCount', {
                        n: threads?.find((g) => g[0]?.id === item.id)?.length ?? 0
                      })}
                      sx={{ height: 18, fontSize: 10.5 }}
                    />
                  ) : null}
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
                  {(messageLabelMap[item.id] ?? []).slice(0, 4).map((labelId) => {
                    const label = labels.find((item2) => item2.id === labelId)
                    if (!label) return null
                    return (
                      <Box
                        key={labelId}
                        title={label.name}
                        sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: label.color }}
                      />
                    )
                  })}
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
            title={searchResults ? t('list.noMatch') : t('list.empty')}
            description={searchResults ? '换个关键词试试' : t('list.emptyHint')}
          />
        )}
      </Box>

      {hasMore || loadingMore ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.25 }}>
          {loadingMore ? <Spinner size={16} /> : (
            <Typography variant="caption" color="text.secondary">
              向下滚动加载更多
            </Typography>
          )}
        </Box>
      ) : null}

      {!searchResults ? (
        <Box sx={{ px: 2, py: 1 }}>
          <Divider sx={{ mb: 1 }} />
          <Typography variant="caption" color="text.secondary">
            {t('list.count', { n: messages.length })}
          </Typography>
        </Box>
      ) : null}

      {layout === 'row' ? (
        <Box
          onMouseDown={startResize}
          sx={{
            position: 'absolute',
            top: 0,
            right: -3,
            width: 6,
            height: '100%',
            cursor: 'col-resize',
            zIndex: 6,
            '&:hover': { bgcolor: 'primary.main', opacity: 0.35 }
          }}
        />
      ) : null}
    </Paper>
  )
}
