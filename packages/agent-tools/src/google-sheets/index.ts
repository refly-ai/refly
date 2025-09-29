import { z } from 'zod';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { ToolsetDefinition } from '@refly/openapi-schema';
import { google } from 'googleapis';
import { ToolParams } from '@langchain/core/tools';

export const GoogleSheetsToolsetDefinition: ToolsetDefinition = {
  key: 'google_sheets',
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
      name: 'get_values',
      descriptionDict: {
        en: 'Get values from a specific range in a Google Sheets spreadsheet.',
        'zh-CN': '从 Google 表格中的特定范围获取值。',
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
      name: 'append_values',
      descriptionDict: {
        en: 'Append values to the end of a range in a Google Sheets spreadsheet.',
        'zh-CN': '在 Google 表格中的范围末尾追加值。',
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
      name: 'add_column',
      descriptionDict: {
        en: 'Add a new column to a Google Sheet.',
        'zh-CN': '向 Google 表格添加新列。',
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
      name: 'copy_worksheet',
      descriptionDict: {
        en: 'Copy a worksheet within a Google Sheets spreadsheet.',
        'zh-CN': '在 Google 表格中复制工作表。',
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
      name: 'upsert_row',
      descriptionDict: {
        en: 'Insert or update a row based on a key column in a Google Sheet.',
        'zh-CN': '在 Google 表格中基于关键列插入或更新行。',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'oauth',
      provider: 'google',
      scope: [
        'https://www.googleapis.com/auth/drive',
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

//automatic assemble clientId, clientSecret, refreshToken, accessToken if authType is oauth
export interface GoogleSheetsParams extends ToolParams {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken: string;
  redirectUri?: string;
}

// Helper function to create authenticated Sheets service
function createSheetsService(params: GoogleSheetsParams) {
  const oauth2Client = new google.auth.OAuth2(
    params.clientId,
    params.clientSecret,
    params.redirectUri ?? 'http://localhost:3000/oauth2callback',
  );

  oauth2Client.setCredentials({
    refresh_token: params.refreshToken,
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

export class GoogleSheetsCreateSpreadsheet extends AgentBaseTool<GoogleSheetsParams> {
  name = 'create_spreadsheet';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    title: z.string().describe('Title of the spreadsheet to create'),
    sheetTitle: z.string().optional().describe('Title of the initial sheet (default: Sheet1)'),
  });
  description = 'Create a new Google Sheets spreadsheet with specified title.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const request = {
        requestBody: {
          properties: {
            title: input.title,
          },
          sheets: input.sheetTitle
            ? [
                {
                  properties: {
                    title: input.sheetTitle,
                  },
                },
              ]
            : undefined,
        },
      };

      const response = await sheets.spreadsheets.create(request);
      const spreadsheet = response.data;

      const result = {
        message: 'Spreadsheet created successfully',
        spreadsheet: {
          spreadsheetId: spreadsheet.spreadsheetId,
          title: spreadsheet.properties?.title,
          sheets: spreadsheet.sheets?.map((sheet: any) => ({
            sheetId: sheet.properties?.sheetId,
            title: sheet.properties?.title,
            index: sheet.properties?.index,
          })),
          spreadsheetUrl: spreadsheet.spreadsheetUrl,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully created Google Sheets spreadsheet: "${spreadsheet.properties?.title}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error creating spreadsheet',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while creating spreadsheet',
      };
    }
  }
}

export class GoogleSheetsGetSpreadsheet extends AgentBaseTool<GoogleSheetsParams> {
  name = 'get_spreadsheet';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet to retrieve'),
    includeGridData: z
      .boolean()
      .optional()
      .describe('Whether to include grid data in the response')
      .default(false),
  });
  description = 'Get detailed information about a Google Sheets spreadsheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const response = await sheets.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
        includeGridData: input.includeGridData,
      });

      const spreadsheet = response.data;

      const result = {
        message: 'Spreadsheet retrieved successfully',
        spreadsheet: {
          spreadsheetId: spreadsheet.spreadsheetId,
          title: spreadsheet.properties?.title,
          locale: spreadsheet.properties?.locale,
          timeZone: spreadsheet.properties?.timeZone,
          sheets: spreadsheet.sheets?.map((sheet) => ({
            sheetId: sheet.properties?.sheetId,
            title: sheet.properties?.title,
            index: sheet.properties?.index,
            sheetType: sheet.properties?.sheetType,
            gridProperties: sheet.properties?.gridProperties,
          })),
          spreadsheetUrl: spreadsheet.spreadsheetUrl,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved Google Sheets spreadsheet: "${spreadsheet.properties?.title}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error getting spreadsheet',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while getting spreadsheet',
      };
    }
  }
}

export class GoogleSheetsGetValues extends AgentBaseTool<GoogleSheetsParams> {
  name = 'get_values';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    range: z
      .string()
      .describe('The A1 notation of the range to retrieve values from (e.g., "Sheet1!A1:B10")'),
    valueRenderOption: z
      .enum(['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'])
      .optional()
      .describe('How values should be rendered in the output')
      .default('FORMATTED_VALUE'),
    dateTimeRenderOption: z
      .enum(['SERIAL_NUMBER', 'FORMATTED_STRING'])
      .optional()
      .describe('How dates and times should be rendered')
      .default('FORMATTED_STRING'),
  });
  description = 'Get values from a specific range in a Google Sheets spreadsheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: input.spreadsheetId,
        range: input.range,
        valueRenderOption: input.valueRenderOption,
        dateTimeRenderOption: input.dateTimeRenderOption,
      });

      const values = response.data.values ?? [];
      const range = response.data.range;

      const result = {
        message: 'Values retrieved successfully',
        range,
        values,
        rowCount: values.length,
        colCount: values.length > 0 ? values[0].length : 0,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved ${values.length} rows from range: ${range}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error getting values',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while getting values',
      };
    }
  }
}

