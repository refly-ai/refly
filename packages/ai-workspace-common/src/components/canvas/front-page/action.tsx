import { Button, Tooltip, Switch, Dropdown, MenuProps, Tag } from 'antd';
import { memo, useMemo, useRef, useCallback } from 'react';
import { LinkOutlined, SendOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { getRuntime } from '@refly/utils/env';
import { ModelSelector } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions/model-selector';
import { ModelInfo } from '@refly/openapi-schema';
import { cn, extractUrlsWithLinkify } from '@refly/utils/index';
import { SkillRuntimeConfig } from '@refly/openapi-schema';
import {
  IconAskAI,
  IconDown,
  IconPilot,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { useChatStoreShallow } from '@refly-packages/ai-workspace-common/stores/chat';

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
    const { isPilotActivated, setIsPilotActivated } = useChatStoreShallow((state) => ({
      isPilotActivated: state.isPilotActivated,
      setIsPilotActivated: state.setIsPilotActivated,
    }));

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

    // Handle dropdown menu click
    const handleMenuClick = useCallback(
      ({ key }: { key: string }) => {
        const isAgent = key === 'agent';
        setIsPilotActivated(isAgent);
      },
      [setIsPilotActivated],
    );

    // Dropdown menu items
    const menuItems: MenuProps['items'] = useMemo(
      () => [
        {
          key: 'ask',
          icon: <IconAskAI className="h-4 w-4" />,
          label: (
            <div className="flex flex-col py-0 px-1">
              <span className="font-medium text-sm">{t('mode.ask')}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('mode.askDescription')}
              </span>
            </div>
          ),
        },
        {
          key: 'agent',
          icon: <IconPilot className="h-4 w-4" />,
          label: (
            <div className="flex flex-col py-0 px-1">
              <span className="font-medium text-sm flex items-center">
                {t('mode.agent')}{' '}
                <Tag color="orange" className="ml-2 py-0 px-1 text-[10px]">
                  Beta
                </Tag>
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('mode.agentDescription')}
              </span>
            </div>
          ),
        },
      ],
      [t],
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
          <Dropdown
            menu={{
              items: menuItems,
              onClick: handleMenuClick,
              selectedKeys: [isPilotActivated ? 'agent' : 'ask'],
            }}
            trigger={['click']}
            placement="bottomLeft"
          >
            <div
              className={cn(
                'flex items-center mr-2 px-2 py-1 gap-0.5 text-xs font-medium cursor-pointer transition-colors duration-200',
                'text-gray-600 dark:text-gray-300',
                'border border-solid rounded-lg border-gray-200 dark:border-gray-600',
                'hover:bg-gray-100 dark:hover:bg-gray-700',
              )}
            >
              <IconPilot className="mr-1 text-sm" />
              <span>{isPilotActivated ? t('mode.agent') : t('mode.ask')}</span>
              <IconDown className="text-xs ml-1" />
            </div>
          </Dropdown>

          {userStore.isLogin && !isPilotActivated && (
            <ModelSelector
              model={model}
              setModel={setModel}
              briefMode={false}
              trigger={['click']}
            />
          )}

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
              size="small"
              type="default"
              className="text-xs flex items-center gap-1 border-red-200 text-red-600 hover:border-red-300 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:border-red-700 dark:hover:text-red-300 dark:bg-red-950 dark:hover:bg-red-900"
              onClick={handleAbort}
            >
              <span>{t('copilot.chatActions.stop')}</span>
            </Button>
          ) : (
            <Button
              size="small"
              type="primary"
              disabled={!canSendMessage}
              className="text-xs flex items-center gap-1"
              onClick={handleSend}
              loading={loading}
            >
              <SendOutlined />
              <span>{t('copilot.chatActions.send')}</span>
            </Button>
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
      prevProps.isExecuting === nextProps.isExecuting
    );
  },
);

Actions.displayName = 'Actions';
