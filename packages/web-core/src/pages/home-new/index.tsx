import { memo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { useChatStoreShallow, useFrontPageStoreShallow } from '@refly/stores';
import { Actions } from '@refly-packages/ai-workspace-common/components/canvas/front-page/action';
import { TemplateList } from '@refly-packages/ai-workspace-common/components/canvas-template/template-list';
import { useAuthStoreShallow } from '@refly/stores';
import { canvasTemplateEnabled } from '@refly/ui-kit';
import Header from '../../components/landing-page-partials/Header';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import {
  storePendingVoucherCode,
  storeSignupEntryPoint,
} from '@refly-packages/ai-workspace-common/hooks/use-pending-voucher-claim';

import cn from 'classnames';
import { Title } from '@refly-packages/ai-workspace-common/components/canvas/front-page/title';

const UnsignedFrontPage = memo(() => {
  const { t, i18n } = useTranslation();
  const templateLanguage = i18n.language;
  const templateCategoryId = '';
  const [searchParams] = useSearchParams();

  const { query, setQuery, runtimeConfig, setRuntimeConfig, reset } = useFrontPageStoreShallow(
    (state) => ({
      query: state.query,
      setQuery: state.setQuery,
      runtimeConfig: state.runtimeConfig,
      setRuntimeConfig: state.setRuntimeConfig,
      reset: state.reset,
    }),
  );

  const { chatMode } = useChatStoreShallow((state) => ({
    chatMode: state.chatMode,
  }));

  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));

  const handleLogin = useCallback(() => {
    storeSignupEntryPoint('visitor_page');
    setLoginModalOpen(true);
  }, [setLoginModalOpen]);

  // Check for autoLogin parameter and auto-open login modal
  useEffect(() => {
    const autoLogin = searchParams.get('autoLogin');
    if (autoLogin === 'true') {
      storeSignupEntryPoint('visitor_page');
      setLoginModalOpen(true);
    }
  }, [searchParams, setLoginModalOpen]);

  // Check for invite parameter in URL and store it for later claiming
  useEffect(() => {
    const inviteCode = searchParams.get('invite');
    if (inviteCode) {
      storePendingVoucherCode(inviteCode);
    }
  }, [searchParams]);

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return (
    <div
      className="relative overflow-hidden h-[var(--screen-height)]"
      style={{
        background:
          'linear-gradient(124deg,rgba(31,201,150,0.1) 0%,rgba(69,190,255,0.06) 24.85%),var(--refly-bg-body-z0)',
      }}
    >
      <Helmet>
        <title>Refly.AI | The Open-Source Agentic Workspace for Human-AI Collaboration</title>
      </Helmet>

      <Header />

      <div className="w-full h-full pt-2 overflow-y-auto" id="front-page-scrollable-div">
        <div
          className={cn(
            'relative w-full h-full',
            canvasTemplateEnabled ? '' : 'flex flex-col justify-center',
          )}
        >
          <div className={cn('p-6 max-w-4xl mx-auto z-10')}>
            <Title />

            <div className="w-full p-4 flex flex-col rounded-[12px] shadow-refly-m overflow-hidden border-[1px] border border-solid border-refly-primary-default bg-refly-bg-content-z2">
              <ChatInput
                readonly={false}
                query={query}
                setQuery={setQuery}
                handleSendMessage={handleLogin}
                maxRows={6}
                inputClassName="px-3 py-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={
                  chatMode === 'agent'
                    ? t('canvas.launchpad.chatInputPlaceholder')
                    : t('canvas.launchpad.commonChatInputPlaceholder')
                }
              />

              <Actions
                query={query}
                model={null}
                setModel={() => {}}
                runtimeConfig={runtimeConfig}
                setRuntimeConfig={setRuntimeConfig}
                handleSendMessage={handleLogin}
                handleAbort={() => {}}
              />
            </div>

            {canvasTemplateEnabled && (
              <div className="h-full flex flex-col mt-10">
                <div className="flex justify-between items-center mx-2">
                  <div>
                    <h3 className="text-base font-medium dark:text-gray-100">
                      {t('frontPage.fromCommunity')}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                      {t('frontPage.fromCommunityDesc')}
                    </p>
                  </div>
                </div>
                <div className="flex-1">
                  <TemplateList
                    source="front-page"
                    scrollableTargetId="front-page-scrollable-div"
                    language={templateLanguage}
                    categoryId={templateCategoryId}
                    className="!bg-transparent !px-0"
                    gridCols="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-2"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

UnsignedFrontPage.displayName = 'UnsignedFrontPage';

export default UnsignedFrontPage;