export class GoogleSheetsUpdateValues extends AgentBaseTool<GoogleSheetsParams> {
  name = 'update_values';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    range: z.string().describe('The A1 notation of the range to update (e.g., "Sheet1!A1:B10")'),
    values: z.array(z.array(z.any())).describe('The values to update, as a 2D array'),
    valueInputOption: z
      .enum(['RAW', 'USER_ENTERED'])
      .optional()
      .describe('How the input data should be interpreted')
      .default('USER_ENTERED'),
  });
  description = 'Update values in a specific range in a Google Sheets spreadsheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const response = await sheets.spreadsheets.values.update({
        spreadsheetId: input.spreadsheetId,
        range: input.range,
        valueInputOption: input.valueInputOption,
        requestBody: {
          values: input.values,
        },
      });

      const result = {
        message: 'Values updated successfully',
        spreadsheetId: input.spreadsheetId,
        updatedRange: response.data.updatedRange,
        updatedRows: response.data.updatedRows,
        updatedColumns: response.data.updatedColumns,
        updatedCells: response.data.updatedCells,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully updated ${response.data.updatedCells} cells in range: ${response.data.updatedRange}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error updating values',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while updating values',
      };
    }
  }
}

export class GoogleSheetsAppendValues extends AgentBaseTool<GoogleSheetsParams> {
  name = 'append_values';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    range: z.string().describe('The A1 notation of the range to append to (e.g., "Sheet1!A1:B1")'),
    values: z.array(z.array(z.any())).describe('The values to append, as a 2D array'),
    valueInputOption: z
      .enum(['RAW', 'USER_ENTERED'])
      .optional()
      .describe('How the input data should be interpreted')
      .default('USER_ENTERED'),
    insertDataOption: z
      .enum(['OVERWRITE', 'INSERT_ROWS'])
      .optional()
      .describe('How the input data should be inserted')
      .default('INSERT_ROWS'),
  });
  description = 'Append values to the end of a range in a Google Sheets spreadsheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const response = await sheets.spreadsheets.values.append({
        spreadsheetId: input.spreadsheetId,
        range: input.range,
        valueInputOption: input.valueInputOption,
        insertDataOption: input.insertDataOption,
        requestBody: {
          values: input.values,
        },
      });

      const result = {
        message: 'Values appended successfully',
        spreadsheetId: input.spreadsheetId,
        updatedRange: response.data.updates?.updatedRange,
        updatedRows: response.data.updates?.updatedRows,
        updatedColumns: response.data.updates?.updatedColumns,
        updatedCells: response.data.updates?.updatedCells,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully appended ${response.data.updates?.updatedCells} cells to spreadsheet`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error appending values',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while appending values',
      };
    }
  }
}

export class GoogleSheetsCreateWorksheet extends AgentBaseTool<GoogleSheetsParams> {
  name = 'create_worksheet';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    title: z.string().describe('The title of the new worksheet'),
    rowCount: z
      .number()
      .optional()
      .describe('The number of rows in the new worksheet')
      .default(1000),
    columnCount: z
      .number()
      .optional()
      .describe('The number of columns in the new worksheet')
      .default(26),
  });
  description = 'Create a new worksheet in an existing Google Sheets spreadsheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const request = {
        spreadsheetId: input.spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: input.title,
                  gridProperties: {
                    rowCount: input.rowCount,
                    columnCount: input.columnCount,
                  },
                },
              },
            },
          ],
        },
      };

      const response = await sheets.spreadsheets.batchUpdate(request);
      const addSheetResponse = response.data.replies?.[0]?.addSheet;

      const result = {
        message: 'Worksheet created successfully',
        spreadsheetId: input.spreadsheetId,
        sheet: {
          sheetId: addSheetResponse?.properties?.sheetId,
          title: addSheetResponse?.properties?.title,
          index: addSheetResponse?.properties?.index,
          gridProperties: addSheetResponse?.properties?.gridProperties,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully created worksheet: "${input.title}" in spreadsheet`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error creating worksheet',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while creating worksheet',
      };
    }
  }
}

