import {
  User,
  ToolsetDefinition,
  SandboxExecuteRequest,
  SandboxExecuteResponse,
} from '@refly/openapi-schema';
import { ToolParams } from '@langchain/core/tools';
import { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod/v3';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';

export interface ReflyService {
  execute: (user: User, req: SandboxExecuteRequest) => Promise<SandboxExecuteResponse>;
}

export interface SandboxParams extends ToolParams {
  user: User;
  reflyService: ReflyService;
}

export const SandboxToolsetDefinition: ToolsetDefinition = {
  key: 'sandbox',
  // TODO: Change to https://www.scalebox.dev/ when it is ready
  domain: 'https://www.cloudsway.ai/',
  labelDict: {
    en: 'Sandbox',
    'zh-CN': '沙盒工具',
  },
  descriptionDict: {
    en: 'Create an isolated environment to execute specific tasks securely, preventing security risks and privacy leaks',
    'zh-CN': '创建隔离环境以安全地执行特定任务，避免安全风险和隐私泄露',
  },
  tools: [
    {
      name: 'execute',
      descriptionDict: {
        en: 'Execute a specific code snippet in an isolated sandbox environment',
        'zh-CN': '在隔离的沙盒环境中执行特定的代码片段',
      },
    },
  ],
};

export class Execute extends AgentBaseTool<SandboxParams> {
  name = 'execute';
  toolsetKey = SandboxToolsetDefinition.key;

  schema = z.object({
    code: z.string().describe('The code to execute'),
    language: z
      .string()
      .optional()
      .default('python')
      .describe('Programming language (python, javascript, etc.)'),
    timeout: z.number().optional().default(30).describe('Execution timeout in seconds'),
  });

  description = `Execute code in a secure sandbox environment.
Supports multiple programming languages including Python, JavaScript, and more.
Returns execution output, errors, and execution time.`;

  protected params: SandboxParams;

  constructor(params: SandboxParams) {
    super(params);
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    _: any,
    config: RunnableConfig,
  ): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;

      if (!reflyService) {
        return {
          status: 'error',
          error: 'Sandbox service is not available',
          summary: 'Sandbox service is not configured.',
        };
      }

      const request: SandboxExecuteRequest = {
        code: input.code,
        language: input.language || 'python',
        timeout: input.timeout,
        parentResultId: config.configurable?.resultId,
      };

      const result = await reflyService.execute(user, request);

      if (result.status === 'success') {
        const summary = `**Result:**
📄 Output: ${result?.data?.output || 'No output'}
⏱️ Execution Time: ${result?.data?.executionTime || 0}ms
✅ Exit Code: ${result?.data?.exitCode || 0}`;

        return {
          status: 'success',
          data: {
            output: result?.data?.output,
            error: result?.data?.error,
            exitCode: result?.data?.exitCode,
            executionTime: result?.data?.executionTime,
            parentResultId: config.configurable?.resultId,
          },
          summary,
          creditCost: 1, // Placeholder credit cost
        };
      }

      const errorMessage =
        result.errors?.map((err) => `[${err.code}] ${err.message}`).join('; ') ||
        'Code execution failed';

      return {
        status: 'error',
        error: errorMessage,
        summary: `❌ **Error:**\n${errorMessage}`,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error occurred while executing code';
      return {
        status: 'error',
        error: 'Error executing code',
        summary: `❌ **Error:**\n${errorMsg}`,
      };
    }
  }
}

export class SandboxToolset extends AgentBaseToolset<SandboxParams> {
  toolsetKey = SandboxToolsetDefinition.key;
  tools = [Execute] satisfies readonly AgentToolConstructor<SandboxParams>[];
}
