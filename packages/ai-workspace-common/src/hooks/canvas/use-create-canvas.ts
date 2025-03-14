import { useState } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useDebouncedCallback } from 'use-debounce';
import { useNavigate } from 'react-router-dom';
import { useSiderStore } from '@refly-packages/ai-workspace-common/stores/sider';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';

export const useCreateCanvas = () => {
  const [isCreating, setIsCreating] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setTitle } = useCanvasStoreShallow((state) => ({
    setTitle: state.setTitle,
  }));

  const debouncedCreateCanvas = useDebouncedCallback(
    async () => {
      const { canvasList, setCanvasList } = useSiderStore.getState();
      const canvasTitle = '';

      setIsCreating(true);
      const { data, error } = await getClient().createCanvas({
        body: {
          title: canvasTitle,
        },
      });
      setIsCreating(false);

      if (!data?.success || error) {
        return;
      }

      const canvasId = data?.data?.canvasId;

      setCanvasList(
        [
          {
            id: canvasId,
            name: canvasTitle,
            updatedAt: new Date().toJSON(),
            type: 'canvas' as const,
          },
          ...canvasList,
        ].slice(0, 10),
      );
      setTitle(canvasId, canvasTitle);

      message.success(t('canvas.action.addSuccess'));
      navigate(`/canvas/${canvasId}`);
    },
    300,
    { leading: true },
  );

  return { debouncedCreateCanvas, isCreating };
};