export class GoogleSheetsDeleteWorksheet extends AgentBaseTool<GoogleSheetsParams> {
  name = 'delete_worksheet';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sheetId: z.number().describe('The ID of the worksheet to delete'),
  });
  description = 'Delete a worksheet from a Google Sheets spreadsheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const request = {
        spreadsheetId: input.spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteSheet: {
                sheetId: input.sheetId,
              },
            },
          ],
        },
      };

      await sheets.spreadsheets.batchUpdate(request);

      const result = {
        message: 'Worksheet deleted successfully',
        spreadsheetId: input.spreadsheetId,
        deletedSheetId: input.sheetId,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully deleted worksheet with ID: ${input.sheetId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error deleting worksheet',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while deleting worksheet',
      };
    }
  }
}

export class GoogleSheetsListWorksheets extends AgentBaseTool<GoogleSheetsParams> {
  name = 'list_worksheets';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
  });
  description = 'List all worksheets in a Google Sheets spreadsheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const response = await sheets.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
      });

      const spreadsheet = response.data;
      const sheetsList = spreadsheet.sheets ?? [];

      const worksheets = sheetsList.map((sheet) => ({
        sheetId: sheet.properties?.sheetId,
        title: sheet.properties?.title,
        index: sheet.properties?.index,
        sheetType: sheet.properties?.sheetType,
        gridProperties: sheet.properties?.gridProperties,
      }));

      const result = {
        message: 'Worksheets listed successfully',
        spreadsheetId: input.spreadsheetId,
        spreadsheetTitle: spreadsheet.properties?.title,
        count: worksheets.length,
        worksheets,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully listed ${worksheets.length} worksheets from spreadsheet: "${spreadsheet.properties?.title}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error listing worksheets',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while listing worksheets',
      };
    }
  }
}

export class GoogleSheetsAddSingleRow extends AgentBaseTool<GoogleSheetsParams> {
  name = 'add_single_row';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sheetName: z.string().describe('The name of the worksheet'),
    values: z.array(z.any()).describe('The values to add as a single row'),
    valueInputOption: z
      .enum(['RAW', 'USER_ENTERED'])
      .optional()
      .describe('How the input data should be interpreted')
      .default('USER_ENTERED'),
  });
  description = 'Add a single row of data to a Google Sheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const response = await sheets.spreadsheets.values.append({
        spreadsheetId: input.spreadsheetId,
        range: input.sheetName,
        valueInputOption: input.valueInputOption,
        requestBody: {
          values: [input.values],
        },
      });

      const result = {
        message: 'Row added successfully',
        spreadsheetId: input.spreadsheetId,
        sheetName: input.sheetName,
        updatedRange: response.data.updates?.updatedRange,
        updatedRows: response.data.updates?.updatedRows,
        updatedColumns: response.data.updates?.updatedColumns,
        updatedCells: response.data.updates?.updatedCells,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully added 1 row to sheet: "${input.sheetName}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error adding single row',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while adding single row',
      };
    }
  }
}

