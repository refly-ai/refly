import { z } from 'zod/v3';
import { AgentBaseTool, AgentBaseToolset } from '../base';

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
  labelDict: {
    en: 'Get Time',
    'zh-CN': '获取时间',
  },
  descriptionDict: {
    en: 'Get the current date and time information.',
    'zh-CN': '获取当前日期和时间信息。',
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
        type: 'text/plain',
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
      .describe('Name of the code file to generate, should contain valid file extension'),
    content: z.string().describe('Actual code content'),
  });

  description = 'Create a new code artifact with title, type, and content.';

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
    html: z.string().describe('The HTML content of the email'),
    to: z
      .string()
      .describe(
        'The email address of the recipient. If not provided, the email will be sent to the user.',
      )
      .optional(),
    attachments: z.array(z.string()).describe('The URLs of the attachments').optional(),
  });

  description = 'Send an email to a specified recipient with subject and HTML content.';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      const result = await reflyService.sendEmail(user, {
        subject: input.subject,
        html: input.html,
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

export class BuiltinToolset extends AgentBaseToolset<BuiltinToolParams> {
  toolsetKey = BuiltinToolsetDefinition.key;
  tools = [
    BuiltinWebSearch,
    BuiltinGenerateDoc,
    BuiltinGenerateCodeArtifact,
    BuiltinSendEmail,
    BuiltinGetTime,
    BuiltinReadFile,
  ] satisfies readonly AgentToolConstructor<BuiltinToolParams>[];
}
