import { Button, Tooltip } from 'antd';
import { FormInstance } from '@arco-design/web-react';
import { useRef, useState, useMemo, useCallback } from 'react';
import { memo } from 'react';

import { IconSend } from '@arco-design/web-react/icon';
import { useTranslation } from 'react-i18next';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { useLaunchpadStoreShallow } from '@refly-packages/ai-workspace-common/stores/launchpad';

// styles
import './index.scss';
import { getRuntime } from '@refly-packages/ai-workspace-common/utils/env';
import { PiMagicWand } from 'react-icons/pi';
import { useGetSubscriptionUsage } from '@refly-packages/ai-workspace-common/queries/queries';
import { ModelSelector } from './model-selector';
import { ModelInfo } from '@refly/openapi-schema';

interface ChatActionsProps {
  query: string;
  model: ModelInfo;
  setModel: (model: ModelInfo) => void;
  form?: FormInstance;
  handleSendMessage: () => void;
  handleAbort: () => void;
}

export const ChatActions = memo(
  (props: ChatActionsProps) => {
    const { query, model, setModel, handleSendMessage, handleAbort } = props;
    const { t } = useTranslation();

    const { setRecommendQuestionsOpen, recommendQuestionsOpen } = useLaunchpadStoreShallow(
      useCallback(
        (state) => ({
          setRecommendQuestionsOpen: state.setRecommendQuestionsOpen,
          recommendQuestionsOpen: state.recommendQuestionsOpen,
        }),
        [],
      ),
    );

    // Memoize handlers
    const handleRecommendQuestionsToggle = useCallback(() => {
      setRecommendQuestionsOpen(!recommendQuestionsOpen);
    }, [recommendQuestionsOpen, setRecommendQuestionsOpen]);

    const handleSendClick = useCallback(() => {
      handleSendMessage();
    }, [handleSendMessage]);

    const { data: tokenUsageData } = useGetSubscriptionUsage({}, [], {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      staleTime: 60 * 1000, // Consider data fresh for 1 minute
      gcTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    const tokenUsage = useMemo(() => tokenUsageData?.data?.token, [tokenUsageData?.data?.token]);
    const tokenAvailable = useMemo(
      () => tokenUsage?.t1TokenQuota > tokenUsage?.t1TokenUsed || tokenUsage?.t2TokenQuota > tokenUsage?.t2TokenUsed,
      [tokenUsage],
    );

    // hooks
    const runtime = getRuntime();
    const isWeb = runtime === 'web';

    const userStore = useUserStoreShallow((state) => ({
      isLogin: state.isLogin,
      setLoginModalVisible: state.setLoginModalVisible,
    }));

    const canSendEmptyMessage = useMemo(() => query?.trim(), [query]);
    const canSendMessage = useMemo(
      () => !userStore.isLogin || (tokenAvailable && canSendEmptyMessage),
      [userStore.isLogin, tokenAvailable, canSendEmptyMessage],
    );

    const containerRef = useRef<HTMLDivElement>(null);

    return (
      <div className="chat-actions" ref={containerRef}>
        <div className="left-actions">
          <ModelSelector model={model} setModel={setModel} briefMode={false} trigger={['click']} />
        </div>
        <div className="right-actions">
          <Tooltip destroyTooltipOnHide title={t('copilot.chatActions.recommendQuestions')}>
            <Button size="small" onClick={handleRecommendQuestionsToggle} className="mr-0">
              <PiMagicWand />
            </Button>
          </Tooltip>

          {!isWeb ? null : (
            <Button
              size="small"
              type="primary"
              disabled={!canSendMessage}
              className="text-xs gap-1"
              onClick={handleSendClick}
            >
              <IconSend />
              <span>{t('copilot.chatActions.send')}</span>
            </Button>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for memo
    return (
      prevProps.handleSendMessage === nextProps.handleSendMessage && prevProps.handleAbort === nextProps.handleAbort
    );
  },
);

ChatActions.displayName = 'ChatActions';
