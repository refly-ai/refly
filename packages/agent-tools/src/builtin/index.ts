import { z } from 'zod/v3';
import { AgentBaseTool, AgentBaseToolset } from '../base';
import { BuiltinExecuteCode } from './sandbox';
import {
  extractFileId,
  extractAllFileIds,
  hasFileIds,
  replaceAllMarkdownFileIds,
  replaceAllHtmlFileIds,
} from '@refly/utils';

import type { RunnableConfig } from '@langchain/core/runnables';
import type { ToolsetDefinition, User } from '@refly/openapi-schema';
import type { AgentToolConstructor, ToolCallResult } from '../base';
import type { ReflyService } from './interface';

export const BuiltinToolsetDefinition: ToolsetDefinition = {
  key: 'builtin',
  domain: 'https://refly.ai',
  labelDict: {
    en: 'Builtin',
    'zh-CN': '内建',
  },
  descriptionDict: {
    en: 'Builtin tools that provide access to Refly internal services.',
    'zh-CN': '内建工具，提供对 Refly 内部服务的访问。',
  },
  tools: [
    {
      name: 'web_search',
      descriptionDict: {
        en: 'Search the web for current information and news.',
        'zh-CN': '在网络上搜索最新信息和新闻。',
      },
    },
    {
      name: 'read_file',
      descriptionDict: {
        en: 'Read content from a file.',
        'zh-CN': '读取文件内容。',
      },
      modelOnly: true,
    },
    {
      name: 'list_files',
      descriptionDict: {
        en: 'List all files in the current canvas.',
        'zh-CN': '列出当前画布中的所有文件。',
      },
      modelOnly: true,
    },
    {
      name: 'read_agent_result',
      descriptionDict: {
        en: 'Read full content of a previous agent result.',
        'zh-CN': '读取前置节点的完整执行结果。',
      },
      modelOnly: true,
    },
    {
      name: 'read_tool_result',
      descriptionDict: {
        en: 'Read detailed input/output of a specific tool call.',
        'zh-CN': '读取特定工具调用的详细输入输出。',
      },
      modelOnly: true,
    },
    {
      name: 'generate_doc',
      descriptionDict: {
        en: 'Generate a new document based on a title and content.',
        'zh-CN': '基于标题和内容生成新文档。',
      },
    },
    {
      name: 'generate_code_artifact',
      descriptionDict: {
        en: 'Generate a new code artifact based on title, type, and content.',
        'zh-CN': '基于标题、类型和内容生成新的代码组件。',
      },
    },
    {
      name: 'send_email',
      descriptionDict: {
        en: 'Send an email to a specified recipient with subject and HTML content.',
        'zh-CN': '向指定收件人发送带有主题和HTML内容的电子邮件。',
      },
    },
    {
      name: 'get_time',
      descriptionDict: {
        en: 'Get the current date and time information.',
        'zh-CN': '获取当前日期和时间信息。',
      },
    },
    {
      name: 'execute_code',
      descriptionDict: {
        en: 'Execute code in a secure sandbox environment.',
        'zh-CN': '在安全的沙箱环境中执行代码。',
      },
    },
  ],
};

interface BuiltinToolParams {
  user: User;
  reflyService: ReflyService;
}

export const BuiltinLibrarySearchDefinition: ToolsetDefinition = {
  key: 'library_search',
  labelDict: {
    en: 'Library Search',
    'zh-CN': '知识库搜索',
  },
  descriptionDict: {
    en: 'Search within Refly knowledge base, documents, and resources.',
    'zh-CN': '在 Refly 知识库、文档和资源中搜索。',
  },
};

export const BuiltinWebSearchDefinition: ToolsetDefinition = {
  key: 'web_search',
  labelDict: {
    en: 'Web Search',
    'zh-CN': '网络搜索',
  },
  descriptionDict: {
    en: 'Search the web for current information and news.',
    'zh-CN': '在网络上搜索最新信息和新闻。',
  },
};

export const BuiltinGenerateDocDefinition: ToolsetDefinition = {
  key: 'generate_doc',
  labelDict: {
    en: 'Generate Document',
    'zh-CN': '生成文档',
  },
  descriptionDict: {
    en: 'Generate a new document based on a title and content.',
    'zh-CN': '基于标题和内容生成新文档。',
  },
};

export const BuiltinGenerateCodeArtifactDefinition: ToolsetDefinition = {
  key: 'generate_code_artifact',
  labelDict: {
    en: 'Generate Code Artifact',
    'zh-CN': '生成代码组件',
  },
  descriptionDict: {
    en: 'Generate a new code artifact based on title, type, and content.',
    'zh-CN': '基于标题、类型和内容生成新的代码组件。',
  },
};

