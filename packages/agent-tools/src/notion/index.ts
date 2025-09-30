import { z } from 'zod';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { ToolsetDefinition } from '@refly/openapi-schema';
import { Client } from '@notionhq/client';

export const NotionToolsetDefinition: ToolsetDefinition = {
  key: 'notion',
  domain: 'https://notion.so',
  labelDict: {
    en: 'Notion',
    'zh-CN': 'Notion',
  },
  descriptionDict: {
    en: 'Access and manage pages, databases, and content in Notion. Create, read, update, and organize your workspace.',
    'zh-CN': '访问和管理 Notion 中的页面、数据库和内容。创建、读取、更新和组织您的工作空间。',
  },
  tools: [
    {
      name: 'create_page',
      descriptionDict: {
        en: 'Create a new page in Notion with specified content and properties.',
        'zh-CN': '在 Notion 中创建一个新页面，包含指定的内容和属性。',
      },
    },
    {
      name: 'retrieve_page',
      descriptionDict: {
        en: 'Get detailed information about a specific page including its content and properties.',
        'zh-CN': '获取特定页面的详细信息，包括其内容和属性。',
      },
    },
    {
      name: 'update_page',
      descriptionDict: {
        en: 'Update page properties, content, or metadata.',
        'zh-CN': '更新页面属性、内容或元数据。',
      },
    },
    {
      name: 'search_pages',
      descriptionDict: {
        en: 'Search for pages in Notion workspace using query parameters.',
        'zh-CN': '使用查询参数在 Notion 工作空间中搜索页面。',
      },
    },
    {
      name: 'create_database',
      descriptionDict: {
        en: 'Create a new database with specified schema and properties.',
        'zh-CN': '创建一个新数据库，包含指定的模式和属性。',
      },
    },
    {
      name: 'query_database',
      descriptionDict: {
        en: 'Query a database with filters, sorts, and pagination.',
        'zh-CN': '使用过滤器、排序和分页查询数据库。',
      },
    },
    {
      name: 'retrieve_database',
      descriptionDict: {
        en: 'Get detailed information about a specific database including its schema.',
        'zh-CN': '获取特定数据库的详细信息，包括其模式。',
      },
    },
    {
      name: 'append_block',
      descriptionDict: {
        en: 'Append content blocks to an existing page or block.',
        'zh-CN': '向现有页面或块追加内容块。',
      },
    },
    {
      name: 'retrieve_block',
      descriptionDict: {
        en: 'Get detailed information about a specific block.',
        'zh-CN': '获取特定块的详细信息。',
      },
    },
    {
      name: 'update_block',
      descriptionDict: {
        en: 'Update the content or properties of a block.',
        'zh-CN': '更新块的内容或属性。',
      },
    },
    {
      name: 'list_users',
      descriptionDict: {
        en: 'List all users in the Notion workspace.',
        'zh-CN': '列出 Notion 工作空间中的所有用户。',
      },
    },
    {
      name: 'get_database_properties',
      descriptionDict: {
        en: 'Get the property schema of a database including property IDs and types. Use this before creating database pages to know the correct property IDs.',
        'zh-CN':
          '获取数据库的属性模式，包括属性ID和类型。在创建数据库页面之前使用此工具来了解正确的属性ID。',
      },
    },
    {
      name: 'create_comment',
      descriptionDict: {
        en: 'Create a comment in a page or existing discussion thread.',
        'zh-CN': '在页面或现有讨论线程中创建评论。',
      },
    },
    {
      name: 'create_file_upload',
      descriptionDict: {
        en: 'Create a file upload. Supports single part, multi-part, and external URL modes.',
        'zh-CN': '创建文件上传。支持单部分、多部分和外部URL模式。',
      },
    },
    {
      name: 'send_file_upload',
      descriptionDict: {
        en: 'Send file upload data to Notion.',
        'zh-CN': '向 Notion 发送文件上传数据。',
      },
    },
    {
      name: 'complete_file_upload',
      descriptionDict: {
        en: 'Complete a multi-part file upload after all parts have been sent.',
        'zh-CN': '在发送完所有部分后完成多部分文件上传。',
      },
    },
    {
      name: 'retrieve_file_upload',
      descriptionDict: {
        en: 'Retrieve information about a file upload.',
        'zh-CN': '检索文件上传的信息。',
      },
    },
    {
      name: 'list_file_uploads',
      descriptionDict: {
        en: 'List all file uploads in the workspace.',
        'zh-CN': '列出工作空间中的所有文件上传。',
      },
    },
    {
      name: 'delete_block',
      descriptionDict: {
        en: 'Delete a block (moves it to trash).',
        'zh-CN': '删除块（移到垃圾箱）。',
      },
    },
    {
      name: 'retrieve_user',
      descriptionDict: {
        en: 'Retrieve information about a specific user.',
        'zh-CN': '检索特定用户的信息。',
      },
    },
    {
      name: 'retrieve_page_property_item',
      descriptionDict: {
        en: 'Get a property item from a page.',
        'zh-CN': '从页面获取属性项。',
      },
    },
    {
      name: 'update_database',
      descriptionDict: {
        en: 'Update database title, description, or properties schema.',
        'zh-CN': '更新数据库标题、描述或属性模式。',
      },
    },
    {
      name: 'retrieve_database_content',
      descriptionDict: {
        en: 'Retrieve all content from a database.',
        'zh-CN': '从数据库检索所有内容。',
      },
    },
    {
      name: 'duplicate_page',
      descriptionDict: {
        en: 'Create a new page copied from an existing page block.',
        'zh-CN': '从现有页面块创建新页面的副本。',
      },
    },
    {
      name: 'create_page_from_database',
      descriptionDict: {
        en: 'Create a page from a database template.',
        'zh-CN': '从数据库模板创建页面。',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'oauth',
      provider: 'notion',
      scope: ['read_content', 'update_content', 'insert_content'],
    },
  ],
  configItems: [],
};

// OAuth2 parameters will be automatically injected
export interface NotionParams {
  accessToken: string;
}

// Helper function to create authenticated Notion client
function createNotionClient(params: NotionParams): Client {
  return new Client({
    auth: params.accessToken,
    notionVersion: '2025-09-03',
  });
}

export class NotionCreatePage extends AgentBaseTool<NotionParams> {
  name = 'create_page';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    parentId: z
      .string()
      .describe(
        'The ID of the parent page or database. For database pages, this should be the database ID.',
      ),
    title: z.string().describe('Title of the new page'),
    content: z.string().optional().describe('Page content in Markdown format'),
    properties: z
      .record(z.string(), z.any())
      .optional()
      .describe(
        'Page properties as JSON object. For database pages, property keys must be the exact property IDs from the database schema (not property names). For regular pages, use property names. Example: {"abc123": {"select": {"name": "Done"}}, "def456": {"select": {"name": "High"}}} where "abc123" and "def456" are actual property IDs from your database.',
      ),
  });

  description = 'Create a new page in Notion with specified content and properties.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      // First, try to determine if parentId is a database or page
      let parentType = 'page'; // default assumption
      let parentData: any = {
        page_id: input.parentId,
      };

      try {
        // Try to retrieve as database first
        await notion.databases.retrieve({
          database_id: input.parentId,
        });
        parentType = 'database';
        parentData = {
          database_id: input.parentId,
        };
      } catch {
        // If database retrieval fails, assume it's a page
        try {
          await notion.pages.retrieve({
            page_id: input.parentId,
          });
          parentType = 'page';
          parentData = {
            page_id: input.parentId,
          };
        } catch {
          return {
            status: 'error',
            error: 'Invalid parent ID',
            summary: `The provided parentId "${input.parentId}" is not a valid page or database ID. Please check the ID and try again.`,
          };
        }
      }

      const pageData: any = {
        parent: parentData,
        properties: {
          title: {
            title: [
              {
                text: {
                  content: input.title,
                },
              },
            ],
          },
        },
      };

      // Handle properties based on parent type
      if (input.properties && Object.keys(input.properties).length > 0) {
        if (parentType === 'database') {
          // For database pages, properties keys should be property IDs
          // We'll validate that they look like UUIDs or other valid property IDs
          const invalidKeys = Object.keys(input.properties).filter((key) => {
            // Property IDs in Notion are typically UUID-like strings or specific formats
            // For now, we'll allow any non-empty string but provide guidance
            return !key || key.trim() === '';
          });

          if (invalidKeys.length > 0) {
            return {
              status: 'error',
              error: 'Invalid property keys',
              summary:
                'Property keys cannot be empty. For database pages, use the exact property IDs from your database schema.',
            };
          }
        } else {
          // For regular pages, property names should be valid identifiers
          const invalidKeys = Object.keys(input.properties).filter((key) => {
            return !/^[a-zA-Z0-9_]+$/.test(key);
          });

          if (invalidKeys.length > 0) {
            return {
              status: 'error',
              error: 'Invalid property names',
              summary: `Property names must contain only English letters, numbers, and underscores. Invalid names: ${invalidKeys.join(', ')}. Please use valid identifiers like 'Status', 'Priority', 'DueDate' instead of Chinese characters.`,
            };
          }
        }

        // Add properties
        for (const [key, value] of Object.entries(input.properties)) {
          // Skip title property as it's already handled
          if (key !== 'title') {
            pageData.properties[key] = value;
          }
        }
      }

      // Add content blocks if provided
      if (input.content) {
        const blocks = this.markdownToBlocks(input.content);
        if (blocks.length > 0) {
          pageData.children = blocks;
        }
      }

      const response = await notion.pages.create(pageData);

      const result = {
        message: 'Page created successfully',
        page: {
          id: response.id,
          title: input.title,
          url: (response as any).url,
          created_time: (response as any).created_time,
          parent_type: parentType,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully created ${parentType} page: ${input.title}`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred while creating page';

      // Provide more specific guidance for common errors
      if (errorMessage.includes('Invalid property identifier')) {
        return {
          status: 'error',
          error: 'Invalid property identifier',
          summary: `One or more property keys are invalid. For database pages, you must use the exact property IDs from the database schema, not property names. Use the 'retrieve_database' tool first to get the correct property IDs.`,
        };
      }

      if (errorMessage.includes('property is not found')) {
        return {
          status: 'error',
          error: 'Property not found',
          summary: `A property specified in your request doesn't exist in the database. Please check the database schema and use the correct property IDs.`,
        };
      }

      return {
        status: 'error',
        error: 'Error creating page',
        summary: errorMessage,
      };
    }
  }

  private markdownToBlocks(markdown: string): any[] {
    // Simple markdown to Notion blocks conversion
    // This is a basic implementation - in production you'd want more comprehensive parsing
    const lines = markdown.split('\n');
    const blocks: any[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('# ')) {
        blocks.push({
          type: 'heading_1',
          heading_1: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmed.substring(2),
                },
              },
            ],
          },
        });
      } else if (trimmed.startsWith('## ')) {
        blocks.push({
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmed.substring(3),
                },
              },
            ],
          },
        });
      } else if (trimmed.startsWith('- ')) {
        blocks.push({
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmed.substring(2),
                },
              },
            ],
          },
        });
      } else {
        blocks.push({
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmed,
                },
              },
            ],
          },
        });
      }
    }

    return blocks;
  }
}

