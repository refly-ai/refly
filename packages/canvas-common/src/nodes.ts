import { CanvasNodeType } from '@refly/openapi-schema';
import { Edge, Node } from '@xyflow/react';
import { genUniqueId } from '@refly/utils';
import {
  NodeMetadataMap,
  CanvasNodeData,
  DocumentNodeMeta,
  ResourceNodeMeta,
  SkillNodeMeta,
  ToolNodeMeta,
  ResponseNodeMeta,
  CodeArtifactNodeMeta,
} from './types';

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
        contentPreview: '',
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
        contentPreview: '',
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

// Helper function to get node height
export const getNodeHeight = (node: Node): number => {
  return node.measured?.height ?? 320;
};

// Add helper function to get node width
export const getNodeWidth = (node: Node): number => {
  return node.measured?.width ?? 288;
};

// Get the level of a node from root
export const getNodeLevel = (
  nodeId: string,
  _nodes: Node[],
  edges: any[],
  rootNodes: Node[],
): number => {
  const visited = new Set<string>();
  const queue: Array<{ id: string; level: number }> = rootNodes.map((node) => ({
    id: node.id,
    level: 0,
  }));

  while (queue.length > 0) {
    const item = queue.shift() ?? { id: '', level: -1 };
    const { id, level } = item;

    if (id && id === nodeId) return level;
    if (visited.has(id) || !id) continue;
    visited.add(id);

    const nextIds = edges
      .filter((edge) => edge.source === id)
      .map((edge) => ({ id: edge.target, level: level + 1 }));

    queue.push(...nextIds);
  }

  return -1;
};

// Helper function to get root nodes (nodes with no incoming edges)
export const getRootNodes = (nodes: Node[], edges: Edge[]): Node[] => {
  return nodes.filter((node) => !edges.some((edge) => edge.target === node.id));
};
