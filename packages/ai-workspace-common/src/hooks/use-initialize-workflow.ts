import { useCallback, useMemo, useState } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { delay } from '@refly-packages/ai-workspace-common/utils/delay';
import { genCanvasID } from '@refly/utils';
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';
import { useWorkflowExecutionPolling } from './use-workflow-execution-polling';
import {
  useCanvasResourcesPanelStoreShallow,
  useCanvasStoreShallow,
  useSubscriptionStoreShallow,
} from '@refly/stores';
import { GetWorkflowDetailResponse, InitializeWorkflowRequest } from '@refly/openapi-schema';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';
import { useUserMembership } from '@refly-packages/ai-workspace-common/hooks/use-user-membership';
import { guessModelProviderError, ModelUsageQuotaExceeded } from '@refly/errors';

export const useInitializeWorkflow = (
  canvasId: string,
  forceSyncState: ({ syncRemote }: { syncRemote?: boolean }) => Promise<void>,
) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [newModeLoading, setNewModeLoading] = useState(false);
  const { getCanvasList } = useHandleSiderData();
  const { showEarnedVoucherPopup } = useSubscriptionStoreShallow((state) => ({
    showEarnedVoucherPopup: state.showEarnedVoucherPopup,
  }));
  const { setHasFirstExecutionToday } = useCanvasResourcesPanelStoreShallow((state) => ({
    setHasFirstExecutionToday: state.setHasFirstExecutionToday,
  }));
  const { planType } = useUserMembership();

  const { executionId, setCanvasExecutionId } = useCanvasStoreShallow((state) => ({
    executionId: state.canvasExecutionId[canvasId],
    setCanvasExecutionId: state.setCanvasExecutionId,
  }));
  const { data: workflowVariables } = useVariablesManagement(canvasId);

  // Memoize callbacks to avoid recreating them on every render
  const handleComplete = useMemo(
    () => async (status: string, data: GetWorkflowDetailResponse) => {
      if (status === 'finish') {
        message.success(
          t('canvas.workflow.run.completed') || 'Workflow execution completed successfully',
        );
      } else if (status === 'failed') {
        // Check if this is a credit insufficient error
        const nodeExecutions = data?.data?.nodeExecutions || [];
        const hasCreditInsufficientError = nodeExecutions.some((nodeExecution: any) => {
          if (nodeExecution.errorMessage) {
            const error = guessModelProviderError(nodeExecution.errorMessage);
            return error instanceof ModelUsageQuotaExceeded;
          }
          return false;
        });

        // Only show error notification if NOT aborted by user and NOT credit insufficient
        if (!data?.data?.abortedByUser && !hasCreditInsufficientError) {
          message.error(t('canvas.workflow.run.failed') || 'Workflow execution failed');
        }
      }
    },
    [t, canvasId],
  );

  const handleError = useMemo(
    () => (_error: any) => {
      message.error(t('canvas.workflow.run.error') || 'Error monitoring workflow execution');
    },
    [t],
  );

  // Use the polling hook for workflow execution monitoring
  const {
    status: workflowStatus,
    data: workflowDetail,
    error: pollingError,
    isPolling: isCurrentlyPolling,
    startPolling,
    stopPolling,
  } = useWorkflowExecutionPolling({
    executionId,
    canvasId: canvasId || '',
    enabled: !!executionId || !!canvasId,
    interval: 2000,
    onComplete: handleComplete,
    onError: handleError,
  });

  const initializeWorkflow = useCallback(
    async (param: InitializeWorkflowRequest) => {
      try {
        setLoading(true);
        await forceSyncState({ syncRemote: true });

        // If current workflow execution is the first successful execution today, trigger voucher popup
        let shouldTriggerVoucherPopup = false;
        if (planType === 'free') {
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          const { data: listWorkflowExecutionsData, error: listWorkflowExecutionsError } =
            await getClient().listWorkflowExecutions({
              query: {
                after: startOfToday.getTime(),
                order: 'creationAsc',
                pageSize: 1,
              },
            });
          const firstExecutionToday = listWorkflowExecutionsData?.data?.[0];
          shouldTriggerVoucherPopup = !listWorkflowExecutionsError && !firstExecutionToday;
        }

        const { data, error } = await getClient().initializeWorkflow({
          body: {
            variables: workflowVariables,
            ...param,
          },
        });

        if (error) {
          console.error('Failed to initialize workflow:', error);
          message.error(t('common.operationFailed') || 'Operation failed');
          return false;
        }
        if (data?.data?.workflowExecutionId && canvasId) {
          setCanvasExecutionId(canvasId, data.data.workflowExecutionId);
        }

        if (shouldTriggerVoucherPopup) {
          setHasFirstExecutionToday(true);
          // Poll for available vouchers if not immediately found
          // This handles cases where the voucher might be generated with a slight delay after execution completion
          for (let attempts = 0; attempts < 10; attempts++) {
            const { data: voucherData } = await getClient().getAvailableVouchers();
            const bestVoucher = voucherData?.data?.bestVoucher ?? voucherData?.data?.vouchers?.[0];
            if (bestVoucher) {
              showEarnedVoucherPopup({
                voucher: bestVoucher,
                score: bestVoucher.llmScore,
                triggerLimitReached: false,
              });
              break;
            }
            if (attempts < 9) {
              await delay(2000);
            }
          }
        }

        message.success({
          content: t('canvas.workflow.run.startRunning') || 'Your workflow starts running',
          duration: 5,
        });
        return true;
      } catch (err) {
        console.error('Error initializing workflow:', err);
        message.error(t('common.operationFailed') || 'Operation failed');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [t, canvasId, setCanvasExecutionId, forceSyncState, workflowVariables, showEarnedVoucherPopup],
  );

  const initializeWorkflowInNewCanvas = useCallback(
    async (canvasId: string) => {
      try {
        setNewModeLoading(true);
        await forceSyncState({ syncRemote: true });

        const newCanvasId = genCanvasID();

        const { error } = await getClient().initializeWorkflow({
          body: {
            canvasId: newCanvasId,
            sourceCanvasId: canvasId,
          },
        });

        if (error) {
          console.error('Failed to initialize workflow in new canvas:', error);
          message.error(t('common.operationFailed') || 'Operation failed');
          return false;
        }

        message.success(
          t('common.putSuccess') || 'Workflow initialized in new canvas successfully',
        );

        // Refresh sidebar canvas list to include the new canvas
        await getCanvasList();

        // Wait for 2 seconds before navigating to the new canvas
        await new Promise((resolve) => setTimeout(resolve, 125));
        navigate(`/workflow/${newCanvasId}`);
        return true;
      } catch (err) {
        console.error('Error initializing workflow in new canvas:', err);
        message.error(t('common.operationFailed') || 'Operation failed');
        return false;
      } finally {
        setNewModeLoading(false);
      }
    },
    [t, navigate, getCanvasList, forceSyncState],
  );

  return {
    initializeWorkflow,
    initializeWorkflowInNewCanvas,
    isInitializing: loading,
    newModeLoading,
    // Workflow execution polling state
    executionId,
    workflowStatus,
    workflowDetail,
    isPolling: isCurrentlyPolling,
    pollingError,
    startPolling,
    stopPolling,
  };
};
