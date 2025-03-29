import { useCallback } from 'react';
import { Connection, Edge, applyEdgeChanges, EdgeChange, useReactFlow } from '@xyflow/react';
import { genUniqueId } from '@refly-packages/utils/id';
import { useEdgeStyles, getEdgeStyles } from '../../components/canvas/constants';
import { useCanvasSync } from './use-canvas-sync';

export const useEdgeOperations = (_selectedCanvasId?: string) => {
  const { getEdges, setEdges } = useReactFlow();
  const edgeStyles = useEdgeStyles();
  const { throttledSyncEdgesToYDoc } = useCanvasSync();

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      const edges = getEdges();
      const updatedEdges = applyEdgeChanges(changes, edges);
      setEdges(updatedEdges);
      throttledSyncEdgesToYDoc(updatedEdges);
    },
    [setEdges, throttledSyncEdgesToYDoc],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params?.source || !params?.target) {
        console.warn('Invalid connection parameters');
        return;
      }

      const edges = getEdges();

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
      setEdges(updatedEdges);
      throttledSyncEdgesToYDoc(updatedEdges);
    },
    [setEdges, edgeStyles, throttledSyncEdgesToYDoc],
  );

  const updateAllEdgesStyle = useCallback(
    (showEdges: boolean) => {
      const edges = getEdges();
      const edgeStyles = getEdgeStyles(showEdges);
      const updatedEdges = edges.map((edge) => ({
        ...edge,
        style: edgeStyles.default,
      }));
      setEdges(updatedEdges);
      throttledSyncEdgesToYDoc(updatedEdges);
    },
    [setEdges, throttledSyncEdgesToYDoc],
  );

  return {
    onEdgesChange,
    onConnect,
    updateAllEdgesStyle,
  };
};