export class NotionRetrievePage extends AgentBaseTool<NotionParams> {
  name = 'retrieve_page';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    pageId: z.string().describe('The ID of the page to retrieve'),
  });

  description =
    'Get detailed information about a specific page including its content and properties.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const response = await notion.pages.retrieve({
        page_id: input.pageId,
      });

      const result = {
        message: 'Page retrieved successfully',
        page: {
          id: response.id,
          title: this.extractTitle(response),
          url: (response as any).url,
          created_time: (response as any).created_time,
          last_edited_time: (response as any).last_edited_time,
          properties: (response as any).properties,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved page: ${result.page.title}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error retrieving page',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while retrieving page',
      };
    }
  }

  private extractTitle(page: any): string {
    const titleProperty = Object.values(page.properties).find(
      (prop: any) => prop.type === 'title',
    ) as any;

    if (titleProperty?.title?.[0]?.plain_text) {
      return titleProperty.title[0].plain_text;
    }

    return 'Untitled';
  }
}

export class NotionUpdatePage extends AgentBaseTool<NotionParams> {
  name = 'update_page';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    pageId: z.string().describe('The ID of the page to update'),
    title: z.string().optional().describe('New title for the page'),
    properties: z.record(z.string(), z.any()).optional().describe('Properties to update'),
    archived: z.boolean().optional().describe('Whether to archive the page'),
  });

  description = 'Update page properties, content, or metadata.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const updateData: any = {};

      if (input.title) {
        updateData.properties = {
          title: {
            title: [
              {
                text: {
                  content: input.title,
                },
              },
            ],
          },
        };
      }

      if (input.properties) {
        updateData.properties = {
          ...updateData.properties,
          ...input.properties,
        };
      }

      if (input.archived !== undefined) {
        updateData.archived = input.archived;
      }

      const response = await notion.pages.update({
        page_id: input.pageId,
        ...updateData,
      });

      const result = {
        message: 'Page updated successfully',
        page: {
          id: response.id,
          title: this.extractTitle(response),
          last_edited_time: (response as any).last_edited_time,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully updated page: ${result.page.title}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error updating page',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while updating page',
      };
    }
  }

  private extractTitle(page: any): string {
    const titleProperty = Object.values(page.properties).find(
      (prop: any) => prop.type === 'title',
    ) as any;

    if (titleProperty?.title?.[0]?.plain_text) {
      return titleProperty.title[0].plain_text;
    }

    return 'Untitled';
  }
}

