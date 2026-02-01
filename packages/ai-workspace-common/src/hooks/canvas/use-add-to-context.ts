import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from 'antd';
import { IContextItem } from '@refly/common-types';
import {
  emitAddToContext,
  emitAddToContextCompleted,
} from '@refly-packages/ai-workspace-common/utils/event-emitter/context';
import AddToContextMessageContent from '../../components/message/add-to-context-message';

export const useAddToContext = () => {
  const { t } = useTranslation();

  const addSingleNodeToContext = useCallback(
    (item: IContextItem) => {
      const nodeType = item?.type;
      // Get node title based on type
      let nodeTitle = '';
      if (item?.metadata?.sourceType === 'documentSelection') {
        nodeTitle = item?.title ?? t('knowledgeBase.context.untitled');
      } else if (nodeType === 'skillResponse') {
        nodeTitle = item?.title ?? t('knowledgeBase.context.untitled');
      } else {
        nodeTitle = item?.title ?? t('knowledgeBase.context.untitled');
      }

      // Emit add to context event
      emitAddToContext({ contextItem: item, duplicated: false });
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
    },
    [t],
  );

  const addContextItems = useCallback(
    (items: IContextItem[]) => {
      // Filter out memo, skill, and group nodes
      const validNodes = items.filter((item) => !['skill', 'group'].includes(item.type));

      if (validNodes.length === 0) {
        return 0;
      }

      // Show success messages for new items
      for (const item of validNodes) {
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

      return validNodes.length; // Return number of successfully added nodes
    },
    [t],
  );

  return {
    addToContext: addSingleNodeToContext,
    addContextItems,
  };
};
