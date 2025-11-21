import { useCallback } from 'react';
import { useAbortAction } from './use-abort-action';
import {
  createNodeEventName,
  nodeActionEmitter,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { logEvent } from '@refly/telemetry-web';

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
  const { workflow: workflowRun } = useCanvasContext();

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
  const handleStop = useCallback(() => {
    if (entityId) {
      return abortAction(entityId);
    }
  }, [entityId, abortAction]);

  return {
    workflowIsRunning,
    handleRerunSingle,
    handleRerunFromHere,
    handleStop,
  };
};