export class NotionSearchPages extends AgentBaseTool<NotionParams> {
  name = 'search_pages';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    query: z.string().optional().describe('Search query string'),
    filter: z
      .object({
        property: z
          .enum(['object'])
          .optional()
          .describe('Property to filter by (only "object" is supported)'),
        value: z.string().optional().describe('Value to filter by'),
      })
      .optional()
      .describe('Filter criteria (only supports filtering by object type)'),
    sort: z
      .object({
        direction: z.enum(['ascending', 'descending']).optional().describe('Sort direction'),
        timestamp: z.enum(['last_edited_time']).optional().describe('Timestamp to sort by'),
      })
      .optional()
      .describe('Sort criteria'),
    pageSize: z.number().optional().describe('Maximum number of results to return (default: 10)'),
  });

  description = 'Search for pages in Notion workspace using query parameters.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const searchParams: any = {
        page_size: input.pageSize ?? 10,
      };

      if (input.query) {
        searchParams.query = input.query;
      }

      if (input.filter?.property && input.filter?.value) {
        searchParams.filter = {
          property: input.filter.property,
          value: input.filter.value,
        };
      }

      if (input.sort?.direction && input.sort?.timestamp) {
        searchParams.sort = {
          direction: input.sort.direction,
          timestamp: input.sort.timestamp,
        };
      } else if (input.sort) {
        // 如果只提供了部分排序参数，使用默认值
        searchParams.sort = {
          direction: input.sort.direction || 'descending',
          timestamp: input.sort.timestamp || 'last_edited_time',
        };
      }

      const response = await notion.search(searchParams);

      const pages = response.results.map((page: any) => ({
        id: page.id,
        title: this.extractTitle(page),
        url: page.url,
        object: page.object,
        created_time: page.created_time,
        last_edited_time: page.last_edited_time,
      }));

      const result = {
        message: `Found ${pages.length} pages`,
        count: pages.length,
        pages,
        has_more: response.has_more,
        next_cursor: response.next_cursor,
      };

      return {
        status: 'success',
        data: result,
        summary: `Search completed successfully. Found ${pages.length} pages.`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error searching pages',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while searching pages',
      };
    }
  }

  private extractTitle(page: any): string {
    if (page.object === 'database') {
      const titleProperty = page.title?.[0]?.plain_text;
      return titleProperty || 'Untitled Database';
    }

    const titleProperty = Object.values(page.properties || {}).find(
      (prop: any) => prop.type === 'title',
    ) as any;

    if (titleProperty?.title?.[0]?.plain_text) {
      return titleProperty.title[0].plain_text;
    }

    return 'Untitled';
  }
}

