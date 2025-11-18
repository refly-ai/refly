import {
  SkillContextContentItem,
  SkillContextDocumentItem,
  SkillContextResourceItem,
  Source,
} from '@refly/openapi-schema';
import { BaseMessage } from '@langchain/core/messages';
import { LOCALE } from '@refly/common-types';
import { BaseSkillState } from '../../base';
import { ContentNodeType } from '../../engine';

export interface SkillContextContentItemMetadata {
  domain: ContentNodeType;
  url?: string;
  title: string;
  entityId?: string;
}

export type SelectedContentDomain =
  | 'resourceSelection'
  | 'documentSelection'
  | 'extensionWeblinkSelection';

export interface Chunk {
  content: string;
  metadata: {
    start: number;
    end: number;
  };
}

export interface MentionedContextItem {
  type?: 'document' | 'resource' | 'selectedContent';
  entityId?: string;
  url?: string;
  title?: string;
  useWholeContent?: boolean;
}

export interface QueryAnalysis {
  analysis: {
    queryAnalysis: string;
    queryRewriteStrategy: string;
    summary: string;
  };
  rewrittenQueries: string[];
  optimizedQuery: string;
  mentionedContext: IContext;
}

export interface QueryProcessorResult {
  optimizedQuery: string;
  query: string;
  usedChatHistory: any[];
  hasContext: boolean;
  remainingTokens: number;
  mentionedContext: any;
}

export interface IContext {
  contentList: SkillContextContentItem[];
  resources: SkillContextResourceItem[];
  documents: SkillContextDocumentItem[];
  messages?: BaseMessage[];
  webSearchSources?: Source[];
  librarySearchSources?: Source[];
  urlSources?: Source[];
  locale?: string | LOCALE;
}

export interface GraphState extends BaseSkillState {
  /**
   * Accumulated messages.
   */
  messages: BaseMessage[];
}
