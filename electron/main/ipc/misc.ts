import { app, shell } from 'electron'
import { getMainWindow } from '../window'
import type { AppSettings, Contact, Rule } from '@shared/types'
import { handle } from './common'
import { deleteContact, listContacts, saveContact, searchContacts } from '../services/contacts'
import { deleteRule, listRules, saveRule } from '../services/rules'
import { settingsGet, settingsSet } from '../services/accounts'
import { authorizeWithBrowser, OAUTH_PROVIDERS } from '../services/oauth'
import { emit } from '../services/sync'

import { DEFAULT_SETTINGS } from '../settings-defaults'

export { DEFAULT_SETTINGS }

export function registerMiscHandlers(): void {
  handle('contacts:list', async (_event, accountId?: string) => listContacts(accountId))

  handle('contacts:search', async (_event, query: string, accountId?: string) => searchContacts(query, accountId))

  handle('contact:save', async (_event, contact: Partial<Contact>) => {
    saveContact(contact)
    return true
  })

  handle('contact:delete', async (_event, id: string) => {
    deleteContact(id)
    return true
  })

  handle('rules:list', async (_event, accountId?: string) => listRules(accountId))

  handle('rule:save', async (_event, rule: Partial<Rule>) => saveRule(rule))

  handle('rule:delete', async (_event, id: string) => {
    deleteRule(id)
    return true
  })

  handle('settings:get', () => ({ ...DEFAULT_SETTINGS, ...settingsGet<Partial<AppSettings>>('app', {}) }))

  handle('settings:set', async (_event, patch: Partial<AppSettings>) => {
    const current = { ...DEFAULT_SETTINGS, ...settingsGet<Partial<AppSettings>>('app', {}) }
    const next = { ...current, ...patch }
    settingsSet('app', next)
    return next
  })

  handle('oauth:providers', () => OAUTH_PROVIDERS)

  handle(
    'oauth:authorize',
    async (_event, input: { provider: string; clientId: string; clientSecret: string; tenant: string; email: string }) =>
      authorizeWithBrowser(input)
  )

  handle('app:version', () => app.getVersion())

  handle('app:open-path', async (_event, path: string) => {
    await shell.openPath(path)
    return true
  })

  handle('window:action', async (_event, action: 'minimize' | 'maximize' | 'close') => {
    const window = getMainWindow()
    if (!window) return true
    if (action === 'minimize') window.minimize()
    else if (action === 'maximize') {
      if (window.isMaximized()) window.unmaximize()
      else window.maximize()
    } else window.close()
    return true
  })

  handle('window:is-maximized', () => {
    const window = getMainWindow()
    return window ? window.isMaximized() : false
  })

  /** 关闭透明背景（个别 Linux 合成器下毛玻璃窗口会发黑时使用） */
  handle('window:set-transparent', async (_event, enabled: boolean) => {
    const window = getMainWindow()
    if (!window) return false
    window.setBackgroundColor(enabled ? '#00000000' : '#f4f4f5')
    return true
  })

  handle('app:toast', async (_event, level: 'info' | 'success' | 'error', message: string) => {
    emit({ type: 'toast', payload: { level, message } })
    return true
  })

}