export class NotionCreateDatabase extends AgentBaseTool<NotionParams> {
  name = 'create_database';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    parentId: z.string().describe('The ID of the parent page'),
    title: z.string().describe('Title of the new database'),
    properties: z.record(z.string(), z.any()).describe('Database properties schema as JSON object'),
  });

  description = 'Create a new database with specified schema and properties.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const databaseData: any = {
        parent: {
          type: 'page_id',
          page_id: input.parentId,
        },
        title: [
          {
            type: 'text',
            text: {
              content: input.title,
            },
          },
        ],
        properties: input.properties,
      };

      const response = await notion.databases.create(databaseData);

      const result = {
        message: 'Database created successfully',
        database: {
          id: response.id,
          title: input.title,
          url: (response as any).url,
          created_time: (response as any).created_time,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully created database: ${input.title}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error creating database',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while creating database',
      };
    }
  }
}

export class NotionQueryDatabase extends AgentBaseTool<NotionParams> {
  name = 'query_database';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    databaseId: z.string().describe('The ID of the database to query'),
    filter: z.record(z.string(), z.any()).optional().describe('Filter criteria as JSON object'),
    sorts: z
      .array(
        z.object({
          property: z.string().describe('Property name to sort by'),
          direction: z.enum(['ascending', 'descending']).describe('Sort direction'),
        }),
      )
      .optional()
      .describe('Sort criteria as array of objects'),
    pageSize: z.number().optional().describe('Maximum number of results to return (default: 10)'),
    startCursor: z.string().optional().describe('Cursor for pagination'),
  });

  description = 'Query a database with filters, sorts, and pagination.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const queryParams: any = {
        database_id: input.databaseId,
        page_size: input.pageSize ?? 10,
      };

      if (input.filter) {
        queryParams.filter = input.filter;
      }

      if (input.sorts) {
        queryParams.sorts = input.sorts;
      }

      if (input.startCursor) {
        queryParams.start_cursor = input.startCursor;
      }

      const response = await (notion.databases as any).query(queryParams);

      const results = response.results.map((item: any) => ({
        id: item.id,
        title: this.extractTitle(item),
        url: item.url,
        created_time: item.created_time,
        last_edited_time: item.last_edited_time,
        properties: item.properties,
      }));

      const result = {
        message: `Found ${results.length} items`,
        count: results.length,
        items: results,
        has_more: response.has_more,
        next_cursor: response.next_cursor,
      };

      return {
        status: 'success',
        data: result,
        summary: `Query completed successfully. Found ${results.length} items.`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error querying database',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while querying database',
      };
    }
  }

  private extractTitle(item: any): string {
    const titleProperty = Object.values(item.properties).find(
      (prop: any) => prop.type === 'title',
    ) as any;

    if (titleProperty?.title?.[0]?.plain_text) {
      return titleProperty.title[0].plain_text;
    }

    return 'Untitled';
  }
}

export class NotionRetrieveDatabase extends AgentBaseTool<NotionParams> {
  name = 'retrieve_database';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    databaseId: z.string().describe('The ID of the database to retrieve'),
  });

  description = 'Get detailed information about a specific database including its schema.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const response = await notion.databases.retrieve({
        database_id: input.databaseId,
      });

      const result = {
        message: 'Database retrieved successfully',
        database: {
          id: response.id,
          title: (response as any).title?.[0]?.plain_text || 'Untitled Database',
          url: (response as any).url,
          created_time: (response as any).created_time,
          last_edited_time: (response as any).last_edited_time,
          properties: (response as any).properties,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved database: ${result.database.title}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error retrieving database',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while retrieving database',
      };
    }
  }
}

