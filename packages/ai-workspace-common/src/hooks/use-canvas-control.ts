import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Connection, useReactFlow, XYPosition } from '@xyflow/react';
import Dagre from '@dagrejs/dagre';
import { CanvasNodeType } from '@refly/openapi-schema';
import { applyEdgeChanges, applyNodeChanges, Edge, EdgeChange, NodeChange } from '@xyflow/react';
import { CanvasNode, prepareNodeData } from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { useCanvasStore, useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { CanvasNodeData, getNodeDefaultMetadata } from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { getEdgeStyles, useEdgeStyles } from '../components/canvas/constants';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { genUniqueId } from '@refly-packages/utils/id';
import { useThrottledCallback } from 'use-debounce';
import { useContextPanelStore } from '@refly-packages/ai-workspace-common/stores/context-panel';

const getLayoutedElements = (nodes: CanvasNode<any>[], edges: Edge[], options: { direction: 'TB' | 'LR' }) => {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: options.direction,
    nodesep: 100,
    ranksep: 80,
    marginx: 50,
    marginy: 50,
  });

  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  nodes.forEach((node) =>
    g.setNode(node.id, {
      ...node,
      width: node.measured?.width ?? 288,
      height: node.measured?.height ?? 320,
    }),
  );

  Dagre.layout(g);

  return {
    nodes: nodes.map((node) => {
      const nodeWithPosition = g.node(node.id);
      return {
        ...node,
        position: { x: nodeWithPosition.x, y: nodeWithPosition.y },
      };
    }),
    edges,
  };
};

const deduplicateNodes = (nodes: CanvasNode<any>[]) => {
  const uniqueNodesMap = new Map();
  nodes.forEach((node) => uniqueNodesMap.set(node.id, node));
  return Array.from(uniqueNodesMap.values());
};

const deduplicateEdges = (edges: Edge[]) => {
  const uniqueEdgesMap = new Map();
  edges.forEach((edge) => uniqueEdgesMap.set(edge.id, edge));
  return Array.from(uniqueEdgesMap.values());
};

export interface CanvasNodeFilter {
  type: CanvasNodeType;
  entityId: string;
}

