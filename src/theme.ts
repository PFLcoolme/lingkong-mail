import { alpha, createTheme, type Theme } from '@mui/material/styles'

const FONT_FAMILY =
  '"Inter", "Noto Sans SC", "Noto Sans CJK SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'

export type ThemeMode = 'light' | 'dark'

/** 玻璃面板：半透明背景 + 高斯模糊 + 细描边 */
export function glassSx(mode: ThemeMode) {
  return {
    background: mode === 'light' ? 'rgba(255,255,255,0.74)' : 'rgba(24,24,27,0.66)',
    backdropFilter: 'blur(22px) saturate(180%)',
    WebkitBackdropFilter: 'blur(22px) saturate(180%)',
    border: `1px solid ${mode === 'light' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.08)'}`,
    boxShadow:
      mode === 'light'
        ? '0 1px 2px rgba(16,18,22,0.04), 0 12px 32px rgba(16,18,22,0.08)'
        : '0 1px 2px rgba(0,0,0,0.4), 0 12px 32px rgba(0,0,0,0.45)'
  }
}

export function buildTheme(mode: ThemeMode): Theme {
  const light = mode === 'light'
  return createTheme({
    palette: {
      mode,
      primary: {
        main: light ? '#18181b' : '#f4f4f5',
        contrastText: light ? '#ffffff' : '#18181b'
      },
      secondary: { main: '#71717a' },
      success: { main: light ? '#16a34a' : '#4ade80' },
      warning: { main: light ? '#d97706' : '#fbbf24' },
      error: { main: light ? '#dc2626' : '#f87171' },
      info: { main: light ? '#52525b' : '#a1a1aa' },
      background: {
        default: light ? '#f2f2f4' : '#0c0c0e',
        paper: light ? '#ffffff' : '#18181b'
      },
      text: {
        primary: light ? '#18181b' : '#f4f4f5',
        secondary: light ? '#71717a' : '#a1a1aa'
      },
      divider: light ? 'rgba(9,9,11,0.08)' : 'rgba(255,255,255,0.10)',
      action: {
        hover: light ? alpha('#18181b', 0.05) : alpha('#ffffff', 0.07),
        selected: light ? alpha('#18181b', 0.09) : alpha('#ffffff', 0.12)
      }
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: FONT_FAMILY,
      fontSize: 13,
      htmlFontSize: 16,
      h1: { fontSize: 20, fontWeight: 600, letterSpacing: -0.2 },
      h2: { fontSize: 17, fontWeight: 600, letterSpacing: -0.1 },
      h3: { fontSize: 15, fontWeight: 600 },
      body1: { fontSize: 13.5 },
      body2: { fontSize: 12.5 },
      caption: { fontSize: 11.5 },
      button: { textTransform: 'none', fontWeight: 500, fontSize: 13 }
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            fontFamily: FONT_FAMILY,
            backgroundImage: light
              ? 'radial-gradient(1200px 600px at 12% -8%, rgba(255,255,255,0.9), transparent 60%), radial-gradient(900px 500px at 100% 0%, rgba(228,228,233,0.75), transparent 55%), radial-gradient(700px 700px at 80% 110%, rgba(244,244,245,0.9), transparent 60%)'
              : 'radial-gradient(1200px 600px at 12% -8%, rgba(39,39,42,0.9), transparent 60%), radial-gradient(900px 500px at 100% 0%, rgba(24,24,27,0.9), transparent 55%)',
            backgroundAttachment: 'fixed'
          }
        }
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            ...glassSx(mode)
          }
        }
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 10,
            paddingInline: 14,
            transition: 'all .16s ease',
            '&.MuiButton-containedPrimary': {
              background: light
                ? 'linear-gradient(180deg, #27272a 0%, #18181b 100%)'
                : 'linear-gradient(180deg, #fafafa 0%, #e4e4e7 100%)',
              '&:hover': {
                background: light
                  ? 'linear-gradient(180deg, #18181b 0%, #09090b 100%)'
                  : 'linear-gradient(180deg, #ffffff 0%, #f4f4f5 100%)'
              }
            }
          },
          outlined: {
            borderColor: light ? 'rgba(9,9,11,0.12)' : 'rgba(255,255,255,0.14)'
          }
        }
      },
      MuiIconButton: {
        styleOverrides: {
          root: { borderRadius: 10, transition: 'all .16s ease' }
        }
      },
      MuiTextField: {
        defaultProps: { variant: 'outlined', size: 'small' },
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 10,
              background: light ? 'rgba(255,255,255,0.55)' : 'rgba(39,39,42,0.5)',
              backdropFilter: 'blur(8px)',
              transition: 'all .16s ease',
              '& fieldset': {
                borderColor: light ? 'rgba(9,9,11,0.10)' : 'rgba(255,255,255,0.12)'
              },
              '&:hover fieldset': {
                borderColor: light ? 'rgba(9,9,11,0.22)' : 'rgba(255,255,255,0.24)'
              },
              '&.Mui-focused fieldset': {
                borderColor: light ? '#18181b' : '#fafafa',
                borderWidth: 1
              }
            }
          }
        }
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 18,
            ...glassSx(mode),
            background: light ? 'rgba(255,255,255,0.9)' : 'rgba(24,24,27,0.88)',
            backgroundImage: 'none'
          },
          backdrop: {
            backdropFilter: 'blur(6px)',
            backgroundColor: light ? 'rgba(244,244,245,0.55)' : 'rgba(9,9,11,0.55)'
          }
        }
      },
      MuiTooltip: {
        defaultProps: { arrow: true },
        styleOverrides: { tooltip: { borderRadius: 8, fontSize: 12 } }
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: 8, fontWeight: 500 } }
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            marginInline: 6,
            transition: 'all .16s ease'
          }
        }
      },
      MuiDivider: {
        styleOverrides: { root: { borderColor: light ? 'rgba(9,9,11,0.07)' : 'rgba(255,255,255,0.08)' } }
      },
      MuiSwitch: {
        styleOverrides: {
          track: { borderRadius: 12 },
          thumb: { boxShadow: 'none' }
        }
      },
      MuiMenu: {
        styleOverrides: {
          paper: { borderRadius: 12, ...glassSx(mode) }
        }
      }
    }
  })
}
