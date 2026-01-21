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
- 🔸 Treat ALL WARNINGS strictly, they are always related to prohibited operations

# Installed Packages (Python)

- **Data processing**: numpy, pandas, scipy
- **Machine learning**: scikit-learn
- **Symbolic math**: sympy
- **Visualization**: matplotlib, seaborn, plotly
- **Image**: pillow, opencv-python-headless
- **Video**: moviepy
- **Audio**: pydub
- **File processing**: openpyxl, python-docx, pypdf, pymupdf, reportlab, python-pptx
- **Format parsing**: pyyaml, toml, orjson, lxml, beautifulsoup4
- **Network**: requests
- **Text / NLP**: jieba, feedparser
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
        const warnings = result.data?.warnings;

        // Code error: exitCode != 0 means user's code has issues
        if (exitCode !== 0) {
          return {
            status: 'error',
            error: error || 'Code execution returned non-zero exit code',
            data: { output, exitCode, executionTime },
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
            warnings,
          },
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
      };
    }
  }

  private formatSystemError(errors?: Array<{ code?: string; message?: string }>): ToolCallResult {
    if (!errors || errors.length === 0) {
      return {
        status: 'error',
        error: 'Unknown system error',
        summary: '[SYSTEM_ERROR] Unknown system error',
      };
    }

    const errorMessages = errors.map((e) => e.message || e.code || 'Unknown').join('; ');

    return {
      status: 'error',
      error: errorMessages,
      // summary,
    };
  }
}
