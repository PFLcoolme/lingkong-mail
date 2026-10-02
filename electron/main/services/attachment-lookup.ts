import { getDb } from './db'

export function getAttPath(attachmentId: string): string | null {
  const row = getDb().prepare('SELECT path FROM attachments WHERE id = ?').get(attachmentId) as
    | { path: string }
    | undefined
  return row?.path ?? null
}
