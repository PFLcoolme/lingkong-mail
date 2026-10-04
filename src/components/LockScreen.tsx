import { useState } from 'react'
import { Box, Button, Paper, TextField, Typography, alpha, useTheme } from '@mui/material'
import LockIcon from '@mui/icons-material/LockRounded'
import { api } from '@/lib/api'
import { useApp } from '@/store/app'

export default function LockScreen(): React.ReactNode {
  const theme = useTheme()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function unlock(): Promise<void> {
    if (!password) return
    setBusy(true)
    try {
      const ok = await api.securityVerify(password)
      if (ok) {
        useApp.setState({ locked: false })
        setPassword('')
        setError('')
      } else {
        setError('密码不正确')
        setPassword('')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(26px) saturate(180%)',
        WebkitBackdropFilter: 'blur(26px) saturate(180%)',
        bgcolor: alpha(theme.palette.background.default, 0.72)
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: 360,
          p: 3.5,
          borderRadius: 3.5,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(theme.palette.text.primary, 0.07)
            }}
          >
            <LockIcon sx={{ fontSize: 26 }} />
          </Box>
        </Box>
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 650 }}>空灵邮箱已锁定</Typography>
          <Typography variant="caption" color="text.secondary">
            输入启动密码后继续使用
          </Typography>
        </Box>
        <TextField
          fullWidth
          autoFocus
          type="password"
          placeholder="启动密码"
          value={password}
          error={Boolean(error)}
          helperText={error}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void unlock()
          }}
          slotProps={{ htmlInput: { 'aria-label': '启动密码' } }}
        />
        <Button variant="contained" onClick={() => void unlock()} disabled={busy} sx={{ height: 38 }}>
          {busy ? '验证中…' : '解锁'}
        </Button>
      </Paper>
    </Box>
  )
}
