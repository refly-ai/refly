import { useEffect, useRef } from 'react';
import { CanvasNode, CanvasNodeData, ResponseNodeMeta } from '@refly/canvas-common';
import { IContextItem } from '@refly/common-types';
import { CanvasEdge, CanvasNodeType } from '@refly/openapi-schema';
import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';
import { useReactFlow } from '@xyflow/react';
import { genUniqueId } from '@refly/utils/id';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-data';

const areContextItemsEqual = (source: IContextItem[], target: IContextItem[]) => {
  if (source.length !== target.length) {
    return false;
  }

  for (let index = 0; index < source.length; index += 1) {
    const sourceItem = source[index];
    const targetItem = target[index];
    if (
      (sourceItem?.entityId ?? '') !== (targetItem?.entityId ?? '') ||
      (sourceItem?.type ?? '') !== (targetItem?.type ?? '')
    ) {
      return false;
    }
  }

  return true;
};

const buildContextItemsFromEdges = (edges: CanvasEdge[], nodes: CanvasNode<any>[]) => {
  const contextItems: IContextItem[] = [];
  const seenEntityIds = new Set<string>();

  for (const edge of edges ?? []) {
    const sourceNode = nodes.find((node) => node.id === edge?.source);

    if (sourceNode?.type !== 'skillResponse') {
      continue;
    }

    const entityId = sourceNode?.data?.entityId ?? '';
    if (!entityId || seenEntityIds.has(entityId)) {
      continue;
    }

    seenEntityIds.add(entityId);
    contextItems.push({
      entityId,
      title: sourceNode?.data?.title ?? '',
      metadata: sourceNode?.data?.metadata,
      type: sourceNode?.type as CanvasNodeType,
    });
  }

  return contextItems;
};

export const useSyncAgentConnections = (
  nodeId: string,
  nodeData: CanvasNodeData<ResponseNodeMeta>,
) => {
  const { edges } = useRealtimeCanvasData();
  const { getNodes, setEdges } = useReactFlow<CanvasNode<any>>();
  const { setNodeData } = useNodeData();
  const contextItems = nodeData?.metadata?.contextItems ?? [];
  const syncedContextFromEdgesRef = useRef<IContextItem[]>([]);

  useEffect(() => {
    const nodes = getNodes();
    const targetNode = nodes.find((node) => node.id === nodeId);
    if (!targetNode) {
      return;
    }

    const relatedEdges = edges?.filter((edge) => edge?.target === nodeId) ?? [];
    if (!relatedEdges.length && !contextItems.length) {
      return;
    }

    const desiredContextItems = buildContextItemsFromEdges(relatedEdges, nodes);
    if (areContextItemsEqual(contextItems, desiredContextItems)) {
      return;
    }

    console.log('useSyncAgentConnections setNodeData', nodeId, desiredContextItems);
    syncedContextFromEdgesRef.current = desiredContextItems;
    setNodeData(nodeId, {
      metadata: {
        contextItems: desiredContextItems,
      },
    });
  }, [edges, contextItems, getNodes, setNodeData, nodeId]);

  useEffect(() => {
    if (areContextItemsEqual(syncedContextFromEdgesRef.current, contextItems)) {
      return;
    }

    const nodes = getNodes();

    const entityToNodeId = new Map<string, string>();
    for (const node of nodes ?? []) {
      const entityId = node?.data?.entityId;
      if (entityId) {
        entityToNodeId.set(entityId, node.id);
      }
    }

    const uniqueSourceIds: string[] = [];
    const seenSourceIds = new Set<string>();
    for (const item of contextItems ?? []) {
      const entityId = item?.entityId ?? '';
      if (!entityId) {
        continue;
      }
      const sourceId = entityToNodeId.get(entityId);
      if (!sourceId || sourceId === nodeId || seenSourceIds.has(sourceId)) {
        continue;
      }
      seenSourceIds.add(sourceId);
      uniqueSourceIds.push(sourceId);
    }

    const desiredSourceSet = new Set(uniqueSourceIds);
    setEdges((prevEdges = []) => {
      const currentEdges = prevEdges.filter((edge) => edge.target === nodeId);
      const edgesToRemove = currentEdges.filter((edge) => !desiredSourceSet.has(edge.source));
      const edgesToAdd = uniqueSourceIds
        .filter((sourceId) => !currentEdges.some((edge) => edge.source === sourceId))
        .map((sourceId) => ({
          id: `edge-${genUniqueId()}`,
          source: sourceId,
          target: nodeId,
          type: 'default',
        }));

      if (!edgesToAdd.length && !edgesToRemove.length) {
        return prevEdges;
      }

      const removeIds = new Set(edgesToRemove.map((edge) => edge.id));
      const filteredEdges = prevEdges.filter((edge) => !removeIds.has(edge.id));
      const updatedEdges = [...filteredEdges, ...edgesToAdd];

      console.log('useSyncAgentConnections updated edges', updatedEdges);
      return updatedEdges;
    });
  }, [contextItems, getNodes, setEdges, nodeId]);
};
