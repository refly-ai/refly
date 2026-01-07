import { useCallback } from 'react';
import { Connection, Edge, EdgeChange, applyEdgeChanges, useStoreApi } from '@xyflow/react';
import { genUniqueId } from '@refly/utils/id';
import { useEdgeStyles, getEdgeStyles } from '../../components/canvas/constants';
import { CanvasNode } from '@refly/canvas-common';
import { edgeEventsEmitter } from '@refly-packages/ai-workspace-common/events/edge';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useTranslation } from 'react-i18next';
import { message } from 'antd';

const checkIsCycle = (source: string, target: string, edges: Edge[]) => {
  const visited = new Set<string>();
  const stack = [target];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === source) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const targetEdges = edges.filter((edge) => edge.source === current);
    for (const edge of targetEdges) {
      stack.push(edge.target);
    }
  }

  return false;
};

export const useEdgeOperations = () => {
  const { getState, setState } = useStoreApi<CanvasNode<any>>();
  const edgeStyles = useEdgeStyles();
  const { forceSyncState } = useCanvasContext();
  const { t } = useTranslation();

  const updateEdgesWithSync = useCallback(
    (edges: Edge[]) => {
      setState({ edges });
      forceSyncState();
    },
    [setState, forceSyncState],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      const { edges } = getState();
      const safePrevEdges = edges ?? [];
      const updatedEdges = applyEdgeChanges(changes ?? [], safePrevEdges);

      updateEdgesWithSync(updatedEdges);
    },
    [getState, updateEdgesWithSync],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params?.source || !params?.target) {
        console.warn('Invalid connection parameters');
        return;
      }

      const { edges } = getState();
      const safeEdges = edges ?? [];

      // check if the edge already exists
      const connectionExists = safeEdges.some(
        (edge) => edge.source === params.source && edge.target === params.target,
      );

      // if the edge already exists, do not create a new edge
      if (connectionExists) {
        return;
      }

      // check for cycles
      if (checkIsCycle(params.source, params.target, safeEdges)) {
        message.warning(t('canvas.cycleDetectionError'));
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

      edgeEventsEmitter.emit('edgeChange', {
        oldEdges: safeEdges,
        newEdges: updatedEdges,
      });
    },
    [getState, updateEdgesWithSync, edgeStyles.default, t],
  );

  const updateAllEdgesStyle = useCallback(
    (showEdges: boolean) => {
      const { edges } = getState();
      const edgeStyles = getEdgeStyles(showEdges);
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
