import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { genActionResultID, genUniqueId } from '@refly-packages/utils/id';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { ThreadContainer } from './thread-container';
import { useReflyPilotReset } from '@refly-packages/ai-workspace-common/hooks/canvas/use-refly-pilot-reset';
import { SkillTemplateConfig } from '@refly/openapi-schema';

export const ReflyPilot = memo(() => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { canvasId } = useCanvasContext();
  const tplConfigRef = useRef<SkillTemplateConfig | null>(null);

  // Use the reset hook to handle canvas ID changes
  const { resetReflyPilot } = useReflyPilotReset(canvasId);

  const {
    setShowReflyPilot,
    linearThreadMessages,
    addLinearThreadMessage,
    tplConfig,
    setTplConfig,
  } = useCanvasStoreShallow((state) => ({
    setShowReflyPilot: state.setShowReflyPilot,
    linearThreadMessages: state.linearThreadMessages,
    addLinearThreadMessage: state.addLinearThreadMessage,
    clearLinearThreadMessages: state.clearLinearThreadMessages,
    tplConfig: state.tplConfig,
    setTplConfig: state.setTplConfig,
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

  // Handler for adding new messages
  const handleAddMessage = useCallback(
    (
      message: { id: string; resultId: string; nodeId: string; data?: any },
      query = '',
      contextItems = [],
    ) => {
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
      setShowReflyPilot(true);
    },
    [addLinearThreadMessage, setShowReflyPilot],
  );

  // Handler for generating new message IDs
  const handleGenerateMessageIds = useCallback(() => {
    const newResultId = genActionResultID();
    const newNodeId = genUniqueId();
    return { resultId: newResultId, nodeId: newNodeId };
  }, []);

  // Handler for closing the Refly Pilot
  const handleClose = useCallback(() => {
    setShowReflyPilot(false);
  }, [setShowReflyPilot]);

  // Handler for updating tplConfig
  const handleUpdateTplConfig = useCallback(
    (config: SkillTemplateConfig | null) => {
      // Only update if config has changed
      if (JSON.stringify(config) !== JSON.stringify(tplConfigRef.current)) {
        tplConfigRef.current = config;
        setTplConfig(config);
      }
    },
    [setTplConfig],
  );

  return (
    <ThreadContainer
      ref={containerRef}
      standalone={true}
      resultId={lastMessageResultId}
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

ReflyPilot.displayName = 'ReflyPilot';
