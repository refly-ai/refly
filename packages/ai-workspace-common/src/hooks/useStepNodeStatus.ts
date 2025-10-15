import { useEffect } from 'react';
import { useWorkflowStepStore } from '@refly/stores';
import { StepNodeStatus } from '@refly/common-types';

export const useStepNodeStatus = (nodeId: string) => {
  const { stepStates, stepResults, isWorkflowMode } = useWorkflowStepStore();

  const stepStatus = stepStates.get(nodeId);
  const stepResult = stepResults.get(nodeId);

  // When node execution completes, update Canvas node visual state
  useEffect(() => {
    if (stepStatus === StepNodeStatus.COMPLETED) {
      updateCanvasNodeAppearance(nodeId, 'completed');
    } else if (stepStatus === StepNodeStatus.RUNNING) {
      updateCanvasNodeAppearance(nodeId, 'running');
    } else if (stepStatus === StepNodeStatus.PENDING) {
      updateCanvasNodeAppearance(nodeId, 'pending');
    }
  }, [stepStatus, nodeId]);

  return {
    status: stepStatus || StepNodeStatus.PENDING,
    result: stepResult,
    isWorkflowMode,
  };
};

// Canvas node appearance update function
const updateCanvasNodeAppearance = (nodeId: string, state: 'running' | 'completed' | 'pending') => {
  // Update Canvas node appearance through DOM manipulation or Canvas state updates
  const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`);
  if (nodeElement) {
    // Remove existing state classes
    nodeElement.classList.remove('step-running', 'step-completed', 'step-pending');

    // Add new state class
    nodeElement.classList.add(`step-${state}`);

    // Add data attribute for easier CSS targeting
    nodeElement.setAttribute('data-step-status', state);
  }
};

export default useStepNodeStatus;
