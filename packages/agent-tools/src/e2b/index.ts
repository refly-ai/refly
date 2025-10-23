import { z } from 'zod/v3';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { ToolsetDefinition } from '@refly/openapi-schema';
import { Sandbox } from '@e2b/code-interpreter';

export const E2BToolsetDefinition: ToolsetDefinition = {
  key: 'e2b',
  domain: 'https://e2b.dev',
  labelDict: {
    en: 'E2B Code Interpreter',
    'zh-CN': 'E2B 代码解释器',
  },
  descriptionDict: {
    en: 'Execute code in secure cloud environments. Supports Python, JavaScript, and other languages with access to pre-installed packages.',
    'zh-CN': '在安全的云环境中执行代码。支持 Python、JavaScript 等语言，并可访问预装的软件包。',
  },
  tools: [
    {
      name: 'run_code',
      descriptionDict: {
        en: 'Execute code in a secure sandbox environment and return the results.',
        'zh-CN': '在安全的沙箱环境中执行代码并返回结果。',
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
            en: 'E2B API Key',
            'zh-CN': 'E2B API 密钥',
          },
          descriptionDict: {
            en: 'Your E2B API key for code execution',
            'zh-CN': '您的 E2B API 密钥，用于代码执行',
          },
          required: true,
        },
      ],
    },
  ],
  configItems: [],
};

export interface E2BParams {
  apiKey: string;
}

// Helper function to create authenticated E2B sandbox
function createE2BSandbox(params: E2BParams): Promise<Sandbox> {
  // Set API key in environment
  process.env.E2B_API_KEY = params.apiKey;
  return Sandbox.create();
}

export class E2BRunCode extends AgentBaseTool<E2BParams> {
  name = 'run_code';
  toolsetKey = E2BToolsetDefinition.key;

  schema = z.object({
    code: z.string().describe('The code to execute in the E2B sandbox environment'),
    language: z
      .string()
      .optional()
      .describe('Programming language (defaults to Python if not specified)'),
  });

  description = 'Execute code in a secure sandbox environment and return the results.';

  protected params: E2BParams;

  constructor(params: E2BParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const sandbox = await createE2BSandbox(this.params);

      try {
        const execution = await sandbox.runCode(input.code);

        // Extract stdout and stderr from logs
        const stdout = execution.logs.stdout.join('\n');
        const stderr = execution.logs.stderr.join('\n');

        // Get the main result text
        const mainResult = execution.text;

        return {
          status: 'success',
          data: {
            code: input.code,
            language: input.language ?? 'python',
            stdout: stdout,
            stderr: stderr,
            mainResult: mainResult,
            logs: execution.logs,
            results: execution.results,
            executionCount: execution.executionCount,
          },
          summary: `Successfully executed code. ${mainResult ? `Result: ${mainResult}` : stdout ? `Output: ${stdout.trim()}` : 'No output.'}`,
        };
      } finally {
        // Always close the sandbox to free resources
        // Note: In newer versions, sandbox cleanup might be automatic
        // If close method exists, call it
        if (typeof (sandbox as any).close === 'function') {
          await (sandbox as any).close();
        }
      }
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to execute code',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while executing code',
      };
    }
  }
}

export class E2BToolset extends AgentBaseToolset<E2BParams> {
  toolsetKey = E2BToolsetDefinition.key;
  tools = [E2BRunCode] satisfies readonly AgentToolConstructor<E2BParams>[];
}
