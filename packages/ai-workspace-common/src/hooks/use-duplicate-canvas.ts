import { useCallback, useState } from 'react';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useNavigate } from 'react-router-dom';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useTranslation } from 'react-i18next';
import { message } from 'antd';
import { logEvent } from '@refly/telemetry-web';
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';

interface UseDuplicateCanvasProps {
  canvasId?: string;
  shareId?: string;
  templateId?: string;
  title?: string;
  isCopy?: boolean;
  onSuccess?: () => void;
}

export const useDuplicateCanvas = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { getCanvasList } = useHandleSiderData();

  const { projectId } = useGetProjectCanvasId();

  const duplicateCanvas = useCallback(
    async ({
      canvasId,
      shareId,
      title,
      templateId,
      isCopy,
      onSuccess,
    }: UseDuplicateCanvasProps) => {
      if (loading) return;
      setLoading(true);
      try {
        let data: any;

        if (shareId) {
          // Cross-user duplication via share
          const response = await getClient().duplicateShare({
            body: {
              shareId,
              projectId,
            },
          });
          data = response.data;
        } else {
          // Same-user duplication
          const newTitle = isCopy ? `${title} ${t('common.duplicate')}` : title;
          const response = await getClient().duplicateCanvas({
            body: {
              projectId,
              canvasId,
              title: newTitle,
            },
          });
          data = response.data;
        }

        if (data?.success) {
          message.success(t('common.putSuccess'));
          onSuccess?.();
          getCanvasList();

          const newEntityId = shareId ? data.data?.entityId : data.data?.canvasId;

          if (newEntityId) {
            if (shareId) {
              logEvent('canvas::entry_canvas_template', Date.now(), {
                entry_type: 'template',
                canvas_id: newEntityId,
                template_id: templateId,
              });
            }
            const url = projectId
              ? `/project/${projectId}?canvasId=${newEntityId}`
              : `/workflow/${newEntityId}`;
            navigate(url);
          }
        }
      } catch (error) {
        console.error('Error duplicating canvas', error);
        message.error(t('common.putErr'));
      } finally {
        setLoading(false);
      }
    },
    [loading, navigate, projectId, t],
  );

  return {
    duplicateCanvas,
    loading,
  };
};
