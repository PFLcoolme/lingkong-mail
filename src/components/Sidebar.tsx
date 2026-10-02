import { useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Tooltip,
  Typography,
  alpha,
  useTheme
} from '@mui/material'
import InboxIcon from '@mui/icons-material/InboxRounded'
import SendIcon from '@mui/icons-material/SendRounded'
import DraftsIcon from '@mui/icons-material/DraftsRounded'
import DeleteIcon from '@mui/icons-material/DeleteOutlineRounded'
import ReportIcon from '@mui/icons-material/ReportProblemOutlined'
import ArchiveIcon from '@mui/icons-material/Inventory2Rounded'
import FolderIcon from '@mui/icons-material/FolderRounded'
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreRounded'
import ChevronRightIcon from '@mui/icons-material/ChevronRightRounded'
import EditIcon from '@mui/icons-material/EditRounded'
import SyncIcon from '@mui/icons-material/SyncRounded'
import AddIcon from '@mui/icons-material/AddRounded'
import ErrorIcon from '@mui/icons-material/ErrorOutlineRounded'
import SettingsIcon from '@mui/icons-material/SettingsOutlined'
import type { FolderType } from '@shared/types'
import { useApp } from '@/store/app'
import { Avatar } from './ui'

const FOLDER_ICON: Record<FolderType, typeof InboxIcon> = {
  inbox: InboxIcon,
  sent: SendIcon,
  drafts: DraftsIcon,
  trash: DeleteIcon,
  junk: ReportIcon,
  archive: ArchiveIcon,
  other: FolderIcon
}

const FOLDER_ORDER: FolderType[] = ['inbox', 'drafts', 'sent', 'archive', 'junk', 'trash', 'other']

