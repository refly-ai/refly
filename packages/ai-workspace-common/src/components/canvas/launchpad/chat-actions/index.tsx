import { Button, Tooltip, Upload, Switch, FormInstance } from 'antd';
import { memo, useMemo, useRef, useCallback } from 'react';
import { LinkOutlined } from '@ant-design/icons';
import { Attachment, Send, Stop } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import { useUserStoreShallow } from '@refly/stores';
import { getRuntime } from '@refly/utils/env';
import { ModelSelector } from './model-selector';
import { ModelInfo } from '@refly/openapi-schema';
import { cn, extractUrlsWithLinkify } from '@refly/utils/index';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useUploadImage } from '@refly-packages/ai-workspace-common/hooks/use-upload-image';
import { IContextItem } from '@refly/common-types';
import { SkillRuntimeConfig, GenericToolset } from '@refly/openapi-schema';
import { ToolSelectorPopover } from '../tool-selector-panel';
import { logEvent } from '@refly/telemetry-web';

export interface CustomAction {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
}

interface ChatActionsProps {
  query: string;
  model: ModelInfo | null;
  setModel: (model: ModelInfo | null) => void;
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
  selectedToolsets?: GenericToolset[];
  setSelectedToolsets?: (toolsets: GenericToolset[]) => void;
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
      handleAbort,
      contextItems,
      isExecuting = false,
      selectedToolsets,
      setSelectedToolsets,
    } = props;
    const { t } = useTranslation();
    const { canvasId, readonly } = useCanvasContext();
    const { handleUploadImage } = useUploadImage();

    const handleSendClick = useCallback(() => {
      // Check if knowledge base is used (resource or document types)
      const usedKnowledgeBase =
        contextItems?.some((item) => item?.type === 'resource' || item?.type === 'document') ??
        false;

      const usedTools = selectedToolsets?.length > 0;

      logEvent('canvas::node_execute', Date.now(), {
        node_type: 'askAI',
        model_name: model?.name ?? '',
        used_knowledge_base: usedKnowledgeBase,
        used_tools: usedTools,
      });
      handleSendMessage();
    }, [contextItems, model, handleSendMessage, selectedToolsets]);

    const handleAbortClick = useCallback(() => {
      handleAbort();
    }, [handleAbort]);

    // hooks
    const isWeb = getRuntime() === 'web';

    const userStore = useUserStoreShallow((state) => ({
      isLogin: state.isLogin,
    }));

    const canSendEmptyMessage = useMemo(() => {
      const hasQuery = query?.trim();
      const hasContextItems = contextItems?.length > 0;
      return hasQuery || hasContextItems;
    }, [query, contextItems]);
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

    if (readonly) {
      return null;
    }

    return (
      <div className={cn('flex justify-between items-center', className)} ref={containerRef}>
        <div className="flex items-center gap-1">
          <ModelSelector
            model={model}
            setModel={setModel}
            size="small"
            briefMode={false}
            trigger={['click']}
            contextItems={contextItems}
          />

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
                type="text"
                size="small"
                icon={<Attachment className="flex items-center w-5 h-5" />}
                className="h-7 w-7 flex items-center justify-center"
              />
            </Tooltip>
          </Upload>

          <ToolSelectorPopover
            selectedToolsets={selectedToolsets}
            onSelectedToolsetsChange={setSelectedToolsets}
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

          {!isWeb ? null : isExecuting ? (
            <Button
              size="small"
              type="primary"
              className="flex-shrink-0 flex items-center justify-center !w-9 !h-9 rounded-full border-none"
              onClick={handleAbortClick}
              icon={<Stop size={20} color="white" />}
            />
          ) : (
            <Button
              type="primary"
              disabled={!canSendMessage}
              className="flex-shrink-0 flex items-center justify-center !w-9 !h-9 rounded-full border-none"
              onClick={handleSendClick}
              icon={<Send size={20} color="white" />}
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
      prevProps.contextItems === nextProps.contextItems &&
      prevProps.query === nextProps.query &&
      prevProps.runtimeConfig === nextProps.runtimeConfig &&
      prevProps.setRuntimeConfig === nextProps.setRuntimeConfig &&
      prevProps.onUploadImage === nextProps.onUploadImage &&
      prevProps.model === nextProps.model &&
      prevProps.customActions === nextProps.customActions &&
      prevProps.isExecuting === nextProps.isExecuting &&
      prevProps.selectedToolsets === nextProps.selectedToolsets &&
      prevProps.setSelectedToolsets === nextProps.setSelectedToolsets
    );
  },
);

ChatActions.displayName = 'ChatActions';
