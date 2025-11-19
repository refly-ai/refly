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
      .enum(['python', 'javascript', 'typescript', 'r', 'java', 'bash', 'node', 'nodejs', 'deno'])
      .describe('Programming language for code execution'),
    timeout: z.number().optional().default(30).describe('Execution timeout in seconds'),
  });

  description = `
Execute code in a secure sandbox environment.

** Critical Rules **
1. Always use relative path for file operations (files are in current working directory)
2. Always include all necessary imports
3. Always create new files, never modify or delete existing files
4. Prefer no code comments, use concise code instead.
5. Each tool call's code context is isolated, always use file to store intermediate results.

\`\`\`python
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv('data.csv')

df.to_csv('result.csv', index=False)
plt.savefig('chart.png')
\`\`\`
`;

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
        language: input.language,
        timeout: input.timeout,
        parentResultId: config.configurable?.resultId,
        canvasId: config.configurable?.canvasId,
        version: config.configurable?.version,
      };

      const result = await reflyService.execute(user, request);

      if (result.status === 'success') {
        const output = result.data?.output || 'No output';
        const executionTime = result.data?.executionTime || 0;
        const exitCode = result.data?.exitCode || 0;

        const summary = `**Result:**
📄 Output: ${output}
⏱️ Execution Time: ${executionTime}ms
✅ Exit Code: ${exitCode}`;

        return {
          status: 'success',
          data: {
            output,
            error: result.data?.error,
            exitCode,
            executionTime,
            parentResultId: config.configurable?.resultId,
            files: result.data?.files,
          },
          summary,
          creditCost: 1, // Placeholder credit cost
        };
      }

      // Handle error response
      let errorMessage = 'Code execution failed';

      if (result.errors && result.errors.length > 0) {
        errorMessage = result.errors.map((err) => `[${err.code}] ${err.message}`).join('; ');
      } else if (result.data?.error) {
        errorMessage = `Execution error: ${result.data.error}`;
      }

      return {
        status: 'error',
        error: errorMessage,
        summary: '❌ **Code execution failed**',
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error occurred while executing code';
      return {
        status: 'error',
        error: errorMsg,
        summary: '❌ **Unexpected error during code execution**',
      };
    }
  }
}

export class SandboxToolset extends AgentBaseToolset<SandboxParams> {
  toolsetKey = SandboxToolsetDefinition.key;
  tools = [Execute] satisfies readonly AgentToolConstructor<SandboxParams>[];
}
