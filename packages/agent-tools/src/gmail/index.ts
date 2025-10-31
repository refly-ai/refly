import { ToolsetDefinition } from '@refly/openapi-schema';

export const GmailToolsetDefinition: ToolsetDefinition = {
  key: 'gmail',
  // TODO: use docs to get the icon, need to change to https://mail.google.com later
  domain: 'https://docs.google.com',
  labelDict: {
    en: 'Gmail',
    'zh-CN': 'Gmail',
  },
  descriptionDict: {
    en: 'Access Gmail via Composio to list, read, forward, draft, delete, and label messages while also managing contacts, profiles, and mailbox history.',
    'zh-CN':
      '通过 Composio 访问 Gmail，支持列出、读取、转发、草拟、删除和标记邮件，并管理联系人、资料和邮箱历史记录。',
  },
  tools: [
    {
      name: 'add_label_to_email',
      descriptionDict: {
        en: 'Add or remove Gmail labels from a specific message.',
        'zh-CN': '为指定邮件添加或移除 Gmail 标签。',
      },
    },
    {
      name: 'batch_delete_messages',
      descriptionDict: {
        en: 'Permanently delete multiple Gmail messages in one request.',
        'zh-CN': '一次性永久删除多封 Gmail 邮件。',
      },
    },
    {
      name: 'batch_modify_messages',
      descriptionDict: {
        en: 'Bulk add or remove labels across up to 1,000 messages.',
        'zh-CN': '批量为最多 1000 封邮件添加或移除标签。',
      },
    },
    {
      name: 'create_email_draft',
      descriptionDict: {
        en: 'Create a Gmail draft message ready to send later.',
        'zh-CN': '创建一封待后续发送的 Gmail 草稿邮件。',
      },
    },
    {
      name: 'create_label',
      descriptionDict: {
        en: 'Create a new Gmail label with optional visibility and colors.',
        'zh-CN': '创建新的 Gmail 标签，可设置可见性与颜色。',
      },
    },
    {
      name: 'delete_draft',
      descriptionDict: {
        en: 'Remove a Gmail draft by its identifier.',
        'zh-CN': '根据草稿 ID 删除 Gmail 草稿。',
      },
    },
    {
      name: 'delete_message',
      descriptionDict: {
        en: 'Permanently delete a Gmail message by ID.',
        'zh-CN': '根据 ID 永久删除 Gmail 邮件。',
      },
    },
    {
      name: 'fetch_emails',
      descriptionDict: {
        en: 'Search and page through Gmail messages with optional full payloads.',
        'zh-CN': '按需获取 Gmail 邮件列表，可分页并返回完整内容。',
      },
    },
    {
      name: 'fetch_message_by_id',
      descriptionDict: {
        en: 'Retrieve a Gmail message by ID in the desired format.',
        'zh-CN': '根据 ID 获取 Gmail 邮件，并选择返回格式。',
      },
    },
    {
      name: 'fetch_message_by_thread',
      descriptionDict: {
        en: 'Retrieve all messages within a Gmail thread.',
        'zh-CN': '获取指定 Gmail 线程中的全部邮件。',
      },
    },
    {
      name: 'forward_message',
      descriptionDict: {
        en: 'Forward an existing Gmail message to new recipients.',
        'zh-CN': '将现有 Gmail 邮件转发给新的收件人。',
      },
    },
    {
      name: 'get_attachment',
      descriptionDict: {
        en: 'Download a Gmail message attachment by ID.',
        'zh-CN': '按 ID 下载 Gmail 邮件附件。',
      },
    },
    {
      name: 'get_contacts',
      descriptionDict: {
        en: 'Read Google contacts and optionally include “Other Contacts”.',
        'zh-CN': '读取 Google 联系人，可选择包含“其他联系人”。',
      },
    },
    {
      name: 'get_people',
      descriptionDict: {
        en: 'Retrieve detailed people records or “Other Contacts” via People API.',
        'zh-CN': '通过 People API 获取详细的联系人或“其他联系人”信息。',
      },
    },
    {
      name: 'get_profile',
      descriptionDict: {
        en: 'Fetch mailbox profile information such as totals and history ID.',
        'zh-CN': '获取邮箱资料信息，包括总数与历史记录 ID。',
      },
    },
    {
      name: 'history_list',
      descriptionDict: {
        en: 'List mailbox history changes since a specific history ID (camelCase payload).',
        'zh-CN': '以 camelCase 参数列出指定历史 ID 之后的邮箱变更。',
      },
    },
    {
      name: 'list_drafts',
      descriptionDict: {
        en: 'List Gmail drafts with optional full draft content.',
        'zh-CN': '列出 Gmail 草稿，可选择返回完整内容。',
      },
    },
    {
      name: 'list_history',
      descriptionDict: {
        en: 'List mailbox history changes since a specific history ID (snake_case payload).',
        'zh-CN': '以 snake_case 参数列出指定历史 ID 之后的邮箱变更。',
      },
    },
    {
      name: 'list_labels',
      descriptionDict: {
        en: 'List all system and custom Gmail labels.',
        'zh-CN': '列出所有系统与自定义的 Gmail 标签。',
      },
    },
    {
      name: 'list_threads',
      descriptionDict: {
        en: 'Retrieve Gmail threads with search, pagination, and verbose options.',
        'zh-CN': '按查询与分页选项获取 Gmail 线程，可返回详细内容。',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'oauth',
      provider: 'google',
      scope: ['https://mail.google.com/'],
    },
  ],
  configItems: [
    {
      key: 'redirectUri',
      inputMode: 'text',
      labelDict: {
        en: 'Redirect URI',
        'zh-CN': '重定向 URI',
      },
      descriptionDict: {
        en: 'The OAuth 2.0 redirect URI configured in Google Cloud Console',
        'zh-CN': '在 Google Cloud Console 中配置的 OAuth 2.0 重定向 URI',
      },
      defaultValue: 'http://localhost:3000/oauth2callback',
    },
  ],
};
