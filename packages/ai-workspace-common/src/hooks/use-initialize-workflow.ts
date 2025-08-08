import { useCallback, useState } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

export const useInitializeWorkflow = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

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

  return {
    initializeWorkflow,
    loading,
  };
};
