import { useCallback, useState } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { genCanvasID } from '@refly/utils';
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';

export const useInitializeWorkflow = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [newModeLoading, setNewModeLoading] = useState(false);
  const { getCanvasList } = useHandleSiderData();

  const initializeWorkflow = useCallback(
    async (canvasId: string) => {
      try {
        setLoading(true);
        const { error } = await getClient().initializeWorkflow({ body: { canvasId } });

        if (error) {
          console.error('Failed to initialize workflow:', error);
          message.error(t('common.operationFailed') || 'Operation failed');
          return false;
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
    [t],
  );

  const initializeWorkflowInNewCanvas = useCallback(
    async (canvasId: string) => {
      try {
        setNewModeLoading(true);
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
    [t, navigate, getCanvasList],
  );

  return {
    initializeWorkflow,
    initializeWorkflowInNewCanvas,
    loading,
    newModeLoading,
  };
};
