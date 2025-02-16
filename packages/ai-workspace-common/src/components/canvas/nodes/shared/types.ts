import { Node, NodeProps } from '@xyflow/react';
import {
  ActionLog,
  ActionMeta,
  ActionStatus,
  Artifact,
  CanvasNodeType,
  ModelInfo,
  Skill,
  SkillTemplateConfig,
  TokenUsageItem,
} from '@refly/openapi-schema';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';

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
};

// Node specific metadata types
export interface DocumentNodeMeta {
  status: ActionStatus;
  sizeMode?: 'compact' | 'adaptive';
  style?: React.CSSProperties;
  originalWidth?: number;
}

export interface ResourceNodeMeta {
  resourceType?: string;
  sizeMode?: 'compact' | 'adaptive';
  style?: React.CSSProperties;
  originalWidth?: number;
  rawFileKey?: string;
}

export type SkillNodeMeta = {
  query?: string;
  resultId?: string;
  version?: number;
  selectedSkill?: Skill;
  modelInfo?: ModelInfo;
  contextItems?: IContextItem[];
  tplConfig?: SkillTemplateConfig;
};

export type ToolNodeMeta = {
  toolType: string;
};

export type ResponseNodeMeta = {
  status: ActionStatus;
  version?: number;
  modelInfo?: ModelInfo;
  tokenUsage?: TokenUsageItem[];
  actionMeta?: ActionMeta;
  artifacts?: Artifact[];
  currentLog?: ActionLog;
  structuredData?: Record<string, unknown>;
  contextItems?: IContextItem[];
  sizeMode?: 'compact' | 'adaptive';
  style?: React.CSSProperties;
  originalWidth?: number;
};

export type ImageNodeMeta = {
  imageType: string;
  imageUrl: string;
  storageKey: string;
};

// Type mapping for node metadata
export type NodeMetadataMap = {
  document: DocumentNodeMeta;
  resource: ResourceNodeMeta;
  skill: SkillNodeMeta;
  tool: ToolNodeMeta;
  response: ResponseNodeMeta;
  image: ImageNodeMeta;
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