export class GoogleSheetsAddMultipleRows extends AgentBaseTool<GoogleSheetsParams> {
  name = 'add_multiple_rows';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sheetName: z.string().describe('The name of the worksheet'),
    values: z.array(z.array(z.any())).describe('The values to add as multiple rows (2D array)'),
    valueInputOption: z
      .enum(['RAW', 'USER_ENTERED'])
      .optional()
      .describe('How the input data should be interpreted')
      .default('USER_ENTERED'),
  });
  description = 'Add multiple rows of data to a Google Sheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const response = await sheets.spreadsheets.values.append({
        spreadsheetId: input.spreadsheetId,
        range: input.sheetName,
        valueInputOption: input.valueInputOption,
        requestBody: {
          values: input.values,
        },
      });

      const result = {
        message: 'Rows added successfully',
        spreadsheetId: input.spreadsheetId,
        sheetName: input.sheetName,
        updatedRange: response.data.updates?.updatedRange,
        updatedRows: response.data.updates?.updatedRows,
        updatedColumns: response.data.updates?.updatedColumns,
        updatedCells: response.data.updates?.updatedCells,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully added ${input.values.length} rows to sheet: "${input.sheetName}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error adding multiple rows',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while adding multiple rows',
      };
    }
  }
}

export class GoogleSheetsUpdateRow extends AgentBaseTool<GoogleSheetsParams> {
  name = 'update_row';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sheetName: z.string().describe('The name of the worksheet'),
    rowNumber: z.number().describe('The row number to update (1-based)'),
    values: z.array(z.any()).describe('The values to update in the row'),
    valueInputOption: z
      .enum(['RAW', 'USER_ENTERED'])
      .optional()
      .describe('How the input data should be interpreted')
      .default('USER_ENTERED'),
  });
  description = 'Update a row in a Google Sheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const range = `${input.sheetName}!${input.rowNumber}:${input.rowNumber}`;

      const response = await sheets.spreadsheets.values.update({
        spreadsheetId: input.spreadsheetId,
        range,
        valueInputOption: input.valueInputOption,
        requestBody: {
          values: [input.values],
        },
      });

      const result = {
        message: 'Row updated successfully',
        spreadsheetId: input.spreadsheetId,
        sheetName: input.sheetName,
        rowNumber: input.rowNumber,
        updatedRange: response.data.updatedRange,
        updatedRows: response.data.updatedRows,
        updatedColumns: response.data.updatedColumns,
        updatedCells: response.data.updatedCells,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully updated row ${input.rowNumber} in sheet: "${input.sheetName}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error updating row',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while updating row',
      };
    }
  }
}

export class GoogleSheetsUpdateMultipleRows extends AgentBaseTool<GoogleSheetsParams> {
  name = 'update_multiple_rows';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sheetName: z.string().describe('The name of the worksheet'),
    startRowNumber: z.number().describe('The starting row number to update (1-based)'),
    values: z.array(z.array(z.any())).describe('The values to update (2D array)'),
    valueInputOption: z
      .enum(['RAW', 'USER_ENTERED'])
      .optional()
      .describe('How the input data should be interpreted')
      .default('USER_ENTERED'),
  });
  description = 'Update multiple rows in a Google Sheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const endRowNumber = input.startRowNumber + input.values.length - 1;
      const range = `${input.sheetName}!${input.startRowNumber}:${endRowNumber}`;

      const response = await sheets.spreadsheets.values.update({
        spreadsheetId: input.spreadsheetId,
        range,
        valueInputOption: input.valueInputOption,
        requestBody: {
          values: input.values,
        },
      });

      const result = {
        message: 'Rows updated successfully',
        spreadsheetId: input.spreadsheetId,
        sheetName: input.sheetName,
        startRowNumber: input.startRowNumber,
        endRowNumber,
        updatedRange: response.data.updatedRange,
        updatedRows: response.data.updatedRows,
        updatedColumns: response.data.updatedColumns,
        updatedCells: response.data.updatedCells,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully updated ${input.values.length} rows starting from row ${input.startRowNumber} in sheet: "${input.sheetName}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error updating multiple rows',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while updating multiple rows',
      };
    }
  }
}

