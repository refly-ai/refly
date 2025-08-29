import { CanvasNodeType, SelectionKey } from '@refly/openapi-schema';

export type ResourceFileType =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'text/markdown'
  | 'text/plain'
  | 'application/epub+zip'
  | 'text/html';

// Define background colors for different node types
export const NODE_COLORS: Record<
  CanvasNodeType | 'threadHistory' | SelectionKey | ResourceFileType,
  string
> = {
  document: 'var(--refly-Colorful-Blue)',
  documentSelection: 'var(--refly-Colorful-Blue)',
  documentCursorSelection: 'var(--refly-Colorful-Blue)',
  documentBeforeCursorSelection: 'var(--refly-Colorful-Blue)',
  documentAfterCursorSelection: 'var(--refly-Colorful-Blue)',

  codeArtifact: 'var(--refly-Colorful-Blue)',
  website: 'var(--refly-Colorful-Blue)',

  start: 'var(--refly-primary-default)',
  resource: 'var(--refly-primary-default)',
  resourceSelection: 'var(--refly-primary-default)',

  skillResponse: 'var(--refly-Colorful-orange)',
  skillResponseSelection: 'var(--refly-Colorful-orange)',
  toolResponse: 'var(--refly-Colorful-orange)',
  memo: 'var(--refly-Colorful-orange)',

  skill: '#6172F3',
  mediaSkill: '#E93D82',
  mediaSkillResponse: '#E93D82',
  tool: '#2E90FA',
  group: 'var(--refly-primary-default)',
  threadHistory: '#64748b',
  image: '#02b0c7',

  video: 'var(--refly-Colorful-red)',
  audio: 'var(--refly-Colorful-red)',
  extensionWeblinkSelection: '#17B26A',
  'application/pdf': 'var(--refly-Colorful-red)',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'var(--refly-Colorful-Blue)',
  'text/markdown': 'var(--refly-text-1)',
  'text/plain': 'var(--refly-Colorful-Blue)',
  'application/epub+zip': 'var(--refly-text-0)',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'var(--refly-Colorful-Blue)',
  'text/html': 'var(--refly-Colorful-Blue)',
};
export const NODE_MINI_MAP_COLORS = {
  ...NODE_COLORS,
  resource: '#40df2b',
  group: '#bfc5bf',
  memo: 'transparent',
};
