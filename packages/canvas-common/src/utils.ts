import { CanvasEdge, CanvasNode, GenericToolset } from '@refly/openapi-schema';
import { CanvasNodeFilter } from './types';
import { Node, Edge, Viewport } from '@xyflow/react';
import { calculateNodePosition } from './position';
import { getNodeDefaultMetadata } from './nodes';
import { deepmerge, genUniqueId } from '@refly/utils';
import { purgeContextItems } from './context';
import { IContextItem } from '@refly/common-types';
import { purgeToolsets } from './tools';

export interface AddNodeParam {
  node: Partial<CanvasNode>;
  nodes: Node[];
  edges: Edge[];
  connectTo?: CanvasNodeFilter[];
  viewport?: Viewport;
  autoLayout?: boolean; // Control whether to enable auto layout
  skipPurgeToolsets?: boolean; // Skip purging toolsets to preserve definition and authData
}

export const deduplicateNodes = (nodes: CanvasNode[]) => {
  const uniqueNodesMap = new Map<string, CanvasNode>();
  for (const node of nodes) {
    uniqueNodesMap.set(node.id, node);
  }
  return Array.from(uniqueNodesMap.values());
};

export const deduplicateEdges = <T extends { source?: string; target?: string; id?: string }>(
  edges: T[],
): T[] => {
  // Use a combination of source and target to identify duplicate edges
  // This ensures that two nodes can only have one connection between them
  const uniqueEdgesMap = new Map<string, T>();
  for (const edge of edges) {
    if (!edge?.source || !edge?.target) {
      continue;
    }
    // Create a unique key based on source and target
    const edgeKey = `${edge.source}-${edge.target}`;
    // Keep the first edge found for each source-target pair
    if (!uniqueEdgesMap.has(edgeKey)) {
      uniqueEdgesMap.set(edgeKey, edge);
    }
  }
  return Array.from(uniqueEdgesMap.values());
};

export const prepareAddNode = (
  param: AddNodeParam,
): { newNode: CanvasNode; newEdges: CanvasEdge[] } => {
  const {
    node = {},
    connectTo = [],
    nodes,
    edges,
    viewport,
    autoLayout,
    skipPurgeToolsets,
  } = param;

  // Check if a node with the same entityType and entityId already exists
  const existingNode = nodes.find(
    (n) => n.type === node.type && n.data?.entityId === node.data?.entityId,
  );

  if (existingNode) {
    // If node exists, return it without creating new edges
    return { newNode: deepmerge(existingNode, node) as CanvasNode, newEdges: [] };
  }

  // If connectTo is not provided, connect the new node to the start node
  if (!connectTo?.length) {
    const startNode = nodes.find((n) => n.type === 'start');
    const connectToStart: CanvasNodeFilter = {
      type: 'start',
      entityId: startNode?.data?.entityId as string,
      handleType: 'source',
    };

    connectTo.push(connectToStart);
  }

  // Purge context items if they exist
  if (node.data?.metadata?.contextItems) {
    node.data.metadata.contextItems = purgeContextItems(
      node.data.metadata.contextItems as IContextItem[],
    );
  }

  // Purge selected toolsets if they exist (unless skipPurgeToolsets is true)
  if (node.data?.metadata?.selectedToolsets && !skipPurgeToolsets) {
    node.data.metadata.selectedToolsets = purgeToolsets(
      node.data.metadata.selectedToolsets as GenericToolset[],
    );
  }

  // Find source nodes and target nodes based on handleType
  const sourceNodes = connectTo
    ?.filter((filter) => !filter.handleType || filter.handleType === 'source')
    ?.map((filter) =>
      nodes.find((n) => n.type === filter.type && n.data?.entityId === filter.entityId),
    )
    .filter((node): node is Node => node !== undefined);

  const targetNodes = connectTo
    ?.filter((filter) => filter.handleType === 'target')
    ?.map((filter) =>
      nodes.find((n) => n.type === filter.type && n.data?.entityId === filter.entityId),
    )
    .filter((node): node is Node => node !== undefined);

  // Calculate new node position using the utility function
  const newPosition = calculateNodePosition({
    nodes,
    sourceNodes: [...(sourceNodes || []), ...(targetNodes || [])],
    connectTo,
    defaultPosition: node.position,
    edges,
    viewport,
    autoLayout, // Pass autoLayout parameter to position calculation
  });

  if (node.offsetPosition && !node.position) {
    newPosition.x += node.offsetPosition.x || 0;
    newPosition.y += node.offsetPosition.y || 0;
  }

  // Get default metadata and apply global nodeSizeMode
  const defaultMetadata = getNodeDefaultMetadata(node.type ?? 'memo');

  // Apply the global nodeSizeMode to the new node's metadata
  if (defaultMetadata && typeof defaultMetadata === 'object') {
    // Using type assertion to avoid TypeScript errors since sizeMode is not on all node types
    (defaultMetadata as any).sizeMode = 'compact';
  }

  const enrichedData = {
    createdAt: new Date().toISOString(),
    title: node.data?.title ?? 'Untitled',
    entityId: node.data?.entityId ?? `entity-${genUniqueId()}`,
    contentPreview: node.data?.contentPreview,
    ...node.data,
    metadata: {
      ...defaultMetadata,
      ...node?.data?.metadata,
      sizeMode: 'compact', // Ensure sizeMode is set even if not in defaultMetadata
    },
  };

  const newNode: CanvasNode = {
    type: node.type ?? 'memo',
    data: enrichedData,
    position: newPosition,
    selected: false,
    id: node?.id || `node-${genUniqueId()}`,
  };

  // Create new edges based on connection types
  const newEdges: CanvasEdge[] = [];

  // Create edges from source nodes to new node (source -> new node)
  if (sourceNodes && sourceNodes.length > 0) {
    const sourceEdges = sourceNodes
      .filter((sourceNode) => {
        // Filter out the source nodes that already have an edge
        return !edges?.some((edge) => edge.source === sourceNode.id && edge.target === newNode.id);
      })
      .map((sourceNode) => ({
        id: `edge-${genUniqueId()}`,
        source: sourceNode.id,
        target: newNode.id,
        // style: edgeStyles.default,
        type: 'default',
      }));
    newEdges.push(...sourceEdges);
  }

  // Create edges from new node to target nodes (new node -> target)
  if (targetNodes && targetNodes.length > 0) {
    const targetEdges = targetNodes
      .filter((targetNode) => {
        // Filter out the target nodes that already have an edge
        return !edges?.some((edge) => edge.source === newNode.id && edge.target === targetNode.id);
      })
      .map((targetNode) => ({
        id: `edge-${genUniqueId()}`,
        source: newNode.id,
        target: targetNode.id,
        // style: edgeStyles.default,
        type: 'default',
      }));
    newEdges.push(...targetEdges);
  }

  return { newNode, newEdges };
};
