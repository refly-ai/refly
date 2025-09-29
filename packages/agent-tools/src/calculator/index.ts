import { z } from 'zod';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { ToolsetDefinition } from '@refly/openapi-schema';

export const CalculatorToolsetDefinition: ToolsetDefinition = {
  key: 'calculator',
  domain: 'https://calculator.com',
  labelDict: {
    en: 'Calculator',
    'zh-CN': '计算器',
  },
  descriptionDict: {
    en: 'Perform mathematical calculations and solve equations.',
    'zh-CN': '执行数学计算和求解方程。',
  },
  tools: [
    {
      name: 'calculate',
      descriptionDict: {
        en: 'Evaluate mathematical expressions and return results.',
        'zh-CN': '计算数学表达式并返回结果。',
      },
    },
    {
      name: 'solve_equation',
      descriptionDict: {
        en: 'Solve linear and quadratic equations.',
        'zh-CN': '求解线性和二次方程。',
      },
    },
  ],
  requiresAuth: false,
  authPatterns: [],
  configItems: [],
};

export class CalculatorCalculate extends AgentBaseTool<unknown> {
  name = 'calculate';
  toolsetKey = CalculatorToolsetDefinition.key;

  schema = z.object({
    expression: z.string().describe('Mathematical expression to evaluate (e.g., "2 + 2 * 3")'),
  });
  description = 'Evaluate mathematical expressions and return results.';

  protected params: unknown;

  constructor(params: unknown) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      // Use Function constructor to safely evaluate mathematical expressions
      // This is safer than eval() as it only allows mathematical operations
      const sanitizedExpression = input.expression.replace(/[^0-9+\-*/().,]/g, '');

      if (!sanitizedExpression) {
        return {
          status: 'error',
          error: 'Invalid expression',
          summary: 'Expression contains no valid mathematical characters',
        };
      }

      const result = Function(`'use strict'; return (${sanitizedExpression})`)();

      if (typeof result !== 'number' || !Number.isFinite(result)) {
        return {
          status: 'error',
          error: 'Invalid calculation result',
          summary: 'Calculation resulted in an invalid number',
        };
      }

      return {
        status: 'success',
        data: {
          expression: input.expression,
          result: result,
          sanitizedExpression: sanitizedExpression,
        },
        summary: `Successfully calculated: ${input.expression} = ${result}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error calculating expression',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while calculating expression',
      };
    }
  }
}

export class CalculatorSolveEquation extends AgentBaseTool<unknown> {
  name = 'solve_equation';
  toolsetKey = CalculatorToolsetDefinition.key;

  schema = z.object({
    equation: z.string().describe('Equation to solve (e.g., "2x + 3 = 7" or "x^2 - 4 = 0")'),
  });
  description = 'Solve linear and quadratic equations.';

  protected params: unknown;

  constructor(params: unknown) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const equation = input.equation.toLowerCase().replace(/\s/g, '');

      // Simple linear equation solver: ax + b = c
      const linearMatch = equation.match(/^(\d*\.?\d*)x([+-]\d*\.?\d*)=(\d*\.?\d*)$/);
      if (linearMatch) {
        const a = Number.parseFloat(linearMatch[1]) || 1;
        const b = Number.parseFloat(linearMatch[2]);
        const c = Number.parseFloat(linearMatch[3]);

        if (a === 0) {
          return {
            status: 'error',
            error: 'Invalid equation',
            summary: 'Coefficient of x cannot be zero',
          };
        }

        const x = (c - b) / a;

        return {
          status: 'success',
          data: {
            equation: input.equation,
            type: 'linear',
            solution: x,
            steps: [
              `${a}x + ${b} = ${c}`,
              `${a}x = ${c} - ${b}`,
              `${a}x = ${c - b}`,
              `x = ${c - b} / ${a}`,
              `x = ${x}`,
            ],
          },
          summary: `Successfully solved linear equation: ${input.equation}, x = ${x}`,
        };
      }

      // Simple quadratic equation solver: x^2 + bx + c = 0
      const quadraticMatch = equation.match(/^x\^2([+-]\d*\.?\d*)x([+-]\d*\.?\d*)=0$/);
      if (quadraticMatch) {
        const b = Number.parseFloat(quadraticMatch[1]);
        const c = Number.parseFloat(quadraticMatch[2]);

        const discriminant = b * b - 4 * c;

        if (discriminant < 0) {
          return {
            status: 'success',
            data: {
              equation: input.equation,
              type: 'quadratic',
              discriminant: discriminant,
              solution: 'No real solutions (complex roots)',
              steps: [
                `x² + ${b}x + ${c} = 0`,
                `Discriminant = b² - 4ac = ${b}² - 4(1)(${c}) = ${b * b} - ${4 * c} = ${discriminant}`,
                'Since discriminant < 0, there are no real solutions',
              ],
            },
            summary: `Successfully analyzed quadratic equation: ${input.equation} has no real solutions`,
          };
        }

        const x1 = (-b + Math.sqrt(discriminant)) / 2;
        const x2 = (-b - Math.sqrt(discriminant)) / 2;

        return {
          status: 'success',
          data: {
            equation: input.equation,
            type: 'quadratic',
            discriminant: discriminant,
            solutions: [x1, x2],
            steps: [
              `x² + ${b}x + ${c} = 0`,
              `Discriminant = b² - 4ac = ${b}² - 4(1)(${c}) = ${b * b} - ${4 * c} = ${discriminant}`,
              'x = (-b ± √discriminant) / 2a',
              `x = (-${b} ± √${discriminant}) / 2(1)`,
              `x = (-${b} ± ${Math.sqrt(discriminant)}) / 2`,
              `x₁ = ${x1}, x₂ = ${x2}`,
            ],
          },
          summary: `Successfully solved quadratic equation: ${input.equation}, x = ${x1} or x = ${x2}`,
        };
      }

      return {
        status: 'error',
        error: 'Unsupported equation format',
        summary:
          'Only simple linear (ax + b = c) and quadratic (x² + bx + c = 0) equations are supported',
        data: {
          equation: input.equation,
          supportedFormats: [
            'Linear: ax + b = c (e.g., "2x + 3 = 7")',
            'Quadratic: x² + bx + c = 0 (e.g., "x² - 4 = 0")',
          ],
        },
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error solving equation',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while solving equation',
      };
    }
  }
}

export class CalculatorToolset extends AgentBaseToolset<unknown> {
  toolsetKey = CalculatorToolsetDefinition.key;
  tools = [
    CalculatorCalculate,
    CalculatorSolveEquation,
  ] satisfies readonly AgentToolConstructor<unknown>[];
}
