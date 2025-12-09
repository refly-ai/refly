import { z } from 'zod/v3';
import { AgentBaseTool, AgentBaseToolset } from '../base';
import { BuiltinExecuteCode } from './sandbox';

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
  internal: true,
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
  internal: true,
  labelDict: {
    en: 'Execute Code',
    'zh-CN': '执行代码',
  },
  descriptionDict: {
    en: 'Execute code in a secure sandbox environment.',
    'zh-CN': '在安全的沙箱环境中执行代码。',
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
    content: z.string().describe('Markdown content of the document'),
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
      const file = await reflyService.writeFile(user, {
        name: input.title,
        content: input.content,
        type: 'text/markdown',
        canvasId: config.configurable?.canvasId,
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
}

export class BuiltinGenerateCodeArtifact extends AgentBaseTool<BuiltinToolParams> {
  name = 'generate_code_artifact';
  toolsetKey = 'generate_code_artifact';

  schema = z.object({
    filename: z
      .string()
      .describe('Name of the file to generate, must include extension (.md, .html, .svg, etc.)'),
    content: z.string().describe('File content (markdown, HTML, SVG markup, etc.)'),
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

## Important
- Always use **full URLs** for embedded images/links (e.g., http://localhost:5173/v1/drive/file/content/df-xxx)
- SVG \`<image>\` tag requires **explicit numeric width and height** (e.g., \`width="300" height="200"\`). Do NOT use \`auto\` — it's invalid in SVG
- Markdown supports standard image syntax: ![alt](full-url)`;

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
      const file = await reflyService.writeFile(user, {
        name: input.filename,
        type: 'text/plain',
        content: input.content,
        canvasId: config.configurable?.canvasId,
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
}

export class BuiltinSendEmail extends AgentBaseTool<BuiltinToolParams> {
  name = 'send_email';
  toolsetKey = 'send_email';

  schema = z.object({
    subject: z.string().describe('The subject of the email'),
    html: z.string().describe(
      `The HTML content of the email. When embedding files, use these placeholder formats:
- \`file://df-<fileId>\` - Creates a shareable preview page link (for text links, clickable content)
- \`file-content://df-<fileId>\` - Creates a direct file content URL (REQUIRED for <img src="">, <video src="">, etc.)

CRITICAL: For <img> tags, you MUST use \`file-content://\` format, not \`file://\`.
Example: <img src="file-content://df-xa4ieer0xx9jod9zcfsu8nnf" />

Use the fileId string directly (format: 'df-' followed by alphanumeric), NOT base64-encoded data.`,
    ),
    to: z
      .string()
      .describe(
        'The email address of the recipient. If not provided, the email will be sent to the user.',
      )
      .optional(),
    attachments: z.array(z.string()).describe('The URLs of the attachments').optional(),
  });

  description = `Send an email to a specified recipient with subject and HTML content.

## File Reference Placeholders
- \`file://df-<fileId>\` → Shareable preview page (for links: <a href="file://df-xxx">)
- \`file-content://df-<fileId>\` → Direct file content URL (for images: <img src="file-content://df-xxx">)

IMPORTANT: Use \`file-content://\` for <img>, <video>, <audio> src attributes. Use \`file://\` for clickable links.`;

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
        attachments: input.attachments,
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

  private async replaceFilePlaceholders(html: string): Promise<string> {
    // Check for both placeholder formats
    const hasFileContent = html?.includes('file-content://df-');
    const hasFile = html?.includes('file://df-');

    if (!html || (!hasFileContent && !hasFile)) {
      return html;
    }

    // Match both formats: file-content://df-xxx and file://df-xxx
    const contentMatchPattern = /file-content:\/\/(df-[a-zA-Z0-9]+)/g;
    const shareMatchPattern = /(?<!file-content:\/\/)file:\/\/(df-[a-zA-Z0-9]+)/g;

    const contentMatches = Array.from(html.matchAll(contentMatchPattern));
    const shareMatches = Array.from(html.matchAll(shareMatchPattern));

    if (contentMatches.length === 0 && shareMatches.length === 0) {
      return html;
    }

    const { reflyService, user } = this.params;

    // Collect all unique file IDs from both patterns
    const allFileIds = new Set<string>();
    for (const [, fileId] of contentMatches) {
      allFileIds.add(fileId);
    }
    for (const [, fileId] of shareMatches) {
      allFileIds.add(fileId);
    }

    const uniqueFileIds = Array.from(allFileIds);

    // Fetch all drive files
    const driveFiles = await Promise.all(
      uniqueFileIds.map(async (fileId) => {
        const file = await reflyService.readFile(user, fileId);
        if (!file) {
          throw new Error(`Drive file not found: ${fileId}`);
        }
        return file;
      }),
    );

    // Get both URL types for each file
    const urlResults = await Promise.all(
      driveFiles.map(async (file) => {
        const { url, contentUrl } = await reflyService.createShareForDriveFile(user, file.fileId);
        return { fileId: file.fileId, shareUrl: url, contentUrl };
      }),
    );

    // Build maps for both URL types
    const shareUrlMap = new Map<string, string>();
    const contentUrlMap = new Map<string, string>();

    for (const { fileId, shareUrl, contentUrl } of urlResults) {
      if (!shareUrl || !contentUrl) {
        throw new Error(`Failed to generate URLs for drive file: ${fileId}`);
      }
      shareUrlMap.set(fileId, shareUrl);
      contentUrlMap.set(fileId, contentUrl);
    }

    // Replace file-content:// with direct content URLs
    let result = html.replace(
      contentMatchPattern,
      (match, fileId: string) => contentUrlMap.get(fileId) ?? match,
    );

    // Replace file:// with share page URLs (but not file-content://)
    result = result.replace(
      /(?<!-)file:\/\/(df-[a-zA-Z0-9]+)/g,
      (match, fileId: string) => shareUrlMap.get(fileId) ?? match,
    );

    return result;
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
    fileId: z.string().describe('The ID of the file to read'),
  });

  description = 'Read content from a drive file.';

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
      return {
        status: 'error',
        error: 'Error reading file',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while reading file',
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

export class BuiltinExecuteCodeToolset extends AgentBaseToolset<BuiltinToolParams> {
  toolsetKey = BuiltinExecuteCodeDefinition.key;
  tools = [BuiltinExecuteCode] satisfies readonly AgentToolConstructor<BuiltinToolParams>[];
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
    BuiltinExecuteCode,
  ] satisfies readonly AgentToolConstructor<BuiltinToolParams>[];
}
