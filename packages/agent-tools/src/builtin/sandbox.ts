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
      .enum(['python', 'javascript', 'shell'])
      .describe('Programming language for code execution'),
  });

  description = `
# Rules

## You CAN

- ✅ Read existing files (user uploads, previous outputs)
- ✅ Create and modify new files (files you created persist across calls)
- ✅ Use any pre-installed packages (see "Installed Packages" below)

## You CANNOT

- ❌ Modify or delete existing files (user uploads are read-only)
- ❌ Access variables, imports, or functions from previous calls (each call is completely isolated)
- ❌ Install new packages with pip

## You MUST

- 🔸 Include ALL necessary imports in EVERY code block
- 🔸 Reload data from files when continuing previous work
- 🔸 Write self-contained code (treat each call as a fresh Python session)

# Installed Packages (Python)

- **Data processing**: numpy, pandas, scipy
- **Machine learning**: scikit-learn
- **Symbolic math**: sympy
- **Visualization**: matplotlib, seaborn, plotly, mplfonts (CJK font support)
- **Image**: pillow
- **File processing**: openpyxl, python-docx, pypdf, pymupdf, reportlab, python-pptx
- **Format parsing**: pyyaml, toml, orjson, lxml, beautifulsoup4
- **Network**: requests
- **Utilities**: python-dateutil, pytz, tabulate

# Example

**Step 1**: Process data and save to file

\`\`\`python
import pandas as pd

df = pd.read_csv('data.csv')
df['total'] = df['price'] * df['quantity']
df.to_csv('result.csv', index=False)
print(f"Processed {len(df)} rows")
\`\`\`

**Step 2**: Load saved file and visualize (must re-import everything)

\`\`\`python
import pandas as pd
import matplotlib.pyplot as plt

# df from Step 1 is NOT available, must reload from file
df = pd.read_csv('result.csv')

plt.figure(figsize=(10, 6))
plt.bar(df['name'], df['total'])
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
