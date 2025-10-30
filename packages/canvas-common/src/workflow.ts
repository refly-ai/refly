import {
  ActionResult,
  ActionStatus,
  CanvasData,
  CanvasEdge,
  CanvasNode,
  CanvasNodeType,
  WorkflowVariable,
} from '@refly/openapi-schema';
import { IContextItem } from '@refly/common-types';
import { CanvasNodeFilter, ResponseNodeMeta } from './types';
import { ThreadHistoryQuery } from './history';
import { mirrorCanvasData } from './data';
import { deepmerge, processQueryWithMentions } from '@refly/utils';

export interface WorkflowNode {
  nodeId: string;
  nodeType: CanvasNodeType;
  node: CanvasNode;
  entityId: string;
  title: string;
  status: ActionStatus;
  connectTo: CanvasNodeFilter[];
  parentNodeIds: string[];
  childNodeIds: string[];

  // only for skillResponse nodes
  processedQuery?: string;
  originalQuery?: string;
  resultHistory?: ActionResult[];
}

/**
 * Workflow node execution interface for database operations
 * This represents the structure of WorkflowNodeExecution from Prisma
 */
export interface WorkflowNodeExecution {
  nodeId: string;
  parentNodeIds?: string | null;
  childNodeIds?: string | null;
  [key: string]: any; // Allow additional properties
}

/**
 * Update context items from variables
 * @param contextItems - Existing context items
 * @param variables - Workflow variables
 * @returns Enhanced context items with resource variables added
 */
export const updateContextItemsFromVariables = (
  contextItems: IContextItem[],
  variables: WorkflowVariable[],
): IContextItem[] => {
  const enhancedContextItems = [...contextItems];

  // For each referenced variable that is a resource type, add it to context
  for (const variable of variables) {
    if (variable.variableType === 'resource') {
      for (const value of variable.value) {
        if (value.type === 'resource' && value.resource?.entityId) {
          // Check if this resource is already in context
          const existingItemIndex = enhancedContextItems.findIndex(
            (item) => item.entityId === value.resource?.entityId && item.type === 'resource',
          );

          if (existingItemIndex >= 0) {
            // Update the existing context item title to the variable name
            enhancedContextItems[existingItemIndex].title = value.resource.name;
          }
        }
      }
    }
  }

  return enhancedContextItems;
};

// Helper function to find all nodes in the subtree starting from given start nodes
const findSubtreeNodes = (startNodeIds: string[], childMap: Map<string, string[]>): Set<string> => {
  const subtreeNodes = new Set<string>();
  const queue = [...startNodeIds];

  while (queue.length > 0) {
    const currentNodeId = queue.shift()!;
    if (!subtreeNodes.has(currentNodeId)) {
      subtreeNodes.add(currentNodeId);
      // Add all children to the queue
      const children = childMap.get(currentNodeId) || [];
      queue.push(...children);
    }
  }

  return subtreeNodes;
};

const buildNodeRelationships = (nodes: CanvasNode[], edges: CanvasEdge[]) => {
  const nodeMap = new Map<string, CanvasNode>();
  const parentMap = new Map<string, string[]>();
  const childMap = new Map<string, string[]>();

  // Initialize maps
  for (const node of nodes) {
    nodeMap.set(node.id, node);
    parentMap.set(node.id, []);
    childMap.set(node.id, []);
  }

  // Build relationships from edges
  for (const edge of edges || []) {
    const sourceId = edge.source;
    const targetId = edge.target;

    if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
      // Add target as child of source
      const sourceChildren = childMap.get(sourceId) || [];
      sourceChildren.push(targetId);
      childMap.set(sourceId, sourceChildren);

      // Add source as parent of target
      const targetParents = parentMap.get(targetId) || [];
      targetParents.push(sourceId);
      parentMap.set(targetId, targetParents);
    }
  }

  return { nodeMap, parentMap, childMap };
};

/**
 * Prepare node executions for a workflow execution
 * @param params - Parameters for preparing node executions
 * @returns Node executions and start nodes
 */
