import { useEffect, useRef, useState } from 'react'
import {
  Box,
  IconButton,
  InputBase,
  Paper,
  Tooltip,
  Typography,
  alpha,
  useTheme
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import MinimizeRoundedIcon from '@mui/icons-material/MinimizeRounded'
import CropSquareRoundedIcon from '@mui/icons-material/CropSquareRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded'
import { api } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { useApp } from '@/store/app'

export default function TitleBar(): React.ReactNode {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const searchTerm = useApp((s) => s.searchTerm)
  const runSearch = useApp((s) => s.runSearch)
  const clearSearch = useApp((s) => s.clearSearch)
  const searching = useApp((s) => s.searching)
  const openSettings = useApp((s) => s.openSettings)
  const t = useT()
  const [term, setTerm] = useState('')
  const [maximized, setMaximized] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    void api.windowIsMaximized().then(setMaximized)
    return api.onWindowState(setMaximized)
  }, [])

  useEffect(() => {
    if (term === searchTerm) return
    window.clearTimeout(timer.current)
    if (!term) {
      clearSearch()
      return
    }
    timer.current = window.setTimeout(() => void runSearch(term), 350)
    return () => window.clearTimeout(timer.current)
  }, [term, runSearch, clearSearch, searchTerm])

  const controlButton = (onClick: () => void, label: string, icon: React.ReactNode, danger = false) => (
    <Tooltip title={label} disableInteractive>
      <IconButton
        size="small"
        className="app-nodrag"
        onClick={onClick}
        aria-label={label}
        sx={{
          borderRadius: 1.5,
          width: 32,
          height: 28,
          color: 'text.secondary',
          '&:hover': {
            bgcolor: danger ? alpha(theme.palette.error.main, 0.12) : alpha(theme.palette.text.primary, 0.08),
            color: danger ? 'error.main' : 'text.primary'
          }
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  )

  return (
    <Paper
      elevation={0}
      className="app-drag"
      sx={{
        height: 46,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 1.5,
        borderRadius: 0,
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        boxShadow: 'none',
        borderBottom: `1px solid ${theme.palette.divider}`,
        bgcolor: isDark ? 'rgba(24,24,27,0.66)' : 'rgba(255,255,255,0.62)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 168 }}>
        <MailOutlineRoundedIcon sx={{ fontSize: 19, color: 'text.primary' }} />
        <Typography
          onDoubleClick={() => void api.windowAction('maximize')}
          sx={{ fontWeight: 650, letterSpacing: -0.2 }}
        >
          {t('app.name')}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }} className="app-nodrag">
        <Box
          sx={{
            width: '100%',
            maxWidth: 460,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            height: 30,
            borderRadius: 2.5,
            bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(9,9,11,0.04)',
            border: `1px solid ${theme.palette.divider}`,
            transition: 'all .16s ease',
            '&:focus-within': {
              bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)',
              borderColor: alpha(theme.palette.text.primary, 0.28)
            }
          }}
        >
          <SearchIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
          <InputBase
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t('search.placeholder')}
            sx={{ flex: 1, fontSize: 13 }}
            inputProps={{ 'aria-label': '搜索邮件' }}
          />
          {searching ? (
            <Typography variant="caption" color="text.secondary">
              {t('search.searching')}
            </Typography>
          ) : null}
          {term ? (
            <IconButton size="small" onClick={() => setTerm('')} aria-label="清除搜索" sx={{ p: 0.25 }}>
              <ClearIcon sx={{ fontSize: 15 }} />
            </IconButton>
          ) : null}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 168, justifyContent: 'flex-end' }}>
        {controlButton(openSettings, t('settings.title'), <SettingsOutlinedIcon sx={{ fontSize: 17 }} />)}
        <Box sx={{ width: 1, height: 18, bgcolor: theme.palette.divider, mx: 0.5 }} />
        {controlButton(() => void api.windowAction('minimize'), '最小化', <MinimizeRoundedIcon sx={{ fontSize: 16 }} />)}
        {controlButton(
          () => void api.windowAction('maximize'),
          maximized ? '还原' : '最大化',
          <CropSquareRoundedIcon sx={{ fontSize: 15 }} />
        )}
        {controlButton(() => void api.windowAction('close'), '关闭', <CloseRoundedIcon sx={{ fontSize: 17 }} />, true)}
      </Box>
    </Paper>
  )
}
