import { useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { CanvasNodeType } from '@refly/openapi-schema';
import { useReactFlow } from '@xyflow/react';
import {
  CanvasNode,
  ResponseNodeMeta,
} from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { useFindThreadHistory } from './use-find-thread-history';

interface UseContextUpdateByEdgesProps {
  readonly: boolean;
  nodeId: string;
  contextItems: IContextItem[];
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
  contextItems,
  updateNodeData,
}: UseContextUpdateByEdgesProps) => {
  const { getNodes, getEdges } = useReactFlow();

  const updateContextItemsByEdges = useCallback(() => {
    if (readonly) return;

    const edges = getEdges();
    const currentEdges = edges?.filter((edge) => edge.target === nodeId) || [];
    if (!currentEdges.length && !contextItems.length) return;

    const nodes = getNodes() as CanvasNode<any>[];

    // get all source nodes that are connected to the current node
    const connectedSourceIds = new Set(currentEdges.map((edge) => edge.source));

    // filter current contextItems, remove nodes that are no longer connected
    const updatedContextItems = contextItems.filter((item) => {
      if (currentEdges.length === 0 && contextItems.length > 0) {
        return true;
      }

      const itemNode = nodes.find((node) => node.data?.entityId === item.entityId);
      return itemNode && connectedSourceIds.has(itemNode.id);
    });

    // add new connected nodes to contextItems
    for (const edge of currentEdges) {
      const sourceNode = nodes.find((node) => node.id === edge.source);
      if (!sourceNode?.data?.entityId || ['skill', 'group'].includes(sourceNode?.type)) continue;

      const exists = updatedContextItems.some((item) => item.entityId === sourceNode.data.entityId);
      if (!exists) {
        updatedContextItems.push({
          entityId: sourceNode.data.entityId,
          type: sourceNode.type as CanvasNodeType,
          title: sourceNode.data.title || '',
        });
      }
    }

    if (JSON.stringify(updatedContextItems) !== JSON.stringify(contextItems)) {
      updateNodeData({ metadata: { contextItems: updatedContextItems } });
    }
  }, [readonly, nodeId, contextItems, getNodes, getEdges, updateNodeData]);

  const debouncedUpdateContextItems = useDebouncedCallback(() => {
    updateContextItemsByEdges();
  }, 300);

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

    console.log('updateContextItemsFromResultId', resultId);

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
