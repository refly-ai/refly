import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from 'antd';
import {
  IContextItem,
  useContextPanelStore,
} from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import AddToContextMessageContent from '../../components/message/add-to-context-message';

export const useAddToContext = () => {
  const { t } = useTranslation();
  const { showLaunchpad, setShowLaunchpad } = useCanvasStoreShallow((state) => ({
    showLaunchpad: state.showLaunchpad,
    setShowLaunchpad: state.setShowLaunchpad,
  }));

  const addSingleNodeToContext = useCallback(
    (item: IContextItem) => {
      const contextStore = useContextPanelStore.getState();
      const selectedContextItems = contextStore.contextItems;
      const nodeType = item?.type;

      // Check if item is already in context
      const isAlreadyAdded = selectedContextItems.some(
        (selectedItem) => selectedItem.entityId === item.entityId && !selectedItem.isPreview,
      );

      // Get node title based on type
      let nodeTitle = '';
      if (item?.metadata?.sourceType === 'documentSelection') {
        nodeTitle = item?.title ?? t('knowledgeBase.context.untitled');
      } else if (nodeType === 'skillResponse') {
        nodeTitle = item?.title ?? t('knowledgeBase.context.untitled');
      } else {
        nodeTitle = item?.title ?? t('knowledgeBase.context.untitled');
      }

      if (!showLaunchpad) {
        setShowLaunchpad(true);
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
        return false;
      }

      // Add to context
      contextStore.addContextItem(item);

      message.success({
        content: React.createElement(AddToContextMessageContent, {
          title: nodeTitle || t('common.untitled'),
          nodeType: t(`canvas.nodeTypes.${nodeType}`),
          action: t('knowledgeBase.context.addSuccessWithTitle'),
        }),
        key: 'add-success',
      });

      return true;
    },
    [showLaunchpad, setShowLaunchpad, t],
  );

  const addContextItems = useCallback(
    (items: IContextItem[]) => {
      // Filter out memo, skill, and group nodes
      const validNodes = items.filter((item) => !['skill', 'group'].includes(item.type));

      if (!showLaunchpad) {
        setShowLaunchpad(true);
      }

      // Add each valid node to context
      const results = validNodes.map((node) => addSingleNodeToContext(node));

      return results.filter(Boolean).length; // Return number of successfully added nodes
    },
    [showLaunchpad, setShowLaunchpad, addSingleNodeToContext],
  );

  return {
    addToContext: addSingleNodeToContext,
    addContextItems,
  };
};
