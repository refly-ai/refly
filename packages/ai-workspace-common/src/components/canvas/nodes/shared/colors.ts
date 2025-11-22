import { CanvasNodeType, SelectionKey } from '@refly/openapi-schema';

export type ResourceFileType =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'text/markdown'
  | 'text/plain'
  | 'application/epub+zip'
  | 'text/html'
  // Images
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp'
  | 'image/svg+xml'
  | 'image/bmp'
  // Videos
  | 'video/mp4'
  | 'video/webm'
  | 'video/ogg'
  | 'video/quicktime'
  | 'video/x-msvideo'
  // Audio
  | 'audio/mpeg'
  | 'audio/wav'
  | 'audio/ogg'
  | 'audio/aac'
  | 'audio/webm';

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
  file: 'var(--refly-Colorful-Blue)',

  start: 'black',
  resource: 'var(--refly-primary-default)',
  resourceSelection: 'var(--refly-primary-default)',

  skillResponse: 'var(--refly-text-0)',
  skillResponseSelection: 'var(--refly-text-0)',
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
  // Images
  'image/jpeg': '#02b0c7',
  'image/png': '#02b0c7',
  'image/gif': '#02b0c7',
  'image/webp': '#02b0c7',
  'image/svg+xml': '#02b0c7',
  'image/bmp': '#02b0c7',
  // Videos
  'video/mp4': 'var(--refly-Colorful-red)',
  'video/webm': 'var(--refly-Colorful-red)',
  'video/ogg': 'var(--refly-Colorful-red)',
  'video/quicktime': 'var(--refly-Colorful-red)',
  'video/x-msvideo': 'var(--refly-Colorful-red)',
  // Audio
  'audio/mpeg': 'var(--refly-Colorful-red)',
  'audio/wav': 'var(--refly-Colorful-red)',
  'audio/ogg': 'var(--refly-Colorful-red)',
  'audio/aac': 'var(--refly-Colorful-red)',
  'audio/webm': 'var(--refly-Colorful-red)',
};

export const NODE_MINI_MAP_COLORS = {
  ...NODE_COLORS,
  resource: '#40df2b',
  group: '#bfc5bf',
  memo: 'transparent',
};

export const AGENT_CONFIG_KEY_CLASSNAMES = {
  inputs: 'bg-refly-node-contrl-2',
  tools: 'bg-refly-node-contrl-1',
  files: 'bg-refly-fill-label',
  agents: 'bg-refly-node-contrl-2',
};
