import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { genActionResultID, genUniqueId } from '@refly/utils/id';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { ThreadContainer } from './thread-container';
import { useLinearThreadReset } from '@refly-packages/ai-workspace-common/hooks/canvas/use-linear-thread-reset';
import { SkillTemplateConfig } from '@refly/openapi-schema';
import {
  useContextPanelStoreShallow,
  ContextTarget,
} from '@refly-packages/ai-workspace-common/stores/context-panel';

export const LinearThreadContainer = memo(() => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { canvasId } = useCanvasContext();
  const tplConfigRef = useRef<SkillTemplateConfig | null>(null);

  // Use the reset hook to handle canvas ID changes
  const { resetReflyPilot } = useLinearThreadReset(canvasId);

  const {
    setShowLinearThread,
    linearThreadMessages,
    addLinearThreadMessage,
    tplConfig,
    setTplConfig,
  } = useCanvasStoreShallow((state) => ({
    setShowLinearThread: state.setShowLinearThread,
    linearThreadMessages: state.linearThreadMessages,
    addLinearThreadMessage: state.addLinearThreadMessage,
    clearLinearThreadMessages: state.clearLinearThreadMessages,
    tplConfig: state.tplConfig,
    setTplConfig: state.setTplConfig,
  }));

  // Get context panel store to manage context items
  const { setActiveResultId } = useContextPanelStoreShallow((state) => ({
    setActiveResultId: state.setActiveResultId,
  }));

  // Update tplConfigRef whenever tplConfig changes
  useEffect(() => {
    if (tplConfig && JSON.stringify(tplConfig) !== JSON.stringify(tplConfigRef.current)) {
      tplConfigRef.current = tplConfig;
    }
  }, [tplConfig]);

  // Extract the last message resultId for context updates
  const lastMessageResultId = useMemo(() => {
    const lastMessage = linearThreadMessages?.[linearThreadMessages.length - 1];
    return lastMessage?.resultId;
  }, [linearThreadMessages]);

  console.log('lastMessageResultId', lastMessageResultId, linearThreadMessages);

  // Scroll to bottom effect
  useEffect(() => {
    if (containerRef.current) {
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [linearThreadMessages]);

  // Set the ReflyPilot as active when it's opened
  useEffect(() => {
    // Set the global context as active
    setActiveResultId(ContextTarget.Global);
  }, [setActiveResultId]);

  // Handler for adding new messages
  const handleAddMessage = useCallback(
    (
      message: { id: string; resultId: string; nodeId: string; data?: any },
      query = '',
      contextItems = [],
    ) => {
      // Set as active when user interacts with this component
      setActiveResultId(ContextTarget.Global);

      // Create the full message with timestamp and additional data
      const fullMessage = {
        id: message.id,
        resultId: message.resultId,
        nodeId: message.nodeId,
        timestamp: Date.now(),
        data: message.data || {
          title: query,
          entityId: message.resultId,
          metadata: {
            contextItems,
            tplConfig: tplConfigRef.current,
          },
        },
      };

      // Add message to the global store
      addLinearThreadMessage(fullMessage);

      // Ensure Refly Pilot is visible
      setShowLinearThread(true);
    },
    [addLinearThreadMessage, setShowLinearThread, setActiveResultId],
  );

  // Handler for generating new message IDs
  const handleGenerateMessageIds = useCallback(() => {
    // Set as active when user interacts with this component
    setActiveResultId(ContextTarget.Global);

    const newResultId = genActionResultID();
    const newNodeId = genUniqueId();
    return { resultId: newResultId, nodeId: newNodeId };
  }, [setActiveResultId]);

  // Handler for closing the Refly Pilot
  const handleClose = useCallback(() => {
    setShowLinearThread(false);
  }, [setShowLinearThread]);

  // Handler for updating tplConfig
  const handleUpdateTplConfig = useCallback(
    (config: SkillTemplateConfig | null) => {
      // Set as active when user interacts with this component
      setActiveResultId(ContextTarget.Global);

      // Only update if config has changed
      if (JSON.stringify(config) !== JSON.stringify(tplConfigRef.current)) {
        tplConfigRef.current = config;
        setTplConfig(config);
      }
    },
    [setTplConfig, setActiveResultId],
  );

  return (
    <ThreadContainer
      ref={containerRef}
      standalone={true}
      resultId={lastMessageResultId || ContextTarget.Global}
      messages={linearThreadMessages}
      onAddMessage={handleAddMessage}
      onClearConversation={resetReflyPilot}
      onGenerateMessageIds={handleGenerateMessageIds}
      onClose={handleClose}
      tplConfig={tplConfig}
      onUpdateTplConfig={handleUpdateTplConfig}
    />
  );
});

LinearThreadContainer.displayName = 'LinearThreadContainer';
