import { useCallback, useState } from 'react';
import { message, notification } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { genCanvasID } from '@refly/utils';
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';
import { useWorkflowExecutionPolling } from './use-workflow-execution-polling';
import { useCanvasStoreShallow } from '@refly/stores';
import { InitializeWorkflowRequest } from '@refly/openapi-schema';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

export const useInitializeWorkflow = (canvasId?: string) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [newModeLoading, setNewModeLoading] = useState(false);
  const { getCanvasList } = useHandleSiderData();

  const { executionId, setCanvasExecutionId } = useCanvasStoreShallow((state) => ({
    executionId: canvasId ? state.canvasExecutionId[canvasId] || null : null,
    setCanvasExecutionId: state.setCanvasExecutionId,
  }));

  const { forceSyncState } = useCanvasContext();

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

    onComplete: (status, _data) => {
      if (status === 'finish') {
        notification.success({
          message:
            t('canvas.workflow.run.completed') || 'Workflow execution completed successfully',
        });
      } else if (status === 'failed') {
        notification.error({
          message: t('canvas.workflow.run.failed') || 'Workflow execution failed',
        });
      }
    },
    onError: (_error) => {
      notification.error({
        message: t('canvas.workflow.run.error') || 'Error monitoring workflow execution',
      });
    },
  });

  const initializeWorkflow = useCallback(
    async (param: InitializeWorkflowRequest) => {
      try {
        setLoading(true);
        await forceSyncState({ syncRemote: true });

        const { data, error } = await getClient().initializeWorkflow({
          body: param,
        });

        if (error) {
          console.error('Failed to initialize workflow:', error);
          message.error(t('common.operationFailed') || 'Operation failed');
          return false;
        }
        if (data?.data?.workflowExecutionId && canvasId) {
          setCanvasExecutionId(canvasId, data.data.workflowExecutionId);
        }

        message.success(t('common.putSuccess') || 'Workflow initialized successfully');
        return true;
      } catch (err) {
        console.error('Error initializing workflow:', err);
        message.error(t('common.operationFailed') || 'Operation failed');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [t, canvasId, setCanvasExecutionId, forceSyncState],
  );

  const initializeWorkflowInNewCanvas = useCallback(
    async (canvasId: string) => {
      try {
        setNewModeLoading(true);
        await forceSyncState({ syncRemote: true });

        const newCanvasId = genCanvasID();

        const { error } = await getClient().initializeWorkflow({
          body: {
            canvasId,
            newCanvasId,
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
        navigate(`/canvas/${newCanvasId}`);
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
    loading,
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