export class NotionAppendBlock extends AgentBaseTool<NotionParams> {
  name = 'append_block';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    parentId: z.string().describe('The ID of the parent page or block'),
    content: z.string().describe('Content to append in Markdown format'),
  });

  description = 'Append content blocks to an existing page or block.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const blocks = this.markdownToBlocks(input.content);

      if (blocks.length === 0) {
        return {
          status: 'success',
          data: { message: 'No content to append' },
          summary: 'No content to append',
        };
      }

      await notion.blocks.children.append({
        block_id: input.parentId,
        children: blocks,
      });

      const result = {
        message: 'Blocks appended successfully',
        block_count: blocks.length,
        parent_id: input.parentId,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully appended ${blocks.length} blocks`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error appending blocks',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while appending blocks',
      };
    }
  }

  private markdownToBlocks(markdown: string): any[] {
    const lines = markdown.split('\n');
    const blocks: any[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('# ')) {
        blocks.push({
          type: 'heading_1',
          heading_1: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmed.substring(2),
                },
              },
            ],
          },
        });
      } else if (trimmed.startsWith('## ')) {
        blocks.push({
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmed.substring(3),
                },
              },
            ],
          },
        });
      } else if (trimmed.startsWith('- ')) {
        blocks.push({
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmed.substring(2),
                },
              },
            ],
          },
        });
      } else {
        blocks.push({
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmed,
                },
              },
            ],
          },
        });
      }
    }

    return blocks;
  }
}

export class NotionRetrieveBlock extends AgentBaseTool<NotionParams> {
  name = 'retrieve_block';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    blockId: z.string().describe('The ID of the block to retrieve'),
  });

  description = 'Get detailed information about a specific block.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const response = await notion.blocks.retrieve({
        block_id: input.blockId,
      });

      const result = {
        message: 'Block retrieved successfully',
        block: {
          id: response.id,
          type: (response as any).type,
          has_children: (response as any).has_children,
          created_time: (response as any).created_time,
          last_edited_time: (response as any).last_edited_time,
          [(response as any).type]: (response as any)[(response as any).type],
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved ${(response as any).type} block`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error retrieving block',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while retrieving block',
      };
    }
  }
}

export class NotionUpdateBlock extends AgentBaseTool<NotionParams> {
  name = 'update_block';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    blockId: z.string().describe('The ID of the block to update'),
    content: z.string().describe('New content for the block'),
    type: z.string().optional().describe('Block type (paragraph, heading_1, etc.)'),
  });

  description = 'Update the content or properties of a block.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const blockType = input.type || 'paragraph';

      const updateData: any = {
        [blockType]: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: input.content,
              },
            },
          ],
        },
      };

      const response = await notion.blocks.update({
        block_id: input.blockId,
        ...updateData,
      });

      const result = {
        message: 'Block updated successfully',
        block: {
          id: response.id,
          type: (response as any).type,
          last_edited_time: (response as any).last_edited_time,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully updated ${(response as any).type} block`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error updating block',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while updating block',
      };
    }
  }
}

export class NotionListUsers extends AgentBaseTool<NotionParams> {
  name = 'list_users';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({});

  description = 'List all users in the Notion workspace.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(_input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const response = await notion.users.list({});

      const users = response.results.map((user: any) => ({
        id: user.id,
        name: user.name,
        type: user.type,
        avatar_url: user.avatar_url,
      }));

      const result = {
        message: `Found ${users.length} users`,
        count: users.length,
        users,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved ${users.length} users from workspace`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error listing users',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while listing users',
      };
    }
  }
}

export class NotionGetDatabaseProperties extends AgentBaseTool<NotionParams> {
  name = 'get_database_properties';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    databaseId: z.string().describe('The ID of the database to get properties for'),
  });

  description =
    'Get the property schema of a database including property IDs and types. Use this before creating database pages to know the correct property IDs.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const response = await notion.databases.retrieve({
        database_id: input.databaseId,
      });

      const properties = Object.entries((response as any).properties || {}).map(
        ([id, prop]: [string, any]) => ({
          id,
          name: prop.name,
          type: prop.type,
          description: `Type: ${prop.type}. Use property ID "${id}" when creating pages in this database.`,
        }),
      );

      const result = {
        message: `Found ${properties.length} properties in database`,
        count: properties.length,
        database_title: (response as any).title?.[0]?.plain_text || 'Untitled Database',
        properties,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved ${properties.length} properties from database. Use the property IDs shown above when creating pages.`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error retrieving database properties',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while retrieving database properties',
      };
    }
  }
}

export class NotionCreateComment extends AgentBaseTool<NotionParams> {
  name = 'create_comment';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    pageId: z.string().optional().describe('The ID of the page to comment on'),
    discussionId: z.string().optional().describe('The ID of the discussion thread to comment on'),
    comment: z.string().describe('The comment text'),
  });

  description = 'Create a comment in a page or existing discussion thread.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      // Validate that either pageId or discussionId is provided, but not both
      if ((input.pageId && input.discussionId) || (!input.pageId && !input.discussionId)) {
        return {
          status: 'error',
          error: 'Invalid parameters',
          summary:
            'Provide either a page ID or a discussion thread ID to create the comment under.',
        };
      }

      const notion = createNotionClient(this.params);

      const commentData: any = {
        rich_text: [
          {
            text: {
              content: input.comment,
            },
          },
        ],
      };

      if (input.pageId) {
        commentData.parent = {
          page_id: input.pageId,
        };
      } else if (input.discussionId) {
        commentData.discussion_id = input.discussionId;
      }

      const response = await (notion as any).comments.create(commentData);

      const result = {
        message: 'Comment created successfully',
        comment: {
          id: response.id,
          created_time: response.created_time,
          content: input.comment,
          parent_type: input.pageId ? 'page' : 'discussion',
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully created comment (ID: ${response.id})`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error creating comment',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while creating comment',
      };
    }
  }
}