export const BuiltinSendEmailDefinition: ToolsetDefinition = {
  key: 'send_email',
  labelDict: {
    en: 'Send Email',
    'zh-CN': '发送邮件',
  },
  descriptionDict: {
    en: 'Send an email to a specified recipient with subject and HTML content.',
    'zh-CN': '向指定收件人发送带有主题和HTML内容的电子邮件。',
  },
};

export const BuiltinGetTimeDefinition: ToolsetDefinition = {
  key: 'get_time',
  // internal: true - This tool should be visible in mentionList for user selection
  labelDict: {
    en: 'Get Time',
    'zh-CN': '获取时间',
  },
  descriptionDict: {
    en: 'Get the current date and time information.',
    'zh-CN': '获取当前日期和时间信息。',
  },
};

export const BuiltinReadFileDefinition: ToolsetDefinition = {
  key: 'read_file',
  //  System-level tool, auto-included, hidden from mentionList, uses compact rendering
  internal: true,
  labelDict: {
    en: 'Read File',
    'zh-CN': '读取文件',
  },
  descriptionDict: {
    en: 'Read content from a file.',
    'zh-CN': '读取文件内容。',
  },
};

export const BuiltinExecuteCodeDefinition: ToolsetDefinition = {
  key: 'execute_code',
  // internal: true - This tool should be visible in mentionList for user selection
  labelDict: {
    en: 'Execute Code',
    'zh-CN': '执行代码',
  },
  descriptionDict: {
    en: 'Execute code in a secure sandbox environment.',
    'zh-CN': '在安全的沙箱环境中执行代码。',
  },
};

export const BuiltinListFilesDefinition: ToolsetDefinition = {
  key: 'list_files',
  // System-level tool, auto-included, hidden from mentionList, uses compact rendering
  internal: true,
  labelDict: {
    en: 'List Files',
    'zh-CN': '列出文件',
  },
  descriptionDict: {
    en: 'List all files in the current canvas.',
    'zh-CN': '列出当前画布中的所有文件。',
  },
};

export const BuiltinGenerateWorkflowPlanDefinition: ToolsetDefinition = {
  key: 'generate_workflow_plan',
  labelDict: {
    en: 'Generate Workflow Plan',
    'zh-CN': '生成工作流计划',
  },
  descriptionDict: {
    en: 'Generate a new workflow plan based on tasks and variables.',
    'zh-CN': '根据任务和变量生成新的工作流计划。',
  },
};

export const BuiltinPatchWorkflowPlanDefinition: ToolsetDefinition = {
  key: 'patch_workflow_plan',
  labelDict: {
    en: 'Patch Workflow Plan',
    'zh-CN': '修补工作流计划',
  },
  descriptionDict: {
    en: 'Patch an existing workflow plan with changes.',
    'zh-CN': '通过更改修补现有工作流计划。',
  },
};

export class BuiltinLibrarySearch extends AgentBaseTool<BuiltinToolParams> {
  name = 'library_search';
  toolsetKey = 'library_search';

  schema = z.object({
    query: z.string().describe('The search query to execute'),
    domains: z
      .array(z.enum(['resource', 'document', 'canvas']))
      .describe('Search domains to include')
      .default(['resource', 'document']),
    mode: z.enum(['keyword', 'vector', 'hybrid']).describe('Search mode').default('vector'),
    limit: z.number().describe('Maximum number of results to return').default(10),
    projectId: z.string().optional().describe('Optional project ID to scope the search'),
  });

  description = 'Search within Refly knowledge base, documents, and resources.';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      const result = await reflyService.librarySearch(
        user,
        {
          query: input.query,
          domains: input.domains,
          mode: input.mode,
          limit: input.limit,
          projectId: input.projectId,
        },
        { enableReranker: true },
      );

      if (!result.success) {
        throw new Error(result.errMsg);
      }

      return {
        status: 'success',
        data: result,
        summary: `Successfully performed library search for query: "${input.query}" with ${result.data?.length ?? 0} results`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error performing library search',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while performing library search',
      };
    }
  }
}

export class BuiltinWebSearch extends AgentBaseTool<BuiltinToolParams> {
  name = 'web_search';
  toolsetKey = 'web_search';

  schema = z.object({
    query: z.string().describe('The search query to execute'),
    num_results: z.number().describe('Number of results to return').default(5),
  });
  description = 'Search the web for current information.';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      const result = await reflyService.webSearch(user, {
        q: input.query,
        limit: input.num_results,
      });

      if (!result.success) {
        throw new Error(result.errMsg);
      }

