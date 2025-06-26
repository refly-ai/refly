import { useCallback } from 'react';
import { useReactFlow, useStoreApi, XYPosition } from '@xyflow/react';
import { CanvasNodeType } from '@refly/openapi-schema';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { genUniqueId } from '@refly/utils/id';
import { useCanvasStore } from '@refly-packages/ai-workspace-common/stores/canvas';
import {
  CanvasNodeData,
  getNodeDefaultMetadata,
  prepareNodeData,
} from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { useEdgeStyles } from '../../components/canvas/constants';
import { CanvasNodeFilter, useNodeSelection } from './use-node-selection';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { locateToNodePreviewEmitter } from '@refly-packages/ai-workspace-common/events/locateToNodePreview';
import { useNodePosition } from './use-node-position';
import { purgeContextItems } from '@refly-packages/ai-workspace-common/utils/map-context-items';
import { useNodePreviewControl } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { CanvasNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { adoptUserNodes } from '@xyflow/system';

// Define the maximum number of nodes allowed in a canvas
const MAX_NODES_PER_CANVAS = 500;
// Define the threshold at which to show warning (e.g., 98% of max)
const WARNING_THRESHOLD = 0.98;

const deduplicateNodes = (nodes: any[]) => {
  const uniqueNodesMap = new Map();
  for (const node of nodes) {
    uniqueNodesMap.set(node.id, node);
  }
  return Array.from(uniqueNodesMap.values());
};

const deduplicateEdges = (edges: any[]) => {
  const uniqueEdgesMap = new Map();
  for (const edge of edges) {
    uniqueEdgesMap.set(edge.id, edge);
  }
  return Array.from(uniqueEdgesMap.values());
};

export const useAddNode = () => {
  const { t } = useTranslation();
  const edgeStyles = useEdgeStyles();
  const { setSelectedNode } = useNodeSelection();
  const { getState, setState } = useStoreApi();
  const { canvasId } = useCanvasContext();
  const { calculatePosition, layoutBranchAndUpdatePositions, setNodeCenter } = useNodePosition();
  const { previewNode } = useNodePreviewControl({ canvasId });
  const { setNodes, setEdges } = useReactFlow();

  // Clean up ghost nodes when menu closes
  const handleCleanGhost = () => {
    setNodes((nodes) => nodes.filter((node) => !node.id.startsWith('ghost-')));
    setEdges((edges) => edges.filter((edge) => !edge.id.startsWith('temp-edge-')));
  };

  const addNode = useCallback(
    (
      node: {
        type: CanvasNodeType;
        data: CanvasNodeData<any>;
        position?: XYPosition;
        id?: string;
        offsetPosition?: XYPosition;
      },
      connectTo?: CanvasNodeFilter[],
      shouldPreview = true,
      needSetCenter = false,
    ): XYPosition | undefined => {
      const { nodeSizeMode } = useCanvasStore.getState();
      const { nodes, edges, nodeLookup, parentLookup } = getState();

      if (!node?.type || !node?.data) {
        console.warn('Invalid node data provided');
        handleCleanGhost();
        return undefined;
      }

      // Check for node limit
      const nodeCount = nodes?.length ?? 0;

      // If we're at the max limit, show error and return
      if (nodeCount >= MAX_NODES_PER_CANVAS) {
        message.error(
          t('canvas.action.nodeLimitReached', {
            max: MAX_NODES_PER_CANVAS,
          }),
        );
        return undefined;
      }

      // If we're approaching the limit, show warning but continue
      if (
        nodeCount + 1 >= Math.ceil(MAX_NODES_PER_CANVAS * WARNING_THRESHOLD) &&
        nodeCount < MAX_NODES_PER_CANVAS
      ) {
        message.warning(
          t('canvas.action.approachingNodeLimit', {
            current: nodeCount + 1,
            max: MAX_NODES_PER_CANVAS,
          }),
        );
      }

      // Check for existing node
      const existingNode = nodes.find(
        (n) => n.type === node.type && n.data?.entityId === node.data?.entityId,
      );
      if (existingNode) {
        if (existingNode.type !== 'skillResponse') {
          message.warning(
            t('canvas.action.nodeAlreadyExists', { type: t(`canvas.nodeTypes.${node.type}`) }),
          );
        }
        setSelectedNode(existingNode);
        setNodeCenter(existingNode.id);
        return existingNode.position;
      }

      // Purge context items if they exist
      if (node.data.metadata?.contextItems) {
        node.data.metadata.contextItems = purgeContextItems(node.data.metadata.contextItems);
      }

      // Find source nodes and target nodes based on handleType
      const sourceNodes = connectTo
        ?.filter((filter) => !filter.handleType || filter.handleType === 'source')
        ?.map((filter) =>
          nodes.find((n) => n.type === filter.type && n.data?.entityId === filter.entityId),
        )
        .filter(Boolean);

      const targetNodes = connectTo
        ?.filter((filter) => filter.handleType === 'target')
        ?.map((filter) =>
          nodes.find((n) => n.type === filter.type && n.data?.entityId === filter.entityId),
        )
        .filter(Boolean);

      // Calculate new node position using the utility function
      const newPosition = calculatePosition({
        nodes,
        sourceNodes: [...(sourceNodes || []), ...(targetNodes || [])],
        connectTo,
        defaultPosition: node.position,
        edges,
      });

      if (node.offsetPosition && !node.position) {
        newPosition.x += node.offsetPosition.x || 0;
        newPosition.y += node.offsetPosition.y || 0;
      }

      // Get default metadata and apply global nodeSizeMode
      const defaultMetadata = getNodeDefaultMetadata(node.type);

      // Apply the global nodeSizeMode to the new node's metadata
      if (defaultMetadata && typeof defaultMetadata === 'object') {
        // Using type assertion to avoid TypeScript errors since sizeMode is not on all node types
        (defaultMetadata as any).sizeMode = nodeSizeMode;
      }

      const enrichedData = {
        createdAt: new Date().toISOString(),
        ...node.data,
        metadata: {
          ...defaultMetadata,
          ...node?.data?.metadata,
          sizeMode: nodeSizeMode, // Ensure sizeMode is set even if not in defaultMetadata
        },
      };

      const newNode = prepareNodeData({
        type: node.type,
        data: enrichedData,
        position: newPosition,
        selected: false,
        id: node?.id,
      });

      // Create updated nodes array with the new node
      const updatedNodes = deduplicateNodes([
        ...nodes.map((n) => ({ ...n, selected: false })),
        newNode,
      ]);

      // Create new edges based on connection types
      let updatedEdges = edges;
      if (connectTo?.length > 0) {
        const newEdges = [];

        // Create edges from source nodes to new node (source -> new node)
        if (sourceNodes?.length > 0) {
          const sourceEdges = sourceNodes
            .filter((sourceNode) => {
              // Filter out the source nodes that already have an edge
              return !edges?.some(
                (edge) => edge.source === sourceNode.id && edge.target === newNode.id,
              );
            })
            .map((sourceNode) => ({
              id: `edge-${genUniqueId()}`,
              source: sourceNode.id,
              target: newNode.id,
              style: edgeStyles.default,
              type: 'default',
            }));
          newEdges.push(...sourceEdges);
        }

        // Create edges from new node to target nodes (new node -> target)
        if (targetNodes?.length > 0) {
          const targetEdges = targetNodes
            .filter((targetNode) => {
              // Filter out the target nodes that already have an edge
              return !edges?.some(
                (edge) => edge.source === newNode.id && edge.target === targetNode.id,
              );
            })
            .map((targetNode) => ({
              id: `edge-${genUniqueId()}`,
              source: newNode.id,
              target: targetNode.id,
              style: edgeStyles.default,
              type: 'default',
            }));
          newEdges.push(...targetEdges);
        }

        // Only add new edges if there are any
        if (newEdges.length > 0) {
          updatedEdges = deduplicateEdges([...edges, ...newEdges]);
        }
      }

      // Update nodes to ensure they exist first
      adoptUserNodes(updatedNodes, nodeLookup, parentLookup, {
        elevateNodesOnSelect: false,
      });
      setState({ nodes: updatedNodes.filter((node) => !node.id.startsWith('ghost-')) });

      // Then update edges with a slight delay to ensure nodes are registered first
      // This helps prevent the race condition where edges are created but nodes aren't ready
      setTimeout(() => {
        // Update edges separately
        setState({ edges: updatedEdges.filter((edge) => !edge.id.startsWith('temp-edge-')) });

        // Apply branch layout if we're connecting to existing nodes
        if (sourceNodes?.length > 0 || targetNodes?.length > 0) {
          // Use setTimeout to ensure the new node and edges are added before layout
          setTimeout(() => {
            // const { autoLayout } = useCanvasStore.getState();
            const autoLayout = false;
            if (!autoLayout) {
              if (needSetCenter) {
                setNodeCenter(newNode.id);
              }

              return;
            }

            // Use all connected nodes for layout calculation
            const allConnectedNodes = [...(sourceNodes || []), ...(targetNodes || [])];
            layoutBranchAndUpdatePositions(
              allConnectedNodes,
              updatedNodes,
              updatedEdges,
              {},
              { needSetCenter: needSetCenter, targetNodeId: newNode.id },
            );
          }, 50);
        } else if (needSetCenter) {
          setNodeCenter(newNode.id);
        }
      }, 10);

      if (
        (newNode.type === 'document' ||
          newNode.type === 'resource' ||
          newNode.type === 'website') &&
        shouldPreview
      ) {
        previewNode(newNode as unknown as CanvasNode);
        locateToNodePreviewEmitter.emit('locateToNodePreview', { canvasId, id: newNode.id });
      }

      // Return the calculated position
      return newPosition;
    },
    [
      canvasId,
      edgeStyles,
      setNodeCenter,
      previewNode,
      t,
      calculatePosition,
      layoutBranchAndUpdatePositions,
    ],
  );

  return { addNode };
};
