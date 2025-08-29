import { memo, useCallback, useMemo, useState } from 'react';
// import { useTranslation } from 'react-i18next';
import cn from 'classnames';
import {
  useChatStoreShallow,
  useFrontPageStoreShallow,
  useUserStoreShallow,
  usePilotStoreShallow,
} from '@refly/stores';
import { MediaChatInput } from '@refly-packages/ai-workspace-common/components/canvas/nodes/media/media-input';
import { ChatModeSelector } from '@refly-packages/ai-workspace-common/components/canvas/front-page/chat-mode-selector';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { ToolSelectorPopover } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/tool-selector-panel';
import { Button, message } from 'antd';
import { logEvent } from '@refly/telemetry-web';

import { ModelSelector } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions/model-selector';
import { Send } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { genActionResultID } from '@refly/utils/id';
import { CreatePilotSessionRequest, GenericToolset } from '@refly/openapi-schema';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

/**
 * NoSession
 * UI shown when there is no active pilot session.
 * Layout and styling are referenced from `canvas/front-page/index.tsx`.
 */
export const NoSession = memo(({ canvasId }: { canvasId: string }) => {
  const { t } = useTranslation();

  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [selectedToolsets, setSelectedToolsets] = useState<GenericToolset[]>([]);

  const { query, setQuery, clearCanvasQuery } = useFrontPageStoreShallow((state) => ({
    query: state.getQuery?.(canvasId) || '',
    setQuery: state.setQuery,
    clearCanvasQuery: state.clearCanvasQuery,
  }));
  const { chatMode, setChatMode, skillSelectedModel, setSkillSelectedModel } = useChatStoreShallow(
    (state) => ({
      chatMode: state.chatMode,
      setChatMode: state.setChatMode,
      skillSelectedModel: state.skillSelectedModel,
      setSkillSelectedModel: state.setSkillSelectedModel,
    }),
  );
  const userStore = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));
  const { setActiveSessionId, setIsPilotOpen, setIsNewTask } = usePilotStoreShallow((state) => ({
    setActiveSessionId: state.setActiveSessionId,
    setIsPilotOpen: state.setIsPilotOpen,
    setIsNewTask: state.setIsNewTask,
  }));
  const isPilotActivated = useMemo(() => chatMode === 'agent', [chatMode]);
  const { addNode } = useAddNode();
  const { invokeAction } = useInvokeAction({ source: 'nosession-ask' });

  // Create wrapper function for setting query with canvasId
  const setCanvasQuery = useCallback(
    (newQuery: string) => {
      setQuery?.(newQuery, canvasId);
    },
    [setQuery, canvasId],
  );

  const handleCreatePilotSession = useCallback(
    async (param: CreatePilotSessionRequest) => {
      setIsExecuting(true);
      const { data, error } = await getClient().createPilotSession({
        body: param,
      });
      if (error) {
        message.error(
          t('pilot.createPilotSessionFailed', {
            defaultValue: 'Failed to create pilot session',
          }),
        );
        setIsExecuting(false);
        return;
      }

      const sessionId = data?.data?.sessionId;
      if (sessionId) {
        setActiveSessionId(sessionId);
        setIsPilotOpen(true);
        // clearCanvasQuery?.(canvasId); // Clear canvas query after successful pilot session creation
      } else {
        message.error(
          t('pilot.createPilotSessionFailed', {
            defaultValue: 'Failed to create pilot session',
          }),
        );
      }
      setIsExecuting(false);
    },
    [t, setActiveSessionId, setIsPilotOpen, canvasId],
  );

  const handleSendMessage = useCallback(() => {
    if (!query?.trim()) return;

    logEvent('agent::send_message', Date.now(), {
      chatMode,
    });

    setIsExecuting(true);

    if (chatMode === 'ask' && canvasId) {
      const resultId = genActionResultID();
      invokeAction(
        {
          query,
          resultId,
          selectedToolsets,
          selectedSkill: undefined,
          modelInfo: skillSelectedModel,
          tplConfig: {},
          runtimeConfig: {},
        },
        {
          entityId: canvasId,
          entityType: 'canvas',
        },
      );
      addNode({
        type: 'skillResponse',
        data: {
          title: query,
          entityId: resultId,
          metadata: {
            status: 'executing',
            selectedToolsets,
            selectedSkill: undefined,
            modelInfo: skillSelectedModel,
            runtimeConfig: {},
            tplConfig: {},
            structuredData: {
              query,
            },
          },
        },
      });
      setIsNewTask(false);
      clearCanvasQuery?.(canvasId); // Clear canvas query after ask action
      setIsExecuting(false);
    } else if (chatMode === 'agent' && canvasId) {
      // Create pilot session for agent mode
      handleCreatePilotSession({
        targetId: canvasId,
        targetType: 'canvas',
        title: query,
        input: { query },
        maxEpoch: 3,
        providerItemId: skillSelectedModel?.providerItemId,
      });
      setIsNewTask(false);
    } else {
      setIsExecuting(false);
    }
  }, [
    query,
    chatMode,
    canvasId,
    addNode,
    invokeAction,
    skillSelectedModel,
    //clearCanvasQuery,
    handleCreatePilotSession,
    selectedToolsets,
  ]);

  return (
    <div className={cn('flex bg-refly-bg-content-z2 overflow-y-auto rounded-lg')}>
      <div className={cn('relative w-full max-w-4xl mx-auto z-10', 'flex flex-col justify-center')}>
        <div className="w-full h-full rounded-[12px] shadow-refly-m overflow-hidden">
          <div className="px-4 pb-4">
            <div className="w-full rounded-[12px] shadow-refly-m overflow-hidden border-[1px] border-solid border-refly-primary-default ">
              {chatMode === 'media' ? (
                <div className="w-full px-4 pt-4 pb-3">
                  <MediaChatInput
                    readonly={false}
                    query={query}
                    setQuery={setCanvasQuery}
                    showChatModeSelector
                  />
                </div>
              ) : (
                <>
                  <div className="px-4 h-[76px]">
                    <ChatInput
                      placeholder={t(
                        'canvas.launchpad.chatInputPlaceholder',
                        'Give Refly a task, it will analyze and plan intelligently, and help you complete the task...',
                      )}
                      readonly={false}
                      query={query}
                      setQuery={setCanvasQuery}
                      handleSendMessage={handleSendMessage}
                      maxRows={6}
                      inputClassName="px-3 pt-5 pb-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex pl-4 pb-3">
                    <div className="flex items-center w-full">
                      <div className="mr-2">
                        <ChatModeSelector chatMode={chatMode} setChatMode={setChatMode} />
                      </div>
                      {userStore.isLogin && !isPilotActivated && (
                        <ModelSelector
                          model={skillSelectedModel}
                          setModel={setSkillSelectedModel}
                          briefMode={false}
                          trigger={['click']}
                        />
                      )}
                      {userStore.isLogin && chatMode === 'ask' && (
                        <ToolSelectorPopover
                          selectedToolsets={selectedToolsets}
                          onSelectedToolsetsChange={setSelectedToolsets}
                        />
                      )}
                      <div className="flex items-center gap-2 ml-auto pr-4">
                        <Button
                          className="flex items-center !h-9 !w-9 rounded-full border-none"
                          size="small"
                          type="primary"
                          icon={<Send size={20} />}
                          onClick={handleSendMessage}
                          disabled={isExecuting || !query?.trim()}
                          loading={isExecuting}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

NoSession.displayName = 'NoSession';