      return {
        status: 'success',
        data: result,
        summary: `Successfully performed web search for query: "${input.query}" with ${result.data?.length ?? 0} results`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error performing web search',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while performing web search',
      };
    }
  }
}

export class BuiltinGenerateDoc extends AgentBaseTool<BuiltinToolParams> {
  name = 'generate_doc';
  toolsetKey = 'generate_doc';

  schema = z.object({
    title: z.string().describe('Title of the document to generate'),
    content: z.string().describe(
      `Document content in Markdown format.

## File Embedding (CRITICAL: Use ONLY fileIds from context)
When embedding files, you MUST use the EXACT fileId provided in context (e.g., from list_files or file metadata).
⚠️ NEVER invent or guess file IDs. File IDs follow the format \`df-<alphanumeric>\` (e.g., df-abc123xyz).

Placeholder formats:
- \`![alt](file-content://df-<fileId>)\` - For images/media (direct file URL)
- \`[text](file://df-<fileId>)\` - For links (share page URL)

If no files are in context, do NOT use file placeholders.`,
    ),
  });
  description =
    'Create or save content to a document (e.g., when the user says "save to document"). Provide a title and Markdown content.';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    _: unknown,
    config: RunnableConfig,
  ): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      const canvasId = config.configurable?.canvasId;

      // Replace file placeholders with HTTP URLs before writing
      const processedContent = await this.replaceFilePlaceholders(input.content);

      const file = await reflyService.writeFile(user, {
        name: input.title,
        content: processedContent,
        type: 'text/plain',
        canvasId,
        resultId: config.configurable?.resultId,
        resultVersion: config.configurable?.version,
      });

      return {
        status: 'success',
        data: file,
        summary: `Successfully generated document: "${input.title}" with ID: ${file.fileId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error generating document',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while generating document',
      };
    }
  }

  /**
   * Replace file placeholders in content with HTTP URLs.
   * Supported formats:
   * - `![alt](file-content://df-xxx)` → Direct file content URL (for images)
   * - `[text](file://df-xxx)` → Share page URL (for links)
   */
  private async replaceFilePlaceholders(content: string): Promise<string> {
    if (!content) {
      return content;
    }

    // Use shared utility to check for and extract all file IDs
    if (!hasFileIds(content)) {
      return content;
    }

    // Extract all unique file IDs using shared utility
    const uniqueFileIds = extractAllFileIds(content);

    if (uniqueFileIds.length === 0) {
      return content;
    }

    const { reflyService, user } = this.params;

    // Get both URL types for each file
    const urlResults = await Promise.all(
      uniqueFileIds.map(async (fileId) => {
        try {
          const { url, contentUrl } = await reflyService.createShareForDriveFile(user, fileId);
          return { fileId, shareUrl: url, contentUrl };
        } catch (error) {
          console.error(
            `[BuiltinGenerateDoc] Failed to create share URL for fileId ${fileId}:`,
            error,
          );
          return { fileId, shareUrl: null, contentUrl: null };
        }
      }),
    );

    // Build URL maps
    const shareUrlMap = new Map<string, string>();
    const contentUrlMap = new Map<string, string>();

    for (const { fileId, shareUrl, contentUrl } of urlResults) {
      if (shareUrl) {
        shareUrlMap.set(fileId, shareUrl);
      }
      if (contentUrl) {
        contentUrlMap.set(fileId, contentUrl);
      }
    }

    // Use shared utility to replace all file ID patterns in markdown content
    return replaceAllMarkdownFileIds(content, contentUrlMap, shareUrlMap);
  }
}

export class BuiltinGenerateCodeArtifact extends AgentBaseTool<BuiltinToolParams> {
  name = 'generate_code_artifact';
  toolsetKey = 'generate_code_artifact';

  schema = z.object({
    filename: z
      .string()
      .describe('Name of the file to generate, must include extension (.md, .html, .svg, etc.)'),
    content: z.string().describe(
      `File content (markdown, HTML, SVG markup, etc.).

## File Embedding (CRITICAL: Use ONLY fileIds from context)
When embedding files, you MUST use the EXACT fileId provided in context (e.g., from list_files or file metadata).
⚠️ NEVER invent or guess file IDs. File IDs follow the format \`df-<alphanumeric>\` (e.g., df-abc123xyz).

Placeholder formats:
- \`![alt](file-content://df-<fileId>)\` - For images/media (direct file URL)
- \`[text](file://df-<fileId>)\` - For links (share page URL)

If no files are in context, do NOT use file placeholders.`,
    ),
  });

  description = `Generate renderable content files that display as rich previews in the UI.

## Supported File Types (with live preview)
- **Markdown (.md)**: Reports, documentation, formatted articles with tables, lists, and embedded images
- **HTML (.html)**: Interactive pages, styled content, web components
- **SVG (.svg)**: Vector graphics, diagrams, flowcharts, data visualizations

## Use Cases
- ✅ Creating formatted reports or documentation
- ✅ Generating diagrams, charts, or visual representations
- ✅ Building interactive HTML content

## NOT for
- ❌ Executable code files (.py, .js, .ts) — use execute_code tool instead
- ❌ Data files (CSV, JSON, Excel) — use execute_code to generate these

## Note
- SVG \`<image>\` tag requires explicit numeric width and height (e.g., \`width="300" height="200"\`)`;

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    _: unknown,
    config: RunnableConfig,
  ): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      const canvasId = config.configurable?.canvasId;

      // Replace file placeholders with HTTP URLs before writing
      const processedContent = await this.replaceFilePlaceholders(input.content, input.filename);

      const file = await reflyService.writeFile(user, {
        name: input.filename,
        type: 'text/plain',
        content: processedContent,
        canvasId,
        resultId: config.configurable?.resultId,
        resultVersion: config.configurable?.version,
      });

      return {
        status: 'success',
        data: file,
        summary: `Successfully generated code artifact: "${input.filename}" with file ID: ${file.fileId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error generating code artifact',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while generating code artifact',
      };
    }
  }

  /**
   * Check if the filename indicates an HTML file
   */
  private isHtmlFile(filename: string): boolean {
    const ext = filename.toLowerCase().split('.').pop();
    return ext === 'html' || ext === 'htm';
  }

  /**
   * Replace file placeholders in content with HTTP URLs.
   * Supported formats:
   * - `![alt](file-content://df-xxx)` → Direct file content URL (for images)
   * - `[text](file://df-xxx)` → Share page URL (for links)
   *
   * For HTML files, all file references (including audio/video src) use content URLs
   * to ensure proper media playback.
   */
  private async replaceFilePlaceholders(content: string, filename: string): Promise<string> {
    if (!content) {
      return content;
    }

    // Use shared utility to check for and extract all file IDs
    if (!hasFileIds(content)) {
      return content;
    }

    // Extract all unique file IDs using shared utility
    const uniqueFileIds = extractAllFileIds(content);

    if (uniqueFileIds.length === 0) {
      return content;
    }

    const { reflyService, user } = this.params;

    // Get both URL types for each file
    const urlResults = await Promise.all(
      uniqueFileIds.map(async (fileId) => {
        try {
          const { url, contentUrl } = await reflyService.createShareForDriveFile(user, fileId);
          return { fileId, shareUrl: url, contentUrl };
        } catch (error) {
          console.error(
            `[BuiltinGenerateCodeArtifact] Failed to create share URL for fileId ${fileId}:`,
            error,
          );
          return { fileId, shareUrl: null, contentUrl: null };
        }
      }),
    );

    // Build URL maps
    const shareUrlMap = new Map<string, string>();
    const contentUrlMap = new Map<string, string>();

    for (const { fileId, shareUrl, contentUrl } of urlResults) {
      if (shareUrl) {
        shareUrlMap.set(fileId, shareUrl);
      }
      if (contentUrl) {
        contentUrlMap.set(fileId, contentUrl);
      }
    }

    // For HTML files, use appropriate URLs based on attribute type:
    // - src attributes (images, audio, video): contentUrl for direct playback
    // - href attributes (links): shareUrl for navigation to share page
    if (this.isHtmlFile(filename)) {
      return replaceAllHtmlFileIds(content, contentUrlMap, shareUrlMap);
    }

    // For markdown and other files, use the standard replacement logic
    return replaceAllMarkdownFileIds(content, contentUrlMap, shareUrlMap);
  }
}

export class BuiltinSendEmail extends AgentBaseTool<BuiltinToolParams> {
  name = 'send_email';
  toolsetKey = 'send_email';

  schema = z.object({
    subject: z.string().describe('The subject of the email'),
    html: z.string().describe(
      `The HTML content of the email.

## File Embedding (CRITICAL: Use ONLY fileIds from context)
When embedding files, you MUST use the EXACT fileId provided in context (e.g., from list_files or file metadata).
⚠️ NEVER invent or guess file IDs. File IDs follow the format \`df-<alphanumeric>\` (e.g., df-abc123xyz).

Placeholder formats:
- \`file-content://df-<fileId>\` - For images/media in src attributes (direct file URL)
- \`file://df-<fileId>\` - For links in href attributes (share page URL)

If no files are in context, do NOT use file placeholders.`,
    ),
    to: z
      .string()
      .describe(
        'The email address of the recipient. If not provided, the email will be sent to the user.',
      )
      .optional(),
    attachments: z
      .array(z.string())
      .describe(
        `File attachments using file-content://df-<fileId> format.
⚠️ CRITICAL: Use ONLY fileIds from context. NEVER invent file IDs.
Each fileId must be an exact match from list_files or file metadata (format: df-<alphanumeric>).`,
      )
      .optional(),
  });

  description = `Send an email to a specified recipient with subject and HTML content.

## File Reference Placeholders
- \`file-content://df-<fileId>\` → Use in <img>, <video>, <audio> src attributes (direct file URL)
- \`file://df-<fileId>\` → Use in <a> href for clickable links (share page URL)

⚠️ IMPORTANT: Only use fileIds that exist in context. Never invent file IDs.`;

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      const htmlWithResolvedFiles = await this.replaceFilePlaceholders(input.html);
      const result = await reflyService.sendEmail(user, {
        subject: input.subject,
        html: htmlWithResolvedFiles,
        to: input.to,
        attachments: await Promise.all(
          input.attachments?.map((file) => {
            const fileId = extractFileId(file);
            const normalized = fileId && file === fileId ? `file-content://${fileId}` : file;
            return this.replaceFilePlaceholders(normalized);
          }) || [],
        ),
      });

      if (!result.success) {
        throw new Error(result.errMsg);
      }

      return {
        status: 'success',
        data: result,
        summary: `Successfully sent email to ${input.to || 'user'} with subject: "${input.subject}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error sending email',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while sending email',
      };
    }
  }

  /**
   * Replace file placeholders in HTML content with HTTP URLs.
   * Supported formats:
   * - `file-content://df-xxx` → Direct file content URL (for images, embedded media)
   * - `file://df-xxx` → Share page URL (for links)
   * - `src="df-xxx"` or `href="df-xxx"` → Bare file IDs in HTML attributes (treated as content URLs)
   */
  private async replaceFilePlaceholders(html: string): Promise<string> {
    if (!html) {
      return html;
    }

    // Use shared utility to check for file IDs
    if (!hasFileIds(html)) {
      return html;
    }

    // Extract all unique file IDs using shared utility
    const uniqueFileIds = extractAllFileIds(html);

    if (uniqueFileIds.length === 0) {
      return html;
    }

    const { reflyService, user } = this.params;

    // Get both URL types for each file
    const urlResults = await Promise.all(
      uniqueFileIds.map(async (fileId) => {
        try {
          const { url, contentUrl } = await reflyService.createShareForDriveFile(user, fileId);
          return { fileId, shareUrl: url, contentUrl };
        } catch (error) {
          console.error(
            `[BuiltinSendEmail] Failed to create share URL for fileId ${fileId}:`,
            error,
          );
          return { fileId, shareUrl: null, contentUrl: null };
        }
      }),
    );

    // Build URL maps (only include successful results)
    const contentUrlMap = new Map<string, string>();
    const shareUrlMap = new Map<string, string>();

    for (const { fileId, shareUrl, contentUrl } of urlResults) {
      if (contentUrl) {
        contentUrlMap.set(fileId, contentUrl);
      }
      if (shareUrl) {
        shareUrlMap.set(fileId, shareUrl);
      }
    }

    // Use shared utility to replace all file ID patterns in HTML content
    // - src attributes (images, audio, video): contentUrl for direct playback
    // - href attributes (links): shareUrl for navigation to share page
    return replaceAllHtmlFileIds(html, contentUrlMap, shareUrlMap);
  }
}

export class BuiltinGetTime extends AgentBaseTool<BuiltinToolParams> {
  name = 'get_time';
  toolsetKey = 'get_time';

  schema = z.object({});

  description = 'Get the current date and time information in various formats.';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(_input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const now = new Date();
      const result = {
        currentTime: now.toISOString(),
        timestamp: now.getTime(),
        date: now.toDateString(),
        time: now.toTimeString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        utcOffset: now.getTimezoneOffset(),
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved current time: ${result.currentTime}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error getting time',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while getting time',
      };
    }
  }
}

export class BuiltinReadFile extends AgentBaseTool<BuiltinToolParams> {
  name = 'read_file';
  toolsetKey = 'read_file';

  schema = z.object({
    fileId: z.string().describe('The ID of the file to read (format: df-xxx, from context)'),
    fileName: z
      .string()
      .optional()
      .describe('Optional file name for frontend display purpose only'),
  });

  description = `Read content from a file.

Supported types:
- Text files (txt, md, json, csv, js, py, xml, yaml...): Returns raw content
- PDF / Word (.docx) / EPUB: Returns extracted text

Token limit: 25,000 tokens (~100K chars). Large files are truncated with head/tail preservation.

NOT supported: Images, Audio, Video (returns error)

Latency: <2s`;

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      const file = await reflyService.readFile(user, input.fileId);

      return {
        status: 'success',
        data: file,
        summary: `Successfully read file: "${file.name}" with file ID: ${file.fileId}`,
      };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      const errorMessage = err.message || 'Unknown error';

      // Check for file size limit error (E3006) - guide LLM to use execute_code
      if (err.code === 'E3006') {
        return {
          status: 'error',
          error: 'FILE_TOO_LARGE',
          data: {
            fileId: input.fileId,
            fileName: input.fileName,
            suggestion:
              'This file exceeds the size limit for direct reading. Use the execute_code tool to process it with custom Python/JavaScript code.',
          },
          summary: errorMessage,
        };
      }

      return {
        status: 'error',
        error: 'Error reading file',
        data: {
          fileId: input.fileId,
          fileName: input.fileName,
        },
        summary: errorMessage,
      };
    }
  }
}