export class GoogleSheetsDeleteRows extends AgentBaseTool<GoogleSheetsParams> {
  name = 'delete_rows';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sheetId: z.number().describe('The ID of the worksheet'),
    startIndex: z.number().describe('The start index of rows to delete (0-based)'),
    endIndex: z.number().describe('The end index of rows to delete (0-based, exclusive)'),
  });
  description = 'Delete specified rows from a Google Sheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const request = {
        spreadsheetId: input.spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: input.sheetId,
                  dimension: 'ROWS',
                  startIndex: input.startIndex,
                  endIndex: input.endIndex,
                },
              },
            },
          ],
        },
      };

      await sheets.spreadsheets.batchUpdate(request);

      const result = {
        message: 'Rows deleted successfully',
        spreadsheetId: input.spreadsheetId,
        sheetId: input.sheetId,
        startIndex: input.startIndex,
        endIndex: input.endIndex,
        deletedRows: input.endIndex - input.startIndex,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully deleted ${input.endIndex - input.startIndex} rows from sheet`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error deleting rows',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while deleting rows',
      };
    }
  }
}

export class GoogleSheetsUpdateCell extends AgentBaseTool<GoogleSheetsParams> {
  name = 'update_cell';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sheetName: z.string().describe('The name of the worksheet'),
    cell: z.string().describe('The cell reference (e.g., "A1")'),
    value: z.any().describe('The value to set in the cell'),
    valueInputOption: z
      .enum(['RAW', 'USER_ENTERED'])
      .optional()
      .describe('How the input data should be interpreted')
      .default('USER_ENTERED'),
  });
  description = 'Update a cell in a Google Sheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const range = `${input.sheetName}!${input.cell}:${input.cell}`;

      const response = await sheets.spreadsheets.values.update({
        spreadsheetId: input.spreadsheetId,
        range,
        valueInputOption: input.valueInputOption,
        requestBody: {
          values: [[input.value]],
        },
      });

      const result = {
        message: 'Cell updated successfully',
        spreadsheetId: input.spreadsheetId,
        sheetName: input.sheetName,
        cell: input.cell,
        value: input.value,
        updatedRange: response.data.updatedRange,
        updatedRows: response.data.updatedRows,
        updatedColumns: response.data.updatedColumns,
        updatedCells: response.data.updatedCells,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully updated cell ${input.cell} in sheet: "${input.sheetName}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error updating cell',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while updating cell',
      };
    }
  }
}

export class GoogleSheetsClearCell extends AgentBaseTool<GoogleSheetsParams> {
  name = 'clear_cell';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sheetName: z.string().describe('The name of the worksheet'),
    cell: z.string().describe('The cell reference to clear (e.g., "A1")'),
  });
  description = 'Clear the content of a cell in a Google Sheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const range = `${input.sheetName}!${input.cell}`;

      const response = await sheets.spreadsheets.values.clear({
        spreadsheetId: input.spreadsheetId,
        range,
      });

      const result = {
        message: 'Cell cleared successfully',
        spreadsheetId: input.spreadsheetId,
        sheetName: input.sheetName,
        cell: input.cell,
        clearedRange: response.data.clearedRange,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully cleared cell ${input.cell} in sheet: "${input.sheetName}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error clearing cell',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while clearing cell',
      };
    }
  }
}

export class GoogleSheetsGetCell extends AgentBaseTool<GoogleSheetsParams> {
  name = 'get_cell';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sheetName: z.string().describe('The name of the worksheet'),
    cell: z.string().describe('The cell reference to get (e.g., "A1")'),
    valueRenderOption: z
      .enum(['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'])
      .optional()
      .describe('How values should be rendered in the output')
      .default('FORMATTED_VALUE'),
  });
  description = 'Get the value of a cell in a Google Sheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const range = `${input.sheetName}!${input.cell}:${input.cell}`;

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: input.spreadsheetId,
        range,
        valueRenderOption: input.valueRenderOption,
      });

      const values = response.data.values ?? [];
      const value = values.length > 0 && values[0].length > 0 ? values[0][0] : null;

      const result = {
        message: 'Cell value retrieved successfully',
        spreadsheetId: input.spreadsheetId,
        sheetName: input.sheetName,
        cell: input.cell,
        value,
        range: response.data.range,
        hasValue: value !== null && value !== undefined && value !== '',
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved value from cell ${input.cell} in sheet: "${input.sheetName}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error getting cell value',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while getting cell value',
      };
    }
  }
}

export class GoogleSheetsAddColumn extends AgentBaseTool<GoogleSheetsParams> {
  name = 'add_column';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sheetId: z.number().describe('The ID of the worksheet'),
    columnIndex: z.number().describe('The index where to insert the new column (0-based)'),
  });
  description = 'Add a new column to a Google Sheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const request = {
        spreadsheetId: input.spreadsheetId,
        requestBody: {
          requests: [
            {
              insertRange: {
                range: {
                  sheetId: input.sheetId,
                  startColumnIndex: input.columnIndex,
                  endColumnIndex: input.columnIndex + 1,
                },
                shiftDimension: 'COLUMNS',
              },
            },
          ],
        },
      };

      const response = await sheets.spreadsheets.batchUpdate(request);

      const result = {
        message: 'Column added successfully',
        spreadsheetId: input.spreadsheetId,
        sheetId: input.sheetId,
        columnIndex: input.columnIndex,
        replies: response.data.replies,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully added column at index ${input.columnIndex}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error adding column',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while adding column',
      };
    }
  }
}

export class GoogleSheetsClearRows extends AgentBaseTool<GoogleSheetsParams> {
  name = 'clear_rows';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sheetName: z.string().describe('The name of the worksheet'),
    startRowIndex: z.number().describe('The start row index to clear (0-based)'),
    endRowIndex: z.number().describe('The end row index to clear (0-based, exclusive)'),
  });
  description = 'Clear the content of specified rows in a Google Sheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const range = `${input.sheetName}!${input.startRowIndex + 1}:${input.endRowIndex}`;

      const response = await sheets.spreadsheets.values.clear({
        spreadsheetId: input.spreadsheetId,
        range,
      });

      const result = {
        message: 'Rows cleared successfully',
        spreadsheetId: input.spreadsheetId,
        sheetName: input.sheetName,
        startRowIndex: input.startRowIndex,
        endRowIndex: input.endRowIndex,
        clearedRange: response.data.clearedRange,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully cleared rows ${input.startRowIndex + 1} to ${input.endRowIndex} in sheet: "${input.sheetName}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error clearing rows',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while clearing rows',
      };
    }
  }
}

export class GoogleSheetsCopyWorksheet extends AgentBaseTool<GoogleSheetsParams> {
  name = 'copy_worksheet';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the source spreadsheet'),
    sheetId: z.number().describe('The ID of the worksheet to copy'),
    destinationSpreadsheetId: z.string().describe('The ID of the destination spreadsheet'),
  });
  description = 'Copy a worksheet within a Google Sheets spreadsheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const response = await sheets.spreadsheets.sheets.copyTo({
        spreadsheetId: input.spreadsheetId,
        sheetId: input.sheetId,
        requestBody: {
          destinationSpreadsheetId: input.destinationSpreadsheetId,
        },
      });

      const result = {
        message: 'Worksheet copied successfully',
        sourceSpreadsheetId: input.spreadsheetId,
        destinationSpreadsheetId: input.destinationSpreadsheetId,
        sheetId: input.sheetId,
        copiedSheet: response.data,
      };

      return {
        status: 'success',
        data: result,
        summary: 'Successfully copied worksheet to destination spreadsheet',
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error copying worksheet',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while copying worksheet',
      };
    }
  }
}

export class GoogleSheetsFindRow extends AgentBaseTool<GoogleSheetsParams> {
  name = 'find_row';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sheetName: z.string().describe('The name of the worksheet'),
    column: z.string().describe('The column letter to search in (e.g., "A")'),
    value: z.string().describe('The value to search for'),
    returnEntireRow: z
      .boolean()
      .optional()
      .describe('Whether to return the entire row data')
      .default(false),
  });
  description = 'Find rows by column and value in a Google Sheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      // Get values from the search column
      const columnRange = `${input.sheetName}!${input.column}:${input.column}`;
      const columnResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: input.spreadsheetId,
        range: columnRange,
      });

      const columnValues = columnResponse.data.values ?? [];
      const foundRows: any[] = [];

      // Find matching rows
      columnValues.forEach((row, index) => {
        if (row[0] === input.value) {
          foundRows.push({
            rowIndex: index,
            googleSheetsRowNumber: index + 1,
            columnValue: row[0],
          });
        }
      });

      // If requested, get entire row data
      if (input.returnEntireRow && foundRows.length > 0) {
        const entireSheetResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: input.spreadsheetId,
          range: input.sheetName,
        });

        const allValues = entireSheetResponse.data.values ?? [];
        for (const foundRow of foundRows) {
          if (allValues[foundRow.rowIndex]) {
            foundRow.entireRow = allValues[foundRow.rowIndex];
          }
        }
      }

      const result = {
        message: 'Rows found successfully',
        spreadsheetId: input.spreadsheetId,
        sheetName: input.sheetName,
        searchColumn: input.column,
        searchValue: input.value,
        foundRows,
        count: foundRows.length,
      };

      return {
        status: 'success',
        data: result,
        summary: `Found ${foundRows.length} rows matching "${input.value}" in column ${input.column}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error finding rows',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while finding rows',
      };
    }
  }
}

