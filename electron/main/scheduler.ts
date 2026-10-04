import { dueItems, removeOutboxItem, setOutboxStatus } from './services/outbox'
import { dueSnoozes, wakeMessage } from './services/snooze'
import { getAccount, getAccountRow, getSecrets } from './services/accounts'
import { getMessageSummary } from './services/messages'
import { appendToSent, buildRawMessage, sendMail } from './services/smtp'
import { showNewMailNotification } from './services/notify'
import { emit } from './services/sync'

/** 真正执行发送（供调度器与“立即发送”共用） */
export async function deliverOutboxItem(id: string): Promise<void> {
  const { getOutboxItem } = await import('./services/outbox')
  const item = getOutboxItem(id)
  if (!item) return
  setOutboxStatus(id, 'sending')
  const account = getAccount(item.accountId)
  const row = getAccountRow(item.accountId)
  if (!account || !row) {
    removeOutboxItem(id)
    return
  }
  const secrets = getSecrets(row)
  const messageId = await sendMail(account, secrets, item.payload)
  if (item.payload.saveToSent !== false) {
    await appendToSent(
      account,
      secrets,
      buildRawMessage(account, item.payload, messageId || `<${Date.now()}@kongling.local>`)
    )
  }
  removeOutboxItem(id)
  emit({ type: 'toast', payload: { level: 'success', message: '邮件已发送' } })
}

export async function processOutbox(): Promise<void> {
  for (const item of dueItems()) {
    try {
      await deliverOutboxItem(item.id)
    } catch (error) {
      setOutboxStatus(item.id, 'failed')
      emit({
        type: 'toast',
        payload: {
          level: 'error',
          message: `发送失败：${error instanceof Error ? error.message : String(error)}`
        }
      })
    }
  }
}

export async function processSnoozes(): Promise<void> {
  for (const item of dueSnoozes()) {
    wakeMessage(item.messageId)
    const summary = getMessageSummary(item.messageId)
    emit({ type: 'messages-changed', payload: { accountId: item.accountId, folderId: item.folderId } })
    if (summary) {
      showNewMailNotification(
        [{ title: summary.from[0]?.name || summary.from[0]?.address || '提醒', body: summary.subject }],
        '稍后提醒'
      )
    }
  }
}

export function startScheduler(): void {
  void processOutbox()
  setInterval(() => {
    void processOutbox()
    void processSnoozes()
  }, 3000)
}
