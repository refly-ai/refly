import { useCallback } from 'react';
import { Connection, Edge, EdgeChange, applyEdgeChanges, useStoreApi } from '@xyflow/react';
import { genUniqueId } from '@refly/utils/id';
import { useEdgeStyles, getEdgeStyles } from '../../components/canvas/constants';
import { CanvasNode, CanvasNodeData } from '@refly/canvas-common';
import { IContextItem } from '@refly/common-types';
import { CanvasNodeType } from '@refly/openapi-schema';
import { edgeEventsEmitter } from '@refly-packages/ai-workspace-common/events/edge';
import { useThemeStore } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
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

const createNodeMap = (nodes: CanvasNode<any>[]) => {
  const map = new Map<string, CanvasNode<any>>();
  for (const node of nodes ?? []) {
    const nodeId = node?.id ?? '';
    if (!nodeId) {
      continue;
    }
    map.set(nodeId, node);
  }
  return map;
};

const buildContextItemsForTarget = (
  targetNodeId: string,
  edges: Edge[],
  nodeMap: Map<string, CanvasNode<any>>,
) => {
  const contextItems: IContextItem[] = [];
  const seenEntityIds = new Set<string>();

  for (const edge of edges ?? []) {
    if ((edge?.target ?? '') !== targetNodeId) {
      continue;
    }

    const sourceNodeId = edge?.source ?? '';
    if (!sourceNodeId) {
      continue;
    }

    const sourceNode = nodeMap.get(sourceNodeId);
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

const collectTargetEdgeIds = (edges: Edge[]) => {
  const map = new Map<string, string[]>();

  for (const edge of edges ?? []) {
    const targetId = edge?.target ?? '';
    const edgeId = edge?.id ?? '';

    if (!targetId || !edgeId) {
      continue;
    }

    const existing = map.get(targetId) ?? [];
    existing.push(edgeId);
    map.set(targetId, existing);
  }

  return map;
};

const haveEdgeSetsChanged = (prevIds: string[], nextIds: string[]) => {
  if (prevIds.length !== nextIds.length) {
    return true;
  }

  const prevSet = new Set(prevIds);

  for (const id of nextIds) {
    if (!prevSet.has(id)) {
      return true;
    }
  }

  return false;
};

const getTargetNodeIdsToSync = (prevEdges: Edge[], nextEdges: Edge[]) => {
  const prevTargetEdges = collectTargetEdgeIds(prevEdges);
  const nextTargetEdges = collectTargetEdgeIds(nextEdges);
  const uniqueTargetIds = new Set<string>([...prevTargetEdges.keys(), ...nextTargetEdges.keys()]);
  const changedTargetIds = new Set<string>();

  for (const targetId of uniqueTargetIds) {
    if (!targetId) {
      continue;
    }
    const prevIds = prevTargetEdges.get(targetId) ?? [];
    const nextIds = nextTargetEdges.get(targetId) ?? [];
    if (haveEdgeSetsChanged(prevIds, nextIds)) {
      changedTargetIds.add(targetId);
    }
  }

  return changedTargetIds;
};

const syncContextItemsForTargets = (
  targetNodeIds: Set<string>,
  nodes: CanvasNode<any>[],
  edges: Edge[],
  setNodeData: (nodeId: string, nodeData: Partial<CanvasNodeData<any>>) => void,
) => {
  if (!targetNodeIds?.size) {
    return;
  }

  const nodeMap = createNodeMap(nodes ?? []);

  for (const targetNodeId of targetNodeIds) {
    if (!targetNodeId) {
      continue;
    }

    const targetNode = nodeMap.get(targetNodeId);
    if (!targetNode) {
      continue;
    }

    const desiredContextItems = buildContextItemsForTarget(targetNodeId, edges ?? [], nodeMap);
    const currentContextItems = targetNode?.data?.metadata?.contextItems ?? [];

    if (areContextItemsEqual(currentContextItems, desiredContextItems)) {
      continue;
    }

    setNodeData(targetNodeId, {
      metadata: {
        contextItems: desiredContextItems,
      },
    });
  }
};

export const useEdgeOperations = () => {
  const { getState, setState } = useStoreApi<CanvasNode<any>>();
  const edgeStyles = useEdgeStyles();
  const { forceSyncState } = useCanvasContext();
  const { setNodeData } = useNodeData();

  const updateEdgesWithSync = useCallback(
    (edges: Edge[]) => {
      setState({ edges });
      forceSyncState();
    },
    [setState, forceSyncState],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      const { edges, nodes } = getState();
      const safePrevEdges = edges ?? [];
      const updatedEdges = applyEdgeChanges(changes ?? [], safePrevEdges);

      updateEdgesWithSync(updatedEdges);
      const targetNodeIds = getTargetNodeIdsToSync(safePrevEdges, updatedEdges);
      syncContextItemsForTargets(targetNodeIds, nodes ?? [], updatedEdges, setNodeData);
    },
    [getState, setNodeData, updateEdgesWithSync],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params?.source || !params?.target) {
        console.warn('Invalid connection parameters');
        return;
      }

      const { edges, nodes } = getState();
      const safeEdges = edges ?? [];

      // check if the edge already exists
      const connectionExists = safeEdges.some(
        (edge) => edge.source === params.source && edge.target === params.target,
      );

      // if the edge already exists, do not create a new edge
      if (connectionExists) {
        return;
      }

      const newEdge = {
        ...params,
        id: `edge-${genUniqueId()}`,
        animated: false,
        style: edgeStyles.default,
      };

      const updatedEdges = [...safeEdges, newEdge];

      updateEdgesWithSync(updatedEdges);
      syncContextItemsForTargets(
        new Set<string>([params.target]),
        nodes ?? [],
        updatedEdges,
        setNodeData,
      );
      edgeEventsEmitter.emit('edgeChange', {
        oldEdges: safeEdges,
        newEdges: updatedEdges,
      });
    },
    [getState, setNodeData, updateEdgesWithSync],
  );

  const updateAllEdgesStyle = useCallback(
    (showEdges: boolean) => {
      const { edges } = getState();
      const { isDarkMode } = useThemeStore.getState();
      const edgeStyles = getEdgeStyles(showEdges, isDarkMode);
      const safeEdges = edges ?? [];
      const updatedEdges = safeEdges.map((edge) => ({
        ...edge,
        style: edgeStyles.default,
      }));
      updateEdgesWithSync(updatedEdges);
    },
    [getState, updateEdgesWithSync],
  );

  return {
    onEdgesChange,
    onConnect,
    updateAllEdgesStyle,
  };
};
