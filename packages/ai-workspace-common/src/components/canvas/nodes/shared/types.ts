import { Node, NodeProps } from '@xyflow/react';
import {
  CanvasNodeData,
  DocumentNodeMeta,
  ResourceNodeMeta,
  SkillNodeMeta,
  ToolNodeMeta,
  ResponseNodeMeta,
  ImageNodeMeta,
  CodeArtifactNodeMeta,
  WebsiteNodeMeta,
} from '@refly/canvas-common';

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
