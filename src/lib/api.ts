import type { AppApi, PickedFile, TestResult } from '@shared/api'
import type {
  AttachmentRecord,
  Contact,
  MainEvent,
  MessageSummary,
  StatsOverview,
  Template
} from '@shared/types'

type ExtraApi = {
  contactsSearch: (query: string, accountId?: string) => Promise<Contact[]>
  messageSummary: (id: string) => Promise<MessageSummary | null>
  messagesCount: (folderId: string) => Promise<number>
  messageExport: (id: string) => Promise<string | null>
  attachmentsAll: (limit?: number) => Promise<AttachmentRecord[]>
  statsOverview: () => Promise<StatsOverview>
  messagesExport: (ids: string[]) => Promise<{ dir: string; count: number } | null>
  messagePrint: (id: string) => Promise<boolean>
  templatesList: () => Promise<Template[]>
  templateSave: (template: Partial<Template>) => Promise<Template>
  templateDelete: (id: string) => Promise<void>
  translateText: (input: { text: string; target: string; source?: string; endpoint?: string }) => Promise<string>
  folderRefreshStats: (folderId: string) => Promise<boolean>
  messagesLocalDelete: (ids: string[]) => Promise<void>
  appToast: (level: 'info' | 'success' | 'error', message: string) => Promise<void>
  windowIsMaximized: () => Promise<boolean>
  windowSetTransparent: (enabled: boolean) => Promise<boolean>
  onWindowState: (listener: (maximized: boolean) => void) => () => void
}

export type Api = AppApi & ExtraApi

export const api: Api = (window as unknown as { api: Api }).api

export function onMainEvent(listener: (event: MainEvent) => void): () => void {
  return api.onEvent(listener)
}

export async function safe<T>(task: Promise<T>, fallback: T): Promise<T> {
  try {
    return await task
  } catch {
    return fallback
  }
}

export type { PickedFile, TestResult }
