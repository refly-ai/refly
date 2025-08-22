import { z } from 'zod';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor } from '../base';
import { InferInteropZodOutput } from '@langchain/core/dist/utils/types';

export class CalculatorAdd extends AgentBaseTool {
  toolsetKey = 'calculator';
  name = 'add';
  schema = z.object({
    a: z.number().describe('The first number to add'),
    b: z.number().describe('The second number to add'),
  });
  description = 'A calculator that adds two numbers together.';

  async _call(
    input: InferInteropZodOutput<typeof CalculatorAdd.prototype.schema>,
  ): Promise<string> {
    const res = input.a + input.b;
    return res.toString();
  }
}

export class CalculatorSubtract extends AgentBaseTool {
  toolsetKey = 'calculator';
  name = 'subtract';
  schema = z.object({
    a: z.number().describe('The value to subtract from'),
    b: z.number().describe('The value to subtract'),
  });
  description = 'A calculator that subtracts two numbers.';

  async _call(
    input: InferInteropZodOutput<typeof CalculatorSubtract.prototype.schema>,
  ): Promise<string> {
    const res = input.a - input.b;
    return res.toString();
  }
}

export class CalculatorToolset extends AgentBaseToolset {
  toolsetKey = 'calculator';
  labelDict = {
    en: 'Calculator',
  };
  descriptionDict = {
    en: 'A calculator that adds and subtracts two numbers together.',
  };
  tools = [CalculatorAdd, CalculatorSubtract] satisfies readonly AgentToolConstructor<unknown>[];
}
