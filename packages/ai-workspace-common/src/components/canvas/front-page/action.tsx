import { Button, Tooltip, Switch } from 'antd';
import { memo, useMemo, useRef, useCallback } from 'react';
import { IconLink, IconSend, IconQuestionCircle } from '@arco-design/web-react/icon';
import { useTranslation } from 'react-i18next';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { getRuntime } from '@refly/utils/env';
import { ModelSelector } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions/model-selector';
import { ModelInfo } from '@refly/openapi-schema';
import { cn, extractUrlsWithLinkify } from '@refly/utils/index';
import { SkillRuntimeConfig } from '@refly/openapi-schema';
import { IconPilot } from '@refly-packages/ai-workspace-common/components/common/icon';

export interface CustomAction {
  content?: string;
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
}

interface ActionsProps {
  query: string;
  model: ModelInfo;
  setModel: (model: ModelInfo) => void;
  runtimeConfig: SkillRuntimeConfig;
  setRuntimeConfig: (runtimeConfig: SkillRuntimeConfig) => void;
  className?: string;
  handleSendMessage: () => void;
  handleAbort: () => void;
  customActions?: CustomAction[];
  loading?: boolean;
  isPilotActivated: boolean;
  setIsPilotActivated: (activated: boolean) => void;
}

export const Actions = memo(
  (props: ActionsProps) => {
    const {
      query,
      model,
      setModel,
      handleSendMessage,
      customActions,
      className,
      loading,
      runtimeConfig,
      setRuntimeConfig,
      isPilotActivated,
      setIsPilotActivated,
    } = props;
    const { t } = useTranslation();

    // hooks
    const isWeb = getRuntime() === 'web';

    const userStore = useUserStoreShallow((state) => ({
      isLogin: state.isLogin,
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

    // Toggle Pilot activation
    const togglePilot = useCallback(() => {
      setIsPilotActivated(!isPilotActivated);
    }, [isPilotActivated, setIsPilotActivated]);

    // Create a pilot session or directly send message
    const handleSend = useCallback(() => {
      if (!canSendMessage) return;
      handleSendMessage();
    }, [canSendMessage, handleSendMessage]);

    const containerRef = useRef<HTMLDivElement>(null);

    return (
      <div className={cn('flex justify-between items-center', className)} ref={containerRef}>
        <div className="flex items-center">
          <ModelSelector model={model} setModel={setModel} briefMode={false} trigger={['click']} />

          <div
            onClick={togglePilot}
            className={cn(
              'flex items-center ml-2 px-2 py-1 gap-0.5 text-xs font-medium cursor-pointer transition-colors duration-200',
              'border border-solid rounded-lg',
              'hover:bg-gray-100 dark:hover:bg-gray-800',
              isPilotActivated
                ? 'text-green-500 border-green-500 dark:text-green-400 dark:border-green-400'
                : 'text-gray-700 border-gray-200 dark:text-gray-400 dark:border-gray-600',
            )}
          >
            <IconPilot className="mr-1 text-sm" />
            <span>{t('pilot.name')}</span>
            <Tooltip title={t('pilot.description')}>
              <IconQuestionCircle className="text-xs cursor-pointer" />
            </Tooltip>
          </div>

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
                <IconLink className="text-sm text-gray-500 flex items-center justify-center cursor-pointer" />
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

          {!isWeb ? null : (
            <Button
              size="small"
              type="primary"
              disabled={!canSendMessage}
              className="text-xs flex items-center gap-1"
              onClick={handleSend}
              loading={loading}
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
    return (
      prevProps.handleSendMessage === nextProps.handleSendMessage &&
      prevProps.handleAbort === nextProps.handleAbort &&
      prevProps.query === nextProps.query &&
      prevProps.runtimeConfig === nextProps.runtimeConfig &&
      prevProps.setRuntimeConfig === nextProps.setRuntimeConfig &&
      prevProps.model === nextProps.model &&
      prevProps.isPilotActivated === nextProps.isPilotActivated &&
      prevProps.setIsPilotActivated === nextProps.setIsPilotActivated
    );
  },
);

Actions.displayName = 'Actions';
