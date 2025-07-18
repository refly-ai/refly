import { Button, Tooltip, Switch } from 'antd';
import { memo, useMemo, useRef, useCallback } from 'react';
import { LinkOutlined } from '@ant-design/icons';
import { Send } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import { useUserStoreShallow } from '@refly/stores';
import { getRuntime } from '@refly/utils/env';
import { ModelSelector } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions/model-selector';
import { ModelInfo } from '@refly/openapi-schema';
import { cn, extractUrlsWithLinkify } from '@refly/utils/index';
import { SkillRuntimeConfig } from '@refly/openapi-schema';
import { useChatStoreShallow } from '@refly/stores';
import { ChatModeSelector } from './chat-mode-selector';
import { McpSelectorPopover } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/mcp-selector-panel';

export interface CustomAction {
  content?: string;
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
}

interface ActionsProps {
  query: string;
  model: ModelInfo | null;
  setModel: (model: ModelInfo | null) => void;
  runtimeConfig: SkillRuntimeConfig;
  setRuntimeConfig: (runtimeConfig: SkillRuntimeConfig) => void;
  className?: string;
  handleSendMessage: () => void;
  handleAbort: () => void;
  customActions?: CustomAction[];
  loading?: boolean;
  isExecuting?: boolean;
}

export const Actions = memo(
  (props: ActionsProps) => {
    const {
      query,
      model,
      setModel,
      runtimeConfig,
      setRuntimeConfig,
      handleSendMessage,
      handleAbort,
      customActions,
      className,
      loading = false,
      isExecuting = false,
    } = props;
    const { t } = useTranslation();

    // hooks
    const isWeb = getRuntime() === 'web';

    const userStore = useUserStoreShallow((state) => ({
      isLogin: state.isLogin,
    }));
    const { chatMode, setChatMode } = useChatStoreShallow((state) => ({
      chatMode: state.chatMode,
      setChatMode: state.setChatMode,
    }));

    const isPilotActivated = useMemo(() => chatMode === 'agent', [chatMode]);

    const canSendEmptyMessage = useMemo(() => query?.trim(), [query]);
    const canSendMessage = useMemo(
      () => !userStore.isLogin || canSendEmptyMessage,
      [userStore.isLogin, canSendEmptyMessage],
    );

    const detectedUrls = useMemo(() => {
      if (!query?.trim()) return [];
      const { detectedUrls } = extractUrlsWithLinkify(query);
      return detectedUrls;
    }, [query]);

    // Handle switch change
    const handleAutoParseLinksChange = useCallback(
      (checked: boolean) => {
        setRuntimeConfig({
          ...runtimeConfig,
          disableLinkParsing: checked,
        });
      },
      [runtimeConfig, setRuntimeConfig],
    );

    // Create a pilot session or directly send message
    const handleSend = useCallback(() => {
      if (!canSendMessage) return;
      handleSendMessage();
    }, [canSendMessage, handleSendMessage]);

    const containerRef = useRef<HTMLDivElement>(null);

    return (
      <div className={cn('flex justify-between items-center', className)} ref={containerRef}>
        <div className="flex items-center">
          <div className="mr-2">
            <ChatModeSelector chatMode={chatMode} setChatMode={setChatMode} className="h-[32px]" />
          </div>

          {userStore.isLogin && !isPilotActivated && (
            <ModelSelector
              model={model}
              setModel={setModel}
              briefMode={false}
              trigger={['click']}
            />
          )}

          {userStore.isLogin && <McpSelectorPopover />}

          {detectedUrls?.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              <Switch
                size="small"
                checked={runtimeConfig?.disableLinkParsing}
                onChange={handleAutoParseLinksChange}
              />
              <Tooltip
                className="flex flex-row items-center gap-1 cursor-pointer"
                title={t('skill.runtimeConfig.parseLinksHint', {
                  count: detectedUrls?.length,
                })}
              >
                <LinkOutlined className="text-sm text-gray-500 flex items-center justify-center cursor-pointer" />
              </Tooltip>
            </div>
          )}
        </div>
        <div className="flex flex-row items-center gap-2">
          {customActions?.map((action, index) => (
            <Tooltip title={action.title} key={index}>
              <Button size="small" icon={action.icon} onClick={action.onClick} className="mr-0">
                <span className="text-xs">{action?.content || ''}</span>
              </Button>
            </Tooltip>
          ))}

          {!isWeb ? null : isExecuting ? (
            <Button
              type="default"
              className="items-center gap-1 border-red-200 text-red-600 hover:border-red-300 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:border-red-700 dark:hover:text-red-300 dark:bg-red-950 dark:hover:bg-red-900"
              onClick={handleAbort}
            >
              <span>{t('copilot.chatActions.stop')}</span>
            </Button>
          ) : (
            <Button
              type="primary"
              disabled={!canSendMessage}
              className="flex items-center !h-9 !w-9 rounded-full"
              onClick={handleSend}
              loading={loading}
              icon={<Send size={20} />}
            />
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.handleSendMessage === nextProps.handleSendMessage &&
      prevProps.handleAbort === nextProps.handleAbort &&
      prevProps.query === nextProps.query &&
      prevProps.runtimeConfig === nextProps.runtimeConfig &&
      prevProps.setRuntimeConfig === nextProps.setRuntimeConfig &&
      prevProps.model === nextProps.model &&
      prevProps.loading === nextProps.loading &&
      prevProps.isExecuting === nextProps.isExecuting &&
      prevProps.customActions === nextProps.customActions
    );
  },
);

Actions.displayName = 'Actions';
