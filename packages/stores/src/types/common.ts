import { CanvasNodeData, ResponseNodeMeta } from '@refly/canvas-common';

// Project directory types
export interface SourceObject {
  id: string;
  type: string;
  name: string;
  path?: string;
  children?: SourceObject[];
  metadata?: Record<string, any>;
}

// Message intent source for chat
export enum MessageIntentSource {
  Canvas = 'canvas',
  Document = 'document',
  Project = 'project',
  Global = 'global',
  Search = 'search',
}

export interface SiderData {
  id: string;
  name: string;
  updatedAt: string;
  type: 'canvas' | 'document' | 'resource' | 'project';
  description?: string;
  coverUrl?: string;
}

export enum SettingsModalActiveTab {
  Language = 'language',
  Subscription = 'subscription',
  Account = 'account',
  ModelProviders = 'modelProviders',
  ModelConfig = 'modelConfig',
  ParserConfig = 'parserConfig',
  DefaultModel = 'defaultModel',
  ToolsConfig = 'toolsConfig',
  Appearance = 'appearance',
}

export interface LinearThreadMessage {
  id: string;
  resultId: string;
  nodeId: string;
  timestamp: number;
  data: CanvasNodeData<ResponseNodeMeta>;
}
