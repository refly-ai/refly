import { Button, Tooltip, Upload, Switch, FormInstance } from 'antd';
import { useMemo, useRef, useCallback, useEffect } from 'react';
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
  loading?: boolean;
}

export const ChatActions = (props: ChatActionsProps) => {
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
    loading = false,
  } = props;
  const { t } = useTranslation();
  const { canvasId, readonly } = useCanvasContext();
  const { handleUploadImage } = useUploadImage();

  const handleSendClick = () => {
    console.log('🎯 ChatActions handleSendClick called - about to call handleSendMessage');
    console.log('🔍 handleSendMessage function:', handleSendMessage);
    handleSendMessage();
    console.log('✅ ChatActions handleSendMessage called');
  };

  const handleAbortClick = () => {
    console.log('🛑 ChatActions handleAbortClick called - about to call handleAbort');
    console.log('🔍 handleAbort function:', props.handleAbort);
    console.log('🔍 handleAbort type:', typeof props.handleAbort);
    if (typeof props.handleAbort === 'function') {
      props.handleAbort();
      console.log('✅ ChatActions handleAbort called');
    } else {
      console.error('❌ handleAbort is not a function!');
    }
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

  // Check if any task is currently executing
  const isExecuting = loading;

  // Debug: Monitor loading prop changes
  useEffect(() => {
    console.log('ChatActions - loading prop changed:', {
      loading,
      isExecuting,
      timestamp: new Date().toISOString(),
    });
  }, [loading, isExecuting]);

  // Debug: handleAbort function
  console.log('ChatActions - handleAbort debug:', {
    handleAbort: props.handleAbort,
    handleAbortType: typeof props.handleAbort,
    handleAbortString: props.handleAbort?.toString(),
    isFunction: typeof props.handleAbort === 'function',
  });

  console.log('ChatActions - Detailed execution state:', {
    loading,
    isExecuting,
    isWeb,
    canSendMessage,
    readonly,
    shouldShowButtons: !readonly,
    shouldShowSendOrStop: isWeb,
    willShowStop: isWeb && isExecuting,
    willShowSend: isWeb && !isExecuting,
    timestamp: new Date().toISOString(),
    propsLoading: props.loading, // Also log the original prop
    destructuredLoading: loading,
    hasLoadingProp: 'loading' in props,
    propsKeys: Object.keys(props),
    getRuntime: getRuntime(),
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
        {/* 🧪 Temporarily removed isWeb check for debugging */}
        {!canSendMessage ? (
          <Button
            size="small"
            danger
            className="text-xs flex items-center gap-1"
            onClick={handleAbortClick}
          >
            <StopOutlined />
            <span>{t('copilot.chatActions.stop', { defaultValue: 'Stop' })}</span>
          </Button>
        ) : (
          <Button
            size="small"
            type="primary"
            // disabled={!canSendMessage}
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
};

ChatActions.displayName = 'ChatActions';