export class GoogleSheetsInsertAnchoredNote extends AgentBaseTool<GoogleSheetsParams> {
  name = 'insert_anchored_note';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sheetId: z.number().describe('The ID of the worksheet'),
    rowIndex: z.number().describe('The row index for the note (0-based)'),
    columnIndex: z.number().describe('The column index for the note (0-based)'),
    note: z.string().describe('The note text to insert'),
  });
  description = 'Insert an anchored note to a cell in a Google Sheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const request = {
        spreadsheetId: input.spreadsheetId,
        requestBody: {
          requests: [
            {
              updateCells: {
                range: {
                  sheetId: input.sheetId,
                  startRowIndex: input.rowIndex,
                  endRowIndex: input.rowIndex + 1,
                  startColumnIndex: input.columnIndex,
                  endColumnIndex: input.columnIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        note: input.note,
                      },
                    ],
                  },
                ],
                fields: 'note',
              },
            },
          ],
        },
      };

      await sheets.spreadsheets.batchUpdate(request);

      const result = {
        message: 'Anchored note inserted successfully',
        spreadsheetId: input.spreadsheetId,
        sheetId: input.sheetId,
        rowIndex: input.rowIndex,
        columnIndex: input.columnIndex,
        note: input.note,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully inserted anchored note at row ${input.rowIndex + 1}, column ${input.columnIndex + 1}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error inserting anchored note',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while inserting anchored note',
      };
    }
  }
}

