import { useState } from 'react';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';
import { useCanvasTemplateModalShallow } from '@refly-packages/ai-workspace-common/stores/canvas-template-modal';

export const useDuplicateCanvas = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getCanvasList } = useHandleSiderData();
  const { setVisible, visible } = useCanvasTemplateModalShallow((state) => ({
    setVisible: state.setVisible,
    visible: state.visible,
  }));
  const [loading, setLoading] = useState(false);
  const duplicateCanvas = async (shareId: string, onSuccess?: () => void) => {
    if (loading) return;
    setLoading(true);
    const { data } = await getClient().duplicateShare({
      body: {
        shareId,
      },
    });
    setLoading(false);
    if (data?.success) {
      message.success(t('common.putSuccess'));
      const canvasData = data.data;
      getCanvasList();
      if (canvasData.entityId) {
        navigate(`/canvas/${canvasData.entityId}`);
        if (visible) {
          setVisible(false);
        }
        onSuccess?.();
      }
    }
  };
  return { duplicateCanvas, loading };
};
