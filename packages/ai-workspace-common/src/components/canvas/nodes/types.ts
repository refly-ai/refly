import { Node, NodeProps } from '@xyflow/react';
import {
  ActionLog,
  ActionMeta,
  ActionStatus,
  Artifact,
  CanvasNodeType,
  ModelInfo,
  Skill,
  TokenUsageItem,
} from '@refly/openapi-schema';

export type CanvasNodeData<T = Record<string, unknown>> = {
  title: string;
  entityId: string;
  createdAt?: string;
  contentPreview?: string;
  metadata?: T;
  targetHandle?: string;
  sourceHandle?: string;
};

export type CanvasNode<T = Record<string, unknown>> = Node<CanvasNodeData<T>, CanvasNodeType>;

// Node specific metadata types
export type DocumentNodeMeta = {
  status: ActionStatus;
};

export type ResourceNodeMeta = {
  resourceType: string;
};

export type SkillNodeMeta = {
  query: string;
  selectedSkill?: Skill;
  modelInfo?: ModelInfo;
  contextNodeIds?: string[];
};

export type ToolNodeMeta = {
  toolType: string;
};

export type ResponseNodeMeta = {
  status: ActionStatus;
  modelInfo?: ModelInfo;
  tokenUsage?: TokenUsageItem[];
  actionMeta?: ActionMeta;
  artifacts?: Artifact[];
  currentLog?: ActionLog;
  structuredData?: Record<string, unknown>;
};

// Type mapping for node metadata
export type NodeMetadataMap = {
  document: DocumentNodeMeta;
  resource: ResourceNodeMeta;
  skill: SkillNodeMeta;
  tool: ToolNodeMeta;
  response: ResponseNodeMeta;
} & Record<string, Record<string, unknown>>;

// Add new common props interface
export interface CommonNodeProps {
  isPreview?: boolean; // Control preview mode
  hideActions?: boolean; // Control action buttons visibility
  hideHandles?: boolean; // Control handles visibility
  onNodeClick?: () => void; // Optional click handler
}

// Update existing node props
export type DocumentNodeProps = NodeProps<Node<CanvasNodeData<DocumentNodeMeta>, 'document'>> & CommonNodeProps;
export type ResourceNodeProps = NodeProps<Node<CanvasNodeData<ResourceNodeMeta>, 'resource'>> & CommonNodeProps;
export type SkillResponseNodeProps = NodeProps<Node<CanvasNodeData<ResponseNodeMeta>, 'skillResponse'>> &
  CommonNodeProps;
export type MemoNodeProps = NodeProps<Node<CanvasNodeData, 'memo'>> & CommonNodeProps;
