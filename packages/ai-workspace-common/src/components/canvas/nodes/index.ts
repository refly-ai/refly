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
import {
  NodeMetadataMap,
  CanvasNodeData,
  DocumentNodeMeta,
  ResourceNodeMeta,
  SkillNodeMeta,
  ToolNodeMeta,
  ResponseNodeMeta,
} from './shared/types';
import { t } from 'i18next';
import { genUniqueId } from '@refly-packages/utils/id';

// Export all components and types
export * from './shared/types';
export * from './document';
export * from './resource';
export * from './skill';
export * from './tool';
export * from './skill-response';
export * from './memo/memo';
export * from './group';
export * from './image';
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
}) => {
  return {
    id: `node-${genUniqueId()}`,
    type,
    position,
    data,
    connectable,
    selected,
    selectable,
    className,
    style,
    draggable,
  };
};

// Helper function to get default metadata based on node type
export const getNodeDefaultMetadata = (nodeType: CanvasNodeType) => {
  if (!nodeType) {
    return {};
  }

  switch (nodeType) {
    case 'document':
      return {
        contentPreview: t('canvas.nodePreview.document.contentPreview'),
        // Add optional fields with default values
        title: '',
        lastModified: new Date().toISOString(),
        status: 'finish',
      } as DocumentNodeMeta;

    case 'resource':
      return {
        resourceType: 'weblink', // Default to weblink
        url: '',
        description: '',
        lastAccessed: new Date().toISOString(),
        contentPreview: t('canvas.nodePreview.resource.contentPreview'),
      } as ResourceNodeMeta;

    case 'skill':
      return {
        query: '',
        modelInfo: null,
      } as SkillNodeMeta;

    case 'tool':
      return {
        toolType: 'TextToSpeech',
        configuration: {}, // Tool-specific configuration
        status: 'ready',
        lastUsed: null,
      } as ToolNodeMeta;

    case 'skillResponse':
      return {
        status: 'waiting',
        version: 0,
      } as ResponseNodeMeta;

    case 'toolResponse':
      return {
        modelName: 'Tool Response',
        status: 'waiting',
        executionTime: null,
      } as ResponseNodeMeta;

    case 'image':
      return {
        sizeMode: 'adaptive',
        style: {},
      };

    default:
      return {};
  }
};

// Add this helper function to share common styles
export const getNodeCommonStyles = ({
  selected,
  isHovered,
}: { selected: boolean; isHovered: boolean }) => `
  bg-white 
  rounded-xl
  box-border
  p-3
  transition-all
  duration-200
  border-[2px]
  border-solid
  overflow-hidden
  ${selected ? 'border-[#00968F]' : 'border-transparent'}
  ${
    isHovered
      ? 'shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)]'
      : 'shadow-[0px_1px_2px_0px_rgba(16,24,60,0.05)]'
  }
  hover:shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)]
`;
