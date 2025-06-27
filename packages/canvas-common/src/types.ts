import { Node, XYPosition } from '@xyflow/react';
import {
  ActionLog,
  ActionMeta,
  ActionStatus,
  Artifact,
  CanvasNodeType,
  CodeArtifactType,
  IndexError,
  IndexStatus,
  ModelInfo,
  ResourceType,
  Skill,
  SkillRuntimeConfig,
  SkillTemplateConfig,
  TokenUsageItem,
} from '@refly/openapi-schema';
import { IContextItem } from '@refly/common-types';

export type CanvasNodeData<T = Record<string, unknown>> = {
  title: string;
  entityId: string;
  createdAt?: string;
  contentPreview?: string;
  reasoningContent?: string;
  metadata?: T;
  targetHandle?: string;
  sourceHandle?: string;
};

export type CanvasNode<T = Record<string, unknown>> = Node<CanvasNodeData<T>, CanvasNodeType> & {
  className?: string;
  style?: React.CSSProperties;
  position?: XYPosition;
};

export interface CanvasNodeFilter {
  type: CanvasNodeType;
  entityId: string;
  handleType?: 'source' | 'target';
}

export interface NodeData extends Record<string, unknown> {
  connections?: string[];
}

export interface DocumentNodeMeta {
  status: ActionStatus;
  sizeMode?: 'compact' | 'adaptive';
  style?: React.CSSProperties;
  originalWidth?: number;
  shareId?: string;
}

export interface ResourceNodeMeta {
  resourceType?: ResourceType;
  indexStatus?: IndexStatus;
  indexError?: IndexError;
  sizeMode?: 'compact' | 'adaptive';
  style?: React.CSSProperties;
  originalWidth?: number;
  shareId?: string;
}

export interface CodeArtifactNodeMeta {
  status?: 'generating' | 'finish' | 'failed' | 'executing';
  shareId?: string;
  previewUrl?: string;
  previewStorageKey?: string;
  language?: string;
  type?: CodeArtifactType;
  title?: string;
  sizeMode?: 'compact' | 'adaptive';
  style?: React.CSSProperties;
  originalWidth?: number;
  activeTab?: 'code' | 'preview';
  code?: string; // @deprecated
}

export type SkillNodeMeta = {
  query?: string;
  resultId?: string;
  version?: number;
  selectedSkill?: Skill;
  modelInfo?: ModelInfo;
  contextItems?: IContextItem[];
  tplConfig?: SkillTemplateConfig;
  runtimeConfig?: SkillRuntimeConfig;
  sizeMode?: 'compact' | 'adaptive';
  style?: React.CSSProperties;
  originalWidth?: number;
  projectId?: string;
};

export type ToolNodeMeta = {
  toolType: string;
  sizeMode?: 'compact' | 'adaptive';
  style?: React.CSSProperties;
  originalWidth?: number;
};

export type ResponseNodeMeta = {
  status: ActionStatus;
  version?: number;
  modelInfo?: ModelInfo;
  tokenUsage?: TokenUsageItem[];
  actionMeta?: ActionMeta;
  artifacts?: Artifact[];
  currentLog?: ActionLog;
  errors?: string[];
  structuredData?: Record<string, unknown>;
  selectedSkill?: Skill;
  contextItems?: IContextItem[];
  tplConfig?: SkillTemplateConfig;
  runtimeConfig?: SkillRuntimeConfig;
  sizeMode?: 'compact' | 'adaptive';
  style?: React.CSSProperties;
  originalWidth?: number;
  reasoningContent?: string;
  shareId?: string;
  pilotSessionId?: string;
  pilotStepId?: string;
};

export type ImageNodeMeta = {
  imageType: string;
  imageUrl: string;
  storageKey: string;
  showBorder?: boolean;
  showTitle?: boolean;
  sizeMode?: 'compact' | 'adaptive';
  style?: React.CSSProperties;
  originalWidth?: number;
};

// Website node metadata
export interface WebsiteNodeMeta {
  url?: string;
  isEditing?: boolean;
  viewMode?: 'form' | 'preview';
  sizeMode?: 'compact' | 'adaptive';
  style?: React.CSSProperties;
  originalWidth?: number;
}

// Type mapping for node metadata
export type NodeMetadataMap = {
  document: DocumentNodeMeta;
  resource: ResourceNodeMeta;
  skill: SkillNodeMeta;
  tool: ToolNodeMeta;
  response: ResponseNodeMeta;
  image: ImageNodeMeta;
  codeArtifact: CodeArtifactNodeMeta;
  website: WebsiteNodeMeta;
} & Record<string, Record<string, unknown>>;
