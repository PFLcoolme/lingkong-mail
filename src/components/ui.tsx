import CloseIcon from '@mui/icons-material/Close'
import {
  Avatar as MuiAvatar,
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch as MuiSwitch,
  Typography
} from '@mui/material'
import type { ReactNode } from 'react'
import { colorFromString, initials } from '@/lib/format'

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 680,
  fullHeight = false
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
  fullHeight?: boolean
}): ReactNode {
  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth={false}
      sx={{
        '& .MuiDialog-paper': {
          width,
          maxWidth: '94vw',
          borderRadius: 3,
          ...(fullHeight ? { height: '86vh' } : {})
        }
      }}
      aria-label={title}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 2,
          pb: 1.5,
          '&.MuiDialogTitle-root': { fontSize: 16, fontWeight: 600 }
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 600 }}>{title}</Typography>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="关闭" sx={{ mt: -0.5 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ py: 2.5 }}>
        {children}
      </DialogContent>
      {footer ? <DialogActions sx={{ px: 2.5, py: 1.75, gap: 1 }}>{footer}</DialogActions> : null}
    </Dialog>
  )
}

export function Avatar({ name, color, size = 28 }: { name: string; color?: string; size?: number }): ReactNode {
  return (
    <MuiAvatar
      sx={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        fontWeight: 600,
        bgcolor: color ?? colorFromString(name),
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
      }}
    >
      {initials(name)}
    </MuiAvatar>
  )
}

export function Field({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: ReactNode
}): ReactNode {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
        {label}
      </Typography>
      {children}
      {hint ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, opacity: 0.85 }}>
          {hint}
        </Typography>
      ) : null}
    </Box>
  )
}

export function Switch({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}): ReactNode {
  return (
    <FormControlLabel
      control={<MuiSwitch checked={checked} onChange={(e) => onChange(e.target.checked)} />}
      label={<Typography sx={{ fontSize: 13 }}>{label}</Typography>}
      sx={{ ml: 0 }}
    />
  )
}

export function Spinner({ size = 16 }: { size?: number }): ReactNode {
  return <CircularProgress size={size} thickness={4} sx={{ color: 'text.secondary' }} />
}

export function EmptyState({
  icon,
  title,
  description,
  action
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}): ReactNode {
  return (
    <Stack sx={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1.5, p: 6, textAlign: 'center' }}>
      {icon}
      <Box>
        <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
        {description ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, maxWidth: 320 }}>
            {description}
          </Typography>
        ) : null}
      </Box>
      {action}
    </Stack>
  )
}

export function SectionTitle({ children }: { children: ReactNode }): ReactNode {
  return (
    <Typography
      variant="caption"
      sx={{ display: 'block', mb: 1, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}
      color="text.secondary"
    >
      {children}
    </Typography>
  )
}
