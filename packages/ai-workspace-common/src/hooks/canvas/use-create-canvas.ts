import { useState } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useDebouncedCallback } from 'use-debounce';
import { useNavigate } from 'react-router-dom';
import { useSiderStore } from '@refly-packages/ai-workspace-common/stores/sider';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

const CANVAS_NUM = 6;

export const useCreateCanvas = ({
  projectId,
  afterCreateSuccess,
}: { projectId?: string; afterCreateSuccess?: () => void } = {}) => {
  const [isCreating, setIsCreating] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const createCanvas = async (canvasTitle: string) => {
    setIsCreating(true);
    const { data, error } = await getClient().createCanvas({
      body: {
        projectId,
        title: canvasTitle,
      },
    });
    setIsCreating(false);

    if (!data?.success || error) {
      return;
    }
    return data?.data?.canvasId;
  };

  const debouncedCreateCanvas = useDebouncedCallback(
    async () => {
      const { canvasList, setCanvasList } = useSiderStore.getState();
      const canvasTitle = '';
      const canvasId = await createCanvas(canvasTitle);
      if (!canvasId) {
        return;
      }

      setCanvasList(
        [
          {
            id: canvasId,
            name: canvasTitle,
            updatedAt: new Date().toJSON(),
            type: 'canvas' as const,
          },
          ...canvasList,
        ].slice(0, CANVAS_NUM),
      );

      message.success(t('canvas.action.addSuccess'));
      if (projectId) {
        navigate(`/project/${projectId}?canvasId=${canvasId}`);
      } else {
        navigate(`/canvas/${canvasId}`);
      }
      afterCreateSuccess?.();
    },
    300,
    { leading: true },
  );

  return { debouncedCreateCanvas, isCreating };
};
