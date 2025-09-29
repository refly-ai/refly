import { z } from 'zod';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { ToolsetDefinition } from '@refly/openapi-schema';
import { google } from 'googleapis';
import { ToolParams } from '@langchain/core/tools';

export const GoogleDocsToolsetDefinition: ToolsetDefinition = {
  key: 'google_docs',
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
      name: 'insert_table',
      descriptionDict: {
        en: 'Insert a table into a Google Doc.',
        'zh-CN': '在 Google 文档中插入表格。',
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
      scope: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/documents'],
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
export interface GoogleDocsParams extends ToolParams {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken: string;
  redirectUri?: string;
}

// Helper function to create authenticated Docs service
function createDocsService(params: GoogleDocsParams) {
  const oauth2Client = new google.auth.OAuth2(
    params.clientId,
    params.clientSecret,
    params.redirectUri ?? 'http://localhost:3000/oauth2callback',
  );

  oauth2Client.setCredentials({
    refresh_token: params.refreshToken,
  });

  return google.docs({ version: 'v1', auth: oauth2Client });
}

// Helper function to create authenticated Drive service (for file operations)
function createDriveService(params: GoogleDocsParams) {
  const oauth2Client = new google.auth.OAuth2(
    params.clientId,
    params.clientSecret,
    params.redirectUri ?? 'http://localhost:3000/oauth2callback',
  );

  oauth2Client.setCredentials({
    refresh_token: params.refreshToken,
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

export class GoogleDocsCreateDocument extends AgentBaseTool<GoogleDocsParams> {
  name = 'create_document';
  toolsetKey = GoogleDocsToolsetDefinition.key;

  schema = z.object({
    title: z.string().describe('Title of the document to create'),
    content: z.string().optional().describe('Initial content to add to the document'),
  });
  description = 'Create a new Google Doc with specified title and content.';

  protected params: GoogleDocsParams;

  constructor(params: GoogleDocsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const drive = createDriveService(this.params);

      // Create the document file
      const fileMetadata = {
        name: input.title,
        mimeType: 'application/vnd.google-apps.document',
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id,name,createdTime,webViewLink',
      });

      const file = response.data;
      const documentId = file.id;

      if (!documentId) {
        throw new Error('Failed to create document - no ID returned');
      }

      // If content is provided, add it to the document
      if (input.content) {
        const docs = createDocsService(this.params);

        await docs.documents.batchUpdate({
          documentId,
          requestBody: {
            requests: [
              {
                insertText: {
                  location: {
                    index: 1,
                  },
                  text: input.content,
                },
              },
            ],
          },
        });
      }

      const result = {
        message: 'Document created successfully',
        document: {
          id: documentId,
          name: file.name,
          createdTime: file.createdTime,
          webViewLink: file.webViewLink,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully created Google Doc: "${file.name}" with ID: ${documentId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error creating document',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while creating document',
      };
    }
  }
}

export class GoogleDocsGetDocument extends AgentBaseTool<GoogleDocsParams> {
  name = 'get_document';
  toolsetKey = GoogleDocsToolsetDefinition.key;

  schema = z.object({
    documentId: z.string().describe('The ID of the Google Doc to retrieve'),
  });
  description = 'Get the content of a Google Doc by its ID.';

  protected params: GoogleDocsParams;

  constructor(params: GoogleDocsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const docs = createDocsService(this.params);

      const response = await docs.documents.get({
        documentId: input.documentId,
      });

      const document = response.data;

      // Extract text content from the document
      let content = '';
      if (document.body?.content) {
        for (const element of document.body.content) {
          if (element.paragraph?.elements) {
            for (const paragraphElement of element.paragraph.elements) {
              if (paragraphElement.textRun?.content) {
                content += paragraphElement.textRun.content;
              }
            }
            // Add newline after each paragraph
            content += '\n';
          }
        }
      }

      const result = {
        message: 'Document retrieved successfully',
        document: {
          id: document.documentId,
          title: document.title,
          content: content.trim(),
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved Google Doc: "${document.title}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error getting document',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while getting document',
      };
    }
  }
}

export class GoogleDocsUpdateDocument extends AgentBaseTool<GoogleDocsParams> {
  name = 'update_document';
  toolsetKey = GoogleDocsToolsetDefinition.key;

  schema = z.object({
    documentId: z.string().describe('The ID of the Google Doc to update'),
    content: z.string().describe('Content to append to the document'),
    mode: z
      .enum(['append', 'replace'])
      .optional()
      .describe('Update mode: append or replace entire content')
      .default('append'),
  });
  description = 'Update the content of a Google Doc by appending or replacing text.';

  protected params: GoogleDocsParams;

  constructor(params: GoogleDocsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const docs = createDocsService(this.params);

      if (input.mode === 'replace') {
        // Get the current document to find the end position
        const docResponse = await docs.documents.get({
          documentId: input.documentId,
        });

        const document = docResponse.data;
        const endIndex = document.body?.content?.length ?? 1;

        // Replace all content
        await docs.documents.batchUpdate({
          documentId: input.documentId,
          requestBody: {
            requests: [
              {
                deleteContentRange: {
                  range: {
                    startIndex: 1,
                    endIndex: endIndex - 1,
                  },
                },
              },
              {
                insertText: {
                  location: {
                    index: 1,
                  },
                  text: input.content,
                },
              },
            ],
          },
        });
      } else {
        // Default: append mode
        // Get the document end position
        const docResponse = await docs.documents.get({
          documentId: input.documentId,
        });

        const document = docResponse.data;
        const endIndex = document.body?.content?.length ?? 1;

        // Append content at the end
        await docs.documents.batchUpdate({
          documentId: input.documentId,
          requestBody: {
            requests: [
              {
                insertText: {
                  location: {
                    index: endIndex - 1,
                  },
                  text: input.content,
                },
              },
            ],
          },
        });
      }

      // Get updated document info
      const drive = createDriveService(this.params);
      const fileResponse = await drive.files.get({
        fileId: input.documentId,
        fields: 'name,modifiedTime',
      });

      const file = fileResponse.data;

      const result = {
        message: 'Document updated successfully',
        document: {
          id: input.documentId,
          name: file.name,
          modifiedTime: file.modifiedTime,
          mode: input.mode,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully updated Google Doc: "${file.name}" (${input.mode} mode)`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error updating document',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while updating document',
      };
    }
  }
}

export class GoogleDocsExportDocument extends AgentBaseTool<GoogleDocsParams> {
  name = 'export_document';
  toolsetKey = GoogleDocsToolsetDefinition.key;

  schema = z.object({
    documentId: z.string().describe('The ID of the Google Doc to export'),
    mimeType: z
      .enum([
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/html',
      ])
      .describe('Export format'),
  });
  description = 'Export a Google Doc to various formats (PDF, Word, etc.).';

  protected params: GoogleDocsParams;

  constructor(params: GoogleDocsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const drive = createDriveService(this.params);

      // Get file metadata first
      const fileResponse = await drive.files.get({
        fileId: input.documentId,
        fields: 'name',
      });

      const file = fileResponse.data;

      // Export the document
      const exportResponse = await drive.files.export({
        fileId: input.documentId,
        mimeType: input.mimeType,
      });

      const result = {
        message: 'Document exported successfully',
        document: {
          id: input.documentId,
          name: file.name,
          exportedMimeType: input.mimeType,
          content: exportResponse.data,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully exported Google Doc: "${file.name}" to ${input.mimeType}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error exporting document',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while exporting document',
      };
    }
  }
}

export class GoogleDocsDeleteDocument extends AgentBaseTool<GoogleDocsParams> {
  name = 'delete_document';
  toolsetKey = GoogleDocsToolsetDefinition.key;

  schema = z.object({
    documentId: z.string().describe('The ID of the Google Doc to delete'),
  });
  description = 'Delete a Google Doc by its ID.';

  protected params: GoogleDocsParams;

  constructor(params: GoogleDocsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const drive = createDriveService(this.params);

      // Get file info before deletion
      const fileResponse = await drive.files.get({
        fileId: input.documentId,
        fields: 'name',
      });

      const fileName = fileResponse.data.name;

      // Delete the document
      await drive.files.delete({
        fileId: input.documentId,
      });

      const result = {
        message: 'Document deleted successfully',
        deletedDocument: {
          id: input.documentId,
          name: fileName,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully deleted Google Doc: "${fileName}" with ID: ${input.documentId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error deleting document',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while deleting document',
      };
    }
  }
}

export class GoogleDocsSearchDocuments extends AgentBaseTool<GoogleDocsParams> {
  name = 'search_documents';
  toolsetKey = GoogleDocsToolsetDefinition.key;

  schema = z.object({
    query: z
      .string()
      .describe(
        'Search query (e.g., "name contains \'report\'", "mimeType = \'application/vnd.google-apps.document\'")',
      ),
    pageSize: z.number().optional().describe('Maximum number of results to return (default: 10)'),
    pageToken: z.string().optional().describe('Token for pagination'),
  });
  description = 'Search for Google Docs using query parameters.';

  protected params: GoogleDocsParams;

  constructor(params: GoogleDocsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const drive = createDriveService(this.params);

      // Add mimeType filter for Google Docs if not specified
      const searchQuery = input.query.includes('mimeType')
        ? input.query
        : `${input.query} and mimeType = 'application/vnd.google-apps.document'`;

      const response = await drive.files.list({
        q: searchQuery,
        pageSize: input.pageSize ?? 10,
        pageToken: input.pageToken,
        fields: 'files(id,name,mimeType,createdTime,modifiedTime),nextPageToken',
      });

      const files = response.data.files ?? [];
      const nextPageToken = response.data.nextPageToken;

      if (files.length === 0) {
        return {
          status: 'success',
          data: {
            message: `No Google Docs found matching query: "${input.query}"`,
            query: input.query,
            count: 0,
          },
          summary: `No Google Docs found matching query: "${input.query}"`,
        };
      }

      const documentList = files.map((file) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
      }));

      const result = {
        message: `Search results for "${input.query}"`,
        query: input.query,
        count: files.length,
        documents: documentList,
        nextPageToken,
      };

      return {
        status: 'success',
        data: result,
        summary: `Search completed successfully. Found ${files.length} Google Docs matching query: "${input.query}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error searching documents',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while searching documents',
      };
    }
  }
}

export class GoogleDocsAppendText extends AgentBaseTool<GoogleDocsParams> {
  name = 'append_text';
  toolsetKey = GoogleDocsToolsetDefinition.key;

  schema = z.object({
    documentId: z.string().describe('The ID of the Google Doc to append text to'),
    text: z.string().describe('The text to append to the document'),
    appendAtBeginning: z
      .boolean()
      .optional()
      .describe('Whether to append at the beginning instead of the end')
      .default(false),
  });
  description = 'Append text to an existing Google Doc.';

  protected params: GoogleDocsParams;

  constructor(params: GoogleDocsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const docs = createDocsService(this.params);

      // Get the document to find the insertion point
      const docResponse = await docs.documents.get({
        documentId: input.documentId,
      });

      const document = docResponse.data;
      const insertIndex = input.appendAtBeginning ? 1 : (document.body?.content?.length ?? 1) - 1;

      // Insert the text
      await docs.documents.batchUpdate({
        documentId: input.documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: {
                  index: insertIndex,
                },
                text: input.text,
              },
            },
          ],
        },
      });

      const result = {
        message: 'Text appended successfully',
        document: {
          id: input.documentId,
          text: input.text,
          appendAtBeginning: input.appendAtBeginning,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully appended text to Google Doc: ${input.documentId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error appending text',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while appending text',
      };
    }
  }
}

export class GoogleDocsInsertText extends AgentBaseTool<GoogleDocsParams> {
  name = 'insert_text';
  toolsetKey = GoogleDocsToolsetDefinition.key;

  schema = z.object({
    documentId: z.string().describe('The ID of the Google Doc to insert text into'),
    text: z.string().describe('The text to insert into the document'),
    index: z
      .number()
      .optional()
      .describe('The index to insert the text at (default: 1)')
      .default(1),
    tabId: z.string().optional().describe('The ID of the tab to insert text into'),
  });
  description = 'Insert text into a Google Doc at a specific location.';

  protected params: GoogleDocsParams;

  constructor(params: GoogleDocsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const docs = createDocsService(this.params);

      const insertRequest: any = {
        text: input.text,
        location: {
          index: input.index,
        },
      };

      if (input.tabId) {
        insertRequest.location.tabId = input.tabId;
      }

      // Insert the text
      await docs.documents.batchUpdate({
        documentId: input.documentId,
        requestBody: {
          requests: [
            {
              insertText: insertRequest,
            },
          ],
        },
      });

      const result = {
        message: 'Text inserted successfully',
        document: {
          id: input.documentId,
          text: input.text,
          index: input.index,
          tabId: input.tabId,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully inserted text into Google Doc: ${input.documentId} at index ${input.index}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error inserting text',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while inserting text',
      };
    }
  }
}

export class GoogleDocsReplaceText extends AgentBaseTool<GoogleDocsParams> {
  name = 'replace_text';
  toolsetKey = GoogleDocsToolsetDefinition.key;

  schema = z.object({
    documentId: z.string().describe('The ID of the Google Doc to replace text in'),
    oldText: z.string().describe('The text to be replaced'),
    newText: z.string().describe('The new text to replace with'),
    matchCase: z
      .boolean()
      .optional()
      .describe('Whether to match case when replacing text')
      .default(false),
    tabIds: z.array(z.string()).optional().describe('The tab IDs to replace the text in'),
  });
  description = 'Replace all instances of matched text in a Google Doc.';

  protected params: GoogleDocsParams;

  constructor(params: GoogleDocsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const docs = createDocsService(this.params);

      const replaceRequest: any = {
        replaceText: input.newText,
        containsText: {
          text: input.oldText,
          matchCase: input.matchCase,
        },
      };

      if (input.tabIds && input.tabIds.length > 0) {
        replaceRequest.tabsCriteria = {
          tabIds: input.tabIds,
        };
      }

      // Replace the text
      await docs.documents.batchUpdate({
        documentId: input.documentId,
        requestBody: {
          requests: [
            {
              replaceAllText: replaceRequest,
            },
          ],
        },
      });

      const result = {
        message: 'Text replaced successfully',
        document: {
          id: input.documentId,
          oldText: input.oldText,
          newText: input.newText,
          matchCase: input.matchCase,
          tabIds: input.tabIds,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully replaced text in Google Doc: ${input.documentId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error replacing text',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while replacing text',
      };
    }
  }
}

export class GoogleDocsInsertTable extends AgentBaseTool<GoogleDocsParams> {
  name = 'insert_table';
  toolsetKey = GoogleDocsToolsetDefinition.key;

  schema = z.object({
    documentId: z.string().describe('The ID of the Google Doc to insert table into'),
    rows: z.number().describe('The number of rows in the table'),
    columns: z.number().describe('The number of columns in the table'),
    index: z
      .number()
      .optional()
      .describe('The index to insert the table at (default: 1)')
      .default(1),
    tabId: z.string().optional().describe('The ID of the tab to insert the table into'),
  });
  description = 'Insert a table into a Google Doc.';

  protected params: GoogleDocsParams;

  constructor(params: GoogleDocsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const docs = createDocsService(this.params);

      const insertRequest: any = {
        rows: input.rows,
        columns: input.columns,
        location: {
          index: input.index,
        },
      };

      if (input.tabId) {
        insertRequest.location.tabId = input.tabId;
      }

      // Insert the table
      await docs.documents.batchUpdate({
        documentId: input.documentId,
        requestBody: {
          requests: [
            {
              insertTable: insertRequest,
            },
          ],
        },
      });

      const result = {
        message: 'Table inserted successfully',
        document: {
          id: input.documentId,
          rows: input.rows,
          columns: input.columns,
          index: input.index,
          tabId: input.tabId,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully inserted ${input.rows}x${input.columns} table into Google Doc: ${input.documentId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error inserting table',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while inserting table',
      };
    }
  }
}

export class GoogleDocsAppendImage extends AgentBaseTool<GoogleDocsParams> {
  name = 'append_image';
  toolsetKey = GoogleDocsToolsetDefinition.key;

  schema = z.object({
    documentId: z.string().describe('The ID of the Google Doc to append image to'),
    imageUri: z.string().describe('The URI of the image to append'),
    appendAtBeginning: z
      .boolean()
      .optional()
      .describe('Whether to append at the beginning instead of the end')
      .default(false),
  });
  description = 'Append an image to the end of a Google Doc.';

  protected params: GoogleDocsParams;

  constructor(params: GoogleDocsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const docs = createDocsService(this.params);

      // Get the document to find the insertion point
      const docResponse = await docs.documents.get({
        documentId: input.documentId,
      });

      const document = docResponse.data;
      const insertIndex = input.appendAtBeginning ? 1 : (document.body?.content?.length ?? 1) - 1;

      // Insert the image
      await docs.documents.batchUpdate({
        documentId: input.documentId,
        requestBody: {
          requests: [
            {
              insertInlineImage: {
                location: {
                  index: insertIndex,
                },
                uri: input.imageUri,
              },
            },
          ],
        },
      });

      const result = {
        message: 'Image appended successfully',
        document: {
          id: input.documentId,
          imageUri: input.imageUri,
          appendAtBeginning: input.appendAtBeginning,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully appended image to Google Doc: ${input.documentId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error appending image',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while appending image',
      };
    }
  }
}

export class GoogleDocsReplaceImage extends AgentBaseTool<GoogleDocsParams> {
  name = 'replace_image';
  toolsetKey = GoogleDocsToolsetDefinition.key;

  schema = z.object({
    documentId: z.string().describe('The ID of the Google Doc containing the image'),
    imageId: z.string().describe('The ID of the image to be replaced'),
    imageUri: z.string().describe('The URI of the new image'),
  });
  description = 'Replace an image in a Google Doc.';

  protected params: GoogleDocsParams;

  constructor(params: GoogleDocsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const docs = createDocsService(this.params);

      // Replace the image
      await docs.documents.batchUpdate({
        documentId: input.documentId,
        requestBody: {
          requests: [
            {
              replaceImage: {
                imageObjectId: input.imageId,
                uri: input.imageUri,
              },
            },
          ],
        },
      });

      const result = {
        message: 'Image replaced successfully',
        document: {
          id: input.documentId,
          imageId: input.imageId,
          imageUri: input.imageUri,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully replaced image in Google Doc: ${input.documentId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error replacing image',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while replacing image',
      };
    }
  }
}

export class GoogleDocsInsertPageBreak extends AgentBaseTool<GoogleDocsParams> {
  name = 'insert_page_break';
  toolsetKey = GoogleDocsToolsetDefinition.key;

  schema = z.object({
    documentId: z.string().describe('The ID of the Google Doc to insert page break into'),
    index: z
      .number()
      .optional()
      .describe('The index to insert the page break at (default: 1)')
      .default(1),
    tabId: z.string().optional().describe('The ID of the tab to insert the page break into'),
  });
  description = 'Insert a page break into a Google Doc.';

  protected params: GoogleDocsParams;

  constructor(params: GoogleDocsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const docs = createDocsService(this.params);

      const insertRequest: any = {
        location: {
          index: input.index,
        },
      };

      if (input.tabId) {
        insertRequest.location.tabId = input.tabId;
      }

      // Insert the page break
      await docs.documents.batchUpdate({
        documentId: input.documentId,
        requestBody: {
          requests: [
            {
              insertPageBreak: insertRequest,
            },
          ],
        },
      });

      const result = {
        message: 'Page break inserted successfully',
        document: {
          id: input.documentId,
          index: input.index,
          tabId: input.tabId,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully inserted page break into Google Doc: ${input.documentId} at index ${input.index}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error inserting page break',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while inserting page break',
      };
    }
  }
}

export class GoogleDocsCreateFromTemplate extends AgentBaseTool<GoogleDocsParams> {
  name = 'create_document_from_template';
  toolsetKey = GoogleDocsToolsetDefinition.key;

  schema = z.object({
    templateId: z.string().describe('The ID of the template document'),
    title: z.string().describe('Title for the new document'),
    folderId: z.string().optional().describe('The ID of the folder to place the new document in'),
    replacements: z
      .record(z.string(), z.string())
      .optional()
      .describe('Key-value pairs for replacing placeholders in the template'),
  });
  description = 'Create a new Google Doc from a template.';

  protected params: GoogleDocsParams;

  constructor(params: GoogleDocsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const drive = createDriveService(this.params);

      // Copy the template document
      const copyResponse = await drive.files.copy({
        fileId: input.templateId,
        requestBody: {
          name: input.title,
        },
      });

      const newDocumentId = copyResponse.data.id;

      if (!newDocumentId) {
        throw new Error('Failed to create document from template - no ID returned');
      }

      // Move to folder if specified
      if (input.folderId) {
        // Get current parents
        const fileResponse = await drive.files.get({
          fileId: newDocumentId,
          fields: 'parents',
        });

        const currentParents = fileResponse.data.parents ?? [];

        // Move to new folder
        await drive.files.update({
          fileId: newDocumentId,
          removeParents: currentParents.join(','),
          addParents: input.folderId,
          fields: 'id,name',
        });
      }

      // Replace placeholders if provided
      if (input.replacements && Object.keys(input.replacements).length > 0) {
        const docs = createDocsService(this.params);

        const replaceRequests = Object.entries(input.replacements).map(
          ([placeholder, replacement]) => ({
            replaceAllText: {
              containsText: {
                text: placeholder,
              },
              replaceText: replacement,
            },
          }),
        );

        await docs.documents.batchUpdate({
          documentId: newDocumentId,
          requestBody: {
            requests: replaceRequests,
          },
        });
      }

      // Get final document info
      const finalResponse = await drive.files.get({
        fileId: newDocumentId,
        fields: 'id,name,webViewLink,createdTime',
      });

      const result = {
        message: 'Document created from template successfully',
        document: {
          id: newDocumentId,
          name: finalResponse.data.name,
          webViewLink: finalResponse.data.webViewLink,
          createdTime: finalResponse.data.createdTime,
          templateId: input.templateId,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully created Google Doc from template: "${finalResponse.data.name}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error creating document from template',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while creating document from template',
      };
    }
  }
}

export class GoogleDocsGetTabContent extends AgentBaseTool<GoogleDocsParams> {
  name = 'get_tab_content';
  toolsetKey = GoogleDocsToolsetDefinition.key;

  schema = z.object({
    documentId: z.string().describe('The ID of the Google Doc to get tab content from'),
    tabIds: z.array(z.string()).describe('The IDs of the tabs to get content for'),
  });
  description = 'Get the content of specific tabs in a Google Doc.';

  protected params: GoogleDocsParams;

  constructor(params: GoogleDocsParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const docs = createDocsService(this.params);

      // Get the document with tabs
      const response = await docs.documents.get({
        documentId: input.documentId,
      });

      const document = response.data;

      if (!document.tabs || document.tabs.length === 0) {
        return {
          status: 'success',
          data: {
            message: 'No tabs found in document',
            documentId: input.documentId,
            tabs: [],
          },
          summary: `No tabs found in Google Doc: ${input.documentId}`,
        };
      }

      // Filter tabs by requested IDs
      const requestedTabs = document.tabs.filter((tab: any) =>
        input.tabIds.includes(tab.tabProperties?.tabId),
      );

      // Extract content from each requested tab
      const tabContents = requestedTabs.map((tab: any) => {
        let content = '';
        if (tab.tabProperties && tab.tabContent?.length) {
          for (const element of tab.tabContent) {
            if (element.paragraph?.elements) {
              for (const paragraphElement of element.paragraph.elements) {
                if (paragraphElement.textRun?.content) {
                  content += paragraphElement.textRun.content;
                }
              }
              content += '\n';
            }
          }
        }

        return {
          tabId: tab.tabProperties?.tabId,
          title: tab.tabProperties?.title,
          content: content.trim(),
        };
      });

      const result = {
        message: `Successfully retrieved tab content for document: ${input.documentId}`,
        documentId: input.documentId,
        tabs: tabContents,
        requestedTabIds: input.tabIds,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved content for ${tabContents.length} tab(s) in Google Doc: ${input.documentId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error getting tab content',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while getting tab content',
      };
    }
  }
}

export class GoogleDocsToolset extends AgentBaseToolset<GoogleDocsParams> {
  toolsetKey = GoogleDocsToolsetDefinition.key;
  tools = [
    GoogleDocsCreateDocument,
    GoogleDocsGetDocument,
    GoogleDocsUpdateDocument,
    GoogleDocsExportDocument,
    GoogleDocsDeleteDocument,
    GoogleDocsSearchDocuments,
    GoogleDocsAppendText,
    GoogleDocsInsertText,
    GoogleDocsReplaceText,
    GoogleDocsInsertTable,
    GoogleDocsAppendImage,
    GoogleDocsReplaceImage,
    GoogleDocsInsertPageBreak,
    GoogleDocsCreateFromTemplate,
    GoogleDocsGetTabContent,
  ] satisfies readonly AgentToolConstructor<GoogleDocsParams>[];
}