export class BuiltinListFiles extends AgentBaseTool<BuiltinToolParams> {
  name = 'list_files';
  toolsetKey = 'list_files';

  schema = z.object({
    source: z
      .enum(['manual', 'variable', 'agent'])
      .optional()
      .describe(
        'Filter files by source: manual (user uploaded), variable (from workflow variables), agent (created by agent). If not specified, returns all files.',
      ),
  });

  description = `List files in the current canvas.

Returns a list of files with their IDs and names. Use the fileId with read_file tool to read file content.

Optional filter by source:
- manual: Files uploaded by user
- variable: Files from workflow variables
- agent: Files created by agent`;

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    _: unknown,
    config: RunnableConfig,
  ): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      const canvasId = config.configurable?.canvasId;

      if (!canvasId) {
        return {
          status: 'error',
          error: 'Canvas ID not found in context',
          summary: 'Cannot list files: canvas context is not available',
        };
      }

      const files = await reflyService.listFiles(user, canvasId, input.source);

      if (!files || files.length === 0) {
        const sourceFilter = input.source ? ` (source: ${input.source})` : '';
        return {
          status: 'success',
          data: input.source ? [] : { manual: [], variable: [], agent: [] },
          summary: `No files found in the current canvas${sourceFilter}`,
        };
      }

      // Simplified file info for LLM consumption
      const toFileInfo = (f: (typeof files)[0]) => ({
        fileId: f.fileId,
        fileName: f.name,
        type: f.type,
      });

      // If source filter specified, return flat list; otherwise group by source
      if (input.source) {
        return {
          status: 'success',
          data: files.map(toFileInfo),
          summary: `Found ${files.length} ${input.source} file(s): ${files.map((f) => f.name).join(', ')}`,
        };
      }

      // Group by source for better LLM understanding
      const grouped = {
        manual: files.filter((f) => f.source === 'manual').map(toFileInfo),
        variable: files.filter((f) => f.source === 'variable').map(toFileInfo),
        agent: files.filter((f) => f.source === 'agent').map(toFileInfo),
      };

      const counts = [
        grouped.manual.length && `${grouped.manual.length} manual`,
        grouped.variable.length && `${grouped.variable.length} variable`,
        grouped.agent.length && `${grouped.agent.length} agent`,
      ]
        .filter(Boolean)
        .join(', ');

      return {
        status: 'success',
        data: grouped,
        summary: `Found ${files.length} file(s) in canvas (${counts})`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error listing files',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while listing files',
      };
    }
  }
}

