import { useState } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useDebouncedCallback } from 'use-debounce';
import { useNavigate } from 'react-router-dom';
import { useCanvasStore } from '@refly/stores';
import { safeDel } from '@refly-packages/ai-workspace-common/utils/safe-idb';

export const useDeleteCanvas = () => {
  const [isRemoving, setIsRemoving] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const deleteCanvas = async (canvasId: string, deleteAllFiles = false) => {
    if (isRemoving) return;
    let success = false;
    try {
      setIsRemoving(true);
      const { data } = await getClient().deleteCanvas({
        body: {
          canvasId,
          deleteAllFiles,
        },
      });

      if (data?.success) {
        success = true;
        message.success(t('canvas.action.deleteSuccess'));

        // Check and remove canvasId from localStorage if matches
        const { currentCanvasId, setCurrentCanvasId, deleteCanvasData } = useCanvasStore.getState();
        const latestCurrentCanvasId = currentCanvasId;
        if (currentCanvasId === canvasId) {
          setCurrentCanvasId(null);
        }

        deleteCanvasData(canvasId);

        try {
          await safeDel(`canvas-state:${canvasId}`);
        } catch (error) {
          console.error('Failed to remove cached canvas state:', error);
        }

        // Only navigate if we're currently on the deleted canvas
        if (latestCurrentCanvasId === canvasId) {
          // Use setTimeout to ensure all state updates are processed
          setTimeout(() => {
            // Always navigate to workspace after deletion
            navigate('/workspace', { replace: true });
          }, 0);
        }
      }
    } finally {
      setIsRemoving(false);
    }
    return success;
  };

  const debouncedDeleteCanvas = useDebouncedCallback(
    (canvasId: string, deleteAllFiles = false) => {
      return deleteCanvas(canvasId, deleteAllFiles);
    },
    300,
    { leading: true },
  );

  return { deleteCanvas: debouncedDeleteCanvas, isRemoving };
};
