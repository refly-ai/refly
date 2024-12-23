import { Button, Tooltip } from 'antd';
import { FormInstance } from '@arco-design/web-react';
import { useEffect, useRef, useState } from 'react';

import { useChatStoreShallow } from '@refly-packages/ai-workspace-common/stores/chat';
import { IconSend } from '@arco-design/web-react/icon';
import { useTranslation } from 'react-i18next';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { useLaunchpadStoreShallow } from '@refly-packages/ai-workspace-common/stores/launchpad';

// components
import { AISettingsDropdown } from './ai-settings';
// styles
import './index.scss';
import { getRuntime } from '@refly-packages/ai-workspace-common/utils/env';
import { PiMagicWand } from 'react-icons/pi';
import { useGetSubscriptionUsage } from '@refly-packages/ai-workspace-common/queries/queries';

interface ChatActionsProps {
  form?: FormInstance;
  handleSendMessage: () => void;
  handleAbort: () => void;
}

export const ChatActions = (props: ChatActionsProps) => {
  const { handleSendMessage, handleAbort } = props;

  const { t } = useTranslation();

  // stores
  const chatStore = useChatStoreShallow((state) => ({
    newQAText: state.newQAText,
    enableWebSearch: state.enableWebSearch,
    setEnableWebSearch: state.setEnableWebSearch,
    enableKnowledgeBaseSearch: state.enableKnowledgeBaseSearch,
    setEnableKnowledgeBaseSearch: state.setEnableKnowledgeBaseSearch,
    enableDeepReasonWebSearch: state.enableDeepReasonWebSearch,
    setEnableDeepReasonWebSearch: state.setEnableDeepReasonWebSearch,
  }));

  const { data: tokenUsageData } = useGetSubscriptionUsage();
  const tokenUsage = tokenUsageData?.data?.token;
  const tokenAvailable =
    tokenUsage?.t1TokenQuota > tokenUsage?.t1TokenUsed || tokenUsage?.t2TokenQuota > tokenUsage?.t2TokenUsed;

  // hooks
  const runtime = getRuntime();
  const isWeb = runtime === 'web';

  const userStore = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
    setLoginModalVisible: state.setLoginModalVisible,
  }));

  const canSendEmptyMessage = chatStore.newQAText?.trim();
  const canSendMessage = !userStore.isLogin || (tokenAvailable && canSendEmptyMessage);

  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const COLLAPSE_WIDTH = 600; // Adjust this threshold as needed

  const { setRecommendQuestionsOpen, recommendQuestionsOpen } = useLaunchpadStoreShallow((state) => ({
    setRecommendQuestionsOpen: state.setRecommendQuestionsOpen,
    recommendQuestionsOpen: state.recommendQuestionsOpen,
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="chat-actions" ref={containerRef}>
      <div className="left-actions">
        <AISettingsDropdown collapsed={containerWidth < COLLAPSE_WIDTH} briefMode={false} trigger={['click']} />
      </div>
      <div className="right-actions">
        <Tooltip destroyTooltipOnHide title={t('copilot.chatActions.recommendQuestions')}>
          <Button size="small" onClick={() => setRecommendQuestionsOpen(!recommendQuestionsOpen)} className="mr-0">
            <PiMagicWand />
          </Button>
        </Tooltip>

        {!isWeb ? null : (
          <Button
            size="small"
            type="primary"
            disabled={!canSendMessage}
            className="text-xs gap-1"
            onClick={() => handleSendMessage()}
          >
            <IconSend />
            <span>{t('copilot.chatActions.send')}</span>
          </Button>
        )}
      </div>
    </div>
  );
};
