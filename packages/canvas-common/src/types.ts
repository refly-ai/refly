import { Edge, Node, XYPosition } from '@xyflow/react';
import {
  ActionLog,
  ActionMeta,
  ActionStatus,
  Artifact,
  CanvasNodeType,
  CodeArtifactType,
  GenericToolset,
  IndexError,
  IndexStatus,
  MediaType,
  ModelInfo,
  ProviderItem,
  ResourceMeta,
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
  resourceMeta?: ResourceMeta;
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
  selectedToolsets?: GenericToolset[];
  modelInfo?: ModelInfo | null;
  contextItems?: IContextItem[];
  tplConfig?: SkillTemplateConfig;
  runtimeConfig?: SkillRuntimeConfig;
  sizeMode?: 'compact' | 'adaptive';
  style?: React.CSSProperties;
  originalWidth?: number;
  projectId?: string;
};

export type MediaSkillNodeMeta = {
  query?: string;
  resultId?: string;
  version?: number;
  modelInfo?: ModelInfo;
  contextItems?: IContextItem[];
  selectedModel?: ProviderItem;
  runtimeConfig?: SkillRuntimeConfig;
  sizeMode?: 'compact' | 'adaptive';
  style?: React.CSSProperties;
  originalWidth?: number;
  projectId?: string;
};

export type MediaSkillResponseNodeMeta = {
  prompt: string;
  status: ActionStatus;
  mediaType?: MediaType;
  resultId?: string;
  selectedModel?: ProviderItem | null;
};

export type ToolNodeMeta = {
  toolType: string;
  sizeMode?: 'compact' | 'adaptive';
  style?: React.CSSProperties;
  originalWidth?: number;
};

export type ResponseNodeMeta = {
  status?: ActionStatus;
  version?: number;
  modelInfo?: ModelInfo | null;
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
  [key: string]: any;
};

export type ImageNodeMeta = {
  imageUrl: string;
  storageKey: string;
  showBorder?: boolean;
  showTitle?: boolean;
  resultId?: string;
  selectedModel?: ModelInfo | null;
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
  mediaSkill: MediaSkillNodeMeta;
  tool: ToolNodeMeta;
  response: ResponseNodeMeta;
  image: ImageNodeMeta;
  codeArtifact: CodeArtifactNodeMeta;
  website: WebsiteNodeMeta;
} & Record<string, Record<string, unknown>>;

export interface CanvasState {
  title: string;
  nodes: CanvasNode[];
  edges: Edge[];
}
