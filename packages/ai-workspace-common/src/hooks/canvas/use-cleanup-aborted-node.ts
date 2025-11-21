import { useCallback } from 'react';
import { useActionResultStoreShallow } from '@refly/stores';
import { useNodeData } from './use-node-data';
import { processContentPreview } from '@refly-packages/ai-workspace-common/utils/content';

/**
 * Custom hook to clean up node state after abort
 *
 * This hook encapsulates the common UI cleanup logic after a node is aborted:
 * 1. Stops polling if streaming
 * 2. Updates node status to 'failed' with content preview (optimistic UI update)
 * 3. Cleans up action results and stream results from store
 *
 * Note: This does NOT call the backend abort API. The caller is responsible for:
 * - Calling abortAction(entityId) for single node abort
 * - Calling abortWorkflow(executionId) for workflow abort
 *
 * @returns Object with cleanupAbortedNode function
 */
export const useCleanupAbortedNode = () => {
  const { setNodeData } = useNodeData();

  const { resultMap, stopPolling, removeStreamResult, removeActionResult } =
    useActionResultStoreShallow((state) => ({
      resultMap: state.resultMap,
      stopPolling: state.stopPolling,
      removeActionResult: state.removeActionResult,
      removeStreamResult: state.removeStreamResult,
    }));

  /**
   * Clean up node state after abort (frontend only)
   *
   * @param nodeId - The ReactFlow node ID
   * @param entityId - The entity ID (action execution ID)
   */
  const cleanupAbortedNode = useCallback(
    (nodeId: string, entityId: string) => {
      if (!entityId) {
        return;
      }

      const result = resultMap[entityId];

      // Stop polling if active
      stopPolling(entityId);

      // Optimistic UI update: immediately update node status to 'failed'
      // Generate content preview from existing steps
      const resultPreview = result
        ? processContentPreview(result.steps?.map((s) => s?.content || ''))
        : '';

      setNodeData(nodeId, {
        metadata: {
          status: 'failed',
          errorType: 'userAbort',
        },
        contentPreview: resultPreview,
      });

      // Clean up action result and stream result from store
      removeActionResult(entityId);
      removeStreamResult(entityId);
    },
    [resultMap, stopPolling, setNodeData, removeActionResult, removeStreamResult],
  );

  return {
    cleanupAbortedNode,
  };
};
