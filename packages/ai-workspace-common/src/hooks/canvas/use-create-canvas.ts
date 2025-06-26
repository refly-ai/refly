import { useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useNavigate } from 'react-router-dom';
import { useSiderStore } from '@refly-packages/ai-workspace-common/stores/sider';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { DATA_NUM } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';

interface CreateCanvasOptions {
  isPilotActivated?: boolean;
}

export const useCreateCanvas = ({
  projectId,
  afterCreateSuccess,
}: { source?: string; projectId?: string; afterCreateSuccess?: () => void } = {}) => {
  const [isCreating, setIsCreating] = useState(false);
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
    async (source?: string, options?: CreateCanvasOptions) => {
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
        ].slice(0, DATA_NUM),
      );

      // Build the query string with source and pilot flag if needed
      const queryParams = new URLSearchParams();
      if (source) {
        queryParams.append('source', source);
      }

      // If pilot is activated, create a pilot session
      if (options?.isPilotActivated) {
        queryParams.append('isPilotActivated', 'true');
      }

      // Add canvasId to query params if in project view
      if (projectId) {
        queryParams.append('canvasId', canvasId);
        navigate(`/project/${projectId}?${queryParams.toString()}`);
      } else {
        navigate(
          `/canvas/${canvasId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
        );
      }

      afterCreateSuccess?.();
    },
    300,
    { leading: true },
  );

  return { debouncedCreateCanvas, isCreating };
};