export const useCanvasControl = (selectedCanvasId?: string) => {
  const { canvasId: contextCanvasId, provider } = useCanvasContext();
  const ydoc = provider.document;

  const { t } = useTranslation();

  const { canvasId: routeCanvasId } = useParams();
  const canvasId = selectedCanvasId ?? contextCanvasId ?? routeCanvasId;

  const { data, setNodes, setEdges, setTitle, setModeRaw, addPinnedNode } = useCanvasStoreShallow((state) => ({
    data: state.data,
    setNodes: state.setNodes,
    setEdges: state.setEdges,
    setTitle: state.setTitle,
    setModeRaw: state.setMode,
    addPinnedNode: state.addPinnedNode,
  }));
  const edgeStyles = useEdgeStyles();

  const nodes = data[canvasId]?.nodes ?? [];
  const edges = data[canvasId]?.edges ?? [];
  const mode = data[canvasId]?.mode ?? 'hand';

  const syncTitleToYDoc = useCallback(
    (title: string) => {
      ydoc?.transact(() => {
        const yTitle = ydoc?.getText('title');
        yTitle?.delete(0, yTitle?.length ?? 0);
        yTitle?.insert(0, title);
      });
    },
    [ydoc],
  );

  const syncNodesToYDoc = useCallback(
    (nodes: CanvasNode<any>[]) => {
      ydoc?.transact(() => {
        const yNodes = ydoc?.getArray('nodes');
        yNodes?.delete(0, yNodes?.length ?? 0);
        yNodes?.push(nodes);
      });
    },
    [ydoc],
  );
  const throttledSyncNodesToYDoc = useThrottledCallback(syncNodesToYDoc, 500, {
    leading: true,
    trailing: false,
  });

  const syncEdgesToYDoc = useCallback(
    (edges: Edge[]) => {
      ydoc?.transact(() => {
        const yEdges = ydoc?.getArray('edges');
        yEdges?.delete(0, yEdges?.length ?? 0);
        yEdges?.push(edges);
      });
    },
    [ydoc],
  );
  const throttledSyncEdgesToYDoc = useThrottledCallback(syncEdgesToYDoc, 500, {
    leading: true,
    trailing: false,
  });

  const setCanvasTitle = useCallback(
    (title: string) => {
      setTitle(canvasId, title);
      syncTitleToYDoc(title);
    },
    [canvasId, setTitle, syncTitleToYDoc],
  );

  const setSelectedNode = useCallback(
    (node: CanvasNode<any> | null) => {
      const { data } = useCanvasStore.getState();
      const nodes = data[canvasId]?.nodes ?? [];
      const updatedNodes = nodes.map((n) => ({
        ...n,
        selected: n.id === node?.id,
      }));
      setNodes(canvasId, updatedNodes);
    },
    [canvasId, setNodes],
  );

  const addSelectedNode = useCallback(
    (node: CanvasNode<any> | null) => {
      const { data } = useCanvasStore.getState();
      const nodes = data[canvasId]?.nodes ?? [];
      const updatedNodes = nodes.map((n) => ({
        ...n,
        selected: n.id === node?.id ? true : n.selected,
      }));
      setNodes(canvasId, updatedNodes);
    },
    [canvasId, setNodes],
  );

  const setSelectedNodeByEntity = useCallback(
    (filter: CanvasNodeFilter) => {
      const { type, entityId } = filter;
      const { data } = useCanvasStore.getState();
      const nodes = data[canvasId]?.nodes ?? [];
      const node = nodes.find((node) => node.type === type && node.data?.entityId === entityId);
      if (node) {
        setSelectedNode(node);
      }
    },
    [canvasId, setSelectedNode],
  );

  const addSelectedNodeByEntity = useCallback(
    (filter: CanvasNodeFilter) => {
      const { type, entityId } = filter;
      const { data } = useCanvasStore.getState();
      const nodes = data[canvasId]?.nodes ?? [];
      const node = nodes.find((node) => node.type === type && node.data?.entityId === entityId);
      if (node) {
        addSelectedNode(node);
      }
    },
    [canvasId, addSelectedNode],
  );

  const setSelectedNodes = useCallback(
    (selectedNodes: CanvasNode<any>[]) => {
      const { data } = useCanvasStore.getState();
      const nodes = data[canvasId]?.nodes ?? [];
      const updatedNodes = nodes.map((n) => ({
        ...n,
        selected: selectedNodes.some((node) => node.id === n.id),
      }));
      setNodes(canvasId, updatedNodes);
    },
    [canvasId, setNodes],
  );

  const deselectNode = useCallback(
    (node: CanvasNode) => {
      const { data } = useCanvasStore.getState();
      const nodes = data[canvasId]?.nodes ?? [];
      const updatedNodes = nodes.map((n) => ({
        ...n,
        selected: n.id === node.id ? false : n.selected,
      }));
      setNodes(canvasId, updatedNodes);
    },
    [canvasId, setNodes],
  );

  const deselectNodeByEntity = useCallback(
    (filter: CanvasNodeFilter) => {
      console.log('deselectNodeByEntity');
      const { type, entityId } = filter;
      const { data } = useCanvasStore.getState();
      const nodes = data[canvasId]?.nodes ?? [];
      const node = nodes.find((n) => n.type === type && n.data?.entityId === entityId);
      if (node) {
        deselectNode(node);
      }
    },
    [canvasId, deselectNode],
  );

  const setNodeData = useCallback(
    <T = any>(nodeId: string, nodeData: Partial<CanvasNodeData<T>>) => {
      const { data } = useCanvasStore.getState();
      const nodes = data[canvasId]?.nodes ?? [];
      const updatedNodes = nodes.map((n) => ({
        ...n,
        data: n.id === nodeId ? { ...n.data, ...nodeData } : n.data,
      }));
      setNodes(canvasId, updatedNodes);
      syncNodesToYDoc(updatedNodes);
    },
    [canvasId, setNodes, syncNodesToYDoc],
  );

  const setNodeDataByEntity = useCallback(
    <T = any>(filter: CanvasNodeFilter, nodeData: Partial<CanvasNodeData<T>>) => {
      const { data } = useCanvasStore.getState();
      const nodes = data[canvasId]?.nodes ?? [];
      const node = nodes.find((n) => n.type === filter.type && n.data?.entityId === filter.entityId);
      if (node) {
        setNodeData(node.id, {
          ...node.data,
          ...nodeData,
          metadata: {
            ...node.data?.metadata,
            ...nodeData?.metadata,
          },
        });
      }
    },
    [canvasId, setNodeData],
  );

  const { fitView, getNode, setCenter } = useReactFlow();

  const onLayout = useCallback(
    (direction: 'TB' | 'LR') => {
      const { data } = useCanvasStore.getState();
      const nodes = data[canvasId]?.nodes ?? [];
      const edges = data[canvasId]?.edges ?? [];
      const layouted = getLayoutedElements(nodes, edges, { direction });

      setNodes(canvasId, layouted.nodes);
      setEdges(canvasId, layouted.edges);
      syncNodesToYDoc(layouted.nodes);
      syncEdgesToYDoc(layouted.edges);

      window.requestAnimationFrame(() => {
        fitView({
          padding: 0.2,
          duration: 200,
          maxZoom: 1,
        });
      });
    },
    [canvasId, fitView],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasNode<any>>[]) => {
      const { data } = useCanvasStore.getState();
      const nodes = data[canvasId]?.nodes ?? [];
      const mutableNodes = nodes.map((node) => ({
        ...node,
        measured: node.measured ? { ...node.measured } : undefined,
      }));

      // Handle deleted nodes
      const deletedNodes = changes.filter((change) => change.type === 'remove');

      if (deletedNodes.length > 0) {
        const contextStore = useContextPanelStore.getState();

        deletedNodes.forEach((change) => {
          const nodeId = change.id;
          // Remove from context items
          contextStore.removeContextItem(nodeId);
          // Remove from chat history
          contextStore.removeHistoryItem(nodeId);
        });
      }

      const updatedNodes = applyNodeChanges(changes, mutableNodes);
      setNodes(canvasId, updatedNodes);
      throttledSyncNodesToYDoc(updatedNodes);
    },
    [canvasId],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      const { data } = useCanvasStore.getState();
      const edges = data[canvasId]?.edges ?? [];
      const updatedEdges = applyEdgeChanges(changes, edges);
      setEdges(canvasId, updatedEdges);
      throttledSyncEdgesToYDoc(updatedEdges);
    },
    [canvasId, setEdges, throttledSyncEdgesToYDoc],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params?.source || !params?.target) {
        console.warn('Invalid connection parameters');
        return;
      }

      const newEdge = {
        ...params,
        id: `edge-${genUniqueId()}`,
        animated: false,
        style: edgeStyles.default,
      };

      const { data } = useCanvasStore.getState();
      const edges = data[canvasId]?.edges ?? [];
      const updatedEdges = [...edges, newEdge];
      setEdges(canvasId, updatedEdges);
      syncEdgesToYDoc(updatedEdges);
    },
    [canvasId, setEdges, syncEdgesToYDoc, edgeStyles],
  );

  const setNodeCenter = useCallback(
    (nodeId: string) => {
      // Center view on new node after it's rendered
      requestAnimationFrame(() => {
        const renderedNode = getNode(nodeId);
        if (renderedNode) {
          setCenter(renderedNode.position.x, renderedNode.position.y, {
            duration: 300,
            zoom: 1,
          });
        }
      });
    },
    [setCenter],
  );

  const addNode = useCallback(
    (
      node: { type: CanvasNodeType; data: CanvasNodeData<any>; position?: XYPosition },
      connectTo?: CanvasNodeFilter[],
    ) => {
      const { data } = useCanvasStore.getState();
      const nodes = data[canvasId]?.nodes ?? [];
      const edges = data[canvasId]?.edges ?? [];

      if (!node?.type || !node?.data) {
        console.warn('Invalid node data provided');
        return;
      }

      let needSetCenter = true;

      // Check for existing node
      const existingNode = nodes.find((n) => n.type === node.type && n.data?.entityId === node.data?.entityId);
      if (existingNode) {
        if (existingNode.type !== 'skillResponse') {
          message.warning(t('canvas.action.nodeAlreadyExists', { type: t(`common.${node.type}`) }));
        }
        setSelectedNode(existingNode);
        setNodeCenter(existingNode.id);
        return;
      }

      // Find source nodes
      const sourceNodes = connectTo
        ?.map((filter) => nodes.find((n) => n.type === filter.type && n.data?.entityId === filter.entityId))
        .filter(Boolean);

      // Calculate new node position
      let newPosition: XYPosition;

      if (sourceNodes?.length) {
        // Get all existing target nodes that are connected to any of the source nodes
        const existingTargetNodeIds = new Set(
          edges.filter((edge) => sourceNodes.some((source) => source.id === edge.source)).map((edge) => edge.target),
        );

        const existingTargetNodes = nodes.filter((n) => existingTargetNodeIds.has(n.id));

        if (existingTargetNodes.length) {
          // Position based on existing target nodes
          const minTargetX = Math.min(...existingTargetNodes.map((n) => n.position.x));
          const maxTargetY = Math.max(...existingTargetNodes.map((n) => n.position.y + (n.measured?.height ?? 100)));

          newPosition = {
            x: minTargetX,
            y: maxTargetY + 40,
          };
        } else {
          // First connection - position based on source nodes
          const avgSourceX = sourceNodes.reduce((sum, n) => sum + n.position.x, 0) / sourceNodes.length;
          const maxSourceY = Math.max(...sourceNodes.map((n) => n.position.y + (n.measured?.height ?? 100)));

          newPosition = {
            x: avgSourceX + 400, // Offset to the right of source nodes
            y: maxSourceY + 40,
          };
        }
      } else {
        // Default position if no source nodes
        newPosition = node.position ?? {
          x: Math.max(...nodes.map((n) => n.position.x), 0) + 400,
          y: Math.max(...nodes.map((n) => n.position.y), 0),
        };
        needSetCenter = true;
      }

      const enrichedData = {
        createdAt: new Date().toISOString(),
        ...node.data,
        metadata: {
          ...getNodeDefaultMetadata(node.type),
          ...node?.data?.metadata,
        },
      };

      const newNode = prepareNodeData({
        type: node.type,
        data: enrichedData,
        position: newPosition,
        selected: true,
      });
      const updatedNodes = deduplicateNodes([...nodes.map((n) => ({ ...n, selected: false })), newNode]);

      setNodes(canvasId, updatedNodes);
      syncNodesToYDoc(updatedNodes);

      if (connectTo?.length > 0) {
        const newEdges: Edge[] =
          sourceNodes?.map((sourceNode) => ({
            id: `edge-${genUniqueId()}`,
            source: sourceNode.id,
            target: newNode.id,
            style: edgeStyles.default,
            type: 'default',
          })) ?? [];

        if (newEdges.length > 0) {
          const updatedEdges = deduplicateEdges([...edges, ...newEdges]);
          setEdges(canvasId, updatedEdges);
          syncEdgesToYDoc(updatedEdges);
        }
      }

      if (needSetCenter) {
        setNodeCenter(newNode.id);
      }

      if (newNode.type === 'document' || newNode.type === 'resource') {
        addPinnedNode(canvasId, newNode);
      }
    },
    [canvasId, setSelectedNode, addPinnedNode, edgeStyles],
  );

  const setMode = useCallback(
    (mode: 'hand' | 'pointer') => {
      setModeRaw(canvasId, mode);
    },
    [canvasId, setModeRaw],
  );

  const updateAllEdgesStyle = useCallback(
    (showEdges: boolean) => {
      const { data } = useCanvasStore.getState();
      const edges = data[canvasId]?.edges ?? [];

      const updatedEdges = edges.map((edge) => ({
        ...edge,
        style: getEdgeStyles(showEdges)?.default,
      }));

      setEdges(canvasId, updatedEdges);
      syncEdgesToYDoc(updatedEdges);
    },
    [canvasId, setEdges, syncEdgesToYDoc],
  );

  return {
    nodes,
    edges,
    setSelectedNode,
    setSelectedNodeByEntity,
    deselectNode,
    deselectNodeByEntity,
    setNodeData,
    setNodeDataByEntity,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onLayout,
    addNode,
    mode,
    setMode,
    setCanvasTitle,
    setNodeCenter,
    setSelectedNodes,
    addSelectedNode,
    addSelectedNodeByEntity,
    updateAllEdgesStyle,
  };
};

export const useNodeHoverEffect = (nodeId: string) => {
  const { setEdges, setNodes } = useReactFlow();
  const edgeStyles = useEdgeStyles();

  const handleMouseEnter = useCallback(() => {
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.source === nodeId || edge.target === nodeId) {
          return {
            ...edge,
            style: edgeStyles.hover,
          };
        }
        return edge;
      }),
    );
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            zIndex: 1000,
          };
        }
        return node;
      }),
    );
  }, [nodeId, setEdges, edgeStyles, setNodes]);

  const handleMouseLeave = useCallback(() => {
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.source === nodeId || edge.target === nodeId) {
          return {
            ...edge,
            style: edgeStyles.default,
          };
        }
        return edge;
      }),
    );
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            zIndex: 0,
          };
        }
        return node;
      }),
    );
  }, [nodeId, setEdges, edgeStyles, setNodes]);

  return {
    handleMouseEnter,
    handleMouseLeave,
  };
};
