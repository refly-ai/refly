import { useEffect } from 'react';
import { ActionResult } from '@refly/openapi-schema';
import {
  NodeItem,
  useContextPanelStore,
  useContextPanelStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useLaunchpadStoreShallow } from '@refly-packages/ai-workspace-common/stores/launchpad';
import { actionEmitter } from '@refly-packages/ai-workspace-common/events/action';
import { useNodeSelection } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-selection';

export const useChatHistory = () => {
  // const { t } = useTranslation();
  // Get chat history state and actions
  const { chatHistoryOpen, setChatHistoryOpen } = useLaunchpadStoreShallow((state) => ({
    chatHistoryOpen: state.chatHistoryOpen,
    setChatHistoryOpen: state.setChatHistoryOpen,
  }));

  const { historyItems, setHistoryItems, updateHistoryItem, removeHistoryItem, clearHistoryItems, pinAllHistoryItems } =
    useContextPanelStoreShallow((state) => ({
      historyItems: state.historyItems,
      setHistoryItems: state.setHistoryItems,
      updateHistoryItem: state.updateHistoryItem,
      removeHistoryItem: state.removeHistoryItem,
      clearHistoryItems: state.clearHistoryItems,
      pinAllHistoryItems: state.pinAllHistoryItems,
    }));

  // Handle result updates
  useEffect(() => {
    const handleResultUpdate = (payload: { resultId: string; payload: ActionResult }) => {
      const { historyItems } = useContextPanelStore.getState();
      const index = historyItems?.findIndex((item) => item?.data.entityId === payload?.resultId);
      if (index >= 0) {
        updateHistoryItem({ ...historyItems[index], ...payload.payload });
      }
    };

    actionEmitter.on('updateResult', handleResultUpdate);
    return () => {
      actionEmitter.off('updateResult', handleResultUpdate);
    };
  }, []);

  const { setSelectedNodeByEntity } = useNodeSelection();

  const handleItemClick = (item: NodeItem) => {
    setSelectedNodeByEntity({ type: 'skillResponse', entityId: item.data.entityId });
  };

  const handleItemPin = (item: NodeItem) => {
    updateHistoryItem({ ...item, isPreview: !item?.isPreview });
  };

  const handleItemDelete = (item: NodeItem) => {
    removeHistoryItem(item.id);
  };

  const handleItemAdd = (node: NodeItem) => {
    const contextStore = useContextPanelStore.getState();
    const historyItems = contextStore.historyItems;

    // Check if node is already in context
    const existingItem = historyItems.find((item) => item.id === node.id);

    if (existingItem) {
      contextStore.updateHistoryItem({ ...node, isPreview: false });
      // message.warning(t('canvas.chatHistory.alreadyAdded'));
      return;
    }

    // Add node to context
    contextStore.addHistoryItem(node);
    // message.success(t('canvas.chatHistory.addSuccess'));
  };

  return {
    chatHistoryOpen,
    setChatHistoryOpen,
    historyItems,
    clearHistoryItems,
    handleItemClick,
    handleItemPin,
    handleItemDelete,
    pinAllHistoryItems,
    handleItemAdd,
  };
};
