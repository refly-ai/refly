import { useCallback, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { CanvasNode, ResponseNodeMeta } from '@refly/canvas-common';
import { SadFace } from 'refly-icons';
import { useCanvasNodesStore } from '@refly/stores';

/**
 * Hook to check if there are any nodes with empty prompts in the workflow.
 * An 'empty prompt' node is a skillResponse node with an empty query in its metadata.
 */
export const useCheckEmptyPrompts = () => {
  const { getNodes, getEdges, fitView } = useReactFlow();
  const { t } = useTranslation();
  const { setHighlightedNodeIds, clearHighlightedNodeIds } = useCanvasNodesStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkEmptyPrompts = useCallback(
    (startNodeId?: string): string[] => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      clearHighlightedNodeIds();
      const nodes = getNodes() as CanvasNode<ResponseNodeMeta>[];
      const edges = getEdges();
      let nodesToCheck: CanvasNode<ResponseNodeMeta>[] = [];

      if (startNodeId) {
        // If startNodeId is provided, find it and all its downstream nodes
        const startNode = nodes.find((n) => n.id === startNodeId);
        if (!startNode) {
          return [];
        }

        const downstreamIds = new Set<string>([startNodeId]);
        const queue = [startNodeId];

        while (queue.length > 0) {
          const currentId = queue.shift();
          const children = edges
            .filter((edge) => edge.source === currentId)
            .map((edge) => edge.target);

          for (const childId of children) {
            if (!downstreamIds.has(childId)) {
              downstreamIds.add(childId);
              queue.push(childId);
            }
          }
        }

        nodesToCheck = nodes.filter((n) => downstreamIds.has(n.id));
      } else {
        // If no startNodeId, check all nodes except the 'start' node
        nodesToCheck = nodes.filter((n) => n.type !== 'start');
      }

      // Filter for skillResponse nodes with empty queries
      const emptyPromptNodeIds = nodesToCheck
        .filter((node) => {
          if (node.type !== 'skillResponse') {
            return false;
          }
          const query = node.data?.metadata?.query;
          return !query || query.trim() === '';
        })
        .map((node) => node.id);

      if (emptyPromptNodeIds.length > 0) {
        fitView();
        const warningMsg =
          t('canvas.workflow.run.emptyPromptsError') ||
          'Some agents are missing prompts and cannot be run';
        message.warning({
          key: 'empty-prompts-warning',
          content: warningMsg,
          icon: <SadFace size={18} className="mr-1" />,
        });

        setHighlightedNodeIds(emptyPromptNodeIds);

        timerRef.current = setTimeout(() => {
          clearHighlightedNodeIds();
          timerRef.current = null;
        }, 3000);
      }

      return emptyPromptNodeIds;
    },
    [getNodes, getEdges, t, setHighlightedNodeIds, clearHighlightedNodeIds, fitView],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { checkEmptyPrompts };
};
