import { AgentBaseToolset } from './base';
import { ToolsetDefinition } from '@refly/openapi-schema';
import { FirecrawlToolset, FirecrawlToolsetDefinition } from './firecrawl';
import { CalculatorToolset, CalculatorToolsetDefinition } from './calculator';

export type AnyToolsetClass = new (...args: any[]) => AgentBaseToolset<any>;

export const toolsetInventory: Record<
  string,
  {
    class: AnyToolsetClass;
    definition: ToolsetDefinition;
  }
> = {
  [FirecrawlToolsetDefinition.key]: {
    class: FirecrawlToolset,
    definition: FirecrawlToolsetDefinition,
  },
  [CalculatorToolsetDefinition.key]: {
    class: CalculatorToolset,
    definition: CalculatorToolsetDefinition,
  },
};
