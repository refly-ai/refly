import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useExportCanvasAsImage } from '@refly-packages/ai-workspace-common/hooks/use-export-canvas-as-image';
import { useDebouncedCallback } from 'use-debounce';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';

export const useUploadMinimap = (canvasId: string) => {
  const { getMinimap } = useExportCanvasAsImage();
  const isLogin = useUserStoreShallow((state) => state.isLogin);

  const getCanvasMinimapStorageKey = async () => {
    const { data } = await getClient().getCanvasDetail({ query: { canvasId } });
    return data?.data?.minimapStorageKey;
  };

  const uploadMinimap = async (image: Blob, storageKey: string) => {
    const { data } = await getClient().upload({
      body: {
        file: image,
        storageKey: storageKey,
        entityId: canvasId,
        entityType: 'canvas',
      },
    });
    return data;
  };

  const handleUpdateCanvasMiniMap = async () => {
    if (!isLogin) return;
    const minimap = await getMinimap();
    if (minimap) {
      const storageKey = await getCanvasMinimapStorageKey();
      const result = await uploadMinimap(minimap, storageKey);
      const { data, success } = result ?? {};

      if (success && data?.storageKey && data.storageKey !== storageKey) {
        await getClient().updateCanvas({
          body: { canvasId, minimapStorageKey: data.storageKey },
        });
      }
    }
  };

  const debouncedHandleUpdateCanvasMiniMap = useDebouncedCallback(handleUpdateCanvasMiniMap, 5000);

  return {
    handleUpdateCanvasMiniMap,
    debouncedHandleUpdateCanvasMiniMap,
  };
};
