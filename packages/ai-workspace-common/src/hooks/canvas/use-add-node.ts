import { useCallback } from 'react';
import { useStoreApi, XYPosition } from '@xyflow/react';
import { CanvasNodeType } from '@refly/openapi-schema';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { genUniqueId } from '@refly-packages/utils/id';
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
  const { setNodeCenter } = useNodePosition();
  const { getState, setState } = useStoreApi();
  const { canvasId } = useCanvasContext();
  const { calculatePosition, layoutBranchAndUpdatePositions } = useNodePosition();
  const { previewNode } = useNodePreviewControl({ canvasId });

  const addNode = useCallback(
    (
      node: { type: CanvasNodeType; data: CanvasNodeData<any>; position?: XYPosition; id?: string },
      connectTo?: CanvasNodeFilter[],
      shouldPreview = true,
      needSetCenter = false,
    ): XYPosition | undefined => {
      const { nodeSizeMode } = useCanvasStore.getState();
      const { nodes, edges, nodeLookup, parentLookup } = getState();

      if (!node?.type || !node?.data) {
        console.warn('Invalid node data provided');
        return undefined;
      }

      // Check for existing node
      const existingNode = nodes.find(
        (n) => n.type === node.type && n.data?.entityId === node.data?.entityId,
      );
      if (existingNode) {
        if (existingNode.type !== 'skillResponse') {
          message.warning(t('canvas.action.nodeAlreadyExists', { type: t(`common.${node.type}`) }));
        }
        setSelectedNode(existingNode);
        setNodeCenter(existingNode.id);
        return existingNode.position;
      }

      // Purge context items if they exist
      if (node.data.metadata?.contextItems) {
        node.data.metadata.contextItems = purgeContextItems(node.data.metadata.contextItems);
      }

      // Find source nodes
      const sourceNodes = connectTo
        ?.map((filter) =>
          nodes.find((n) => n.type === filter.type && n.data?.entityId === filter.entityId),
        )
        .filter(Boolean);

      // Calculate new node position using the utility function
      const newPosition = calculatePosition({
        nodes,
        sourceNodes,
        connectTo,
        defaultPosition: node.position,
        edges,
      });

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

      // Create new edges if connecting to source nodes
      let updatedEdges = edges;
      if (connectTo?.length > 0 && sourceNodes?.length > 0) {
        const newEdges = sourceNodes
          .filter((sourceNode) => {
            // filter out the source nodes that already have an edge
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

        // only add new edges if there are any
        if (newEdges.length > 0) {
          updatedEdges = deduplicateEdges([...edges, ...newEdges]);
        }
      }

      // Update nodes to ensure they exist first
      adoptUserNodes(updatedNodes, nodeLookup, parentLookup, {
        elevateNodesOnSelect: false,
      });
      setState({ nodes: updatedNodes });

      // Then update edges with a slight delay to ensure nodes are registered first
      // This helps prevent the race condition where edges are created but nodes aren't ready
      setTimeout(() => {
        // Update edges separately
        setState({ edges: updatedEdges });

        // Apply branch layout if we're connecting to existing nodes
        if (sourceNodes?.length > 0) {
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

            layoutBranchAndUpdatePositions(
              sourceNodes,
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
        newNode.type === 'document' ||
        (newNode.type === 'resource' && shouldPreview) ||
        (['skillResponse', 'codeArtifact', 'website'].includes(newNode.type) && shouldPreview)
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
