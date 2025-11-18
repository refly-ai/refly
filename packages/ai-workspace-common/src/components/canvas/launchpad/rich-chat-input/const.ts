export type MentionItemSource =
  | 'variables'
  | 'agents'
  | 'files'
  | 'products'
  | 'toolsets'
  | 'tools';

export type MentionItemType = 'var' | 'step' | 'resource' | 'toolset' | 'tool';

export const mentionItemSourceToType: Record<MentionItemSource, MentionItemType> = {
  variables: 'var',
  agents: 'step',
  files: 'resource',
  products: 'resource',
  toolsets: 'toolset',
  tools: 'tool',
};
