import { useEffect, useMemo, useState } from 'react'
import { Box, CssBaseline, ThemeProvider, alpha } from '@mui/material'
import MailPlusIcon from '@mui/icons-material/MailOutlineRounded'
import { useApp } from '@/store/app'
import { api } from '@/lib/api'
import { buildTheme, type ThemeMode } from '@/theme'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import MessageList from './components/MessageList'
import ReadingPane from './components/ReadingPane'
import Composer from './components/Composer'
import AddAccountWizard from './components/AddAccountWizard'
import SettingsDialog from './components/SettingsDialog'
import Toasts from './components/Toasts'
import { EmptyState } from './components/ui'

export default function App(): React.ReactNode {
  const ready = useApp((s) => s.ready)
  const accounts = useApp((s) => s.accounts)
  const bootstrap = useApp((s) => s.bootstrap)
  const wizardOpen = useApp((s) => s.wizardOpen)
  const settingsOpen = useApp((s) => s.settingsOpen)
  const composer = useApp((s) => s.composer)
  const openWizard = useApp((s) => s.openWizard)
  const settings = useApp((s) => s.settings)
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  )

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    if (ready && !accounts.length) openWizard()
  }, [ready, accounts.length, openWizard])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent): void => setSystemDark(e.matches)
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [])

  const mode: ThemeMode =
    settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme === 'dark' ? 'dark' : 'light'
  const theme = useMemo(() => buildTheme(mode), [mode])
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void api.windowIsMaximized().then(setMaximized)
    return api.onWindowState(setMaximized)
  }, [])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: settings.transparentBackground
            ? mode === 'light'
              ? alpha('#ffffff', 0.7)
              : alpha('#0c0c0e', 0.7)
            : mode === 'light'
              ? '#f4f4f5'
              : '#0c0c0e',
          borderRadius: maximized ? 0 : 4,
          overflow: 'hidden',
          border: maximized ? 'none' : `1px solid ${alpha(mode === 'light' ? '#09090b' : '#ffffff', 0.08)}`,
          boxShadow: maximized ? 'none' : '0 18px 60px rgba(9,9,11,0.22)'
        }}
      >
        <TitleBar />
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <Sidebar />
          {accounts.length ? (
            <>
              <MessageList />
              <ReadingPane />
            </>
          ) : (
            <Box sx={{ flex: 1, display: 'flex' }}>
              <EmptyState
                icon={<MailPlusIcon sx={{ fontSize: 34, color: 'text.disabled' }} />}
                title="还没有添加邮箱"
                description="添加第一个邮箱账户后即可收取、撰写和管理邮件"
                action={
                  <Box
                    onClick={openWizard}
                    sx={{
                      mt: 1,
                      px: 2,
                      py: 0.75,
                      borderRadius: 2.5,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 500,
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText'
                    }}
                  >
                    添加邮箱账户
                  </Box>
                }
              />
            </Box>
          )}
        </Box>
      </Box>

      {composer ? <Composer /> : null}
      {wizardOpen ? <AddAccountWizard /> : null}
      {settingsOpen ? <SettingsDialog /> : null}
      <Toasts />
    </ThemeProvider>
  )
}