export class GoogleSheetsInsertComment extends AgentBaseTool<GoogleSheetsParams> {
  name = 'insert_comment';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sheetId: z.number().describe('The ID of the worksheet'),
    rowIndex: z.number().describe('The row index for the comment (0-based)'),
    columnIndex: z.number().describe('The column index for the comment (0-based)'),
    comment: z.string().describe('The comment text to insert'),
  });
  description = 'Insert a comment to a cell in a Google Sheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sheets = createSheetsService(this.params);

      const request = {
        spreadsheetId: input.spreadsheetId,
        requestBody: {
          requests: [
            {
              insertRange: {
                range: {
                  sheetId: input.sheetId,
                  startRowIndex: input.rowIndex,
                  endRowIndex: input.rowIndex + 1,
                  startColumnIndex: input.columnIndex,
                  endColumnIndex: input.columnIndex + 1,
                },
                shiftDimension: 'ROWS',
              },
            },
            {
              updateCells: {
                range: {
                  sheetId: input.sheetId,
                  startRowIndex: input.rowIndex,
                  endRowIndex: input.rowIndex + 1,
                  startColumnIndex: input.columnIndex,
                  endColumnIndex: input.columnIndex + 1,
                },
                rows: [
                  {
                    values: [
                      {
                        note: input.comment,
                      },
                    ],
                  },
                ],
                fields: 'note',
              },
            },
          ],
        },
      };

      await sheets.spreadsheets.batchUpdate(request);

      const result = {
        message: 'Comment inserted successfully',
        spreadsheetId: input.spreadsheetId,
        sheetId: input.sheetId,
        rowIndex: input.rowIndex,
        columnIndex: input.columnIndex,
        comment: input.comment,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully inserted comment at row ${input.rowIndex + 1}, column ${input.columnIndex + 1}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error inserting comment',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while inserting comment',
      };
    }
  }
}

