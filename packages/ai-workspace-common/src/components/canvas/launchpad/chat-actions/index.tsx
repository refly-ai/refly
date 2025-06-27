import { Button, Tooltip, Upload, Switch, FormInstance } from 'antd';
import { memo, useMemo, useRef, useCallback } from 'react';
import { IconImage } from '@refly-packages/ai-workspace-common/components/common/icon';
import { LinkOutlined, SendOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { getRuntime } from '@refly/utils/env';
import { ModelSelector } from './model-selector';
import { ModelInfo } from '@refly/openapi-schema';
import { cn, extractUrlsWithLinkify } from '@refly/utils/index';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useUploadImage } from '@refly-packages/ai-workspace-common/hooks/use-upload-image';
import { IContextItem } from '@refly/common-types';
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
  isExecuting?: boolean;
}

export const ChatActions = memo(
  (props: ChatActionsProps) => {
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
      isExecuting = false,
    } = props;
    const { t } = useTranslation();
    const { canvasId, readonly } = useCanvasContext();
    const { handleUploadImage } = useUploadImage();

    const handleSendClick = () => {
      handleSendMessage();
    };

    const handleAbortClick = () => {
      props.handleAbort();
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

          {!isWeb ? null : isExecuting ? (
            <Button
              size="small"
              type="default"
              className="text-xs flex items-center gap-1 border-red-200 text-red-600 hover:border-red-300 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:border-red-700 dark:hover:text-red-300 dark:bg-red-950/20 dark:hover:bg-red-900/30"
              onClick={handleAbortClick}
            >
              <span>{t('copilot.chatActions.stop')}</span>
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
  },
  (prevProps, nextProps) => {
    return (
      prevProps.handleSendMessage === nextProps.handleSendMessage &&
      prevProps.handleAbort === nextProps.handleAbort &&
      prevProps.contextItems === nextProps.contextItems &&
      prevProps.query === nextProps.query &&
      prevProps.runtimeConfig === nextProps.runtimeConfig &&
      prevProps.setRuntimeConfig === nextProps.setRuntimeConfig &&
      prevProps.onUploadImage === nextProps.onUploadImage &&
      prevProps.model === nextProps.model &&
      prevProps.customActions === nextProps.customActions &&
      prevProps.isExecuting === nextProps.isExecuting
    );
  },
);

ChatActions.displayName = 'ChatActions';
