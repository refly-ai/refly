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
Execute code in a secure sandbox environment with isolated input/output file systems.

** File System Structure **
- Input: /mnt/refly/input (read-only, contains user uploaded files and previous results)
- Output: /mnt/refly/output (read-write, for generated files in current execution)

** Path Helper Functions (Python) **
Use these helper functions to construct file paths correctly:
- input_path(filename): Returns /mnt/refly/input/<filename>
- output_path(filename): Returns /mnt/refly/output/<filename>

Example:
\`\`\`python
# Read user data from input
import pandas as pd
df = pd.read_csv(input_path('data.csv'))

# Generate output file
df.to_csv(output_path('result.csv'), index=False)
\`\`\`

** Best Practices **
- Read user files from /mnt/refly/input using input_path()
- Write generated files to /mnt/refly/output using output_path()
- Always include all necessary imports
- Filter warnings only once to avoid duplicates
  \`\`\`python
  import warnings
  warnings.filterwarnings('once', category=UserWarning)
  \`\`\`

** Important Notes **
- Files generated in /mnt/refly/output will be automatically saved to user's drive
- Each execution gets a fresh /mnt/refly/output directory
- Input directory is read-only - attempting to write will fail
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

      const version = config.configurable?.version;
      if (!version) {
        return {
          status: 'error',
          error: 'Version is required for sandbox execution',
          summary:
            'Version configuration is missing. Please ensure the execution context includes a version identifier.',
        };
      }

      const request: SandboxExecuteRequest = {
        code: input.code,
        language: input.language,
        timeout: input.timeout,
        version,
        parentResultId: config.configurable?.resultId,
        canvasId: config.configurable?.canvasId,
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
      let errorDetails = '';

      if (result.errors && result.errors.length > 0) {
        errorMessage = result.errors.map((err) => `[${err.code}] ${err.message}`).join('; ');
        errorDetails = errorMessage;
      } else if (result.data?.error) {
        errorDetails = result.data.error;
        errorMessage = `Execution error: ${errorDetails}`;
      }

      return {
        status: 'error',
        error: errorMessage,
        summary: `❌ **Error:**\n${errorDetails || errorMessage}`,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error occurred while executing code';
      const errorStack = error instanceof Error && error.stack ? `\n\nStack:\n${error.stack}` : '';
      return {
        status: 'error',
        error: errorMsg,
        summary: `❌ **Error:**\n${errorMsg}${errorStack}`,
      };
    }
  }
}

export class SandboxToolset extends AgentBaseToolset<SandboxParams> {
  toolsetKey = SandboxToolsetDefinition.key;
  tools = [Execute] satisfies readonly AgentToolConstructor<SandboxParams>[];
}
