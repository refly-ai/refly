import { useState } from 'react';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';
import { useCanvasTemplateModalShallow } from '@refly/stores';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { logEvent } from '@refly/telemetry-web';

export const useDuplicateCanvas = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projectId } = useGetProjectCanvasId();
  const { getCanvasList } = useHandleSiderData();
  const { setVisible, visible } = useCanvasTemplateModalShallow((state) => ({
    setVisible: state.setVisible,
    visible: state.visible,
  }));
  const [loading, setLoading] = useState(false);
  const duplicateCanvas = async (shareId: string, templateId?: string, onSuccess?: () => void) => {
    if (loading) return;
    setLoading(true);
    const { data } = await getClient().duplicateShare({
      body: {
        shareId,
        projectId,
      },
    });
    setLoading(false);
    if (data?.success) {
      message.success(t('common.putSuccess'));
      const canvasData = data.data;
      getCanvasList();
      if (canvasData.entityId) {
        logEvent('canvas::entry_canvas_template', Date.now(), {
          entry_type: 'template',
          canvas_id: canvasData.entityId,
          template_id: templateId,
        });
        if (projectId) {
          navigate(`/project/${projectId}?canvasId=${canvasData.entityId}`);
        } else {
          navigate(`/canvas/${canvasData.entityId}`);
        }
        if (visible) {
          setVisible(false);
        }
        onSuccess?.();
      }
    }
  };
  return { duplicateCanvas, loading };
};
