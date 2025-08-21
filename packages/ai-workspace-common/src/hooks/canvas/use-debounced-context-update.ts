import { useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { IContextItem } from '@refly/common-types';
import { CanvasNodeType } from '@refly/openapi-schema';
import { Edge, useReactFlow } from '@xyflow/react';
import { CanvasNode, ResponseNodeMeta } from '@refly/canvas-common';
import { useFindThreadHistory } from './use-find-thread-history';
import { genUniqueId } from '@refly/utils/id';

interface UseContextUpdateByEdgesProps {
  readonly: boolean;
  nodeId: string;
  updateNodeData: (data: any) => void;
}

interface UseContextUpdateByResultIdProps {
  standalone?: boolean;
  resultId?: string;
  setContextItems: (items: IContextItem[]) => void;
}

/**
 * Hook to update context items based on edges connected to a node
 */
export const useContextUpdateByEdges = ({
  readonly,
  nodeId,
  updateNodeData,
}: UseContextUpdateByEdgesProps) => {
  const { getNodes, addEdges } = useReactFlow();

  // Helper function to get child nodes of a group (excluding skill and group types)
  const getGroupChildNodes = useCallback((groupId: string, allNodes: CanvasNode<any>[]) => {
    return allNodes.filter((node) => {
      const isInGroup = node.parentId === groupId;
      return isInGroup && !['skill', 'group', 'mediaSkill'].includes(node.type);
    });
  }, []);

  const updateContextItemsByEdges = useCallback(
    (contextItems: IContextItem[], edges: Edge[]) => {
      if (readonly) return;

      const currentEdges = edges?.filter((edge) => edge.target === nodeId) || [];
      if (!currentEdges.length && !contextItems.length) return;

      const nodes = getNodes() as CanvasNode<any>[];

      // Clone existing context items to preserve all existing items
      const updatedContextItems = [...contextItems];

      // Create a set of existing entityIds for quick lookup
      const existingEntityIds = new Set(contextItems.map((item) => item.entityId));
      const edgesToAdd = [];

      // Check each edge and add new context items if they don't exist
      for (const edge of currentEdges) {
        const sourceNode = nodes.find((node) => node.id === edge.source);
        if (!sourceNode?.data?.entityId || ['skill', 'mediaSkill'].includes(sourceNode?.type))
          continue;

        const entityId = sourceNode.data.entityId;

        // If entityId already exists in current items, skip
        if (existingEntityIds.has(entityId)) continue;

        // Special handling for group type nodes
        if (sourceNode.type === 'group') {
          const childNodes = getGroupChildNodes(sourceNode.id, nodes);

          // Add child nodes to context items
          for (const childNode of childNodes) {
            if (childNode.data?.entityId && !existingEntityIds.has(childNode.data.entityId)) {
              updatedContextItems.push({
                entityId: childNode.data.entityId,
                type: childNode.type as CanvasNodeType,
                title: childNode.data.title || '',
              });

              edgesToAdd.push({
                id: `edge-${genUniqueId()}`,
                source: childNode.id,
                target: nodeId,
                type: 'default',
              });
              // Update existing entityIds set to avoid duplicates
              existingEntityIds.add(childNode.data.entityId);
            }
          }
        } else {
          updatedContextItems.push({
            entityId,
            type: sourceNode.type as CanvasNodeType,
            title: sourceNode.data.title || '',
          });
          existingEntityIds.add(entityId);
        }
      }
      // Only update if the context items have actually changed
      if (updatedContextItems.length !== contextItems.length) {
        if (edgesToAdd.length > 0) {
          addEdges(edgesToAdd);
        }
        updateNodeData({ metadata: { contextItems: updatedContextItems } });
      }
    },
    [readonly, nodeId, getNodes, updateNodeData, getGroupChildNodes],
  );

  const debouncedUpdateContextItems = useDebouncedCallback(
    (contextItems: IContextItem[], edges: Edge[]) => {
      updateContextItemsByEdges(contextItems, edges);
    },
    100,
  );

  return { debouncedUpdateContextItems };
};

/**
 * Hook to update context items based on a result ID
 */
export const useContextUpdateByResultId = ({
  resultId,
  setContextItems,
}: UseContextUpdateByResultIdProps) => {
  const { getNodes } = useReactFlow();
  const findThreadHistory = useFindThreadHistory();

  const updateContextItemsFromResultId = useCallback(() => {
    if (!resultId) return;

    // Find the node associated with this resultId
    const nodes = getNodes();
    const currentNode = nodes.find(
      (n) => n.data?.entityId === resultId,
    ) as CanvasNode<ResponseNodeMeta>;

    if (!currentNode) return;

    // Find thread history based on resultId
    const threadHistory = findThreadHistory({ resultId });

    if (threadHistory.length === 0 && !currentNode) return;

    // Collect all thread history node entityIds
    const historyEntityIds = new Set<string>();
    for (const historyNode of threadHistory) {
      if (historyNode?.data?.entityId) {
        historyEntityIds.add(String(historyNode.data.entityId));
      }
    }

    // Get current node's context items and filter out those that are in thread history
    // Also filter out any existing items with withHistory flag to prevent duplicates
    const finalContextItems: IContextItem[] = [];
    const currentContextItems = currentNode.data?.metadata?.contextItems || [];

    // First add context items that aren't part of thread history and don't have withHistory flag
    for (const item of currentContextItems) {
      // Skip items that are already in thread history or have withHistory flag
      if (!historyEntityIds.has(item.entityId) && !item.metadata?.withHistory) {
        finalContextItems.push(item);
      }
    }

    // Only add the last node from thread history as context item with withHistory flag
    // Skip if the last history node is the current node itself
    if (threadHistory.length > 0) {
      const lastHistoryNode = threadHistory[threadHistory.length - 1];
      if (lastHistoryNode?.data?.entityId && lastHistoryNode.type) {
        finalContextItems.push({
          entityId: String(lastHistoryNode.data.entityId),
          type: lastHistoryNode.type as CanvasNodeType,
          title: String(lastHistoryNode.data.title || ''),
          metadata: {
            withHistory: true,
          },
        });
      }
    }

    // Set all collected context items
    if (finalContextItems.length > 0) {
      setContextItems(finalContextItems);
    }
  }, [resultId, getNodes, findThreadHistory, setContextItems]);

  const debouncedUpdateContextItems = useDebouncedCallback(() => {
    updateContextItemsFromResultId();
  }, 300);

  return { debouncedUpdateContextItems };
};
