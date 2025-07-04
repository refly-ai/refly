import { CanvasNodeType } from '@refly/openapi-schema';

// Define background colors for different node types
export const NODE_COLORS: Record<CanvasNodeType | 'threadHistory', string> = {
  document: '#00968F',
  resource: '#17B26A',
  skillResponse: '#F79009',
  toolResponse: '#F79009',
  skill: '#6172F3',
  mediaSkill: '#E93D82',
  mediaSkillResponse: '#E93D82',
  tool: '#2E90FA',
  memo: '#f2eb0e',
  group: '#6172F3',
  threadHistory: '#64748b',
  image: '#02b0c7',
  codeArtifact: '#3E63DD',
  website: '#17B26A',
  video: '#FF6B6B',
  audio: '#4ECDC4',
};
export const NODE_MINI_MAP_COLORS = {
  ...NODE_COLORS,
  resource: '#40df2b',
  group: '#bfc5bf',
  memo: 'transparent',
};
