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
import { GmailToolset, GmailToolsetDefinition } from './gmail';
import { TwitterToolset, TwitterToolsetDefinition } from './twitter';
import { NotionToolset, NotionToolsetDefinition } from './notion';
import { GenerateAudioFalToolset, GenerateAudioFalToolsetDefinition } from './generate-audio-fal';
import { GenerateImageFalToolset, GenerateImageFalToolsetDefinition } from './generate-image-fal';
import { GenerateVideoFalToolset, GenerateVideoFalToolsetDefinition } from './generate-video-fal';

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
  [GmailToolsetDefinition.key]: {
    class: GmailToolset,
    definition: GmailToolsetDefinition,
  },
  [TwitterToolsetDefinition.key]: {
    class: TwitterToolset,
    definition: TwitterToolsetDefinition,
  },
  [NotionToolsetDefinition.key]: {
    class: NotionToolset,
    definition: NotionToolsetDefinition,
  },
  [GenerateAudioFalToolsetDefinition.key]: {
    class: GenerateAudioFalToolset,
    definition: GenerateAudioFalToolsetDefinition,
  },
  [GenerateImageFalToolsetDefinition.key]: {
    class: GenerateImageFalToolset,
    definition: GenerateImageFalToolsetDefinition,
  },
  [GenerateVideoFalToolsetDefinition.key]: {
    class: GenerateVideoFalToolset,
    definition: GenerateVideoFalToolsetDefinition,
  },
};
