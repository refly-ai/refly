import { z } from 'zod';
import { ToolParams } from '@langchain/core/tools';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { ToolsetDefinition } from '@refly/openapi-schema';
import { BrowserUseClient } from 'browser-use-sdk';

export const BrowserUseToolsetDefinition: ToolsetDefinition = {
  key: 'browser-use',
  domain: 'https://browser-use.com',
  labelDict: {
    en: 'Browser Use',
    'zh-CN': '浏览器使用',
  },
  descriptionDict: {
    en: 'Browser automation tool that allows AI agents to control web browsers and perform complex web tasks. Supports stealth browsing, proxy configuration, domain restrictions, and result schema validation.',
    'zh-CN':
      '浏览器自动化工具，允许 AI 代理控制网页浏览器并执行复杂的网页任务。支持隐身浏览、代理配置、域名限制和结果模式验证。',
  },
  tools: [
    {
      name: 'create_task',
      descriptionDict: {
        en: 'Create and execute browser automation tasks. Can perform web scraping, form filling, navigation, and other browser-based operations with optional result schema validation.',
        'zh-CN':
          '创建并执行浏览器自动化任务。可以执行网页抓取、表单填写、导航和其他基于浏览器的操作，支持可选的结果模式验证。',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'credentials',
      credentialItems: [
        {
          key: 'apiKey',
          inputMode: 'text',
          inputProps: {
            passwordType: true,
          },
          labelDict: {
            en: 'API Key',
            'zh-CN': 'API 密钥',
          },
          descriptionDict: {
            en: 'The API key for Browser Use service',
            'zh-CN': 'Browser Use 服务的 API 密钥',
          },
          required: true,
        },
      ],
    },
  ],
  configItems: [
    {
      key: 'baseUrl',
      inputMode: 'text',
      labelDict: {
        en: 'Base URL',
        'zh-CN': '基础 URL',
      },
      descriptionDict: {
        en: 'The base URL of Browser Use service',
        'zh-CN': 'Browser Use 服务的 URL',
      },
      defaultValue: 'https://api.browser-use.com',
    },
  ],
};

interface BrowserUseToolParams extends ToolParams {
  apiKey: string;
  baseUrl?: string;
}

export class BrowserUseCreateTask extends AgentBaseTool<BrowserUseToolParams> {
  name = 'create_task';
  toolsetKey = BrowserUseToolsetDefinition.key;

  schema = z.object({
    task: z.string().min(1).max(20000).describe('The task prompt/instruction for the agent'),
    structuredOutput: z
      .any()
      .optional()
      .describe(
        'Optional Zod schema to validate and structure the task result (will be stringified as JSON schema)',
      ),
    sessionId: z.string().optional().describe('Optional session ID to reuse a browser session'),
    profileId: z.string().optional().describe('Optional profile ID to use for the session'),
    proxyCountryCode: z
      .string()
      .optional()
      .describe('Optional proxy country code for stealth browsing (e.g., "us", "uk")'),
    startUrl: z.string().url().optional().describe('Optional URL to start the task from'),
    maxSteps: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .describe('Maximum number of steps the agent can take before stopping (default: 30)'),
    allowedDomains: z
      .array(z.string())
      .optional()
      .describe('Optional list of allowed domains for navigation restrictions'),
    secrets: z
      .record(z.string(), z.string())
      .optional()
      .describe('Optional secrets for the task (domain-specific credentials)'),
    metadata: z
      .record(z.string(), z.string())
      .optional()
      .describe('Optional metadata for the task (up to 10 key-value pairs)'),
    highlightElements: z
      .boolean()
      .optional()
      .describe('Whether to highlight interactive elements on the page (default: false)'),
    flashMode: z
      .boolean()
      .optional()
      .describe('Enable maximum speed execution by reducing thinking time (default: false)'),
    thinking: z.boolean().optional().describe('Whether to enable thinking mode (default: false)'),
    vision: z
      .boolean()
      .optional()
      .describe('Whether to enable vision capabilities (default: true)'),
    systemPromptExtension: z
      .string()
      .max(2000)
      .optional()
      .describe('Optional extension to the agent system prompt (max 2000 characters)'),
    llm: z
      .enum([
        'gpt-4.1',
        'gpt-4.1-mini',
        'o4-mini',
        'o3',
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'claude-sonnet-4-20250514',
        'gpt-4o',
        'gpt-4o-mini',
        'llama-4-maverick-17b-128e-instruct',
        'claude-3-7-sonnet-20250219',
      ])
      .optional()
      .describe('The LLM model to use for the agent'),
  });

  description =
    'Create and execute browser automation tasks. Can perform web scraping, form filling, navigation, and other browser-based operations with optional result schema validation.';

  protected params: BrowserUseToolParams;

  constructor(params: BrowserUseToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      // Dynamic import to avoid issues if package is not available
      //const { BrowserUseClient } = await import('browser-use-sdk');

      const client = new BrowserUseClient({
        apiKey: this.params.apiKey,
      });

      let sessionId = input.sessionId;

      // Create session if profileId or proxyCountryCode is provided but no sessionId
      if ((input.profileId || input.proxyCountryCode) && !sessionId) {
        const sessionOptions: any = {};
        if (input.profileId) {
          sessionOptions.profileId = input.profileId;
        }
        if (input.proxyCountryCode) {
          sessionOptions.proxyCountryCode = input.proxyCountryCode as any;
        }

        const session = await client.sessions.createSession(sessionOptions);
        sessionId = session.id;
      }

      // Prepare task options
      const taskOptions: any = {
        task: input.task,
      };

      // Add optional parameters
      if (input.structuredOutput) {
        // Convert Zod schema to JSON schema string
        const { zodToJsonSchema } = await import('zod-to-json-schema');
        const jsonSchema = zodToJsonSchema(input.structuredOutput);
        taskOptions.structuredOutput = JSON.stringify(jsonSchema);
      }

      if (sessionId) {
        taskOptions.sessionId = sessionId;
      }

      if (input.startUrl) {
        taskOptions.startUrl = input.startUrl;
      }

      if (input.maxSteps !== undefined) {
        taskOptions.maxSteps = input.maxSteps;
      }

      if (input.allowedDomains?.length) {
        taskOptions.allowedDomains = input.allowedDomains;
      }

      if (input.secrets) {
        taskOptions.secrets = input.secrets;
      }

      if (input.metadata) {
        taskOptions.metadata = input.metadata;
      }

      if (input.highlightElements !== undefined) {
        taskOptions.highlightElements = input.highlightElements;
      }

      if (input.flashMode !== undefined) {
        taskOptions.flashMode = input.flashMode;
      }

      if (input.thinking !== undefined) {
        taskOptions.thinking = input.thinking;
      }

      if (input.vision !== undefined) {
        taskOptions.vision = input.vision;
      }

      if (input.systemPromptExtension) {
        taskOptions.systemPromptExtension = input.systemPromptExtension;
      }

      if (input.llm) {
        taskOptions.llm = input.llm;
      }

      // Create and execute the task
      const task = await client.tasks.createTask(taskOptions);
      const result = await task.complete();

      // Prepare the response
      const responseData: any = {
        output: result.output,
        fullResult: result,
      };

      // Add parsed result if structuredOutput was provided and result has parsed data
      if (input.structuredOutput && result.parsed) {
        responseData.parsed = result.parsed;
      }

      // Add session info if available
      if (result.sessionId) {
        responseData.sessionId = result.sessionId;
      }

      // Generate summary
      const summaryParts = ['Successfully executed browser automation task'];

      if (result.parsed) {
        summaryParts.push('with structured result');
      }

      if (input.proxyCountryCode) {
        summaryParts.push(`using proxy from ${input.proxyCountryCode.toUpperCase()}`);
      }

      if (input.flashMode) {
        summaryParts.push('(flash mode enabled)');
      }

      if (input.llm) {
        summaryParts.push(`using ${input.llm} model`);
      }

      return {
        status: 'success',
        data: responseData,
        summary: summaryParts.join(' '),
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error executing browser automation task',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while executing browser automation task',
      };
    }
  }
}

export class BrowserUseToolset extends AgentBaseToolset<BrowserUseToolParams> {
  toolsetKey = BrowserUseToolsetDefinition.key;
  tools = [BrowserUseCreateTask] satisfies readonly AgentToolConstructor<BrowserUseToolParams>[];
}
