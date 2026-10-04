import { useApp } from '@/store/app'

export type Lang = 'zh-CN' | 'en'

type Entry = { 'zh-CN': string; en: string }

const DICT: Record<string, Entry> = {
  'app.name': { 'zh-CN': '空灵邮箱', en: 'Kongling Mail' },

  'compose.write': { 'zh-CN': '写邮件', en: 'Compose' },
  'compose.reply': { 'zh-CN': '回复', en: 'Reply' },
  'compose.replyAll': { 'zh-CN': '全部回复', en: 'Reply all' },
  'compose.forward': { 'zh-CN': '转发', en: 'Forward' },
  'compose.send': { 'zh-CN': '发送', en: 'Send' },
  'compose.sending': { 'zh-CN': '发送中…', en: 'Sending…' },
  'compose.saveDraft': { 'zh-CN': '存草稿', en: 'Save draft' },
  'compose.from': { 'zh-CN': '发件账户', en: 'From account' },
  'compose.to': { 'zh-CN': '收件人', en: 'To' },
  'compose.cc': { 'zh-CN': '抄送', en: 'Cc' },
  'compose.bcc': { 'zh-CN': '密送', en: 'Bcc' },
  'compose.subject': { 'zh-CN': '主题', en: 'Subject' },
  'compose.body': { 'zh-CN': '正文', en: 'Body' },
  'compose.addAttachment': { 'zh-CN': '添加附件', en: 'Add attachment' },
  'compose.showCc': { 'zh-CN': '+ 抄送 / 密送', en: '+ Cc / Bcc' },
  'compose.template': { 'zh-CN': '插入模板', en: 'Insert template' },
  'compose.hint': { 'zh-CN': 'Ctrl + Enter 快速发送', en: 'Ctrl + Enter to send' },

  'sidebar.accounts': { 'zh-CN': '账户', en: 'Accounts' },
  'sidebar.otherFolders': { 'zh-CN': '其他文件夹', en: 'Other folders' },
  'sidebar.drafts': { 'zh-CN': '本地草稿', en: 'Local drafts' },
  'sidebar.sync': { 'zh-CN': '同步', en: 'Sync' },
  'sidebar.unread': { 'zh-CN': '{n} 封未读', en: '{n} unread' },
  'sidebar.allRead': { 'zh-CN': '全部已读', en: 'All read' },
  'sidebar.addAccount': { 'zh-CN': '+ 添加邮箱账户', en: '+ Add account' },

  'list.filter': { 'zh-CN': '在当前文件夹中过滤', en: 'Filter in this folder' },
  'list.unreadOnly': { 'zh-CN': '仅未读', en: 'Unread only' },
  'list.attachmentsOnly': { 'zh-CN': '仅含附件', en: 'With attachments' },
  'list.backToFolder': { 'zh-CN': '返回文件夹', en: 'Back to folder' },
  'list.selected': { 'zh-CN': '已选 {n}', en: '{n} selected' },
  'list.moveTo': { 'zh-CN': '移动到…', en: 'Move to…' },
  'list.count': { 'zh-CN': '共 {n} 封邮件', en: '{n} messages' },
  'list.empty': { 'zh-CN': '这里还没有邮件', en: 'No messages here' },
  'list.emptyHint': { 'zh-CN': '点击左下角“同步”从服务器收取邮件', en: 'Click "Sync" to fetch mail from server' },
  'list.noMatch': { 'zh-CN': '没有匹配的邮件', en: 'No matching messages' },
  'list.export': { 'zh-CN': '导出', en: 'Export' },
  'list.print': { 'zh-CN': '打印', en: 'Print' },
  'list.threadCount': { 'zh-CN': '{n} 封', en: '{n}' },

  'read.markUnread': { 'zh-CN': '标为未读', en: 'Mark unread' },
  'read.markRead': { 'zh-CN': '标记为已读', en: 'Mark read' },
  'read.translate': { 'zh-CN': '翻译', en: 'Translate' },
  'read.translating': { 'zh-CN': '翻译中…', en: 'Translating…' },
  'read.translated': { 'zh-CN': '译文', en: 'Translation' },
  'read.original': { 'zh-CN': '原文', en: 'Original' },
  'read.remoteImages': { 'zh-CN': '为保护隐私，已阻止加载邮件中的远程图片', en: 'Remote images blocked for privacy' },
  'read.showImages': { 'zh-CN': '显示图片', en: 'Show images' },
  'read.attachments': { 'zh-CN': '附件（{n}）', en: 'Attachments ({n})' },
  'read.open': { 'zh-CN': '打开', en: 'Open' },
  'read.saveAs': { 'zh-CN': '另存为', en: 'Save as' },
  'read.preview': { 'zh-CN': '预览', en: 'Preview' },
  'read.noPreview': { 'zh-CN': '该类型不支持应用内预览，请点“打开”用系统程序查看', en: 'Preview unsupported, use "Open"' },
  'read.exportEml': { 'zh-CN': '导出为 .eml 文件', en: 'Export as .eml' },
  'read.print': { 'zh-CN': '打印邮件', en: 'Print message' },
  'read.empty': { 'zh-CN': '选择一封邮件开始阅读', en: 'Select a message to read' },
  'read.emptyHint': {
    'zh-CN': '在左侧列表中点击邮件即可查看正文、下载附件或进行回复',
    en: 'Click a message to read it, download attachments or reply'
  },
  'read.sentTo': { 'zh-CN': '发送至', en: 'To' },

  'search.placeholder': { 'zh-CN': '搜索全部邮件（主题 / 正文 / 发件人）', en: 'Search all mail (subject / body / sender)' },
  'search.searching': { 'zh-CN': '搜索中…', en: 'Searching…' },

  'settings.title': { 'zh-CN': '设置', en: 'Settings' },
  'settings.accounts': { 'zh-CN': '账户', en: 'Accounts' },
  'settings.general': { 'zh-CN': '常规', en: 'General' },
  'settings.signature': { 'zh-CN': '签名', en: 'Signature' },
  'settings.rules': { 'zh-CN': '规则', en: 'Rules' },
  'settings.contacts': { 'zh-CN': '联系人', en: 'Contacts' },
  'settings.templates': { 'zh-CN': '模板', en: 'Templates' },
  'settings.about': { 'zh-CN': '关于', en: 'About' },
  'settings.attachments': { 'zh-CN': '附件', en: 'Attachments' },
  'settings.stats': { 'zh-CN': '统计', en: 'Statistics' },
  'settings.labels': { 'zh-CN': '标签', en: 'Labels' },
  'settings.addAccount': { 'zh-CN': '添加账户', en: 'Add account' },
  'settings.edit': { 'zh-CN': '编辑', en: 'Edit' },
  'settings.save': { 'zh-CN': '保存', en: 'Save' },
  'settings.close': { 'zh-CN': '关闭', en: 'Close' },

  'wizard.title': { 'zh-CN': '添加邮箱账户', en: 'Add mail account' },
  'wizard.stepEmail': { 'zh-CN': '邮箱地址', en: 'Email' },
  'wizard.stepServer': { 'zh-CN': '服务器配置', en: 'Server' },
  'wizard.stepLogin': { 'zh-CN': '登录方式', en: 'Sign-in' },
  'wizard.detect': { 'zh-CN': '自动检测并继续', en: 'Detect and continue' },
  'wizard.next': { 'zh-CN': '下一步', en: 'Next' },
  'wizard.prev': { 'zh-CN': '上一步', en: 'Previous' },
  'wizard.test': { 'zh-CN': '测试连接', en: 'Test connection' },
  'wizard.finish': { 'zh-CN': '完成添加', en: 'Finish' },

  'toast.synced': { 'zh-CN': '同步完成', en: 'Sync complete' },
  'toast.sent': { 'zh-CN': '邮件已发送', en: 'Message sent' },
  'toast.draftSaved': { 'zh-CN': '草稿已保存', en: 'Draft saved' },
  'toast.moved': { 'zh-CN': '已移动邮件', en: 'Messages moved' },
  'toast.deleted': { 'zh-CN': '已删除邮件', en: 'Messages deleted' },
  'toast.accountAdded': { 'zh-CN': '账户已添加，正在首次同步', en: 'Account added, syncing…' },
  'toast.accountDeleted': { 'zh-CN': '账户已删除', en: 'Account deleted' },
  'toast.accountUpdated': { 'zh-CN': '账户已更新', en: 'Account updated' },
  'toast.signatureSaved': { 'zh-CN': '签名已保存', en: 'Signature saved' },
  'toast.ruleSaved': { 'zh-CN': '规则已保存', en: 'Rule saved' },
  'toast.exported': { 'zh-CN': '已导出 {n} 封邮件', en: 'Exported {n} messages' },
  'empty.noAccount': { 'zh-CN': '还没有添加邮箱', en: 'No account yet' },
  'empty.noAccountHint': {
    'zh-CN': '添加第一个邮箱账户后即可收取、撰写和管理邮件',
    en: 'Add your first account to send and receive mail'
  },
  'empty.addAccount': { 'zh-CN': '添加邮箱账户', en: 'Add mail account' },

  'settings.translate': { 'zh-CN': '邮件翻译', en: 'Translation' },
  'settings.translateEnable': { 'zh-CN': '在邮件工具栏显示“翻译”按钮', en: 'Show "Translate" in the toolbar' },
  'settings.translateTarget': { 'zh-CN': '目标语言', en: 'Target language' },
  'settings.translateEndpoint': { 'zh-CN': '自定义翻译接口（留空使用内置免费接口）', en: 'Custom endpoint (blank = built-in)' },
  'settings.threadView': { 'zh-CN': '会话视图：同一主题的邮件折叠显示', en: 'Thread view: group messages by subject' },
  'template.new': { 'zh-CN': '新建模板', en: 'New template' },
  'template.edit': { 'zh-CN': '编辑模板', en: 'Edit template' },
  'template.name': { 'zh-CN': '模板名称', en: 'Template name' },
  'template.subject': { 'zh-CN': '邮件主题', en: 'Subject' },
  'template.body': { 'zh-CN': '正文内容', en: 'Body' },
  'template.empty': {
    'zh-CN': '还没有模板。创建后可在撰写邮件时一键插入主题与正文。',
    en: 'No templates yet. Create one to insert subject and body when composing.'
  },
  'template.saved': { 'zh-CN': '模板已保存', en: 'Template saved' },

  'editor.bold': { 'zh-CN': '加粗', en: 'Bold' },
  'editor.italic': { 'zh-CN': '斜体', en: 'Italic' },
  'editor.underline': { 'zh-CN': '下划线', en: 'Underline' },
  'editor.list': { 'zh-CN': '项目符号', en: 'Bullet list' },
  'editor.link': { 'zh-CN': '插入链接', en: 'Insert link' },
  'editor.clear': { 'zh-CN': '清除格式', en: 'Clear formatting' },
  'editor.linkPrompt': { 'zh-CN': '输入链接地址', en: 'Enter link URL' },
  'editor.dropHint': { 'zh-CN': '可直接把文件拖进来添加附件', en: 'Drop files here to attach' },

  'read.alwaysAllowSender': { 'zh-CN': '始终允许该发件人', en: 'Always allow sender' },
  'settings.alwaysLoadImages': { 'zh-CN': '总是加载邮件中的远程图片（关闭隐私防护）', en: 'Always load remote images (privacy off)' },
  'toast.translateUnavailable': { 'zh-CN': '翻译服务暂时不可用', en: 'Translation service unavailable' }
}

function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`))
}

/** 全局翻译函数（从设置中读取当前语言） */
export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const language = useApp((s) => s.settings.language)
  const lang: Lang = language.startsWith('en') ? 'en' : 'zh-CN'
  return (key: string, vars?: Record<string, string | number>) => {
    const entry = DICT[key]
    if (!entry) return key
    return format(entry[lang], vars)
  }
}

export function translateStatic(key: string, lang: Lang = 'zh-CN', vars?: Record<string, string | number>): string {
  const entry = DICT[key]
  if (!entry) return key
  return format(entry[lang], vars)
}
