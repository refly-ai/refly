import { useCallback, useEffect, useState } from 'react';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useCanvasStoreShallow, useSiderStoreShallow } from '@refly/stores';

/**
 * Updates the canvas title on the server.
 *
 * @param canvasId - The ID of the canvas to update.
 * @param newTitle - The new title for the canvas.
 * @returns The updated title if successful, otherwise undefined.
 */
async function updateRemoteCanvasTitle(canvasId: string, newTitle: string) {
  const { data, error } = await getClient().updateCanvas({
    body: {
      canvasId,
      title: newTitle,
    },
  });
  if (error || !data?.success) {
    return;
  }
  return data.data?.title;
}

/**
 * Hook for managing canvas title updates, including auto-naming and manual renaming.
 *
 * @param canvasId - The current canvas ID.
 * @param initialTitle - The initial title of the canvas.
 * @returns State and functions for managing canvas title updates.
 */
export function useUpdateCanvasTitle(canvasId: string, initialTitle: string) {
  const [editedTitle, setEditedTitle] = useState(initialTitle);
  const [isAutoNaming, setIsAutoNaming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const setCanvasTitle = useCanvasStoreShallow((state) => state.setCanvasTitle);
  const updateCanvasTitleInStore = useSiderStoreShallow((state) => state.updateCanvasTitle);

  useEffect(() => {
    setEditedTitle(initialTitle);
  }, [initialTitle]);

  const handleAutoName = useCallback(async () => {
    if (!canvasId) return;
    setIsAutoNaming(true);
    try {
      const { data, error } = await getClient().autoNameCanvas({
        body: {
          canvasId,
          directUpdate: false,
        },
      });
      if (error || !data?.success) {
        return;
      }
      if (data?.data?.title) {
        setEditedTitle(data.data.title);
        return data.data.title;
      }
    } finally {
      setIsAutoNaming(false);
    }
  }, [canvasId]);

  const updateTitle = useCallback(
    async (titleToSave?: string) => {
      const title = titleToSave ?? editedTitle;
      if (isSaving) return;

      setIsSaving(true);
      try {
        const newTitle = await updateRemoteCanvasTitle(canvasId, title ?? '');
        if (newTitle !== undefined) {
          setCanvasTitle(canvasId, newTitle);
          updateCanvasTitleInStore(canvasId, newTitle);
          return newTitle;
        }
      } finally {
        setIsSaving(false);
      }
    },
    [canvasId, editedTitle, isSaving, setCanvasTitle, updateCanvasTitleInStore],
  );

  return {
    editedTitle,
    setEditedTitle,
    isAutoNaming,
    isSaving,
    handleAutoName,
    updateTitle,
  };
}
