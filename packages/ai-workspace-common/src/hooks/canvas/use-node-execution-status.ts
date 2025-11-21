import { useMemo } from 'react';
import { useCanvasStoreShallow } from '@refly/stores';
import { ActionStatus, WorkflowNodeExecution } from '@refly/openapi-schema';

interface UseNodeExecutionStatusOptions {
  canvasId: string;
  nodeId: string;
}

interface UseNodeExecutionStatusReturn {
  nodeExecution: WorkflowNodeExecution | null;
  status: ActionStatus;
  isExecuting: boolean;
  isWaiting: boolean;
  isFinished: boolean;
  isFailed: boolean;
}

/**
 * Hook to get the execution status of a specific node in a canvas
 */
export const useNodeExecutionStatus = ({
  canvasId,
  nodeId,
}: UseNodeExecutionStatusOptions): UseNodeExecutionStatusReturn => {
  const { nodeExecutions } = useCanvasStoreShallow((state) => ({
    nodeExecutions: state.canvasNodeExecutions[canvasId] ?? [],
  }));

  const nodeExecution = useMemo(() => {
    return nodeExecutions?.find((execution) => execution.nodeId === nodeId) ?? null;
  }, [nodeExecutions, nodeId]);

  const status = nodeExecution?.status ?? null;

  const isExecuting = status === 'executing';
  const isWaiting = status === 'waiting';
  const isFinished = status === 'finish';
  const isFailed = status === 'failed';

  return {
    nodeExecution,
    status,
    isExecuting,
    isWaiting,
    isFinished,
    isFailed,
  };
};
