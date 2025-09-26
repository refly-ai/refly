import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
import { useFrontPageStoreShallow } from '@refly/stores';
import { IconRight } from '@refly-packages/ai-workspace-common/components/common/icon';
import { Button } from 'antd';
import { Actions } from './action';
import { useChatStoreShallow } from '@refly/stores';
import { TemplateList } from '@refly-packages/ai-workspace-common/components/canvas-template/template-list';
import { canvasTemplateEnabled } from '@refly/ui-kit';
import { useCanvasTemplateModalShallow } from '@refly/stores';
import { Title } from './title';
import { useAbortAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-abort-action';
import cn from 'classnames';
import { logEvent } from '@refly/telemetry-web';

export const FrontPage = memo(({ projectId }: { projectId: string | null }) => {
  const { t, i18n } = useTranslation();
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  const templateLanguage = i18n.language;
  const templateCategoryId = '';

  const { skillSelectedModel, setSkillSelectedModel, chatMode } = useChatStoreShallow((state) => ({
    skillSelectedModel: state.skillSelectedModel,
    setSkillSelectedModel: state.setSkillSelectedModel,
    chatMode: state.chatMode,
  }));

  const {
    query,
    setQuery,
    runtimeConfig,
    setRuntimeConfig,
    reset,
    selectedToolsets,
    setSelectedToolsets,
  } = useFrontPageStoreShallow((state) => ({
    query: state.query,
    setQuery: state.setQuery,
    selectedToolsets: state.selectedToolsets,
    setSelectedToolsets: state.setSelectedToolsets,
    tplConfig: state.tplConfig,
    runtimeConfig: state.runtimeConfig,
    setRuntimeConfig: state.setRuntimeConfig,
    reset: state.reset,
  }));

  const { debouncedCreateCanvas, isCreating } = useCreateCanvas({
    projectId: projectId ?? undefined,
    afterCreateSuccess: () => {
      // When canvas is created successfully, data is already in the store
      // No need to use localStorage anymore
    },
  });
  const { setVisible: setCanvasTemplateModalVisible } = useCanvasTemplateModalShallow((state) => ({
    setVisible: state.setVisible,
  }));

  const { abortAction } = useAbortAction({ source: 'front-page' });

  const handleSendMessage = useCallback(() => {
    if (!query?.trim()) return;

    logEvent('home::send_message', Date.now(), {
      chatMode,
      model: skillSelectedModel?.name,
    });

    setIsExecuting(true);
    debouncedCreateCanvas('front-page', {
      isPilotActivated: chatMode === 'agent',
      isAsk: chatMode === 'ask',
    });
  }, [query, debouncedCreateCanvas, chatMode]);

  const handleAbort = useCallback(() => {
    setIsExecuting(false);
    abortAction();
  }, [abortAction]);

  useEffect(() => {
    if (!isCreating && isExecuting) {
      setIsExecuting(false);
    }
  }, [isCreating, isExecuting]);

  const handleViewAllTemplates = useCallback(() => {
    setCanvasTemplateModalVisible(true);
  }, [setCanvasTemplateModalVisible]);

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return (
    <div
      className={cn(
        'h-full flex bg-refly-bg-content-z2 overflow-y-auto rounded-lg border border-solid border-refly-Card-Border shadow-sm',
      )}
      id="front-page-scrollable-div"
    >
      <div
        className={cn(
          'relative w-full h-full p-6 max-w-4xl mx-auto z-10',
          canvasTemplateEnabled ? '' : 'flex flex-col justify-center',
        )}
      >
        <Title />

        <div className="w-full p-4 flex flex-col rounded-[12px] shadow-refly-m overflow-hidden border border-solid border-refly-primary-default">
          <ChatInput
            readonly={false}
            query={query}
            setQuery={setQuery}
            handleSendMessage={handleSendMessage}
            maxRows={6}
            inputClassName="px-3 py-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={
              chatMode === 'agent'
                ? t('frontPage.agentInputPlaceholder')
                : t('frontPage.chatInputPlaceholder')
            }
          />
          <Actions
            query={query}
            model={skillSelectedModel}
            setModel={setSkillSelectedModel}
            runtimeConfig={runtimeConfig}
            setRuntimeConfig={setRuntimeConfig}
            handleSendMessage={handleSendMessage}
            handleAbort={handleAbort}
            loading={isCreating}
            isExecuting={isExecuting}
            selectedToolsets={selectedToolsets}
            onSelectedToolsetsChange={setSelectedToolsets}
          />
        </div>

        {canvasTemplateEnabled && (
          <div className="h-full flex flex-col mt-10">
            <div className="flex justify-between items-center mx-2">
              <div>
                <h3 className="text-base font-medium">{t('frontPage.fromCommunity')}</h3>
                <p className="text-xs text-gray-500 mt-1">{t('frontPage.fromCommunityDesc')}</p>
              </div>
              <Button
                type="text"
                size="small"
                className="text-xs text-gray-500 gap-1 hover:!text-green-500 transition-colors"
                onClick={handleViewAllTemplates}
              >
                {t('common.viewAll')} <IconRight className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex-1">
              <TemplateList
                source="front-page"
                scrollableTargetId="front-page-scrollable-div"
                language={templateLanguage}
                categoryId={templateCategoryId}
                className="!bg-transparent !px-0"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

FrontPage.displayName = 'FrontPage';
