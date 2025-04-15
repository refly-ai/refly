import { Node, NodeProps, XYPosition } from '@xyflow/react';
import {
  ActionLog,
  ActionMeta,
  ActionStatus,
  Artifact,
  CanvasNodeType,
  IndexError,
  IndexStatus,
  ModelInfo,
  ResourceType,
  Skill,
  SkillRuntimeConfig,
  SkillTemplateConfig,
  TokenUsageItem,
} from '@refly/openapi-schema';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { CodeArtifactType } from '@refly/openapi-schema';

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

// Node specific metadata types
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
  status?: 'generating' | 'finish' | 'failed';
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
};

export type ImageNodeMeta = {
  imageType: string;
  imageUrl: string;
  storageKey: string;
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

// Add new common props interface
export interface CommonNodeProps {
  isPreview?: boolean; // Control preview mode
  hideActions?: boolean; // Control action buttons visibility
  hideHandles?: boolean; // Control handles visibility
  onNodeClick?: () => void; // Optional click handler
}

// Update existing node props
export type DocumentNodeProps = NodeProps<Node<CanvasNodeData<DocumentNodeMeta>, 'document'>> &
  CommonNodeProps;
export type ResourceNodeProps = NodeProps<Node<CanvasNodeData<ResourceNodeMeta>, 'resource'>> &
  CommonNodeProps;
export type SkillResponseNodeProps = NodeProps<
  Node<CanvasNodeData<ResponseNodeMeta>, 'skillResponse'>
> &
  CommonNodeProps;
export type MemoNodeProps = NodeProps<Node<CanvasNodeData, 'memo'>> & CommonNodeProps;
export type ImageNodeProps = NodeProps<Node<CanvasNodeData<ImageNodeMeta>, 'image'>> &
  CommonNodeProps;
export type CodeArtifactNodeProps = NodeProps<
  Node<CanvasNodeData<CodeArtifactNodeMeta>, 'codeArtifact'>
> &
  CommonNodeProps;
export type WebsiteNodeProps = NodeProps<Node<CanvasNodeData<WebsiteNodeMeta>, 'website'>> &
  CommonNodeProps;
