import { z } from 'zod';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { ToolsetDefinition } from '@refly/openapi-schema';
import { loadPyodide } from 'pyodide';

export const CodeInterpreterToolsetDefinition: ToolsetDefinition = {
  key: 'code-interpreter',
  domain: 'https://pyodide.org',
  labelDict: {
    en: 'Code Interpreter',
    'zh-CN': '代码解释器',
  },
  descriptionDict: {
    en: 'Execute Python code using Pyodide in the browser. Perfect for calculations, data analysis, and code testing. The result will be the value of the last expression in your code.',
    'zh-CN':
      '使用 Pyodide 在浏览器中执行 Python 代码。适用于计算、数据分析和代码测试。结果将是代码中最后一个表达式的值。',
  },
  tools: [
    {
      name: 'runPythonCode',
      descriptionDict: {
        en: 'Execute Python code and return the result. The last expression in your code will be returned as the result value. Use print() statements to display intermediate results. For example: "x = 1 + 1; print(f\'1 + 1 = {x}\'); x" will both print and return the result.',
        'zh-CN':
          '执行 Python 代码并返回结果。代码中最后一个表达式的值将被作为结果返回。使用 print() 语句来显示中间结果。例如："x = 1 + 1; print(f\'1 + 1 = {x}\'); x" 将同时打印和返回结果。',
      },
    },
  ],
  requiresAuth: false,
  authPatterns: [],
  configItems: [],
};

export class RunPythonCode extends AgentBaseTool<unknown> {
  name = 'runPythonCode';
  toolsetKey = CodeInterpreterToolsetDefinition.key;

  schema = z.object({
    code: z
      .string()
      .describe(
        'Python code to execute. The last expression will be returned as the result. Use print() for intermediate output. Example: "result = 1 + 1; print(f\'Calculation: {result}\'); result"',
      ),
  });
  description = 'Execute Python code and return the result.';

  protected params: unknown;

  constructor(params: unknown) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      // Load Pyodide instance (reuse if already loaded)
      const pyodide = await loadPyodide();

      // Execute the Python code
      const result = await pyodide.runPython(input.code);

      return {
        status: 'success',
        data: {
          code: input.code,
          result: result,
        },
        summary: 'Successfully executed Python code',
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error executing Python code',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while executing Python code',
        data: {
          code: input.code,
        },
      };
    }
  }
}

export class CodeInterpreterToolset extends AgentBaseToolset<unknown> {
  toolsetKey = CodeInterpreterToolsetDefinition.key;
  tools = [RunPythonCode] satisfies readonly AgentToolConstructor<unknown>[];
}
