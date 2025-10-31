import { ToolsetDefinition } from '@refly/openapi-schema';

export const GoogleDocsToolsetDefinition: ToolsetDefinition = {
  key: 'googledocs',
  domain: 'https://docs.google.com',
  labelDict: {
    en: 'Google Docs',
    'zh-CN': 'Google 文档',
  },
  descriptionDict: {
    en: 'Access and manage Google Docs documents. Create, read, update, export, and manage Google Docs.',
    'zh-CN': '访问和管理 Google 文档。创建、读取、更新、导出和管理 Google 文档。',
  },
  tools: [
    {
      name: 'create_document',
      descriptionDict: {
        en: 'Create a new Google Doc with specified title and content.',
        'zh-CN': '创建一个新的 Google 文档，包含指定的标题和内容。',
      },
    },
    {
      name: 'copy_document',
      descriptionDict: {
        en: 'Create a copy of an existing Google Document.',
        'zh-CN': '创建现有 Google 文档的副本。',
      },
    },
    {
      name: 'create_document_markdown',
      descriptionDict: {
        en: 'Create a new Google Doc with Markdown content.',
        'zh-CN': '使用 Markdown 内容创建新的 Google 文档。',
      },
    },
    {
      name: 'get_document',
      descriptionDict: {
        en: 'Get the content of a Google Doc by its ID.',
        'zh-CN': '通过 ID 获取 Google 文档的内容。',
      },
    },
    {
      name: 'update_document',
      descriptionDict: {
        en: 'Update the content of a Google Doc by appending or replacing text.',
        'zh-CN': '通过追加或替换文本来更新 Google 文档的内容。',
      },
    },
    {
      name: 'export_document',
      descriptionDict: {
        en: 'Export a Google Doc to various formats (PDF, Word, etc.).',
        'zh-CN': '将 Google 文档导出为各种格式（PDF、Word 等）。',
      },
    },
    {
      name: 'delete_document',
      descriptionDict: {
        en: 'Delete a Google Doc by its ID.',
        'zh-CN': '通过 ID 删除 Google 文档。',
      },
    },
    {
      name: 'search_documents',
      descriptionDict: {
        en: 'Search for Google Docs using query parameters.',
        'zh-CN': '使用查询参数搜索 Google 文档。',
      },
    },
    {
      name: 'append_text',
      descriptionDict: {
        en: 'Append text to an existing Google Doc.',
        'zh-CN': '向现有的 Google 文档追加文本。',
      },
    },
    {
      name: 'insert_text',
      descriptionDict: {
        en: 'Insert text into a Google Doc at a specific location.',
        'zh-CN': '在 Google 文档的指定位置插入文本。',
      },
    },
    {
      name: 'replace_text',
      descriptionDict: {
        en: 'Replace all instances of matched text in a Google Doc.',
        'zh-CN': '替换 Google 文档中所有匹配的文本。',
      },
    },
    {
      name: 'delete_content_range',
      descriptionDict: {
        en: 'Delete a range of content from a Google Document.',
        'zh-CN': '从 Google 文档中删除内容范围。',
      },
    },
    {
      name: 'insert_table',
      descriptionDict: {
        en: 'Insert a table into a Google Doc.',
        'zh-CN': '在 Google 文档中插入表格。',
      },
    },
    {
      name: 'delete_table',
      descriptionDict: {
        en: 'Delete a table from a Google Document.',
        'zh-CN': '从 Google 文档中删除表格。',
      },
    },
    {
      name: 'delete_table_row',
      descriptionDict: {
        en: 'Delete a row from a table in a Google Document.',
        'zh-CN': '从 Google 文档的表格中删除行。',
      },
    },
    {
      name: 'delete_table_column',
      descriptionDict: {
        en: 'Delete a column from a table in a Google Document.',
        'zh-CN': '从 Google 文档的表格中删除列。',
      },
    },
    {
      name: 'append_image',
      descriptionDict: {
        en: 'Append an image to the end of a Google Doc.',
        'zh-CN': '向 Google 文档末尾追加图片。',
      },
    },
    {
      name: 'insert_inline_image',
      descriptionDict: {
        en: 'Insert an inline image at a specific location in a Google Doc.',
        'zh-CN': '在 Google 文档的指定位置插入内联图片。',
      },
    },
    {
      name: 'replace_image',
      descriptionDict: {
        en: 'Replace an image in a Google Doc.',
        'zh-CN': '替换 Google 文档中的图片。',
      },
    },
    {
      name: 'insert_page_break',
      descriptionDict: {
        en: 'Insert a page break into a Google Doc.',
        'zh-CN': '在 Google 文档中插入分页符。',
      },
    },
    {
      name: 'create_header',
      descriptionDict: {
        en: 'Create a header in a Google Document.',
        'zh-CN': '在 Google 文档中创建页眉。',
      },
    },
    {
      name: 'delete_header',
      descriptionDict: {
        en: 'Delete a header from a Google Document.',
        'zh-CN': '从 Google 文档中删除页眉。',
      },
    },
    {
      name: 'create_footer',
      descriptionDict: {
        en: 'Create a footer in a Google Document.',
        'zh-CN': '在 Google 文档中创建页脚。',
      },
    },
    {
      name: 'delete_footer',
      descriptionDict: {
        en: 'Delete a footer from a Google Document.',
        'zh-CN': '从 Google 文档中删除页脚。',
      },
    },
    {
      name: 'create_footnote',
      descriptionDict: {
        en: 'Create a footnote in a Google Document.',
        'zh-CN': '在 Google 文档中创建脚注。',
      },
    },
    {
      name: 'create_named_range',
      descriptionDict: {
        en: 'Create a named range in a Google Document.',
        'zh-CN': '在 Google 文档中创建命名范围。',
      },
    },
    {
      name: 'delete_named_range',
      descriptionDict: {
        en: 'Delete a named range from a Google Document.',
        'zh-CN': '从 Google 文档中删除命名范围。',
      },
    },
    {
      name: 'create_paragraph_bullets',
      descriptionDict: {
        en: 'Add bullets to paragraphs in a Google Document.',
        'zh-CN': '在 Google 文档的段落中添加项目符号。',
      },
    },
    {
      name: 'delete_paragraph_bullets',
      descriptionDict: {
        en: 'Remove bullets from paragraphs in a Google Document.',
        'zh-CN': '从 Google 文档的段落中删除项目符号。',
      },
    },
    {
      name: 'get_charts_from_spreadsheet',
      descriptionDict: {
        en: 'Get all charts from a Google Sheets spreadsheet.',
        'zh-CN': '从 Google 表格中获取所有图表。',
      },
    },
    {
      name: 'create_document_from_template',
      descriptionDict: {
        en: 'Create a new Google Doc from a template.',
        'zh-CN': '从模板创建新的 Google 文档。',
      },
    },
    {
      name: 'get_tab_content',
      descriptionDict: {
        en: 'Get the content of specific tabs in a Google Doc.',
        'zh-CN': '获取 Google 文档中特定标签页的内容。',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'oauth',
      provider: 'google',
      scope: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/documents',
      ],
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