export class NotionCreateFileUpload extends AgentBaseTool<NotionParams> {
  name = 'create_file_upload';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    mode: z
      .enum(['single_part', 'multi_part', 'external_url'])
      .optional()
      .describe(
        'How the file is being sent. Use multi_part for files larger than 20MB. Use external_url for files temporarily hosted elsewhere.',
      ),
    filename: z
      .string()
      .optional()
      .describe(
        'Name of the file to be created. Required when mode is multi_part or external_url. Must include an extension.',
      ),
    contentType: z
      .string()
      .optional()
      .describe(
        'MIME type of the file to be created. Recommended when sending the file in multiple parts.',
      ),
    numberOfParts: z
      .number()
      .optional()
      .describe(
        'When mode is multi_part, the number of parts you are uploading. Must be between 1 and 1,000.',
      ),
    externalUrl: z
      .string()
      .optional()
      .describe(
        'When mode is external_url, provide the HTTPS URL of a publicly accessible file to import.',
      ),
  });

  description = 'Create a file upload. Supports single part, multi-part, and external URL modes.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const fileUploadData: any = {};

      if (input.mode) {
        fileUploadData.mode = input.mode;
      }

      if (input.filename) {
        fileUploadData.filename = input.filename;
      }

      if (input.contentType) {
        fileUploadData.content_type = input.contentType;
      }

      if (input.numberOfParts) {
        fileUploadData.number_of_parts = input.numberOfParts;
      }

      if (input.externalUrl) {
        fileUploadData.external_url = input.externalUrl;
      }

      const response = await (notion as any).files.createFileUpload(fileUploadData);

      const result = {
        message: 'File upload created successfully',
        file_upload: {
          id: response.id,
          status: response.status,
          mode: response.mode,
          filename: response.filename,
          content_type: response.content_type,
          number_of_parts: response.number_of_parts,
          upload_urls: response.upload_urls,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully created file upload with ID ${response.id}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error creating file upload',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while creating file upload',
      };
    }
  }
}

export class NotionSendFileUpload extends AgentBaseTool<NotionParams> {
  name = 'send_file_upload';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    fileUploadId: z.string().describe('The ID of the file upload'),
    fileData: z.string().describe('The file data as base64 encoded string'),
    filename: z.string().describe('Name of the file'),
    contentType: z.string().optional().describe('MIME type of the file'),
  });

  description = 'Send file upload data to Notion.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      // Convert base64 to buffer
      const fileBuffer = Buffer.from(input.fileData, 'base64');

      const fileBlob = new Blob([fileBuffer], {
        type: input.contentType || 'application/octet-stream',
      });

      const response = await (notion as any).files.sendFileUpload({
        file_upload_id: input.fileUploadId,
        file: {
          data: fileBlob,
          filename: input.filename,
        },
      });

      const result = {
        message: 'File upload sent successfully',
        file_upload: {
          id: response.id,
          status: response.status,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully sent file upload with ID ${response.id}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error sending file upload',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while sending file upload',
      };
    }
  }
}

export class NotionCompleteFileUpload extends AgentBaseTool<NotionParams> {
  name = 'complete_file_upload';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    fileUploadId: z.string().describe('The ID of the file upload to complete'),
  });

  description = 'Complete a multi-part file upload after all parts have been sent.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const response = await (notion as any).files.completeFileUpload({
        file_upload_id: input.fileUploadId,
      });

      const result = {
        message: 'File upload completed successfully',
        file_upload: {
          id: response.id,
          status: response.status,
          file_url: response.file_url,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully completed file upload with ID ${input.fileUploadId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error completing file upload',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while completing file upload',
      };
    }
  }
}

export class NotionRetrieveFileUpload extends AgentBaseTool<NotionParams> {
  name = 'retrieve_file_upload';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    fileUploadId: z.string().describe('The ID of the file upload to retrieve'),
  });

  description = 'Retrieve information about a file upload.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const response = await (notion as any).files.retrieveFileUpload({
        file_upload_id: input.fileUploadId,
      });

      const result = {
        message: 'File upload retrieved successfully',
        file_upload: {
          id: response.id,
          status: response.status,
          mode: response.mode,
          filename: response.filename,
          content_type: response.content_type,
          file_url: response.file_url,
          created_time: response.created_time,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved file upload with ID ${input.fileUploadId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error retrieving file upload',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while retrieving file upload',
      };
    }
  }
}

export class NotionListFileUploads extends AgentBaseTool<NotionParams> {
  name = 'list_file_uploads';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({});

  description = 'List all file uploads in the workspace.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(_input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const fileUploads: any[] = [];
      let hasMore = true;
      let startCursor: string | undefined;

      while (hasMore) {
        const response = await (notion as any).files.listFileUploads({
          start_cursor: startCursor,
        });

        fileUploads.push(...response.results);
        hasMore = response.has_more;
        startCursor = response.next_cursor;
      }

