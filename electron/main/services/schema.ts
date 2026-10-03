export const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  protocol TEXT NOT NULL DEFAULT 'imap',
  auth_type TEXT NOT NULL DEFAULT 'password',
  in_host TEXT NOT NULL DEFAULT '',
  in_port INTEGER NOT NULL DEFAULT 993,
  in_security TEXT NOT NULL DEFAULT 'ssl',
  in_username TEXT NOT NULL DEFAULT '',
  out_host TEXT NOT NULL DEFAULT '',
  out_port INTEGER NOT NULL DEFAULT 465,
  out_security TEXT NOT NULL DEFAULT 'ssl',
  out_username TEXT NOT NULL DEFAULT '',
  ews_url TEXT NOT NULL DEFAULT '',
  oauth_provider TEXT NOT NULL DEFAULT '',
  oauth_client_id TEXT NOT NULL DEFAULT '',
  oauth_client_secret TEXT NOT NULL DEFAULT '',
  oauth_tenant TEXT NOT NULL DEFAULT '',
  password_enc TEXT,
  refresh_token_enc TEXT,
  access_token_enc TEXT,
  token_expires INTEGER NOT NULL DEFAULT 0,
  keep_on_server INTEGER NOT NULL DEFAULT 1,
  sync_days INTEGER NOT NULL DEFAULT 30,
  signature TEXT NOT NULL DEFAULT '',
  signature_html TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#5b8def',
  enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'idle',
  last_error TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  delimiter TEXT NOT NULL DEFAULT '/',
  type TEXT NOT NULL DEFAULT 'other',
  unread INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  uid_validity INTEGER NOT NULL DEFAULT 0,
  last_uid INTEGER NOT NULL DEFAULT 0,
  synced_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_folders_account ON folders(account_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  uid INTEGER NOT NULL DEFAULT 0,
  message_id TEXT NOT NULL DEFAULT '',
  in_reply_to TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  from_json TEXT NOT NULL DEFAULT '[]',
  to_json TEXT NOT NULL DEFAULT '[]',
  cc_json TEXT NOT NULL DEFAULT '[]',
  bcc_json TEXT NOT NULL DEFAULT '[]',
  date INTEGER NOT NULL DEFAULT 0,
  size INTEGER NOT NULL DEFAULT 0,
  seen INTEGER NOT NULL DEFAULT 0,
  flagged INTEGER NOT NULL DEFAULT 0,
  answered INTEGER NOT NULL DEFAULT 0,
  draft INTEGER NOT NULL DEFAULT 0,
  attachment_count INTEGER NOT NULL DEFAULT 0,
  snippet TEXT NOT NULL DEFAULT '',
  body_text TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  search_text TEXT NOT NULL DEFAULT '',
  headers_json TEXT NOT NULL DEFAULT '{}',
  fetched INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_messages_folder ON messages(folder_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_messages_account ON messages(account_id);
CREATE INDEX IF NOT EXISTS idx_messages_msgid ON messages(message_id);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  filename TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  path TEXT NOT NULL DEFAULT '',
  content_id TEXT NOT NULL DEFAULT '',
  inline INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  frequency INTEGER NOT NULL DEFAULT 1,
  last_used_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_contacts_account ON contacts(account_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_unique ON contacts(account_id, email);

CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  match_all INTEGER NOT NULL DEFAULT 1,
  conditions_json TEXT NOT NULL DEFAULT '[]',
  actions_json TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_rules_account ON rules(account_id);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL DEFAULT '',
  to_text TEXT NOT NULL DEFAULT '',
  cc_text TEXT NOT NULL DEFAULT '',
  bcc_text TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body_text TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  in_reply_to TEXT NOT NULL DEFAULT '',
  "references" TEXT NOT NULL DEFAULT '',
  reply_folder_id TEXT NOT NULL DEFAULT '',
  reply_uid INTEGER NOT NULL DEFAULT 0,
  attachments_json TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_drafts_account ON drafts(account_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  send_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_outbox_send_at ON outbox(send_at);

CREATE TABLE IF NOT EXISTS snoozed (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  wake_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snoozed_wake ON snoozed(wake_at);

CREATE TABLE IF NOT EXISTS saved_searches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_templates_created ON templates(created_at);

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  subject, body, participants,
  content='messages',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, subject, body, participants)
  VALUES (new.rowid, new.subject, new.search_text,
          new.from_json || ' ' || new.to_json || ' ' || new.cc_json);
END;

CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, subject, body, participants)
  VALUES ('delete', old.rowid, old.subject, old.search_text,
          old.from_json || ' ' || old.to_json || ' ' || old.cc_json);
END;

CREATE TRIGGER IF NOT EXISTS messages_fts_update AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, subject, body, participants)
  VALUES ('delete', old.rowid, old.subject, old.search_text,
          old.from_json || ' ' || old.to_json || ' ' || old.cc_json);
  INSERT INTO messages_fts(rowid, subject, body, participants)
  VALUES (new.rowid, new.subject, new.search_text,
          new.from_json || ' ' || new.to_json || ' ' || new.cc_json);
END;
`