export default function Sidebar(): React.ReactNode {
  const theme = useTheme()
  const accounts = useApp((s) => s.accounts)
  const folders = useApp((s) => s.folders)
  const activeAccountId = useApp((s) => s.activeAccountId)
  const activeFolderId = useApp((s) => s.activeFolderId)
  const selectAccount = useApp((s) => s.selectAccount)
  const selectFolder = useApp((s) => s.selectFolder)
  const syncNow = useApp((s) => s.syncNow)
  const openSettings = useApp((s) => s.openSettings)
  const openWizard = useApp((s) => s.openWizard)
  const compose = useApp((s) => s.compose)
  const syncing = useApp((s) => s.syncing)
  const drafts = useApp((s) => s.drafts)
  const openDraft = useApp((s) => s.openDraft)
  const loadDrafts = useApp((s) => s.loadDrafts)

  const [accountsOpen, setAccountsOpen] = useState(true)
  const [otherOpen, setOtherOpen] = useState(true)

  const busy = Object.values(syncing).some((s) => s.running)
  const unreadTotal = folders.reduce((sum, f) => sum + f.unread, 0)

  const groups = FOLDER_ORDER.map((type) => ({
    type,
    items: folders.filter((f) => f.type === type)
  })).filter((g) => g.items.length)

  const sectionHeader = (label: string, open: boolean, onToggle: () => void, extra?: React.ReactNode) => (
    <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1.5, pb: 0.5 }}>
      <Box
        onClick={onToggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          flex: 1,
          cursor: 'pointer',
          color: 'text.secondary'
        }}
      >
        {open ? <ExpandMoreIcon sx={{ fontSize: 15 }} /> : <ChevronRightIcon sx={{ fontSize: 15 }} />}
        <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
          {label}
        </Typography>
      </Box>
      {extra}
    </Box>
  )

  return (
    <Paper
      elevation={0}
      sx={{
        width: 252,
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
      <Box sx={{ p: 2, pb: 1 }}>
        <Button
          fullWidth
          variant="contained"
          disableElevation
          startIcon={<EditIcon sx={{ fontSize: 17 }} />}
          onClick={() => compose({ mode: 'new' })}
          disabled={!accounts.length}
          sx={{ height: 36, borderRadius: 2.5 }}
        >
          写邮件
        </Button>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', pb: 1 }}>
        {sectionHeader(
          `账户 ${accounts.length}`,
          accountsOpen,
          () => setAccountsOpen(!accountsOpen),
          <Tooltip title="添加账户" disableInteractive>
            <IconButton size="small" onClick={openWizard} aria-label="添加账户">
              <AddIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}

        {accountsOpen ? (
          <List dense disablePadding>
            {accounts.map((account) => {
              const accountUnread = folders
                .filter((f) => f.accountId === account.id)
                .reduce((sum, f) => sum + f.unread, 0)
              return (
                <ListItemButton
                  key={account.id}
                  selected={account.id === activeAccountId}
                  onClick={() => void selectAccount(account.id)}
                  sx={{ py: 0.6, minHeight: 36 }}
                >
                  <ListItemIcon sx={{ minWidth: 30 }}>
                    <Avatar name={account.name || account.email} color={account.color} size={22} />
                  </ListItemIcon>
                  <ListItemText
                    primary={account.name}
                    slotProps={{
                      primary: {
                        sx: {
                          fontSize: 13,
                          fontWeight: account.id === activeAccountId ? 600 : 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }
                      }
                    }}
                  />
                  {account.status === 'error' || account.status === 'auth-error' ? (
                    <Tooltip title={account.lastError || '连接失败'} disableInteractive>
                      <ErrorIcon sx={{ fontSize: 15, color: 'error.main', mr: 0.5 }} />
                    </Tooltip>
                  ) : null}
                  {accountUnread ? <Chip size="small" label={accountUnread} sx={{ height: 18, fontSize: 11 }} /> : null}
                </ListItemButton>
              )
            })}
          </List>
        ) : null}

        {groups.map((group) => {
          const isOther = group.type === 'other'
          return (
            <Box key={group.type} sx={{ mt: 0.5 }}>
              {isOther ? sectionHeader('其他文件夹', otherOpen, () => setOtherOpen(!otherOpen)) : null}
              <List dense disablePadding>
                {group.items.map((folder) => {
                  const Icon = FOLDER_ICON[group.type]
                  const state = syncing[folder.id]
                  if (isOther && !otherOpen) return null
                  return (
                    <ListItemButton
                      key={folder.id}
                      selected={folder.id === activeFolderId}
                      onClick={() => void selectFolder(folder.id)}
                      sx={{ py: 0.55, minHeight: 34 }}
                    >
                      <ListItemIcon sx={{ minWidth: 30 }}>
                        <Icon sx={{ fontSize: 18 }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={folder.name}
                        slotProps={{
                          primary: {
                            sx: {
                              fontSize: 13,
                              fontWeight: folder.id === activeFolderId ? 600 : 400,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }
                          }
                        }}
                      />
                      {state?.running ? (
                        <SyncIcon
                          className="spin"
                          sx={{ fontSize: 14, color: 'text.secondary', mr: 0.5 }}
                        />
                      ) : null}
                      {folder.unread ? (
                        <Chip
                          size="small"
                          label={folder.unread}
                          sx={{
                            height: 18,
                            fontSize: 11,
                            bgcolor: alpha(theme.palette.text.primary, 0.1),
                            color: 'text.primary'
                          }}
                        />
                      ) : null}
                    </ListItemButton>
                  )
                })}
              </List>
            </Box>
          )
        })}

        {drafts.length ? (
          <Box sx={{ mt: 1, pt: 1, borderTop: `1px solid ${theme.palette.divider}` }}>
            {sectionHeader(`本地草稿 ${drafts.length}`, true, () => void loadDrafts())}
            <List dense disablePadding>
              {drafts.slice(0, 5).map((draft) => (
                <ListItemButton key={draft.id} onClick={() => openDraft(draft)} sx={{ py: 0.4, minHeight: 30 }}>
                  <ListItemIcon sx={{ minWidth: 30 }}>
                    <DraftsIcon sx={{ fontSize: 16 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={draft.subject || draft.to || '(无主题)'}
                    slotProps={{
                      primary: {
                        sx: {
                          fontSize: 12,
                          color: 'text.secondary',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }
                      }
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>
        ) : null}
      </Box>

      <Divider />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<SyncIcon className={busy ? 'spin' : ''} sx={{ fontSize: 15 }} />}
          onClick={() => void syncNow(false)}
          disabled={busy || !accounts.length}
          sx={{ borderRadius: 2, height: 28 }}
        >
          同步
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {unreadTotal ? `${unreadTotal} 封未读` : '全部已读'}
        </Typography>
        <Tooltip title="设置" disableInteractive>
          <IconButton size="small" onClick={openSettings} aria-label="设置">
            <SettingsIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Paper>
  )
}