      const result = {
        message: `Found ${fileUploads.length} file uploads`,
        count: fileUploads.length,
        file_uploads: fileUploads.map((upload) => ({
          id: upload.id,
          status: upload.status,
          mode: upload.mode,
          filename: upload.filename,
          content_type: upload.content_type,
          created_time: upload.created_time,
        })),
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved ${fileUploads.length} file uploads`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error listing file uploads',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while listing file uploads',
      };
    }
  }
}

export class NotionDeleteBlock extends AgentBaseTool<NotionParams> {
  name = 'delete_block';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    blockId: z.string().describe('The ID of the block to delete'),
  });

  description = 'Delete a block (moves it to trash).';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      await notion.blocks.delete({
        block_id: input.blockId,
      });

      const result = {
        message: 'Block deleted successfully',
        block_id: input.blockId,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully deleted block with ID ${input.blockId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error deleting block',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while deleting block',
      };
    }
  }
}

export class NotionRetrieveUser extends AgentBaseTool<NotionParams> {
  name = 'retrieve_user';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    userId: z.string().describe('The ID of the user to retrieve'),
  });

  description = 'Retrieve information about a specific user.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const response = await notion.users.retrieve({
        user_id: input.userId,
      });

      const result = {
        message: 'User retrieved successfully',
        user: {
          id: response.id,
          name: response.name,
          type: response.type,
          avatar_url: response.avatar_url,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved user with ID ${input.userId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error retrieving user',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while retrieving user',
      };
    }
  }
}

export class NotionRetrievePagePropertyItem extends AgentBaseTool<NotionParams> {
  name = 'retrieve_page_property_item';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    pageId: z.string().describe('The ID of the page'),
    propertyId: z.string().describe('The ID of the property to retrieve'),
  });

  description = 'Get a property item from a page.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const response = await (notion as any).pages.properties.retrieve({
        page_id: input.pageId,
        property_id: input.propertyId,
      });

      const result = {
        message: 'Page property item retrieved successfully',
        property: {
          id: response.id,
          type: response.type,
          [response.type]: response[response.type],
        },
      };

      return {
        status: 'success',
        data: result,
        summary: 'Successfully retrieved page property item',
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error retrieving page property item',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while retrieving page property item',
      };
    }
  }
}

export class NotionUpdateDatabase extends AgentBaseTool<NotionParams> {
  name = 'update_database';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    databaseId: z.string().describe('The ID of the database to update'),
    title: z.string().optional().describe('New title for the database'),
    description: z.string().optional().describe('New description for the database'),
    properties: z.record(z.string(), z.any()).optional().describe('Properties schema to update'),
  });

  description = 'Update database title, description, or properties schema.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const updateData: any = {};

      if (input.title) {
        updateData.title = [
          {
            type: 'text',
            text: {
              content: input.title,
            },
          },
        ];
      }

      if (input.description) {
        updateData.description = [
          {
            type: 'text',
            text: {
              content: input.description,
            },
          },
        ];
      }

      if (input.properties) {
        updateData.properties = input.properties;
      }

      const response = await notion.databases.update({
        database_id: input.databaseId,
        ...updateData,
      });

      const result = {
        message: 'Database updated successfully',
        database: {
          id: response.id,
          title: (response as any).title?.[0]?.plain_text || 'Untitled Database',
          description: (response as any).description?.[0]?.plain_text,
          last_edited_time: (response as any).last_edited_time,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully updated database: ${result.database.title}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error updating database',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while updating database',
      };
    }
  }
}

export class NotionRetrieveDatabaseContent extends AgentBaseTool<NotionParams> {
  name = 'retrieve_database_content';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    databaseId: z.string().describe('The ID of the database to retrieve content from'),
    pageSize: z.number().optional().describe('Maximum number of results to return (default: 10)'),
    startCursor: z.string().optional().describe('Cursor for pagination'),
  });

  description = 'Retrieve all content from a database.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const queryParams: any = {
        database_id: input.databaseId,
        page_size: input.pageSize ?? 10,
      };

      if (input.startCursor) {
        queryParams.start_cursor = input.startCursor;
      }

      const response = await (notion.databases as any).query(queryParams);

      const items = response.results.map((item: any) => ({
        id: item.id,
        title: this.extractTitle(item),
        url: item.url,
        created_time: item.created_time,
        last_edited_time: item.last_edited_time,
        properties: item.properties,
      }));

      const result = {
        message: `Found ${items.length} items`,
        count: items.length,
        items,
        has_more: response.has_more,
        next_cursor: response.next_cursor,
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved ${items.length} items from database`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error retrieving database content',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while retrieving database content',
      };
    }
  }

  private extractTitle(item: any): string {
    const titleProperty = Object.values(item.properties).find(
      (prop: any) => prop.type === 'title',
    ) as any;

    if (titleProperty?.title?.[0]?.plain_text) {
      return titleProperty.title[0].plain_text;
    }

    return 'Untitled';
  }
}

