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
  BuiltinReadFileToolset,
  BuiltinReadFileDefinition,
  BuiltinListFilesToolset,
  BuiltinListFilesDefinition,
  BuiltinExecuteCodeToolset,
  BuiltinExecuteCodeDefinition,
} from './builtin';
import { AgentBaseToolset } from './base';
// import { BrowserUseToolset, BrowserUseToolsetDefinition } from './browser-use';
import { GitHubToolsetDefinition } from './github';
import { GmailToolsetDefinition } from './gmail';
import { GoogleDocsToolsetDefinition } from './google-docs';
import { GoogleDriveToolsetDefinition } from './google-drive';
import { GoogleSheetsToolsetDefinition } from './google-sheets';
import { JinaToolset, JinaToolsetDefinition } from './jina';
import { NotionToolset, NotionToolsetDefinition } from './notion';
import { PerplexityToolset, PerplexityToolsetDefinition } from './perplexity';
// import { ProductHuntToolset, ProductHuntToolsetDefinition } from './producthunt';
import { RedditToolsetDefinition } from './reddit';
import { TwitterToolsetDefinition } from './twitter';
// import { WhaleWisdomToolset, WhaleWisdomToolsetDefinition } from './whalewisdom';
// import { SandboxToolset, SandboxToolsetDefinition } from './sandbox';
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
  [BuiltinReadFileDefinition.key]: {
    class: BuiltinReadFileToolset,
    definition: BuiltinReadFileDefinition,
  },
  [BuiltinListFilesDefinition.key]: {
    class: BuiltinListFilesToolset,
    definition: BuiltinListFilesDefinition,
  },
  [BuiltinExecuteCodeDefinition.key]: {
    class: BuiltinExecuteCodeToolset,
    definition: BuiltinExecuteCodeDefinition,
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
  [PerplexityToolsetDefinition.key]: {
    class: PerplexityToolset,
    definition: PerplexityToolsetDefinition,
  },
  // [ProductHuntToolsetDefinition.key]: {
  //   class: ProductHuntToolset,
  //   definition: ProductHuntToolsetDefinition,
  // },
  // [BrowserUseToolsetDefinition.key]: {
  //   class: BrowserUseToolset,
  //   definition: BrowserUseToolsetDefinition,
  // },
  [GitHubToolsetDefinition.key]: {
    class: undefined,
    definition: GitHubToolsetDefinition,
  },
  [GmailToolsetDefinition.key]: {
    class: undefined,
    definition: GmailToolsetDefinition,
  },
  [RedditToolsetDefinition.key]: {
    class: undefined,
    definition: RedditToolsetDefinition,
  },
};
