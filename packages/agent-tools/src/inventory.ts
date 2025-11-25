import { ToolsetDefinition } from '@refly/openapi-schema';
import {
  BuiltinWebSearchToolset,
  BuiltinWebSearchDefinition,
  BuiltinGenerateDocToolset,
  BuiltinGenerateDocDefinition,
  BuiltinGenerateCodeArtifactToolset,
  BuiltinGenerateCodeArtifactDefinition,
  BuiltinSendEmailToolset,
  BuiltinSendEmailDefinition,
  BuiltinGetTimeToolset,
  BuiltinGetTimeDefinition,
} from './builtin';
import { AgentBaseToolset } from './base';
import { BrowserUseToolset, BrowserUseToolsetDefinition } from './browser-use';
// import { FalAudioToolset, FalAudioToolsetDefinition } from './fal-audio';
// import { FalImageToolset, FalImageToolsetDefinition } from './fal-image';
// import { FalVideoToolset, FalVideoToolsetDefinition } from './fal-video';
import { FirecrawlToolset, FirecrawlToolsetDefinition } from './firecrawl';
// DEPRECATED: FishAudio and HeyGen are now loaded from configuration
// import { FishAudioToolset, FishAudioToolsetDefinition } from './fish-audio';
import { GitHubToolsetDefinition } from './github';
// import { HeyGenToolset, HeyGenToolsetDefinition } from './heygen';
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
import { Apify13FToolset, Apify13FToolsetDefinition } from './apify-13f';

export type AnyToolsetClass = new (...args: any[]) => AgentBaseToolset<any>;

export const builtinToolsetInventory: Record<
  string,
  {
    class: AnyToolsetClass;
    definition: ToolsetDefinition;
  }
> = {
  [BuiltinWebSearchDefinition.key]: {
    class: BuiltinWebSearchToolset,
    definition: BuiltinWebSearchDefinition,
  },
  [BuiltinGenerateDocDefinition.key]: {
    class: BuiltinGenerateDocToolset,
    definition: BuiltinGenerateDocDefinition,
  },
  [BuiltinGenerateCodeArtifactDefinition.key]: {
    class: BuiltinGenerateCodeArtifactToolset,
    definition: BuiltinGenerateCodeArtifactDefinition,
  },
  [BuiltinSendEmailDefinition.key]: {
    class: BuiltinSendEmailToolset,
    definition: BuiltinSendEmailDefinition,
  },
  [BuiltinGetTimeDefinition.key]: {
    class: BuiltinGetTimeToolset,
    definition: BuiltinGetTimeDefinition,
  },
};

// Oauth tool use external sdk to execute, so the class is undefined
export const toolsetInventory: Record<
  string,
  {
    class: AnyToolsetClass | undefined;
    definition: ToolsetDefinition;
  }
> = {
  [FirecrawlToolsetDefinition.key]: {
    class: FirecrawlToolset,
    definition: FirecrawlToolsetDefinition,
  },
  [SandboxToolsetDefinition.key]: {
    class: SandboxToolset,
    definition: SandboxToolsetDefinition,
  },
  [Apify13FToolsetDefinition.key]: {
    class: Apify13FToolset,
    definition: Apify13FToolsetDefinition,
  },

  [GoogleDriveToolsetDefinition.key]: {
    class: undefined,
    definition: GoogleDriveToolsetDefinition,
  },
  [JinaToolsetDefinition.key]: {
    class: JinaToolset,
    definition: JinaToolsetDefinition,
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
  // [FalAudioToolsetDefinition.key]: {
  //   class: FalAudioToolset,
  //   definition: FalAudioToolsetDefinition,
  // },
  // [FalImageToolsetDefinition.key]: {
  //   class: FalImageToolset,
  //   definition: FalImageToolsetDefinition,
  // },
  // [FalVideoToolsetDefinition.key]: {
  //   class: FalVideoToolset,
  //   definition: FalVideoToolsetDefinition,
  // },
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
