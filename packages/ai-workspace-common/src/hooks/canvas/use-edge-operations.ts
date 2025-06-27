import { useCallback } from 'react';
import { Connection, Edge, applyEdgeChanges, EdgeChange, useStoreApi } from '@xyflow/react';
import { genUniqueId } from '@refly/utils/id';
import { useEdgeStyles, getEdgeStyles } from '../../components/canvas/constants';
import { useCanvasSync } from './use-canvas-sync';
import { CanvasNode } from '@refly/canvas-common';
import { edgeEventsEmitter } from '@refly-packages/ai-workspace-common/events/edge';
import { useThemeStore } from '@refly-packages/ai-workspace-common/stores/theme';

export const useEdgeOperations = () => {
  const { getState, setState } = useStoreApi<CanvasNode<any>>();
  const edgeStyles = useEdgeStyles();
  const { throttledSyncEdgesToYDoc } = useCanvasSync();

  const updateEdgesWithSync = useCallback(
    (edges: Edge[]) => {
      setState({ edges });
      throttledSyncEdgesToYDoc(edges);
    },
    [setState, throttledSyncEdgesToYDoc],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      const { edges } = getState();
      const updatedEdges = applyEdgeChanges(changes, edges);

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

      // check if the edge already exists
      const connectionExists = edges?.some(
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

      const updatedEdges = [...edges, newEdge];

      updateEdgesWithSync(updatedEdges);
      edgeEventsEmitter.emit('edgeChange', {
        oldEdges: edges,
        newEdges: updatedEdges,
      });
    },
    [getState, updateEdgesWithSync],
  );

  const updateAllEdgesStyle = useCallback(
    (showEdges: boolean) => {
      const { edges } = getState();
      const { isDarkMode } = useThemeStore.getState();
      const edgeStyles = getEdgeStyles(showEdges, isDarkMode);
      const updatedEdges = edges.map((edge) => ({
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
