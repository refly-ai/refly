import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from 'antd';
import { IContextItem } from '@refly/common-types';
import {
  emitAddToContext,
  emitAddToContextCompleted,
} from '@refly-packages/ai-workspace-common/utils/event-emitter/context';
import AddToContextMessageContent from '../../components/message/add-to-context-message';
import { usePilotStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

export const useAddToContext = () => {
  const { t } = useTranslation();
  const { canvasId } = useCanvasContext();
  const { isPilotOpen, setIsPilotOpen, contextItems, setContextItems } = usePilotStoreShallow(
    (state) => ({
      isPilotOpen: state.isPilotOpen,
      setIsPilotOpen: state.setIsPilotOpen,
      contextItems: state.contextItemsByCanvas?.[canvasId] ?? [],
      setContextItems: state.setContextItems,
    }),
  );

  const addSingleNodeToContext = useCallback(
    (item: IContextItem) => {
      const nodeType = item?.type;
      const delay = isPilotOpen ? 0 : 400;
      if (!isPilotOpen) {
        setIsPilotOpen(true);
      }
      // Check if item is already in context
      const isAlreadyAdded = contextItems.some(
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

          emitAddToContext({ contextItem: item, duplicated: true });
          return false;
        }

        emitAddToContext({ contextItem: item, duplicated: false });
        setContextItems(canvasId, [...contextItems, item]);
        message.success({
          content: React.createElement(AddToContextMessageContent, {
            title: nodeTitle || t('common.untitled'),
            nodeType: t(`canvas.nodeTypes.${nodeType}`),
            action: t('knowledgeBase.context.addSuccessWithTitle'),
          }),
          key: 'add-success',
        });

        emitAddToContextCompleted({ contextItem: item, success: true });

        return true;
      }, delay);
    },
    [t, isPilotOpen, setIsPilotOpen, canvasId, contextItems, setContextItems],
  );

  const addContextItems = useCallback(
    (items: IContextItem[]) => {
      // Filter out memo, skill, and group nodes
      const validNodes = items.filter((item) => !['skill', 'group'].includes(item.type));

      if (validNodes.length === 0) {
        return 0;
      }

      const delay = isPilotOpen ? 0 : 400;
      if (!isPilotOpen) {
        setIsPilotOpen(true);
      }

      // Check for duplicates and prepare new items
      const newItems: IContextItem[] = [];
      const duplicateItems: IContextItem[] = [];

      for (const item of validNodes) {
        const isAlreadyAdded = contextItems.some(
          (selectedItem) => selectedItem.entityId === item.entityId && !selectedItem.isPreview,
        );

        if (isAlreadyAdded) {
          duplicateItems.push(item);
        } else {
          newItems.push(item);
        }
      }

      // Show warning messages for duplicates
      for (const item of duplicateItems) {
        const nodeType = item?.type;
        let nodeTitle = '';
        if (item?.metadata?.sourceType === 'documentSelection') {
          nodeTitle = item?.title ?? t('knowledgeBase.context.untitled');
        } else if (nodeType === 'skillResponse') {
          nodeTitle = item?.title ?? t('knowledgeBase.context.untitled');
        } else {
          nodeTitle = item?.title ?? t('knowledgeBase.context.untitled');
        }

        message.warning({
          content: React.createElement(AddToContextMessageContent, {
            title: nodeTitle,
            nodeType: t(`canvas.nodeTypes.${nodeType}`),
            action: t('knowledgeBase.context.alreadyAddedWithTitle'),
          }),
          key: `already-added-warning-${item.entityId}`,
        });

        emitAddToContext({ contextItem: item, duplicated: true });
      }

      // Add new items to context
      if (newItems.length > 0) {
        setTimeout(() => {
          // Use functional update to avoid race conditions
          setContextItems(canvasId, (prevItems) => [...prevItems, ...newItems]);

          // Show success messages for new items
          for (const item of newItems) {
            const nodeType = item?.type;
            let nodeTitle = '';
            if (item?.metadata?.sourceType === 'documentSelection') {
              nodeTitle = item?.title ?? t('knowledgeBase.context.untitled');
            } else if (nodeType === 'skillResponse') {
              nodeTitle = item?.title ?? t('knowledgeBase.context.untitled');
            } else {
              nodeTitle = item?.title ?? t('knowledgeBase.context.untitled');
            }

            message.success({
              content: React.createElement(AddToContextMessageContent, {
                title: nodeTitle || t('common.untitled'),
                nodeType: t(`canvas.nodeTypes.${nodeType}`),
                action: t('knowledgeBase.context.addSuccessWithTitle'),
              }),
              key: `add-success-${item.entityId}`,
            });

            emitAddToContext({ contextItem: item, duplicated: false });
            emitAddToContextCompleted({ contextItem: item, success: true });
          }
        }, delay);
      }

      return newItems.length; // Return number of successfully added nodes
    },
    [t, isPilotOpen, setIsPilotOpen, canvasId, contextItems, setContextItems],
  );

  return {
    addToContext: addSingleNodeToContext,
    addContextItems,
  };
};
