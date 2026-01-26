import { GenericToolset, ShareRecord, ShareUser } from '@refly/openapi-schema';

// Project directory types
export interface SourceObject {
  id: string;
  type: string;
  name: string;
  path?: string;
  children?: SourceObject[];
  metadata?: Record<string, any>;
}

export interface SiderData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  type: 'canvas' | 'document' | 'resource' | 'project';
  description?: string;
  coverUrl?: string;
  owner?: ShareUser;
  usedToolsets?: Array<GenericToolset>;
  shareRecord?: ShareRecord;
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
