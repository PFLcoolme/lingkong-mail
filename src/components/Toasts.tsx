import { Alert, Box, IconButton, Slide, alpha } from '@mui/material'
import CloseIcon from '@mui/icons-material/CloseRounded'
import { useApp } from '@/store/app'

export default function Toasts(): React.ReactNode {
  const toasts = useApp((s) => s.toasts)
  const dismiss = useApp((s) => s.dismissToast)
  if (!toasts.length) return null
  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 1600,
        display: 'flex',
        flexDirection: 'column',
        gap: 1
      }}
    >
      {toasts.map((toast) => (
        <Slide key={toast.id} direction="up" in mountOnEnter unmountOnExit>
          <Alert
            severity={toast.level === 'error' ? 'error' : toast.level === 'success' ? 'success' : 'info'}
            variant="outlined"
            action={
              <IconButton size="small" onClick={() => dismiss(toast.id)} aria-label="关闭提示">
                <CloseIcon sx={{ fontSize: 15 }} />
              </IconButton>
            }
            sx={{
              borderRadius: 2.5,
              minWidth: 240,
              maxWidth: 360,
              backdropFilter: 'blur(18px) saturate(180%)',
              WebkitBackdropFilter: 'blur(18px) saturate(180%)',
              bgcolor: (theme) => alpha(theme.palette.background.paper, 0.86),
              boxShadow: '0 8px 28px rgba(16,18,22,0.14)'
            }}
          >
            {toast.message}
          </Alert>
        </Slide>
      ))}
    </Box>
  )
}
