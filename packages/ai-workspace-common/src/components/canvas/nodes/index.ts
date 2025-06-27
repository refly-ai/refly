import { NodeTypes } from '@xyflow/react';
import { CanvasNodeType } from '@refly/openapi-schema';
import { DocumentNode } from './document';
import { ResourceNode } from './resource';
import { SkillNode } from './skill';
import { ToolNode } from './tool';
import { SkillResponseNode } from './skill-response';
import { MemoNode } from './memo/memo';
import { GroupNode } from './group';
import { ImageNode } from './image';
import { CodeArtifactNode } from './code-artifact';
import { WebsiteNode } from './website';
import { GhostNode } from './ghost';
import {
  NodeMetadataMap,
  CanvasNodeData,
  DocumentNodeMeta,
  ResourceNodeMeta,
  SkillNodeMeta,
  ToolNodeMeta,
  ResponseNodeMeta,
  CodeArtifactNodeMeta,
} from '@refly/canvas-common';
import { t } from 'i18next';
import { genUniqueId } from '@refly/utils/id';

// Export all components and types
export * from './document';
export * from './resource';
export * from './skill';
export * from './tool';
export * from './skill-response';
export * from './memo/memo';
export * from './group';
export * from './image';
export * from './code-artifact';
export * from './website';

// Node types mapping
export const nodeTypes: NodeTypes = {
  document: DocumentNode,
  resource: ResourceNode,
  skill: SkillNode,
  tool: ToolNode,
  skillResponse: SkillResponseNode,
  memo: MemoNode,
  group: GroupNode,
  image: ImageNode,
  codeArtifact: CodeArtifactNode,
  website: WebsiteNode,
  ghost: GhostNode,
};

// Helper function to prepare node data
export const prepareNodeData = <T extends CanvasNodeType>({
  type,
  data,
  position = { x: 0, y: 0 },
  connectable = true,
  selected = false,
  selectable = true,
  className,
  style,
  draggable = true,
  zIndex,
  id,
}: {
  type: T;
  data: CanvasNodeData<NodeMetadataMap[T]>;
  position?: { x: number; y: number };
  connectable?: boolean;
  selectable?: boolean;
  selected?: boolean;
  className?: string;
  style?: React.CSSProperties;
  draggable?: boolean;
  zIndex?: number;
  id?: string;
}) => {
  return {
    id: id || `node-${genUniqueId()}`,
    type,
    position,
    data,
    connectable,
    selected,
    selectable,
    className,
    style,
    draggable,
    zIndex,
  };
};

// Helper function to get default metadata based on node type
export const getNodeDefaultMetadata = (nodeType: CanvasNodeType) => {
  if (!nodeType) {
    return {};
  }

  // Base metadata to include in all node types
  const baseMetadata = {
    sizeMode: 'adaptive' as const, // Default size mode that will be overridden with global setting
  };

  switch (nodeType) {
    case 'document':
      return {
        ...baseMetadata,
        contentPreview: t('canvas.nodePreview.document.contentPreview'),
        // Add optional fields with default values
        title: '',
        lastModified: new Date().toISOString(),
        status: 'finish',
      } as DocumentNodeMeta;

    case 'resource':
      return {
        ...baseMetadata,
        resourceType: 'weblink', // Default to weblink
        url: '',
        description: '',
        lastAccessed: new Date().toISOString(),
        contentPreview: t('canvas.nodePreview.resource.contentPreview'),
      } as ResourceNodeMeta;

    case 'skill':
      return {
        ...baseMetadata,
        query: '',
        modelInfo: null,
      } as SkillNodeMeta;

    case 'tool':
      return {
        ...baseMetadata,
        toolType: 'TextToSpeech',
        configuration: {}, // Tool-specific configuration
        status: 'ready',
        lastUsed: null,
      } as ToolNodeMeta;

    case 'skillResponse':
      return {
        ...baseMetadata,
        status: 'waiting',
        version: 0,
      } as ResponseNodeMeta;

    case 'toolResponse':
      return {
        ...baseMetadata,
        modelName: 'Tool Response',
        status: 'waiting',
        executionTime: null,
      } as ResponseNodeMeta;

    case 'image':
      return {
        ...baseMetadata,
        style: {},
      };

    case 'codeArtifact':
      return {
        ...baseMetadata,
        status: 'generating',
        language: 'typescript',
        style: {},
        activeTab: 'code',
      } as CodeArtifactNodeMeta;

    default:
      return baseMetadata;
  }
};

// Add this helper function to share common styles
export const getNodeCommonStyles = ({
  selected,
  isHovered,
}: { selected: boolean; isHovered: boolean }) => `
  bg-white dark:bg-gray-900
  rounded-xl
  box-border
  transition-all
  duration-200
  border-[1px]
  border-solid
  overflow-hidden
  ${selected ? 'border-[#00968F] border-solid border-2' : 'border-transparent'}
  ${
    isHovered
      ? 'shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)]'
      : 'shadow-[0px_1px_2px_0px_rgba(16,24,60,0.05)]'
  }
  hover:shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)]
`;