export class GoogleSheetsUpsertRow extends AgentBaseTool<GoogleSheetsParams> {
  name = 'upsert_row';
  toolsetKey = GoogleSheetsToolsetDefinition.key;

  schema = z.object({
    spreadsheetId: z.string().describe('The ID of the spreadsheet'),
    sheetName: z.string().describe('The name of the worksheet'),
    keyColumn: z.string().describe('The column letter to use as key (e.g., "A")'),
    keyValue: z.string().describe('The key value to search for'),
    rowData: z.array(z.any()).describe('The row data to insert or update'),
  });
  description = 'Insert or update a row based on a key column in a Google Sheet.';

  protected params: GoogleSheetsParams;

  constructor(params: GoogleSheetsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      // First, try to find the existing row
      const findTool = new GoogleSheetsFindRow(this.params);
      const findResult = await findTool._call({
        spreadsheetId: input.spreadsheetId,
        sheetName: input.sheetName,
        column: input.keyColumn,
        value: input.keyValue,
        returnEntireRow: false,
      });

      if (findResult.status === 'success' && findResult.data.foundRows.length > 0) {
        // Update existing row
        const rowNumber = findResult.data.foundRows[0].googleSheetsRowNumber;
        const updateTool = new GoogleSheetsUpdateRow(this.params);
        await updateTool._call({
          spreadsheetId: input.spreadsheetId,
          sheetName: input.sheetName,
          rowNumber,
          values: input.rowData,
          valueInputOption: 'USER_ENTERED',
        });

        const result = {
          message: 'Row updated successfully (upsert)',
          spreadsheetId: input.spreadsheetId,
          sheetName: input.sheetName,
          operation: 'update',
          rowNumber,
          rowData: input.rowData,
        };

        return {
          status: 'success',
          data: result,
          summary: `Successfully updated existing row ${rowNumber} with key "${input.keyValue}"`,
        };
      } else {
        // Insert new row
        const insertTool = new GoogleSheetsAddSingleRow(this.params);
        await insertTool._call({
          spreadsheetId: input.spreadsheetId,
          sheetName: input.sheetName,
          values: input.rowData,
          valueInputOption: 'USER_ENTERED',
        });

        const result = {
          message: 'Row inserted successfully (upsert)',
          spreadsheetId: input.spreadsheetId,
          sheetName: input.sheetName,
          operation: 'insert',
          rowData: input.rowData,
        };

        return {
          status: 'success',
          data: result,
          summary: `Successfully inserted new row with key "${input.keyValue}"`,
        };
      }
    } catch (error) {
      return {
        status: 'error',
        error: 'Error performing upsert operation',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while performing upsert operation',
      };
    }
  }
}

export class GoogleSheetsToolset extends AgentBaseToolset<GoogleSheetsParams> {
  toolsetKey = GoogleSheetsToolsetDefinition.key;
  tools = [
    GoogleSheetsCreateSpreadsheet,
    GoogleSheetsGetSpreadsheet,
    GoogleSheetsGetValues,
    GoogleSheetsUpdateValues,
    GoogleSheetsAppendValues,
    GoogleSheetsCreateWorksheet,
    GoogleSheetsDeleteWorksheet,
    GoogleSheetsListWorksheets,
    GoogleSheetsAddSingleRow,
    GoogleSheetsAddMultipleRows,
    GoogleSheetsUpdateRow,
    GoogleSheetsUpdateMultipleRows,
    GoogleSheetsDeleteRows,
    GoogleSheetsUpdateCell,
    GoogleSheetsClearCell,
    GoogleSheetsGetCell,
    GoogleSheetsAddColumn,
    GoogleSheetsClearRows,
    GoogleSheetsCopyWorksheet,
    GoogleSheetsFindRow,
    GoogleSheetsInsertAnchoredNote,
    GoogleSheetsInsertComment,
    GoogleSheetsUpsertRow,
  ] satisfies readonly AgentToolConstructor<GoogleSheetsParams>[];
}
