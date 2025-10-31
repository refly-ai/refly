import { ToolsetDefinition } from '@refly/openapi-schema';
export const GoogleSheetsToolsetDefinition: ToolsetDefinition = {
  key: 'googlesheets',
  domain: 'https://sheets.google.com',
  labelDict: {
    en: 'Google Sheets',
    'zh-CN': 'Google 表格',
  },
  descriptionDict: {
    en: 'Access and manage Google Sheets spreadsheets. Create, read, update spreadsheets and worksheets.',
    'zh-CN': '访问和管理 Google 表格。创建、读取、更新表格和工作表。',
  },
  tools: [
    {
      name: 'create_spreadsheet',
      descriptionDict: {
        en: 'Create a new Google Sheets spreadsheet with specified title.',
        'zh-CN': '创建一个新的 Google 表格，包含指定的标题。',
      },
    },
    {
      name: 'get_spreadsheet',
      descriptionDict: {
        en: 'Get detailed information about a Google Sheets spreadsheet.',
        'zh-CN': '获取 Google 表格的详细信息。',
      },
    },
    {
      name: 'get_spreadsheet_by_data_filter',
      descriptionDict: {
        en: 'Get spreadsheet data filtered by specific criteria.',
        'zh-CN': '通过特定条件获取过滤后的表格数据。',
      },
    },
    {
      name: 'get_values',
      descriptionDict: {
        en: 'Get values from a specific range in a Google Sheets spreadsheet.',
        'zh-CN': '从 Google 表格中的特定范围获取值。',
      },
    },
    {
      name: 'batch_get',
      descriptionDict: {
        en: 'Get values from multiple ranges in a Google Sheets spreadsheet.',
        'zh-CN': '从 Google 表格的多个范围获取值。',
      },
    },
    {
      name: 'update_values',
      descriptionDict: {
        en: 'Update values in a specific range in a Google Sheets spreadsheet.',
        'zh-CN': '更新 Google 表格中特定范围的值。',
      },
    },
    {
      name: 'batch_update',
      descriptionDict: {
        en: 'Update multiple ranges in a Google Sheets spreadsheet.',
        'zh-CN': '更新 Google 表格中的多个范围。',
      },
    },
    {
      name: 'batch_update_values_by_data_filter',
      descriptionDict: {
        en: 'Update values in ranges matching data filters.',
        'zh-CN': '更新匹配数据过滤器的范围中的值。',
      },
    },
    {
      name: 'append_values',
      descriptionDict: {
        en: 'Append values to the end of a range in a Google Sheets spreadsheet.',
        'zh-CN': '在 Google 表格中的范围末尾追加值。',
      },
    },
    {
      name: 'clear_values',
      descriptionDict: {
        en: 'Clear cell content from a specified range.',
        'zh-CN': '清除指定范围的单元格内容。',
      },
    },
    {
      name: 'create_worksheet',
      descriptionDict: {
        en: 'Create a new worksheet in an existing Google Sheets spreadsheet.',
        'zh-CN': '在现有的 Google 表格中创建一个新的工作表。',
      },
    },
    {
      name: 'delete_worksheet',
      descriptionDict: {
        en: 'Delete a worksheet from a Google Sheets spreadsheet.',
        'zh-CN': '从 Google 表格中删除工作表。',
      },
    },
    {
      name: 'list_worksheets',
      descriptionDict: {
        en: 'List all worksheets in a Google Sheets spreadsheet.',
        'zh-CN': '列出 Google 表格中的所有工作表。',
      },
    },
    {
      name: 'get_sheet_names',
      descriptionDict: {
        en: 'Get all worksheet names from a Google Sheets spreadsheet.',
        'zh-CN': '从 Google 表格中获取所有工作表名称。',
      },
    },
    {
      name: 'find_worksheet_by_title',
      descriptionDict: {
        en: 'Find a worksheet by its title.',
        'zh-CN': '通过标题查找工作表。',
      },
    },
    {
      name: 'copy_worksheet',
      descriptionDict: {
        en: 'Copy a worksheet within a Google Sheets spreadsheet.',
        'zh-CN': '在 Google 表格中复制工作表。',
      },
    },
    {
      name: 'add_single_row',
      descriptionDict: {
        en: 'Add a single row of data to a Google Sheet.',
        'zh-CN': '向 Google 表格添加单行数据。',
      },
    },
    {
      name: 'add_multiple_rows',
      descriptionDict: {
        en: 'Add multiple rows of data to a Google Sheet.',
        'zh-CN': '向 Google 表格添加多行数据。',
      },
    },
    {
      name: 'create_spreadsheet_row',
      descriptionDict: {
        en: 'Insert a new empty row in a Google Sheet.',
        'zh-CN': '在 Google 表格中插入新的空行。',
      },
    },
    {
      name: 'update_row',
      descriptionDict: {
        en: 'Update a row in a Google Sheet.',
        'zh-CN': '更新 Google 表格中的一行数据。',
      },
    },
    {
      name: 'update_multiple_rows',
      descriptionDict: {
        en: 'Update multiple rows in a Google Sheet.',
        'zh-CN': '更新 Google 表格中的多行数据。',
      },
    },
    {
      name: 'delete_rows',
      descriptionDict: {
        en: 'Delete specified rows from a Google Sheet.',
        'zh-CN': '从 Google 表格中删除指定的行。',
      },
    },
    {
      name: 'clear_rows',
      descriptionDict: {
        en: 'Clear the content of specified rows in a Google Sheet.',
        'zh-CN': '清除 Google 表格中指定行的内容。',
      },
    },
    {
      name: 'delete_dimension',
      descriptionDict: {
        en: 'Delete specified rows or columns from a sheet.',
        'zh-CN': '从工作表中删除指定的行或列。',
      },
    },
    {
      name: 'append_dimension',
      descriptionDict: {
        en: 'Append new rows or columns to a sheet.',
        'zh-CN': '向工作表追加新的行或列。',
      },
    },
    {
      name: 'find_row',
      descriptionDict: {
        en: 'Find rows by column and value in a Google Sheet.',
        'zh-CN': '在 Google 表格中通过列和值查找行。',
      },
    },
    {
      name: 'upsert_row',
      descriptionDict: {
        en: 'Insert or update a row based on a key column in a Google Sheet.',
        'zh-CN': '在 Google 表格中基于关键列插入或更新行。',
      },
    },
    {
      name: 'add_column',
      descriptionDict: {
        en: 'Add a new column to a Google Sheet.',
        'zh-CN': '向 Google 表格添加新列。',
      },
    },
    {
      name: 'create_spreadsheet_column',
      descriptionDict: {
        en: 'Create a new column in a Google Spreadsheet.',
        'zh-CN': '在 Google 表格中创建新列。',
      },
    },
    {
      name: 'update_cell',
      descriptionDict: {
        en: 'Update a cell in a Google Sheet.',
        'zh-CN': '更新 Google 表格中的一个单元格。',
      },
    },
    {
      name: 'clear_cell',
      descriptionDict: {
        en: 'Clear the content of a cell in a Google Sheet.',
        'zh-CN': '清除 Google 表格中单元格的内容。',
      },
    },
    {
      name: 'get_cell',
      descriptionDict: {
        en: 'Get the value of a cell in a Google Sheet.',
        'zh-CN': '获取 Google 表格中单元格的值。',
      },
    },
    {
      name: 'format_cell',
      descriptionDict: {
        en: 'Apply formatting to cells in a Google Sheet.',
        'zh-CN': '为 Google 表格中的单元格应用格式。',
      },
    },
    {
      name: 'insert_anchored_note',
      descriptionDict: {
        en: 'Insert an anchored note to a cell in a Google Sheet.',
        'zh-CN': '在 Google 表格的单元格中插入锚定注释。',
      },
    },
    {
      name: 'insert_comment',
      descriptionDict: {
        en: 'Insert a comment to a cell in a Google Sheet.',
        'zh-CN': '在 Google 表格的单元格中插入评论。',
      },
    },
    {
      name: 'create_chart',
      descriptionDict: {
        en: 'Create a chart in a Google Sheets spreadsheet.',
        'zh-CN': '在 Google 表格中创建图表。',
      },
    },
    {
      name: 'find_replace',
      descriptionDict: {
        en: 'Find and replace text in a Google Spreadsheet.',
        'zh-CN': '在 Google 表格中查找和替换文本。',
      },
    },
    {
      name: 'clear_basic_filter',
      descriptionDict: {
        en: 'Clear the basic filter from a sheet.',
        'zh-CN': '清除工作表的基本筛选器。',
      },
    },
    {
      name: 'aggregate_column_data',
      descriptionDict: {
        en: 'Search and aggregate data from columns in a Google Sheet.',
        'zh-CN': '在 Google 表格中搜索并聚合列数据。',
      },
    },
    {
      name: 'execute_sql',
      descriptionDict: {
        en: 'Execute SQL queries against Google Sheets tables.',
        'zh-CN': '对 Google 表格执行 SQL 查询。',
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
        'https://www.googleapis.com/auth/spreadsheets',
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
