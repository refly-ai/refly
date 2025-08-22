import { AgentBaseToolset } from './base';

import { FirecrawlToolset } from './firecrawl';
import { CalculatorToolset } from './calculator';

export type AnyToolsetClass = new (...args: any[]) => AgentBaseToolset<any>;

export const toolsetInventory: {
  key: string;
  class: AnyToolsetClass;
}[] = [
  {
    key: 'firecrawl',
    class: FirecrawlToolset,
  },
  {
    key: 'calculator',
    class: CalculatorToolset,
  },
];
