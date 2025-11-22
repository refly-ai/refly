import { Button, Tooltip, Upload, FormInstance } from 'antd';
import { memo, useMemo, useRef, useCallback } from 'react';
import { ImageOutline, Send, Stop } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import {
  useActionResultStoreShallow,
  useChatStoreShallow,
  useUserStoreShallow,
} from '@refly/stores';
import { getRuntime } from '@refly/utils/env';
import { ModelSelector } from './model-selector';
import { cn } from '@refly/utils/index';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { ToolSelectorPopover } from '../tool-selector-panel';
import { logEvent } from '@refly/telemetry-web';
import { ChatModeSelector } from '@refly-packages/ai-workspace-common/components/canvas/front-page/chat-mode-selector';
import type { IContextItem } from '@refly/common-types';
import type { ModelInfo, GenericToolset } from '@refly/openapi-schema';

export interface CustomAction {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
}

interface ChatActionsProps {
  resultId?: string;
  className?: string;
  form?: FormInstance;
  customActions?: CustomAction[];
  handleSendMessage: () => void;
  handleAbort?: () => void;
  onUploadImage: (file: File) => Promise<void>;
  isExecuting?: boolean;
  enableChatModeSelector?: boolean;
  showLeftActions?: boolean;

  // New props from useAgentNodeManagement
  query: string;
  modelInfo?: ModelInfo | null;
  contextItems?: IContextItem[];
  selectedToolsets?: GenericToolset[];
  setModelInfo?: (
    modelInfo: ModelInfo | null | ((prevModelInfo: ModelInfo | null) => ModelInfo | null),
  ) => void;
  setSelectedToolsets?: (
    toolsets: GenericToolset[] | ((prevToolsets: GenericToolset[]) => GenericToolset[]),
  ) => void;
}

export const ChatActions = memo((props: ChatActionsProps) => {
  const {
    resultId,
    handleSendMessage,
    customActions,
    className,
    onUploadImage,
    handleAbort,
    isExecuting = false,
    enableChatModeSelector = false,
    showLeftActions = true,
    query,
    modelInfo,
    contextItems,
    selectedToolsets,
    setModelInfo,
    setSelectedToolsets,
  } = props;
  const { t } = useTranslation();
  const { readonly } = useCanvasContext();
  const { chatMode, setChatMode } = useChatStoreShallow((state) => ({
    chatMode: state.chatMode,
    setChatMode: state.setChatMode,
  }));
  const { result } = useActionResultStoreShallow((state) => ({
    result: resultId ? state.resultMap[resultId] : undefined,
  }));

  const handleSendClick = useCallback(() => {
    // Check if knowledge base is used (resource or document types)
    const usedKnowledgeBase =
      contextItems?.some((item) => item?.type === 'resource' || item?.type === 'document') ?? false;

    const usedTools = selectedToolsets?.length > 0;

    logEvent('canvas::node_execute', Date.now(), {
      node_type: 'askAI',
      model_name: modelInfo?.name ?? '',
      used_knowledge_base: usedKnowledgeBase,
      used_tools: usedTools,
    });
    handleSendMessage();
  }, [contextItems, modelInfo, handleSendMessage, selectedToolsets]);

  const handleAbortClick = useCallback(() => {
    handleAbort?.();
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

  const canSendMessage = useMemo(() => {
    if (!result) {
      return !userStore.isLogin || canSendEmptyMessage;
    }

    // Only allow sending message if the result is not waiting or executing
    return result.status !== 'waiting' && result.status !== 'executing' && canSendEmptyMessage;
  }, [userStore.isLogin, canSendEmptyMessage, result]);

  const containerRef = useRef<HTMLDivElement>(null);

  if (readonly) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center',
        showLeftActions ? 'justify-between' : 'justify-end',
        className,
      )}
      ref={containerRef}
    >
      {showLeftActions && (
        <div className="flex items-center gap-1">
          {enableChatModeSelector && (
            <ChatModeSelector chatMode={chatMode} setChatMode={setChatMode} />
          )}

          {(!enableChatModeSelector || chatMode === 'ask') && (
            <>
              <ModelSelector
                model={modelInfo}
                setModel={setModelInfo}
                size="small"
                briefMode={false}
                trigger={['click']}
                contextItems={contextItems}
              />

              <Upload
                accept="image/*"
                showUploadList={false}
                customRequest={({ file }) => {
                  onUploadImage(file as File);
                }}
                multiple
              >
                <Tooltip title={t('common.uploadImage')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<ImageOutline size={20} className="flex items-center" />}
                    className="h-7 !w-7 flex items-center justify-center"
                  />
                </Tooltip>
              </Upload>

              <ToolSelectorPopover
                selectedToolsets={selectedToolsets}
                onSelectedToolsetsChange={setSelectedToolsets}
              />
            </>
          )}
        </div>
      )}
      <div className="flex flex-row items-center gap-2">
        {customActions?.map((action, index) => (
          <Tooltip title={action.title} key={index}>
            <Button
              type="text"
              size="small"
              icon={action.icon}
              onClick={action.onClick}
              className="h-7 w-7 flex items-center justify-center"
            />
          </Tooltip>
        ))}

        {!isWeb ? null : isExecuting ? (
          <Button
            size="small"
            type="primary"
            disabled={!handleAbort}
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
});

ChatActions.displayName = 'ChatActions';
