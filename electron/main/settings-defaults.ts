import type { AppSettings } from '@shared/types'

/** 应用默认设置（主进程侧），渲染层有一份等价的默认值 */
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  fontSize: 14,
  checkIntervalMinutes: 5,
  notifications: true,
  readPanePosition: 'right',
  confirmBeforeDelete: true,
  showSnippet: true,
  autoStartSync: true,
  markReadDelayMs: 800,
  language: 'zh-CN',
  transparentBackground: false,
  idleEnabled: true,
  threadView: true,
  translateEnabled: true,
  translateTarget: 'zh-CN',
  translateEndpoint: '',
  trayEnabled: true,
  alwaysLoadImages: false,
  sendDelaySeconds: 10,
  closeToTray: false,
  syncDraftsToServer: true,
  openAtLogin: false,
  listDensity: 'comfortable',
  listWidth: 404
}
