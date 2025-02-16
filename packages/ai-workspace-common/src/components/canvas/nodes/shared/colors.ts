import { CanvasNodeType } from '@refly/openapi-schema';

// Define background colors for different node types
export const NODE_COLORS: Record<CanvasNodeType | 'threadHistory', string> = {
  document: '#00968F',
  resource: '#17B26A',
  skillResponse: '#F79009',
  toolResponse: '#F79009',
  skill: '#6172F3',
  tool: '#2E90FA',
  memo: '#6172F3',
  group: '#6172F3',
  threadHistory: '#64748b',
  image: '#02b0c7',
};
