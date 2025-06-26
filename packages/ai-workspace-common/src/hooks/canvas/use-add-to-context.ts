import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from 'antd';
import {
  IContextItem,
  useContextPanelStore,
} from '@refly-packages/ai-workspace-common/stores/context-panel';
import { ContextTarget } from '@refly-packages/ai-workspace-common/stores/context-panel';
import {
  emitAddToContext,
  emitAddToContextCompleted,
} from '@refly-packages/ai-workspace-common/utils/event-emitter/context';
import AddToContextMessageContent from '../../components/message/add-to-context-message';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';

export const useAddToContext = () => {
  const { t } = useTranslation();
  const { showLinearThread, setShowLinearThread } = useCanvasStoreShallow((state) => ({
    showLinearThread: state.showLinearThread,
    setShowLinearThread: state.setShowLinearThread,
    showSlideshow: state.showSlideshow,
    setShowSlideshow: state.setShowSlideshow,
  }));

  const addSingleNodeToContext = useCallback(
    (item: IContextItem) => {
      const { activeResultId } = useContextPanelStore.getState();
      const resultId = activeResultId || ContextTarget.Global;
      const contextStore = useContextPanelStore.getState();
      const selectedContextItems = contextStore.contextItems;
      const nodeType = item?.type;

      if (activeResultId === 'global' && !showLinearThread) {
        setShowLinearThread(true);
      }

      // Check if item is already in context
      const isAlreadyAdded = selectedContextItems.some(
        (selectedItem) => selectedItem.entityId === item.entityId && !selectedItem.isPreview,
      );

      setTimeout(() => {
        // Get node title based on type
        let nodeTitle = '';
        if (item?.metadata?.sourceType === 'documentSelection') {
          nodeTitle = item?.title ?? t('knowledgeBase.context.untitled');
        } else if (nodeType === 'skillResponse') {
          nodeTitle = item?.title ?? t('knowledgeBase.context.untitled');
        } else {
          nodeTitle = item?.title ?? t('knowledgeBase.context.untitled');
        }

        if (isAlreadyAdded) {
          message.warning({
            content: React.createElement(AddToContextMessageContent, {
              title: nodeTitle,
              nodeType: t(`canvas.nodeTypes.${nodeType}`),
              action: t('knowledgeBase.context.alreadyAddedWithTitle'),
            }),
            key: 'already-added-warning',
          });

          // Emit event that adding to context is completed (but failed)
          emitAddToContext(item, resultId);
          emitAddToContextCompleted(item, resultId, false);
          return false;
        }

        // Emit event that we're adding to context
        emitAddToContext(item, resultId);

        // Add to context
        // contextStore.addContextItem(item);

        message.success({
          content: React.createElement(AddToContextMessageContent, {
            title: nodeTitle || t('common.untitled'),
            nodeType: t(`canvas.nodeTypes.${nodeType}`),
            action: t('knowledgeBase.context.addSuccessWithTitle'),
          }),
          key: 'add-success',
        });

        // Emit event that adding to context is completed
        emitAddToContextCompleted(item, resultId, true);
        return true;
      }, 100);
    },
    [t],
  );

  const addContextItems = useCallback(
    (items: IContextItem[]) => {
      // Filter out memo, skill, and group nodes
      const validNodes = items.filter((item) => !['skill', 'group'].includes(item.type));

      // Add each valid node to context
      const results = validNodes.map((node) => addSingleNodeToContext(node));

      return results.filter(Boolean).length; // Return number of successfully added nodes
    },
    [addSingleNodeToContext],
  );

  return {
    addToContext: addSingleNodeToContext,
    addContextItems,
  };
};
