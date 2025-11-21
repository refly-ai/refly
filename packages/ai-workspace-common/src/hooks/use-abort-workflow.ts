import { useState, useCallback } from 'react';
import { Modal, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useReactFlow } from '@xyflow/react';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useCanvasStoreShallow } from '@refly/stores';
import type { CanvasNode } from '@refly/canvas-common';
import { useCleanupAbortedNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-cleanup-aborted-node';

interface UseAbortWorkflowOptions {
  executionId?: string | null;
  canvasId?: string;
  onSuccess?: () => void;
}

interface UseAbortWorkflowReturn {
  handleAbort: () => void;
  isAborting: boolean;
}

/**
 * Custom hook to abort a running workflow execution
 *
 * Features:
 * - Shows confirmation modal before aborting
 * - Calls abort API endpoint
 * - Implements optimistic UI update (immediately marks executing/waiting nodes as 'failed')
 * - Stops polling for all affected nodes
 * - Cleans up action results and stream results from store
 * - Updates node data in ReactFlow canvas
 * - Shows success/error messages
 *
 * @param options - Configuration options
 * @param options.executionId - The workflow execution ID to abort
 * @param options.canvasId - The canvas ID to update node executions optimistically
 * @param options.onSuccess - Callback to invoke after successful abort
 * @returns Object with handleAbort function and isAborting state
 */
export const useAbortWorkflow = ({
  executionId,
  canvasId,
  onSuccess,
}: UseAbortWorkflowOptions): UseAbortWorkflowReturn => {
  const { t } = useTranslation();
  const [isAborting, setIsAborting] = useState(false);
  const { getNodes } = useReactFlow<CanvasNode<any>>();
  const { cleanupAbortedNode } = useCleanupAbortedNode();

  const { canvasNodeExecutions, setCanvasNodeExecutions } = useCanvasStoreShallow((state) => ({
    canvasNodeExecutions: canvasId ? state.canvasNodeExecutions[canvasId] : null,
    setCanvasNodeExecutions: state.setCanvasNodeExecutions,
  }));

  const handleAbort = useCallback(() => {
    if (!executionId) {
      return;
    }

    Modal.confirm({
      title: t('canvas.workflow.run.abort.confirmTitle'),
      content: t('canvas.workflow.run.abort.confirmContent'),
      okText: t('canvas.workflow.run.abort.confirm'),
      cancelText: t('common.cancel'),
      icon: null,
      okButtonProps: {
        className: '!bg-[#0E9F77] !border-[#0E9F77] hover:!bg-[#0C8A66] hover:!border-[#0C8A66]',
      },
      onOk: async () => {
        setIsAborting(true);
        try {
          if (canvasId && Array.isArray(canvasNodeExecutions) && canvasNodeExecutions.length) {
            // Optimistic UI update: immediately update all executing/waiting nodes
            const nodes = getNodes();

            // Find all nodes that are currently executing or waiting
            const affectedNodeExecutions = canvasNodeExecutions.filter(
              (nodeExecution) =>
                nodeExecution.status === 'executing' || nodeExecution.status === 'waiting',
            );

            // Update canvasNodeExecutions state
            const updatedNodeExecutions = canvasNodeExecutions.map((nodeExecution) => {
              if (nodeExecution.status === 'executing' || nodeExecution.status === 'waiting') {
                return {
                  ...nodeExecution,
                  status: 'failed' as const,
                  errorMessage: 'Workflow aborted by user',
                };
              }
              return nodeExecution;
            });

            setCanvasNodeExecutions(canvasId, updatedNodeExecutions);

            // For each affected node, clean up frontend state
            for (const nodeExecution of affectedNodeExecutions) {
              const node = nodes.find((n) => n.data?.entityId === nodeExecution.entityId);
              if (!node) continue;

              // Clean up frontend state for this node
              cleanupAbortedNode(node.id, nodeExecution.entityId);
            }
          }

          // Abort the workflow on backend first
          const { error } = await getClient().abortWorkflow({
            body: { executionId },
          });

          if (error) {
            message.error(t('canvas.workflow.run.abort.failed'));
            setIsAborting(false);
            return;
          }

          message.success(t('canvas.workflow.run.abort.success'));

          // Invoke success callback
          onSuccess?.();
        } catch (error) {
          console.error('Failed to abort workflow:', error);
          message.error(t('canvas.workflow.run.abort.failed'));
        } finally {
          setIsAborting(false);
        }
      },
    });
  }, [
    executionId,
    canvasId,
    canvasNodeExecutions,
    getNodes,
    setCanvasNodeExecutions,
    cleanupAbortedNode,
    t,
    onSuccess,
  ]);

  return {
    handleAbort,
    isAborting,
  };
};
