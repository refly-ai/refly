import { z } from 'zod/v3';
import { RunnableConfig } from '@langchain/core/runnables';
import { User, SandboxExecuteRequest } from '@refly/openapi-schema';
import { AgentBaseTool, ToolCallResult } from '../base';
import type { ReflyService } from './interface';

interface BuiltinSandboxParams {
  user: User;
  reflyService: ReflyService;
}

export class BuiltinExecuteCode extends AgentBaseTool<BuiltinSandboxParams> {
  name = 'execute_code';
  toolsetKey = 'execute_code';

  schema = z.object({
    code: z.string().describe('The code to execute'),
    language: z
      .enum(['python', 'javascript', 'typescript', 'r', 'java', 'bash', 'node', 'nodejs', 'deno'])
      .describe('Programming language for code execution'),
  });

  description = `
Execute code in a secure sandbox environment.

** Critical Rules **

- Always use relative path for file operations (files are in current working directory)
- Always include all necessary imports in EVERY execution
- Always create new files, never modify or delete existing files
- Prefer no code comments, use concise code instead
- COMPLETE ISOLATION: Each tool call starts with a fresh Python environment - no variables, imports, or objects carry over from previous calls
- File Persistence: Only files are persistent across calls - all Python variables and imports must be redefined each time
- Self-Contained Code: Every code block must be completely self-contained with all required imports and variable definitions

** Environment Behavior **

✅ Files created in previous calls remain accessible
❌ Variables from previous calls are NOT available
❌ Imports from previous calls are NOT retained
❌ Function definitions from previous calls are NOT accessible

** Best Practices **

Start each execution with all necessary imports
Load data from files if continuing previous work
Save results to files for future use
Treat each call as a completely new Python session

\`\`\`python
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv('data.csv')

df.to_csv('result.csv', index=False)
plt.savefig('chart.png')
\`\`\`
`;

  protected params: BuiltinSandboxParams;

  constructor(params: BuiltinSandboxParams) {
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
          summary: '[SYSTEM_ERROR] Sandbox service is not configured.',
        };
      }

      const request: SandboxExecuteRequest = {
        params: {
          code: input.code,
          language: input.language,
        },
        context: {
          parentResultId: config.configurable?.resultId,
          canvasId: config.configurable?.canvasId,
          version: config.configurable?.version,
        },
      };

      const result = await reflyService.execute(user, request);

      if (result.status === 'success') {
        const output = result.data?.output || '';
        const error = result.data?.error || '';
        const exitCode = result.data?.exitCode ?? 0;
        const executionTime = result.data?.executionTime || 0;
        const files = result.data?.files || [];

        // Code error: exitCode != 0 means user's code has issues
        if (exitCode !== 0) {
          return {
            status: 'error',
            error: error || 'Code execution returned non-zero exit code',
            data: { output, exitCode, executionTime },
            summary: this.formatCodeErrorSummary(error, output),
            creditCost: 1,
          };
        }

        // Success: code executed without errors
        return {
          status: 'success',
          data: {
            output,
            exitCode,
            executionTime,
            parentResultId: config.configurable?.resultId,
            files,
          },
          summary: this.formatSuccessSummary(output, files),
          creditCost: 1,
        };
      }

      // System error: infrastructure failure
      return this.formatSystemError(result.errors);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error occurred while executing code';
      return {
        status: 'error',
        error: errorMsg,
        summary: `[SYSTEM_ERROR] ${errorMsg}`,
      };
    }
  }

  private formatSuccessSummary(
    output: string,
    files: Array<{ name?: string; storageKey?: string }>,
  ): string {
    // Summary should be concise since data.output already contains full content
    const parts: string[] = [];

    if (files.length > 0) {
      const fileNames = files.map((f) => f.name || f.storageKey || 'unnamed').join(', ');
      parts.push(`[OK] Files created: ${fileNames}`);
    } else if (output) {
      parts.push('[OK] Execution completed with output');
    } else {
      parts.push('[OK] Execution completed (no output)');
    }

    return parts.join('\n');
  }

  private formatCodeErrorSummary(error: string, output: string): string {
    const MAX_ERROR_LENGTH = 1500;
    const MAX_OUTPUT_LENGTH = 500;

    const truncatedError =
      error.length > MAX_ERROR_LENGTH
        ? `${error.slice(0, MAX_ERROR_LENGTH)}... [truncated]`
        : error;

    const parts = [`[CODE_ERROR] ${truncatedError}`];

    if (output) {
      const truncatedOutput =
        output.length > MAX_OUTPUT_LENGTH
          ? `${output.slice(0, MAX_OUTPUT_LENGTH)}... [truncated]`
          : output;
      parts.push(`Output before error: ${truncatedOutput}`);
    }

    parts.push('Fix the code and retry.');

    return parts.join('\n');
  }

  private formatSystemError(errors?: Array<{ code?: string; message?: string }>): ToolCallResult {
    const TRANSIENT_ERROR_CODE = 'SANDBOX_TRANSIENT_ERROR';

    if (!errors || errors.length === 0) {
      return {
        status: 'error',
        error: 'Unknown system error',
        summary: '[SYSTEM_ERROR] Unknown system error',
      };
    }

    const errorMessages = errors.map((e) => e.message || e.code || 'Unknown').join('; ');
    const isTransient = errors.some((e) => e.code === TRANSIENT_ERROR_CODE);

    const summary = isTransient
      ? `[SYSTEM_ERROR] ${errorMessages}\nThis is a temporary issue. Retry the request.`
      : `[SYSTEM_ERROR] ${errorMessages}`;

    return {
      status: 'error',
      error: errorMessages,
      summary,
    };
  }
}
