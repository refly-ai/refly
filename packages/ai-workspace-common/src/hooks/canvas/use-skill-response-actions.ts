import { useCallback } from 'react';
import { message } from 'antd';
import {
  createNodeEventName,
  nodeActionEmitter,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { logEvent } from '@refly/telemetry-web';
import { useCleanupAbortedNode } from './use-cleanup-aborted-node';
import { useAbortAction } from './use-abort-action';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useVariableView } from './use-variable-view';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';
import { useTranslation } from 'react-i18next';
import { parseMentionsFromQuery } from '@refly/utils';

interface UseSkillResponseActionsProps {
  nodeId: string;
  entityId: string;
  canvasId?: string;
  query?: string | null;
}

export const useSkillResponseActions = ({
  nodeId,
  entityId,
  canvasId,
  query,
}: UseSkillResponseActionsProps) => {
  const { t } = useTranslation();
  const { cleanupAbortedNode } = useCleanupAbortedNode();
  const { abortAction } = useAbortAction();
  const { workflow: workflowRun } = useCanvasContext();
  const { setShowWorkflowRun } = useCanvasResourcesPanelStoreShallow((state) => ({
    setShowWorkflowRun: state.setShowWorkflowRun,
  }));

  // Get variable view handler for auto-opening config panel
  const { handleVariableView } = useVariableView(canvasId || '');

  // Get workflow variables for validation
  const { data: workflowVariables = [] } = useVariablesManagement(canvasId || '');

  // Check if workflow is running
  const workflowIsRunning = !!(workflowRun.isInitializing || workflowRun.isPolling);

  // Get first empty required file variable that is referenced in the query
  const getFirstEmptyRequiredFileVariable = useCallback(
    (query?: string | null) => {
      // If no query is provided, don't check any variables
      if (!query) {
        return null;
      }

      // Extract variable references from the query using utility function
      const mentions = parseMentionsFromQuery(query);
      const referencedVariableIds = new Set<string>(
        mentions.filter((m) => m.type === 'var').map((m) => m.id),
      );

      // Check only the variables that are referenced in the query
      for (const variable of workflowVariables) {
        // Skip variables that are not referenced in the query
        if (!referencedVariableIds.has(variable.variableId)) {
          continue;
        }

        if (
          variable.required &&
          variable.variableType === 'resource' &&
          (!variable.value || variable.value.length === 0)
        ) {
          return variable;
        }
      }
      return null;
    },
    [workflowVariables],
  );

  // Rerun only this node
  const handleRerunSingle = useCallback(() => {
    // Check for empty required file variables that are referenced in the query
    const emptyRequiredVar = getFirstEmptyRequiredFileVariable(query);
    if (emptyRequiredVar) {
      message.warning(
        t('canvas.workflow.run.requiredFileInputsMissing') ||
          'This agent has required file inputs. Please upload the missing files before running.',
      );
      // Auto-open the config panel for the first empty required variable
      handleVariableView(emptyRequiredVar, { autoOpenEdit: true, showError: true });
      return;
    }

    nodeActionEmitter.emit(createNodeEventName(nodeId, 'rerun'));
  }, [nodeId, query, getFirstEmptyRequiredFileVariable, handleVariableView, t]);

  // Rerun workflow from this node
  const handleRerunFromHere = useCallback(async () => {
    if (!canvasId) {
      console.warn('Cannot rerun workflow: canvasId is missing');
      return;
    }

    // Check for empty required file variables (for this step or later steps in the chain)
    // Note: For "from here", we check all variables since we're running the full workflow
    const emptyRequiredVar = getFirstEmptyRequiredFileVariable(null);
    if (emptyRequiredVar) {
      message.warning(
        t('canvas.workflow.run.requiredFileInputsMissingForChain') ||
          'Some required file inputs for this step or later steps are missing. Please upload them before running.',
      );
      // Auto-open the config panel for the first empty required variable
      handleVariableView(emptyRequiredVar, { autoOpenEdit: true, showError: true });
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

    logEvent('run_from_here', Date.now(), {
      canvasId,
      nodeId,
    });

    // Initialize workflow starting from this node
    const success = await workflowRun.initializeWorkflow({
      canvasId,
      startNodes: [nodeId],
    });

    if (success) {
      setShowWorkflowRun(false);
    }
  }, [
    nodeId,
    canvasId,
    workflowRun,
    setShowWorkflowRun,
    getFirstEmptyRequiredFileVariable,
    handleVariableView,
    t,
  ]);

  // Stop the running node
  const handleStop = useCallback(async () => {
    // First, abort the action on backend

    await abortAction(entityId);

    // Then, clean up frontend state
    cleanupAbortedNode(nodeId, entityId);
  }, [nodeId, entityId, abortAction, cleanupAbortedNode]);

  return {
    workflowIsRunning,
    handleRerunSingle,
    handleRerunFromHere,
    handleStop,
  };
};
