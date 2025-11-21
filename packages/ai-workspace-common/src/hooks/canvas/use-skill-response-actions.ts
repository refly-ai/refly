import { useCallback } from 'react';
import { useAbortAction } from './use-abort-action';
import {
  createNodeEventName,
  nodeActionEmitter,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { logEvent } from '@refly/telemetry-web';
import { useActionResultStoreShallow } from '@refly/stores';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-data';
import { processContentPreview } from '@refly-packages/ai-workspace-common/utils/content';

interface UseSkillResponseActionsProps {
  nodeId: string;
  entityId: string;
  canvasId?: string;
}

export const useSkillResponseActions = ({
  nodeId,
  entityId,
  canvasId,
}: UseSkillResponseActionsProps) => {
  const { abortAction } = useAbortAction();
  const { setNodeData } = useNodeData();
  const { workflow: workflowRun } = useCanvasContext();
  const { result, isStreaming, stopPolling, removeStreamResult, removeActionResult } =
    useActionResultStoreShallow((state) => ({
      result: state.resultMap[entityId],
      isStreaming: !!state.streamResults[entityId],
      stopPolling: state.stopPolling,
      removeActionResult: state.removeActionResult,
      removeStreamResult: state.removeStreamResult,
    }));
  // Check if workflow is running
  const workflowIsRunning = !!(workflowRun.isInitializing || workflowRun.isPolling);

  // Rerun only this node
  const handleRerunSingle = useCallback(() => {
    nodeActionEmitter.emit(createNodeEventName(nodeId, 'rerun'));
  }, [nodeId]);

  // Rerun workflow from this node
  const handleRerunFromHere = useCallback(() => {
    if (!canvasId) {
      console.warn('Cannot rerun workflow: canvasId is missing');
      return;
    }

    // Check if workflow is already running
    const initializing = workflowRun.isInitializing;
    const isPolling = workflowRun.isPolling;
    const isRunningWorkflow = !!(initializing || isPolling);

    if (isRunningWorkflow) {
      console.warn('Workflow is already running');
      return;
    }

    logEvent('run_from_this_node', null, {
      canvasId,
      nodeId,
    });

    // Initialize workflow starting from this node
    workflowRun.initializeWorkflow({
      canvasId,
      startNodes: [nodeId],
    });
  }, [nodeId, canvasId, workflowRun]);

  // Stop the running node
  const handleStop = useCallback(async () => {
    if (!entityId) {
      return;
    }

    // Abort the action on backend
    await abortAction(entityId);
    if (isStreaming) {
      stopPolling(entityId);
    }

    // Optimistic UI update: immediately update node status to 'failed'
    // Generate content preview from existing steps
    const resultPreview = processContentPreview(result.steps?.map((s) => s?.content || ''));
    setNodeData(nodeId, {
      metadata: {
        status: 'failed',
      },
      contentPreview: resultPreview,
    });

    // Clean up action result and stream result from store
    removeActionResult(entityId);
    removeStreamResult(entityId);
  }, [
    entityId,
    result,
    stopPolling,
    abortAction,
    removeActionResult,
    removeStreamResult,
    setNodeData,
  ]);

  return {
    workflowIsRunning,
    handleRerunSingle,
    handleRerunFromHere,
    handleStop,
  };
};