// ============================================================================
// Read Agent Result Tool - Read full content of a previous agent result
// ============================================================================

export const BuiltinReadAgentResultDefinition: ToolsetDefinition = {
  key: 'read_agent_result',
  internal: true,
  labelDict: {
    en: 'Read Agent Result',
    'zh-CN': '读取执行结果',
  },
  descriptionDict: {
    en: 'Read full content of a previous agent result.',
    'zh-CN': '读取前置节点的完整执行结果。',
  },
};

// Maximum tokens for read_agent_result output (to prevent context explosion)
const MAX_AGENT_RESULT_TOKENS = 8000;

/**
 * Truncate content from the end (keep tail), trying to start from sentence boundary
 */
function truncateFromEnd(content: string, maxTokens: number): string {
  if (!content) return '';

  // Rough estimate: 1 token ≈ 3.5 chars for mixed content
  const estimatedChars = maxTokens * 3.5;
  if (content.length <= estimatedChars) {
    return content;
  }

  const tail = content.slice(-estimatedChars);

  // Try to start from a sentence boundary (within first 30% of tail)
  const sentenceStart = tail.search(/[.。!！?？\n]\s*/);
  if (sentenceStart !== -1 && sentenceStart < tail.length * 0.3) {
    return `[...truncated...]\n\n${tail.slice(sentenceStart + 1).trim()}`;
  }

  return `[...truncated...]\n\n${tail.trim()}`;
}

