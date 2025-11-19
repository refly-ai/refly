import { Edge, Node, XYPosition } from '@xyflow/react';
import {
  ActionLog,
  ActionMeta,
  ActionStatus,
  AgentMode,
  Artifact,
  CanvasNodeType,
  CodeArtifactType,
  GenericToolset,
  IndexError,
  IndexStatus,
  MediaModelParameter,
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
  /**
   * @deprecated Use `title` instead.
   */
  editedTitle?: string; // manually edited title
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
  parentResultId?: string;
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
  parentResultId?: string;
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
  agentMode?: AgentMode;
  copilotSessionId?: string;
  sizeMode?: 'compact' | 'adaptive';
  style?: React.CSSProperties;
  originalWidth?: number;
  projectId?: string;
  structuredData?: Record<string, unknown>;
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
  contextItems?: IContextItem[];
  mediaType?: MediaType;
  resultId?: string;
  selectedModel?: ProviderItem | null;
  modelInfo?: ModelInfo;
  inputParameters?: MediaModelParameter[];
};

export type ToolNodeMeta = {
  toolType: string;
  sizeMode?: 'compact' | 'adaptive';
  style?: React.CSSProperties;
  originalWidth?: number;
};

export type AgentConfig = {
  query?: string;
  modelInfo?: ModelInfo;
  selectedToolsets?: GenericToolset[];
  contextItems?: IContextItem[];
};

export type ResponseNodeMeta = {
  status?: ActionStatus;
  version?: number;
  query?: string;
  modelInfo?: ModelInfo | null;
  tokenUsage?: TokenUsageItem[];
  actionMeta?: ActionMeta;
  artifacts?: Artifact[];
  currentLog?: ActionLog;
  errors?: string[];
  structuredData?: Record<string, unknown>;
  selectedSkill?: Skill;
  selectedToolsets?: GenericToolset[];
  contextItems?: IContextItem[];
  upstreamResultIds?: string[];
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
  creditCost?: number;
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
  contextItems?: IContextItem[];
  modelInfo?: ModelInfo;
  parentResultId?: string;
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
