import { useCallback, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useNavigate } from 'react-router-dom';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { logEvent } from '@refly/telemetry-web';
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';

interface CreateCanvasOptions {
  isPilotActivated?: boolean;
  isMediaGeneration?: boolean;
  isAsk?: boolean;
}

export const useCreateCanvas = ({
  projectId,
  afterCreateSuccess,
}: { source?: string; projectId?: string; afterCreateSuccess?: () => void } = {}) => {
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();
  const { getCanvasList } = useHandleSiderData();
  const { setSidePanelVisible, setWideScreenVisible } = useCanvasResourcesPanelStoreShallow(
    (state) => ({
      setSidePanelVisible: state.setSidePanelVisible,
      setWideScreenVisible: state.setWideScreenVisible,
    }),
  );

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

  const handleCloseResourcesPanel = useCallback(() => {
    setSidePanelVisible(false);
    setWideScreenVisible(false);
  }, [setSidePanelVisible, setWideScreenVisible]);

  const debouncedCreateCanvas = useDebouncedCallback(
    async (source?: string, options?: CreateCanvasOptions) => {
      const canvasTitle = '';
      const canvasId = await createCanvas(canvasTitle);
      if (!canvasId) {
        return;
      }

      handleCloseResourcesPanel();

      getCanvasList();

      // Build the query string with source and pilot flag if needed
      const queryParams = new URLSearchParams();
      if (source) {
        queryParams.append('source', source);
      }

      // If pilot is activated, create a pilot session
      if (options?.isPilotActivated) {
        queryParams.append('isPilotActivated', 'true');
        logEvent('canvas::entry_canvas_agent', Date.now(), {
          entry_type: 'agent',
          canvas_id: canvasId,
        });
      }

      if (options?.isMediaGeneration) {
        queryParams.append('isMediaGeneration', 'true');
        logEvent('canvas::entry_canvas_media', Date.now(), {
          entry_type: 'media',
          canvas_id: canvasId,
        });
      }

      if (options?.isAsk) {
        logEvent('canvas::entry_canvas_ask', Date.now(), {
          entry_type: 'ask',
          canvas_id: canvasId,
        });
      }

      if (!options?.isPilotActivated && !options?.isMediaGeneration && !options?.isAsk) {
        logEvent('canvas::create_canvas_from_home', Date.now(), {});
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
