import type { Template } from '@shared/types'
import { generateId, getDb, now } from './db'

interface TemplateRow {
  id: string
  name: string
  subject: string
  body: string
  created_at: number
}

function rowToTemplate(row: TemplateRow): Template {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    body: row.body,
    createdAt: row.created_at
  }
}

export function listTemplates(): Template[] {
  return (getDb().prepare('SELECT * FROM templates ORDER BY created_at DESC').all() as TemplateRow[]).map(
    rowToTemplate
  )
}

export function saveTemplate(template: Partial<Template>): Template {
  const db = getDb()
  const id = template.id || generateId('tpl')
  const params = {
    id,
    name: template.name ?? '新模板',
    subject: template.subject ?? '',
    body: template.body ?? '',
    created_at: now()
  }
  const exists = db.prepare('SELECT id FROM templates WHERE id = ?').get(id)
  if (exists) {
    db.prepare('UPDATE templates SET name=@name, subject=@subject, body=@body WHERE id=@id').run(params)
  } else {
    db.prepare(
      'INSERT INTO templates (id, name, subject, body, created_at) VALUES (@id, @name, @subject, @body, @created_at)'
    ).run(params)
  }
  return rowToTemplate(db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as TemplateRow)
}

export function deleteTemplate(id: string): void {
  getDb().prepare('DELETE FROM templates WHERE id = ?').run(id)
}
