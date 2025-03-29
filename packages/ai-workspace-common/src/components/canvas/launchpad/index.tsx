import { useEffect, memo, useCallback, useMemo } from 'react';

import { ChatPanel } from './chat-panel';
import { SkillDisplay } from './skill-display';
import { cn } from '@refly-packages/utils/cn';

// stores
import { useContextPanelStoreShallow } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useChatStoreShallow } from '@refly-packages/ai-workspace-common/stores/chat';
import { useLaunchpadStoreShallow } from '@refly-packages/ai-workspace-common/stores/launchpad';

// types
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { RecommendQuestionsPanel } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/recommend-questions-panel';
import { SkillTemplateConfig } from '@refly/openapi-schema';

interface LaunchPadProps {
  visible?: boolean;
  inReflyPilot?: boolean;
  className?: string;
  onAddMessage?: (
    message: { id: string; resultId: string; nodeId: string; data?: any },
    query?: string,
    contextItems?: any[],
  ) => void;
  onGenerateMessageIds?: () => { resultId: string; nodeId: string };
  tplConfig?: SkillTemplateConfig | null;
  onUpdateTplConfig?: (config: SkillTemplateConfig | null) => void;
}

export const LaunchPad = memo(
  ({
    visible = true,
    inReflyPilot = false,
    className,
    onAddMessage,
    onGenerateMessageIds,
    tplConfig,
    onUpdateTplConfig,
  }: LaunchPadProps) => {
    // stores
    const contextPanelStore = useContextPanelStoreShallow((state) => ({
      resetState: state.resetState,
    }));
    const chatStore = useChatStoreShallow((state) => ({
      newQAText: state.newQAText,
      setNewQAText: state.setNewQAText,
      resetState: state.resetState,
    }));

    const { canvasId } = useCanvasContext();

    const { recommendQuestionsOpen, setRecommendQuestionsOpen } = useLaunchpadStoreShallow(
      (state) => ({
        recommendQuestionsOpen: state.recommendQuestionsOpen,
        setRecommendQuestionsOpen: state.setRecommendQuestionsOpen,
      }),
    );

    // Add new method to clear state
    const clearLaunchpadState = useCallback(() => {
      chatStore.resetState();
      contextPanelStore.resetState();
    }, [chatStore.resetState, contextPanelStore.resetState]);

    // Handle canvas ID changes
    useEffect(() => {
      if (canvasId) {
        clearLaunchpadState();
      }
    }, [canvasId, clearLaunchpadState]);

    // Memoize the ChatPanel component to prevent unnecessary re-renders
    const chatPanelComponent = useMemo(() => {
      return (
        <ChatPanel
          embeddedMode={inReflyPilot}
          onAddMessage={onAddMessage}
          onGenerateMessageIds={onGenerateMessageIds}
          tplConfig={tplConfig}
          onUpdateTplConfig={onUpdateTplConfig}
        />
      );
    }, [inReflyPilot, onAddMessage, onGenerateMessageIds, tplConfig, onUpdateTplConfig]);

    if (!visible) {
      return null;
    }

    return (
      <div
        className={cn(
          'ai-copilot-operation-container',
          inReflyPilot && 'embedded-launchpad w-full',
          className,
          'w-full',
        )}
        data-cy="launchpad"
      >
        <div className={cn('ai-copilot-operation-body', inReflyPilot && 'p-4')}>
          <SkillDisplay />
          <RecommendQuestionsPanel
            isOpen={recommendQuestionsOpen}
            onClose={() => setRecommendQuestionsOpen(false)}
          />
          {chatPanelComponent}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) =>
    prevProps.visible === nextProps.visible &&
    prevProps.inReflyPilot === nextProps.inReflyPilot &&
    prevProps.onAddMessage === nextProps.onAddMessage &&
    prevProps.onGenerateMessageIds === nextProps.onGenerateMessageIds &&
    prevProps.tplConfig === nextProps.tplConfig &&
    prevProps.onUpdateTplConfig === nextProps.onUpdateTplConfig,
);