export class BuiltinReadAgentResult extends AgentBaseTool<BuiltinToolParams> {
  name = 'read_agent_result';
  toolsetKey = 'read_agent_result';

  schema = z.object({
    resultId: z.string().describe('The result ID to read (from context resultsMeta)'),
  });

  description = `Read the full execution result of a previous agent/skill node.
The summary in resultsMeta is just a naive tail truncation and is UNRELIABLE.
ALWAYS use this tool when:
- The task relates to or builds upon previous results
- contentTokens > 300 (contains substantial content worth reading)
- You need specific details, reasoning, or data from the result
Returns AI's reasoning/responses with tool call placeholders.`;

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      const result = await reflyService.getActionResult(user, {
        resultId: input.resultId,
      });

      if (!result) {
        return {
          status: 'error',
          error: 'Result not found',
          summary: `No result found for resultId: ${input.resultId}`,
        };
      }

      const formattedContent = this.formatResultWithToolPlaceholders(result);

      // Truncate from end if content is too long (keep tail which usually has conclusions)
      const truncatedContent = truncateFromEnd(formattedContent, MAX_AGENT_RESULT_TOKENS);

      return {
        status: 'success',
        data: {
          content: truncatedContent,
          title: result.title || 'Untitled',
          resultId: input.resultId,
        },
        summary: `Successfully read agent result: ${result.title || input.resultId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error reading agent result',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while reading agent result',
      };
    }
  }

  /**
   * Format ActionResult with AI content and tool call placeholders.
   */
  private formatResultWithToolPlaceholders(result: any): string {
    const messages = result.messages;

    // If no messages, fallback to steps
    if (!messages || messages.length === 0) {
      if (result.steps && result.steps.length > 0) {
        return result.steps.map((step: any) => step?.content || '').join('\n\n');
      }
      return 'No content available for this result.';
    }

    const parts: string[] = [];

    for (const msg of messages) {
      if (msg.type === 'ai') {
        const reasoning = msg.reasoningContent || '';
        const content = msg.content || '';
        const fullContent = reasoning ? `${reasoning}\n\n${content}` : content;
        if (fullContent.trim()) {
          parts.push(fullContent);
        }
      } else if (msg.type === 'tool') {
        const tc = msg.toolCallResult;
        if (tc) {
          const status = tc.status || 'unknown';
          const toolName = tc.toolName || 'unknown';
          const callId = tc.callId || 'unknown';
          parts.push(`[Tool Call: ${callId} | ${toolName} | ${status}]`);
        }
      }
    }

    return parts.join('\n\n');
  }
}

// ============================================================================
// Read Tool Result Tool - Read detailed input/output of a specific tool call
// ============================================================================

export const BuiltinReadToolResultDefinition: ToolsetDefinition = {
  key: 'read_tool_result',
  internal: true,
  labelDict: {
    en: 'Read Tool Result',
    'zh-CN': '读取工具结果',
  },
  descriptionDict: {
    en: 'Read detailed input/output of a specific tool call.',
    'zh-CN': '读取特定工具调用的详细输入输出。',
  },
};

export class BuiltinReadToolResult extends AgentBaseTool<BuiltinToolParams> {
  name = 'read_tool_result';
  toolsetKey = 'read_tool_result';

  schema = z.object({
    resultId: z.string().describe('The result ID containing the tool call'),
    callId: z.string().describe('The tool call ID to read'),
  });

  description = `Read the detailed input and output of a specific tool call.
Use this when you need the full tool execution details (input parameters and output).
Check toolCallsMeta.status first - only read if status is 'success' and you need the data.`;

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      const result = await reflyService.getActionResult(user, {
        resultId: input.resultId,
      });

      if (!result) {
        return {
          status: 'error',
          error: 'Result not found',
          summary: `No result found for resultId: ${input.resultId}`,
        };
      }

      const toolCall =
        (result.toolCalls ?? []).find((tc: any) => tc.callId === input.callId) ??
        (result.steps?.flatMap((step: any) => step?.toolCalls ?? []) ?? []).find(
          (tc: any) => tc?.callId === input.callId,
        ) ??
        (result.messages?.map((msg: any) => msg?.toolCallResult) ?? []).find(
          (tc: any) => tc?.callId === input.callId,
        );
      if (!toolCall) {
        return {
          status: 'error',
          error: 'Tool call not found',
          summary: `No tool call found with callId: ${input.callId} in result: ${input.resultId}`,
        };
      }

      return {
        status: 'success',
        data: {
          callId: toolCall.callId,
          toolName: toolCall.toolName,
          status: toolCall.status,
          input: toolCall.input,
          output: toolCall.output,
          error: toolCall.error,
        },
        summary: `Successfully read tool result: ${toolCall.toolName} (${input.callId})`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error reading tool result',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while reading tool result',
      };
    }
  }
}

export class BuiltinLibrarySearchToolset extends AgentBaseToolset<BuiltinToolParams> {
  toolsetKey = BuiltinLibrarySearchDefinition.key;
  tools = [BuiltinLibrarySearch] satisfies readonly AgentToolConstructor<BuiltinToolParams>[];
}

export class BuiltinWebSearchToolset extends AgentBaseToolset<BuiltinToolParams> {
  toolsetKey = BuiltinWebSearchDefinition.key;
  tools = [BuiltinWebSearch] satisfies readonly AgentToolConstructor<BuiltinToolParams>[];
}

export class BuiltinGenerateDocToolset extends AgentBaseToolset<BuiltinToolParams> {
  toolsetKey = BuiltinGenerateDocDefinition.key;
  tools = [BuiltinGenerateDoc] satisfies readonly AgentToolConstructor<BuiltinToolParams>[];
}

export class BuiltinGenerateCodeArtifactToolset extends AgentBaseToolset<BuiltinToolParams> {
  toolsetKey = BuiltinGenerateCodeArtifactDefinition.key;
  tools = [
    BuiltinGenerateCodeArtifact,
  ] satisfies readonly AgentToolConstructor<BuiltinToolParams>[];
}

export class BuiltinSendEmailToolset extends AgentBaseToolset<BuiltinToolParams> {
  toolsetKey = BuiltinSendEmailDefinition.key;
  tools = [BuiltinSendEmail] satisfies readonly AgentToolConstructor<BuiltinToolParams>[];
}

export class BuiltinGetTimeToolset extends AgentBaseToolset<BuiltinToolParams> {
  toolsetKey = BuiltinGetTimeDefinition.key;
  tools = [BuiltinGetTime] satisfies readonly AgentToolConstructor<BuiltinToolParams>[];
}

export class BuiltinReadFileToolset extends AgentBaseToolset<BuiltinToolParams> {
  toolsetKey = BuiltinReadFileDefinition.key;
  tools = [BuiltinReadFile] satisfies readonly AgentToolConstructor<BuiltinToolParams>[];
}

export class BuiltinListFilesToolset extends AgentBaseToolset<BuiltinToolParams> {
  toolsetKey = BuiltinListFilesDefinition.key;
  tools = [BuiltinListFiles] satisfies readonly AgentToolConstructor<BuiltinToolParams>[];
}

export class BuiltinExecuteCodeToolset extends AgentBaseToolset<BuiltinToolParams> {
  toolsetKey = BuiltinExecuteCodeDefinition.key;
  tools = [BuiltinExecuteCode] satisfies readonly AgentToolConstructor<BuiltinToolParams>[];
}

export class BuiltinReadAgentResultToolset extends AgentBaseToolset<BuiltinToolParams> {
  toolsetKey = BuiltinReadAgentResultDefinition.key;
  tools = [BuiltinReadAgentResult] satisfies readonly AgentToolConstructor<BuiltinToolParams>[];
}

export class BuiltinReadToolResultToolset extends AgentBaseToolset<BuiltinToolParams> {
  toolsetKey = BuiltinReadToolResultDefinition.key;
  tools = [BuiltinReadToolResult] satisfies readonly AgentToolConstructor<BuiltinToolParams>[];
}

export class BuiltinToolset extends AgentBaseToolset<BuiltinToolParams> {
  toolsetKey = BuiltinToolsetDefinition.key;
  tools = [
    BuiltinWebSearch,
    BuiltinGenerateDoc,
    BuiltinGenerateCodeArtifact,
    BuiltinSendEmail,
    BuiltinGetTime,
    BuiltinReadFile,
    BuiltinListFiles,
    BuiltinExecuteCode,
    BuiltinReadAgentResult,
    BuiltinReadToolResult,
  ] satisfies readonly AgentToolConstructor<BuiltinToolParams>[];
}
