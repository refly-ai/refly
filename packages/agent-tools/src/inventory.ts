import { AgentBaseToolset } from './base';
import { ToolsetDefinition } from '@refly/openapi-schema';
import { BuiltinToolset, BuiltinToolsetDefinition } from './builtin';
import { FirecrawlToolset, FirecrawlToolsetDefinition } from './firecrawl';
import { CalculatorToolset, CalculatorToolsetDefinition } from './calculator';
import { GoogleDriveToolset, GoogleDriveToolsetDefinition } from './google-drive';
import { JinaToolset, JinaToolsetDefinition } from './jina';
import { CodeInterpreterToolset, CodeInterpreterToolsetDefinition } from './code-interpreter';
import { WhaleWisdomToolset, WhaleWisdomToolsetDefinition } from './whalewisdom';
import { GoogleDocsToolset, GoogleDocsToolsetDefinition } from './google-docs';
import { GoogleSheetsToolset, GoogleSheetsToolsetDefinition } from './google-sheets';
import { TwitterToolset, TwitterToolsetDefinition } from './twitter';
import { NotionToolset, NotionToolsetDefinition } from './notion';
import { FalAudioToolset, FalAudioToolsetDefinition } from './fal-audio';
import { FalImageToolset, FalImageToolsetDefinition } from './fal-image';
import { FalVideoToolset, FalVideoToolsetDefinition } from './fal-video';
import { PerplexityToolset, PerplexityToolsetDefinition } from './perplexity';
import { ProductHuntToolset, ProductHuntToolsetDefinition } from './producthunt';
import { BrowserUseToolset, BrowserUseToolsetDefinition } from './browser-use';
import { ScaleboxToolset, ScaleboxToolsetDefinition } from './scalebox';
import { ApifyToolset, ApifyToolsetDefinition } from './apify';
import { NovitaSandboxToolset, NovitaSandboxToolsetDefinition } from './novita-sandbox';
import { Apify13FToolset, Apify13FToolsetDefinition } from './apify-13f';

export type AnyToolsetClass = new (...args: any[]) => AgentBaseToolset<any>;

export const toolsetInventory: Record<
  string,
  {
    class: AnyToolsetClass;
    definition: ToolsetDefinition;
  }
> = {
  [BuiltinToolsetDefinition.key]: {
    class: BuiltinToolset,
    definition: BuiltinToolsetDefinition,
  },
  [FirecrawlToolsetDefinition.key]: {
    class: FirecrawlToolset,
    definition: FirecrawlToolsetDefinition,
  },
  [CalculatorToolsetDefinition.key]: {
    class: CalculatorToolset,
    definition: CalculatorToolsetDefinition,
  },
  [GoogleDriveToolsetDefinition.key]: {
    class: GoogleDriveToolset,
    definition: GoogleDriveToolsetDefinition,
  },
  [JinaToolsetDefinition.key]: {
    class: JinaToolset,
    definition: JinaToolsetDefinition,
  },
  [CodeInterpreterToolsetDefinition.key]: {
    class: CodeInterpreterToolset,
    definition: CodeInterpreterToolsetDefinition,
  },
  [WhaleWisdomToolsetDefinition.key]: {
    class: WhaleWisdomToolset,
    definition: WhaleWisdomToolsetDefinition,
  },
  [GoogleDocsToolsetDefinition.key]: {
    class: GoogleDocsToolset,
    definition: GoogleDocsToolsetDefinition,
  },
  [GoogleSheetsToolsetDefinition.key]: {
    class: GoogleSheetsToolset,
    definition: GoogleSheetsToolsetDefinition,
  },
  [TwitterToolsetDefinition.key]: {
    class: TwitterToolset,
    definition: TwitterToolsetDefinition,
  },
  [NotionToolsetDefinition.key]: {
    class: NotionToolset,
    definition: NotionToolsetDefinition,
  },
  [FalAudioToolsetDefinition.key]: {
    class: FalAudioToolset,
    definition: FalAudioToolsetDefinition,
  },
  [FalImageToolsetDefinition.key]: {
    class: FalImageToolset,
    definition: FalImageToolsetDefinition,
  },
  [FalVideoToolsetDefinition.key]: {
    class: FalVideoToolset,
    definition: FalVideoToolsetDefinition,
  },
  [PerplexityToolsetDefinition.key]: {
    class: PerplexityToolset,
    definition: PerplexityToolsetDefinition,
  },
  [ProductHuntToolsetDefinition.key]: {
    class: ProductHuntToolset,
    definition: ProductHuntToolsetDefinition,
  },
  [BrowserUseToolsetDefinition.key]: {
    class: BrowserUseToolset,
    definition: BrowserUseToolsetDefinition,
  },
  [ScaleboxToolsetDefinition.key]: {
    class: ScaleboxToolset,
    definition: ScaleboxToolsetDefinition,
  },
  [ApifyToolsetDefinition.key]: {
    class: ApifyToolset,
    definition: ApifyToolsetDefinition,
  },
  [NovitaSandboxToolsetDefinition.key]: {
    class: NovitaSandboxToolset,
    definition: NovitaSandboxToolsetDefinition,
  },
  [Apify13FToolsetDefinition.key]: {
    class: Apify13FToolset,
    definition: Apify13FToolsetDefinition,
  },
};