export const prepareNodeExecutions = (params: {
  executionId: string;
  canvasData: CanvasData;
  variables: WorkflowVariable[];
  startNodes?: string[];
  isNewCanvas?: boolean;
}): { nodeExecutions: WorkflowNode[]; startNodes: string[] } => {
  const { canvasData, variables, isNewCanvas = false } = params;
  const { nodes, edges } = canvasData;

  let newNodes: CanvasNode[] = nodes;
  let newEdges: CanvasEdge[] = edges;

  if (isNewCanvas) {
    const mirroredCanvas = mirrorCanvasData(canvasData, {
      nodeProcessor: (node) => {
        // Always clear content preview
        node.data.contentPreview = '';

        if (node.type === 'skillResponse') {
          const originalQuery = String(
            (node.data?.metadata as ResponseNodeMeta)?.structuredData?.query ??
              node.data?.title ??
              '',
          );
          const { processedQuery, updatedQuery } = processQueryWithMentions(originalQuery, {
            replaceVars: true,
            variables,
          });
          node.data.title = processedQuery;
          node.data.metadata = deepmerge(node.data.metadata, {
            structuredData: {
              query: updatedQuery,
            },
          });
        }

        return node;
      },
    });

    newNodes = mirroredCanvas.nodes;
    newEdges = mirroredCanvas.edges;
  } else {
    // Process skillResponse nodes with variables
    newNodes = nodes.map((node) => {
      if (node.type === 'skillResponse') {
        const originalQuery = String(
          (node.data?.metadata as ResponseNodeMeta)?.structuredData?.query ??
            node.data?.title ??
            '',
        );
        const { processedQuery, updatedQuery } = processQueryWithMentions(originalQuery, {
          replaceVars: true,
          variables,
        });
        node.data.title = processedQuery;
        node.data.metadata = deepmerge(node.data.metadata, {
          structuredData: {
            query: updatedQuery,
          },
        });
      }
      return node;
    });
  }

  const { nodeMap, parentMap, childMap } = buildNodeRelationships(newNodes, newEdges);

  // If new canvas mode, ignore provided start nodes
  const startNodes = isNewCanvas
    ? []
    : (params.startNodes?.map((sid) => nodeMap.get(sid)?.id ?? sid) ?? []);
  if (startNodes.length === 0) {
    for (const [nodeId, parents] of parentMap) {
      if (parents.length === 0) {
        startNodes.push(nodeId);
      }
    }
  }

  if (startNodes.length === 0) {
    return { nodeExecutions: [], startNodes };
  }

  // Determine which nodes should be in 'waiting' status
  const subtreeNodes = findSubtreeNodes(startNodes, childMap);

  const historyQuery = new ThreadHistoryQuery(newNodes, newEdges);

  // Create node execution records
  const nodeExecutions: WorkflowNode[] = [];
  for (const node of newNodes) {
    const parents = parentMap.get(node.id) || [];
    const children = childMap.get(node.id) || [];

    // Set status based on whether the node is in the subtree (computed with original ids) and not a skill node
    const status = subtreeNodes.has(node.id) && node.type !== 'skill' ? 'waiting' : 'finish';

    // Build connection filters based on parent entity IDs
    const connectTo: CanvasNodeFilter[] = parents
      .map((pid) => {
        const node = nodeMap.get(pid);
        return {
          type: node?.type as CanvasNodeType,
          entityId: node?.data?.entityId ?? '',
          handleType: 'source' as const,
        };
      })
      .filter((f) => f.type && f.entityId);

    const nodeExecution: WorkflowNode = {
      nodeId: node.id,
      nodeType: node.type,
      node,
      entityId: node.data?.entityId ?? '',
      title: node.data?.editedTitle ?? node.data?.title ?? '',
      status,
      connectTo,
      parentNodeIds: [...new Set(parents)], // Remove duplicates
      childNodeIds: [...new Set(children)], // Remove duplicates
    };

    if (node.type === 'skillResponse') {
      const metadata = node.data?.metadata ?? {};
      const { contextItems = [] } = metadata as ResponseNodeMeta;

      const originalQuery =
        String((node.data?.metadata as ResponseNodeMeta)?.structuredData?.query ?? '') ??
        node.data?.title ??
        '';

      // Add resource variables referenced in query to context items
      const enhancedContextItems = updateContextItemsFromVariables(contextItems, variables);

      const resultHistory = enhancedContextItems
        .filter((item) => item.type === 'skillResponse' && item.metadata?.withHistory)
        .flatMap((item) =>
          historyQuery.findThreadHistory({ resultId: item.entityId }).map((node) => ({
            title: String(node.data?.title),
            resultId: String(node.data?.entityId),
          })),
        );

      // Update node metadata with enhanced context items
      node.data.metadata = {
        ...metadata,
        contextItems: enhancedContextItems,
      };

      nodeExecution.originalQuery = originalQuery;
      nodeExecution.processedQuery = node?.data.title;
      nodeExecution.resultHistory = resultHistory;
    } else if (['document', 'codeArtifact', 'image', 'video', 'audio'].includes(node.type)) {
      // Set status based on whether the node is in the subtree (computed with original ids)
      const status = subtreeNodes.has(node.id) ? 'waiting' : 'finish';
      nodeExecution.status = status;
    }

    nodeExecutions.push(nodeExecution);
  }

  return { nodeExecutions, startNodes };
};

/**
 * Sort node executions by execution order using topological sort
 * Parents should always come before their children, maintaining original canvas order
 * @param nodeExecutions - Array of WorkflowNodeExecution
 * @returns Sorted array of WorkflowNodeExecution
 */
export const sortNodeExecutionsByExecutionOrder = <T extends WorkflowNodeExecution>(
  nodeExecutions: T[],
): T[] => {
  // Build a map from nodeId to nodeExecution
  const nodeMap = new Map(nodeExecutions.map((n) => [n.nodeId, n]));
  // Track visited nodes
  const visited = new Set<string>();
  // Result array
  const result: T[] = [];

  // Helper for DFS that maintains original canvas order
  const visit = (nodeExecution: T) => {
    if (visited.has(nodeExecution.nodeId)) return;
    // Mark as visited BEFORE recursing to parents to prevent infinite loop on cycles
    visited.add(nodeExecution.nodeId);

    // Visit parents first if they exist and are in the map
    // Sort parents by their original order in the canvas to maintain consistency
    const parentNodeIds = JSON.parse(nodeExecution.parentNodeIds || '[]') as string[];
    const parentNodes = parentNodeIds
      .map((parentId) => nodeMap.get(parentId))
      .filter((node): node is T => node !== undefined)
      .sort((a, b) => {
        // Sort by creation order or nodeId to maintain consistent ordering
        return a.nodeId.localeCompare(b.nodeId);
      });

    for (const parentNode of parentNodes) {
      visit(parentNode);
    }

    result.push(nodeExecution);
  };

  // Sort nodes by their original order in the canvas before processing
  // This ensures that when multiple nodes have no dependencies, they maintain their original order
  const sortedNodeExecutions = [...nodeExecutions].sort((a, b) => {
    // First sort by creation order (if available) or nodeId
    return a.nodeId.localeCompare(b.nodeId);
  });

  // Visit all nodes in sorted order
  for (const nodeExecution of sortedNodeExecutions) {
    visit(nodeExecution);
  }

  return result;
};
