import { CanvasNode, CanvasNodeType } from '@refly/openapi-schema';
import { CanvasNodeFilter } from '@refly/canvas-common';
import { genNodeID, genNodeEntityId } from '@refly/utils';

/**
 * Build connectTo filters from edges to preserve connections when adding nodes.
 * Maps target node IDs to source node filters for CanvasSyncService.addNodesToCanvas.
 */
export function buildConnectToFilters(
  nodes: CanvasNode[],
  edges: Array<{ source: string; target: string }>,
): Map<string, CanvasNodeFilter[]> {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const map = new Map<string, CanvasNodeFilter[]>();

  for (const edge of edges) {
    const sourceNode = nodeById.get(edge.source);
    if (!sourceNode) continue;

    const list = map.get(edge.target) || [];
    list.push({
      type: sourceNode.type as CanvasNodeType,
      entityId: (sourceNode.data?.entityId as string) || '',
      handleType: 'source',
    });
    map.set(edge.target, list);
  }

  return map;
}

/**
 * CLI node input structure (from CLI builder schema)
 */
export interface CliNodeInput {
  id: string;
  type: string;
  input?: Record<string, unknown>;
  dependsOn?: string[];
  // Top-level shorthand fields (for simplified CLI/agent usage)
  query?: string;
  toolsetKeys?: string[];
  // Also support proper CanvasNode fields if passed
  data?: {
    title?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    // Common fields that should go into metadata
    query?: string;
    selectedToolsets?: unknown[];
    toolsetKeys?: string[];
    modelInfo?: Record<string, unknown>;
    [key: string]: unknown;
  };
  position?: { x: number; y: number };
}

/**
 * Map CLI node types to canvas node types.
 * CLI uses simplified type names (e.g., 'agent') that need to be mapped
 * to proper canvas node types (e.g., 'skillResponse').
 */
function mapCliNodeTypeToCanvasType(cliType: string): CanvasNodeType {
  const typeMapping: Record<string, CanvasNodeType> = {
    agent: 'skillResponse',
    skill: 'skillResponse',
    // Add more mappings as needed
  };
  return (typeMapping[cliType] || cliType) as CanvasNodeType;
}

/**
 * Transform CLI nodes to proper canvas node format.
 * CLI nodes use a simplified schema with `input` field, but canvas expects
 * proper `data` structure with `entityId`, `metadata`, etc.
 */
export function transformCliNodesToCanvasNodes(
  cliNodes: CliNodeInput[],
): Array<Pick<CanvasNode, 'type' | 'data'> & Partial<Pick<CanvasNode, 'id'>>> {
  return cliNodes.map((cliNode) => {
    const nodeType = mapCliNodeTypeToCanvasType(cliNode.type);
    const entityId = cliNode.data?.entityId || genNodeEntityId(nodeType);
    const defaultMetadata = getDefaultMetadataForNodeType(nodeType);
    const inputMetadata = cliNode.input || {};

    const dataFieldsForMetadata: Record<string, unknown> = {};

    if (cliNode.query !== undefined) {
      dataFieldsForMetadata.query = cliNode.query;
    } else if (cliNode.data?.query !== undefined) {
      dataFieldsForMetadata.query = cliNode.data.query;
    }

    if (cliNode.toolsetKeys !== undefined) {
      dataFieldsForMetadata.toolsetKeys = cliNode.toolsetKeys;
    } else if (cliNode.data?.toolsetKeys !== undefined) {
      dataFieldsForMetadata.toolsetKeys = cliNode.data.toolsetKeys;
    }

    if (cliNode.data?.selectedToolsets !== undefined) {
      dataFieldsForMetadata.selectedToolsets = cliNode.data.selectedToolsets;
    }
    if (cliNode.data?.modelInfo !== undefined) {
      dataFieldsForMetadata.modelInfo = cliNode.data.modelInfo;
    }

    const metadata = {
      ...defaultMetadata,
      ...cliNode.data?.metadata,
      ...inputMetadata,
      ...dataFieldsForMetadata,
      sizeMode: 'compact' as const,
    };

    return {
      id: cliNode.id || genNodeID(),
      type: nodeType,
      data: {
        title: cliNode.data?.title || getDefaultTitleForNodeType(nodeType),
        entityId,
        contentPreview: (cliNode.data?.contentPreview as string) || '',
        metadata,
      },
    };
  });
}

function getDefaultMetadataForNodeType(nodeType: CanvasNodeType): Record<string, unknown> {
  switch (nodeType) {
    case 'start':
      return {};
    case 'skillResponse':
      return {
        status: 'init',
        version: 0,
      };
    case 'document':
      return {
        contentPreview: '',
        lastModified: new Date().toISOString(),
        status: 'finish',
      };
    case 'resource':
      return {
        resourceType: 'weblink',
        lastAccessed: new Date().toISOString(),
      };
    case 'tool':
      return {
        toolType: 'TextToSpeech',
        configuration: {},
        status: 'ready',
      };
    case 'toolResponse':
      return {
        status: 'waiting',
      };
    case 'memo':
      return {};
    default:
      return {};
  }
}

function getDefaultTitleForNodeType(nodeType: CanvasNodeType): string {
  switch (nodeType) {
    case 'start':
      return 'Start';
    case 'skillResponse':
      return 'Agent';
    case 'document':
      return 'Document';
    case 'resource':
      return 'Resource';
    case 'tool':
      return 'Tool';
    case 'toolResponse':
      return 'Tool Response';
    case 'memo':
      return 'Memo';
    default:
      return 'Untitled';
  }
}
