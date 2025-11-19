import type { MentionItemType } from '@refly/utils';

export type MentionItemSource =
  | 'variables'
  | 'agents'
  | 'files'
  | 'products'
  | 'toolsets'
  | 'tools';

export const mentionItemSourceToType: Record<MentionItemSource, MentionItemType> = {
  variables: 'var',
  agents: 'agent',
  files: 'file',
  products: 'file',
  toolsets: 'toolset',
  tools: 'tool',
};
