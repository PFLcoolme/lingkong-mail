import type { SavedSearch } from '@shared/types'
import { generateId, getDb, now } from './db'

interface Row {
  id: string
  name: string
  query: string
  created_at: number
}

export function listSavedSearches(): SavedSearch[] {
  return (getDb().prepare('SELECT * FROM saved_searches ORDER BY created_at ASC').all() as Row[]).map((r) => ({
    id: r.id,
    name: r.name,
    query: r.query,
    createdAt: r.created_at
  }))
}

export function saveSavedSearch(search: Partial<SavedSearch>): SavedSearch {
  const db = getDb()
  const id = search.id || generateId('sch')
  if (db.prepare('SELECT id FROM saved_searches WHERE id = ?').get(id)) {
    db.prepare('UPDATE saved_searches SET name = ?, query = ? WHERE id = ?').run(
      search.name ?? '',
      search.query ?? '',
      id
    )
  } else {
    db.prepare('INSERT INTO saved_searches (id, name, query, created_at) VALUES (?, ?, ?, ?)').run(
      id,
      search.name ?? '新搜索',
      search.query ?? '',
      now()
    )
  }
  const row = db.prepare('SELECT * FROM saved_searches WHERE id = ?').get(id) as Row
  return { id: row.id, name: row.name, query: row.query, createdAt: row.created_at }
}

export function deleteSavedSearch(id: string): void {
  getDb().prepare('DELETE FROM saved_searches WHERE id = ?').run(id)
}
