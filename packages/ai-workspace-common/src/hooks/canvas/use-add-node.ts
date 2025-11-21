import { useCallback } from 'react';
import { useReactFlow, useStoreApi, XYPosition } from '@xyflow/react';
import { CanvasNode as SchemaCanvasNode } from '@refly/openapi-schema';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  CanvasNode,
  CanvasNodeFilter,
  prepareAddNode,
  deduplicateEdges,
} from '@refly/canvas-common';
import { useEdgeStyles } from '../../components/canvas/constants';
import { useNodeSelection } from './use-node-selection';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useNodePosition } from './use-node-position';
import { useNodePreviewControl } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { adoptUserNodes } from '@xyflow/system';
import { useCanvasStore } from '@refly/stores';
import { useFetchProviderItems } from '@refly-packages/ai-workspace-common/hooks/use-fetch-provider-items';

// Define the maximum number of nodes allowed in a canvas
const MAX_NODES_PER_CANVAS = 500;
// Define the threshold at which to show warning (e.g., 98% of max)
const WARNING_THRESHOLD = 0.98;

// Retry configuration for canvas initialization
const MAX_RETRY_ATTEMPTS = 10;
const INITIAL_RETRY_DELAY = 100; // milliseconds
const MAX_RETRY_DELAY = 5000; // milliseconds

const deduplicateNodes = (nodes: any[]) => {
  const uniqueNodesMap = new Map();
  for (const node of nodes) {
    uniqueNodesMap.set(node.id, node);
  }
  return Array.from(uniqueNodesMap.values());
};

export const useAddNode = () => {
  const { t } = useTranslation();
  const edgeStyles = useEdgeStyles();
  const { setSelectedNode } = useNodeSelection();
  const { getState, setState } = useStoreApi();
  const { canvasId } = useCanvasContext();
  const { layoutBranchAndUpdatePositions, setNodeCenter } = useNodePosition();
  const { previewNode } = useNodePreviewControl({ canvasId });
  const { setNodes, setEdges } = useReactFlow();

  // Clean up ghost nodes when menu closes
  const handleCleanGhost = () => {
    setNodes((nodes) => nodes.filter((node) => !node.id.startsWith('ghost-')));
    setEdges((edges) => edges.filter((edge) => !edge.id.startsWith('temp-edge-')));
  };

  const { defaultChatModel } = useFetchProviderItems({
    category: 'llm',
    enabled: true,
  });

  const addNode = useCallback(
    (
      node: Partial<CanvasNode>,
      connectTo?: CanvasNodeFilter[],
      shouldPreview = true,
      needSetCenter = false,
      retryCount = 0,
      skipPurgeToolsets = false,
    ): XYPosition | undefined => {
      const { canvasInitialized } = useCanvasStore.getState();

      if (!canvasInitialized[canvasId]) {
        // Check if we've exceeded the maximum retry attempts
        if (retryCount >= MAX_RETRY_ATTEMPTS) {
          console.error(`Canvas initialization failed after ${MAX_RETRY_ATTEMPTS} attempts`);
          message.error(t('canvas.action.initializationFailed'));
          handleCleanGhost();
          return undefined;
        }

        // Calculate exponential backoff delay with a maximum cap
        const delay = Math.min(INITIAL_RETRY_DELAY * 2 ** retryCount, MAX_RETRY_DELAY);

        setTimeout(() => {
          addNode(node, connectTo, shouldPreview, needSetCenter, retryCount + 1, skipPurgeToolsets);
        }, delay);
        return undefined;
      }

      const { nodes, edges, nodeLookup, parentLookup } = getState();

      if (!node?.type || !node?.data) {
        console.warn('Invalid node data provided');
        handleCleanGhost();
        return undefined;
      }

      // Set default model info if not provided
      node.data.metadata ??= {};
      node.data.metadata.modelInfo ??= defaultChatModel;

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

      const { newNode, newEdges } = prepareAddNode({
        node: node as SchemaCanvasNode,
        connectTo,
        nodes,
        edges,
        skipPurgeToolsets,
      });

      const updatedNodes = deduplicateNodes([...nodes, newNode]);
      const updatedEdges = deduplicateEdges([...edges, ...newEdges]);

      // Update nodes to ensure they exist first
      adoptUserNodes(updatedNodes, nodeLookup, parentLookup, {
        elevateNodesOnSelect: false,
      });
      setState({ nodes: updatedNodes.filter((node) => node && !node.id.startsWith('ghost-')) });
      // Then update edges with a slight delay to ensure nodes are registered first
      // This helps prevent the race condition where edges are created but nodes aren't ready
      setTimeout(() => {
        // Update edges separately
        setState({
          edges: updatedEdges.filter((edge) => edge && !edge.id.startsWith('temp-edge-')),
        });

        // Apply branch layout if we're connecting to existing nodes
        if (needSetCenter) {
          setSelectedNode(newNode);
          setNodeCenter(newNode.id);
        }
      }, 10);

      if (
        [
          'document',
          'resource',
          'website',
          'skillResponse',
          'codeArtifact',
          'image',
          'video',
          'audio',
        ].includes(newNode.type) &&
        shouldPreview
      ) {
        previewNode(newNode as unknown as CanvasNode);
      }

      // Return the calculated position
      return newNode.position;
    },
    [
      canvasId,
      edgeStyles,
      setNodeCenter,
      previewNode,
      t,
      layoutBranchAndUpdatePositions,
      defaultChatModel,
    ],
  );

  return { addNode };
};
