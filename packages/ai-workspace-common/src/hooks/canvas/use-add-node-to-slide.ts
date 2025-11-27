import { useAddNodesToCanvasPage } from '@refly-packages/ai-workspace-common/queries/queries';
import { slideshowEmitter } from '@refly-packages/ai-workspace-common/events/slideshow';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCanvasStoreShallow } from '@refly/stores';
import { useCallback } from 'react';
import { CanvasNode } from '@refly/canvas-common';

export const useAddNodeToSlide = ({
  canvasId,
  nodes,
  onSuccess,
}: {
  canvasId: string;
  nodes: CanvasNode[];
  onSuccess?: () => void;
}) => {
  const { t } = useTranslation();
  const { setCanvasPage } = useCanvasStoreShallow((state) => ({
    setCanvasPage: state.setCanvasPage,
  }));

  const nodeIds = nodes
    .filter((node) => !['skill', 'group'].includes(node.type))
    .map((node) => node.data.entityId as string);

  const { mutate, isPending: isAddingNodesToSlide } = useAddNodesToCanvasPage(undefined, {
    onSuccess: (response: any) => {
      const pageId = response?.data?.data?.page?.pageId;
      if (pageId) {
        message.success(t('common.putSuccess'));
        setCanvasPage(canvasId, pageId);
        setTimeout(() => {
          slideshowEmitter.emit('update', { canvasId, pageId, entityId: nodeIds?.[0] });
        }, 1);
      }
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Failed to add nodes to canvas page:', error);
      message.error(t('common.putFailed'));
    },
  });

  const addNodesToSlide = useCallback(() => {
    mutate({
      body: { nodeIds },
      path: { canvasId },
    });
  }, [mutate, canvasId, nodeIds]);
  return {
    addNodesToSlide,
    isAddingNodesToSlide,
  };
};