export class NotionDuplicatePage extends AgentBaseTool<NotionParams> {
  name = 'duplicate_page';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    pageId: z.string().describe('The ID of the page to duplicate'),
    title: z.string().optional().describe('New title for the duplicated page'),
    parentId: z.string().describe('The ID of the parent page for the new page'),
  });

  description = 'Create a new page copied from an existing page block.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      // First, retrieve the original page
      const originalPage = await notion.pages.retrieve({
        page_id: input.pageId,
      });

      // Get the page content (blocks)
      const blocksResponse = await notion.blocks.children.list({
        block_id: input.pageId,
      });

      // Prepare the new page data
      const pageData: any = {
        parent: {
          page_id: input.parentId,
        },
        properties: {
          title: {
            title: [
              {
                text: {
                  content: input.title || this.extractTitle(originalPage),
                },
              },
            ],
          },
        },
      };

      // Copy cover and icon if they exist
      if ((originalPage as any).cover) {
        pageData.cover = (originalPage as any).cover;
      }

      if ((originalPage as any).icon) {
        pageData.icon = (originalPage as any).icon;
      }

      // Copy content blocks
      if (blocksResponse.results.length > 0) {
        pageData.children = blocksResponse.results.map((block: any) => ({
          type: block.type,
          [block.type]: block[block.type],
        }));
      }

      const response = await notion.pages.create(pageData);

      const result = {
        message: 'Page duplicated successfully',
        page: {
          id: response.id,
          title: input.title || this.extractTitle(originalPage),
          url: (response as any).url,
          created_time: (response as any).created_time,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully duplicated page: ${result.page.title}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error duplicating page',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while duplicating page',
      };
    }
  }

  private extractTitle(page: any): string {
    const titleProperty = Object.values(page.properties).find(
      (prop: any) => prop.type === 'title',
    ) as any;

    if (titleProperty?.title?.[0]?.plain_text) {
      return titleProperty.title[0].plain_text;
    }

    return 'Untitled';
  }
}

export class NotionCreatePageFromDatabase extends AgentBaseTool<NotionParams> {
  name = 'create_page_from_database';
  toolsetKey = NotionToolsetDefinition.key;

  schema = z.object({
    parentDatabaseId: z.string().describe('The ID of the parent database'),
    title: z.string().optional().describe('Title of the new page'),
    properties: z.record(z.string(), z.any()).optional().describe('Page properties'),
    icon: z.string().optional().describe('Icon emoji for the page'),
    cover: z.string().optional().describe('Cover URL for the page'),
    content: z.string().optional().describe('Page content in Markdown format'),
  });

  description = 'Create a page from a database template.';

  protected params: NotionParams;

  constructor(params: NotionParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const notion = createNotionClient(this.params);

      const pageData: any = {
        parent: {
          database_id: input.parentDatabaseId,
        },
        properties: {},
      };

      // Set title
      if (input.title) {
        pageData.properties.title = {
          title: [
            {
              text: {
                content: input.title,
              },
            },
          ],
        };
      }

      // Set other properties
      if (input.properties) {
        for (const [key, value] of Object.entries(input.properties)) {
          if (key !== 'title') {
            pageData.properties[key] = value;
          }
        }
      }

      // Set icon
      if (input.icon) {
        pageData.icon = {
          type: 'emoji',
          emoji: input.icon,
        };
      }

      // Set cover
      if (input.cover) {
        pageData.cover = {
          type: 'external',
          external: {
            url: input.cover,
          },
        };
      }

      // Add content blocks if provided
      if (input.content) {
        const blocks = this.markdownToBlocks(input.content);
        if (blocks.length > 0) {
          pageData.children = blocks;
        }
      }

      const response = await notion.pages.create(pageData);

      const result = {
        message: 'Page created from database successfully',
        page: {
          id: response.id,
          title: input.title || 'Untitled',
          url: (response as any).url,
          created_time: (response as any).created_time,
        },
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully created page from database: ${result.page.title}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error creating page from database',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while creating page from database',
      };
    }
  }

  private markdownToBlocks(markdown: string): any[] {
    const lines = markdown.split('\n');
    const blocks: any[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('# ')) {
        blocks.push({
          type: 'heading_1',
          heading_1: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmed.substring(2),
                },
              },
            ],
          },
        });
      } else if (trimmed.startsWith('## ')) {
        blocks.push({
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmed.substring(3),
                },
              },
            ],
          },
        });
      } else if (trimmed.startsWith('- ')) {
        blocks.push({
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmed.substring(2),
                },
              },
            ],
          },
        });
      } else {
        blocks.push({
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: trimmed,
                },
              },
            ],
          },
        });
      }
    }

    return blocks;
  }
}

export class NotionToolset extends AgentBaseToolset<NotionParams> {
  toolsetKey = NotionToolsetDefinition.key;
  tools = [
    NotionCreatePage,
    NotionRetrievePage,
    NotionUpdatePage,
    NotionSearchPages,
    NotionCreateDatabase,
    NotionQueryDatabase,
    NotionRetrieveDatabase,
    NotionAppendBlock,
    NotionRetrieveBlock,
    NotionUpdateBlock,
    NotionListUsers,
    NotionGetDatabaseProperties,
    NotionCreateComment,
    NotionCreateFileUpload,
    NotionSendFileUpload,
    NotionCompleteFileUpload,
    NotionRetrieveFileUpload,
    NotionListFileUploads,
    NotionDeleteBlock,
    NotionRetrieveUser,
    NotionRetrievePagePropertyItem,
    NotionUpdateDatabase,
    NotionRetrieveDatabaseContent,
    NotionDuplicatePage,
    NotionCreatePageFromDatabase,
  ] satisfies readonly AgentToolConstructor<NotionParams>[];
}
