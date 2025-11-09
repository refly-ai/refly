import { ToolsetDefinition } from '@refly/openapi-schema';
import { AgentBaseToolset } from './base';
import { BrowserUseToolset, BrowserUseToolsetDefinition } from './browser-use';
import { BuiltinToolset, BuiltinToolsetDefinition } from './builtin';
import { CalculatorToolset, CalculatorToolsetDefinition } from './calculator';
import { CodeInterpreterToolset, CodeInterpreterToolsetDefinition } from './code-interpreter';
import { FalAudioToolset, FalAudioToolsetDefinition } from './fal-audio';
import { FalImageToolset, FalImageToolsetDefinition } from './fal-image';
import { FalVideoToolset, FalVideoToolsetDefinition } from './fal-video';
import { FirecrawlToolset, FirecrawlToolsetDefinition } from './firecrawl';
import { GitHubToolsetDefinition } from './github';
import { GmailToolsetDefinition } from './gmail';
import { GoogleDocsToolsetDefinition } from './google-docs';
import { GoogleDriveToolsetDefinition } from './google-drive';
import { GoogleSheetsToolsetDefinition } from './google-sheets';
import { JinaToolset, JinaToolsetDefinition } from './jina';
// import { LinkedInToolsetDefinition } from './linkedin';
import { NotionToolset, NotionToolsetDefinition } from './notion';
import { PerplexityToolset, PerplexityToolsetDefinition } from './perplexity';
import { ProductHuntToolset, ProductHuntToolsetDefinition } from './producthunt';
import { RedditToolsetDefinition } from './reddit';
import { TwitterToolsetDefinition } from './twitter';
import { WhaleWisdomToolset, WhaleWisdomToolsetDefinition } from './whalewisdom';
import { SandboxToolset, SandboxToolsetDefinition } from './sandbox';

export type AnyToolsetClass = new (...args: any[]) => AgentBaseToolset<any>;

// Oauth tool use external sdk to execute, so the class is undefined
// Oauth tool use external sdk to execute, so the class is undefined
export const toolsetInventory: Record<
  string,
  {
    class: AnyToolsetClass | undefined;
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
  [SandboxToolsetDefinition.key]: {
    class: SandboxToolset,
    definition: SandboxToolsetDefinition,
  },
  [CalculatorToolsetDefinition.key]: {
    class: CalculatorToolset,
    definition: CalculatorToolsetDefinition,
  },
  [GoogleDriveToolsetDefinition.key]: {
    class: undefined,
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
    class: undefined,
    definition: GoogleDocsToolsetDefinition,
  },
  [GoogleSheetsToolsetDefinition.key]: {
    class: undefined,
    definition: GoogleSheetsToolsetDefinition,
  },
  [TwitterToolsetDefinition.key]: {
    class: undefined,
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
  [GitHubToolsetDefinition.key]: {
    class: undefined,
    definition: GitHubToolsetDefinition,
  },
  [GmailToolsetDefinition.key]: {
    class: undefined,
    definition: GmailToolsetDefinition,
  },
  // [LinkedInToolsetDefinition.key]: {
  //   class: undefined,
  //   definition: LinkedInToolsetDefinition,
  // },
  [RedditToolsetDefinition.key]: {
    class: undefined,
    definition: RedditToolsetDefinition,
  },
};
