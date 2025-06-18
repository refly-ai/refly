import { Button, Tooltip, Upload, Switch, FormInstance } from 'antd';
import { memo, useMemo, useRef, useCallback } from 'react';
import { IconImage } from '@refly-packages/ai-workspace-common/components/common/icon';
import { LinkOutlined, SendOutlined, StopOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { getRuntime } from '@refly/utils/env';
import { ModelSelector } from './model-selector';
import { ModelInfo } from '@refly/openapi-schema';
import { cn, extractUrlsWithLinkify } from '@refly/utils/index';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useUploadImage } from '@refly-packages/ai-workspace-common/hooks/use-upload-image';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { SkillRuntimeConfig } from '@refly/openapi-schema';
import { useContextPanelStoreShallow } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useActionResultStore } from '@refly-packages/ai-workspace-common/stores/action-result';

export interface CustomAction {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
}

interface ChatActionsProps {
  query: string;
  model: ModelInfo;
  setModel: (model: ModelInfo) => void;
  runtimeConfig: SkillRuntimeConfig;
  setRuntimeConfig: (runtimeConfig: SkillRuntimeConfig) => void;
  className?: string;
  form?: FormInstance;
  handleSendMessage: () => void;
  handleAbort: () => void;
  customActions?: CustomAction[];
  onUploadImage?: (file: File) => Promise<void>;
  contextItems: IContextItem[];
}

export const ChatActions = memo((props: ChatActionsProps) => {
  const {
    query,
    model,
    setModel,
    runtimeConfig,
    setRuntimeConfig,
    handleSendMessage,
    customActions,
    className,
    onUploadImage,
    contextItems,
  } = props;
  const { t } = useTranslation();
  const { canvasId, readonly } = useCanvasContext();
  const { handleUploadImage } = useUploadImage();

  const handleSendClick = () => {
    handleSendMessage();
  };

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

  const containerRef = useRef<HTMLDivElement>(null);

  /* ------------------------------------------------------------------
   * Stop / Abort handling
   * ------------------------------------------------------------------*/
  // Get currently active result id from context panel store
  const { activeResultId } = useContextPanelStoreShallow((state) => ({
    activeResultId: state.activeResultId,
  }));

  console.log('ChatActions - activeResultId from store:', activeResultId);

  // Determine whether the active result is currently executing
  const isExecuting = useActionResultStore((state) => {
    const result = state.resultMap?.[activeResultId];
    console.log('ChatActions - Full debug:', {
      activeResultId,
      hasResult: !!result,
      resultStatus: result?.status,
      allResultIds: Object.keys(state.resultMap || {}),
      isExecuting: result ? result.status !== 'finish' && result.status !== 'failed' : false,
    });
    if (!result) return false;
    return result.status !== 'finish' && result.status !== 'failed';
  });

  return readonly ? null : (
    <div className={cn('flex justify-between items-center', className)} ref={containerRef}>
      <div className="flex items-center">
        <ModelSelector
          model={model}
          setModel={setModel}
          briefMode={false}
          trigger={['click']}
          contextItems={contextItems}
        />

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
            <Button size="small" icon={action.icon} onClick={action.onClick} className="mr-0" />
          </Tooltip>
        ))}

        <Upload
          accept="image/*"
          showUploadList={false}
          customRequest={({ file }) => {
            if (onUploadImage) {
              onUploadImage(file as File);
            } else {
              handleUploadImage(file as File, canvasId);
            }
          }}
          multiple
        >
          <Tooltip title={t('common.uploadImage')}>
            <Button
              className="translate-y-[0.5px]"
              size="small"
              icon={<IconImage className="flex items-center" />}
            />
          </Tooltip>
        </Upload>

        {/* Show Stop button when generating, otherwise show Send button */}
        {!isWeb ? null : isExecuting ? (
          <Button
            size="small"
            danger
            className="text-xs flex items-center gap-1"
            onClick={props.handleAbort}
          >
            <StopOutlined />
            <span>{t('copilot.chatActions.stop', { defaultValue: 'Stop' })}</span>
          </Button>
        ) : (
          <Button
            size="small"
            type="primary"
            disabled={!canSendMessage}
            className="text-xs flex items-center gap-1"
            onClick={handleSendClick}
          >
            <SendOutlined />
            <span>{t('copilot.chatActions.send')}</span>
          </Button>
        )}
      </div>
    </div>
  );
});

ChatActions.displayName = 'ChatActions';
