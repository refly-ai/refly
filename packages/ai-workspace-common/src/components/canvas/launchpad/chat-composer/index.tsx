import { forwardRef, memo, useMemo, useCallback, useRef, useImperativeHandle } from 'react';
import type { IContextItem } from '@refly/common-types';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import {
  RichChatInput,
  type RichChatInputRef,
} from '@refly-packages/ai-workspace-common/components/canvas/launchpad/rich-chat-input';
import {
  ChatActions,
  CustomAction,
} from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions';
import { useUploadImage } from '@refly-packages/ai-workspace-common/hooks/use-upload-image';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useActionResultStore, useChatStoreShallow } from '@refly/stores';
import { useTranslation } from 'react-i18next';
import { message } from 'antd';
import { type MentionPosition } from '../rich-chat-input/mention-extension';
import { useAgentNodeManagement } from '@refly-packages/ai-workspace-common/hooks/canvas/use-agent-node-management';

export interface ChatComposerProps {
  handleSendMessage: () => void;
  handleAbort?: () => void;

  // Optional UI behaviors
  placeholder?: string;
  inputClassName?: string;
  maxRows?: number;
  onFocus?: () => void;
  className?: string;
  contextClassName?: string;
  actionsClassName?: string;

  // Action result ID
  resultId?: string;

  mentionPosition?: MentionPosition;

  // Rich input
  enableRichInput?: boolean;

  // Execution state
  isExecuting?: boolean;

  enableChatModeSelector?: boolean;

  // Custom actions
  customActions?: CustomAction[];

  nodeId: string;

  // Show/hide ChatActions
  showActions?: boolean;
  disabled?: boolean;
}

export interface ChatComposerRef {
  focus: () => void;
  insertAtSymbol?: () => void;
}

/**
 * ChatComposer composes ContextManager, ChatInput/RichChatInput and ChatActions.
 * Parent should provide upload handlers and business callbacks.
 */
const ChatComposerComponent = forwardRef<ChatComposerRef, ChatComposerProps>((props, ref) => {
  const {
    handleSendMessage,
    handleAbort,
    placeholder,
    inputClassName = 'px-1 py-0',
    maxRows = 6,
    onFocus,
    resultId,
    className = '',
    actionsClassName = '',
    enableRichInput = false,
    mentionPosition = 'bottom-start',
    isExecuting = false,
    enableChatModeSelector = false,
    customActions,
    nodeId,
    showActions = true,
    disabled = false,
  } = props;

  const { handleUploadImage, handleUploadMultipleImages } = useUploadImage();
  const { canvasId, readonly } = useCanvasContext();
  const { t } = useTranslation();
  const {
    query,
    setQuery,
    contextItems,
    setContextItems,
    modelInfo,
    setModelInfo,
    selectedToolsets,
    setSelectedToolsets,
  } = useAgentNodeManagement(nodeId);

  // Ref for the input component
  const inputRef = useRef<RichChatInputRef>(null);

  // Expose focus and insertAtSymbol methods through ref
  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        inputRef.current?.focus();
      },
      insertAtSymbol: () => {
        inputRef.current?.insertAtSymbol?.();
      },
    }),
    [],
  );

  const { chatMode } = useChatStoreShallow((state) => ({
    chatMode: state.chatMode,
  }));

  const defaultPlaceholder = useMemo(() => {
    if (placeholder) {
      return placeholder;
    }
    if (chatMode === 'agent' && enableChatModeSelector) {
      return t('canvas.launchpad.chatInputPlaceholder');
    } else {
      return t('canvas.launchpad.commonChatInputPlaceholder');
    }
  }, [chatMode, placeholder, t, enableChatModeSelector]);

  const handleImageUpload = useCallback(
    async (file: File) => {
      const driveFile = await handleUploadImage(file, canvasId);
      if (driveFile) {
        setTimeout(() => {
          // Use functional update to avoid state race conditions
          setContextItems((prevContextItems) => [
            ...(prevContextItems || []),
            {
              type: 'file',
              entityId: driveFile.fileId,
              title: driveFile.name,
            },
          ]);
        }, 10);
      }
    },
    [handleUploadImage, setContextItems, canvasId],
  );

  const handleMultipleImagesUpload = useCallback(
    async (files: File[]) => {
      const driveFiles = await handleUploadMultipleImages(files, canvasId);
      if (driveFiles?.length) {
        setTimeout(() => {
          const newContextItems: IContextItem[] = driveFiles.map((driveFile) => ({
            type: 'file',
            entityId: driveFile.fileId,
            title: driveFile.name,
          }));

          // Use functional update to avoid state race conditions
          setContextItems((prevContextItems) => [...(prevContextItems || []), ...newContextItems]);
        }, 10);
      }
    },
    [handleUploadMultipleImages, setContextItems, canvasId],
  );

  const handleSendMessageInternal = useCallback(() => {
    // If resultId is provided, check if the result is executing
    if (resultId) {
      const { resultMap } = useActionResultStore.getState();
      const result = resultMap[resultId];
      if (result && (result.status === 'waiting' || result.status === 'executing')) {
        message.warning(t('canvas.launchpad.actionIsRunning'));
        return;
      }
    }

    handleSendMessage();
  }, [resultId, handleSendMessage]);

  return (
    <div className={`flex flex-col gap-3 h-full ${className}`}>
      {enableRichInput ? (
        <RichChatInput
          readonly={readonly || disabled}
          ref={inputRef}
          inputClassName={inputClassName}
          maxRows={maxRows}
          handleSendMessage={handleSendMessageInternal}
          onUploadImage={handleImageUpload as (file: File) => Promise<void>}
          onUploadMultipleImages={handleMultipleImagesUpload as (files: File[]) => Promise<void>}
          onFocus={onFocus}
          placeholder={defaultPlaceholder}
          mentionPosition={mentionPosition}
          nodeId={nodeId}
        />
      ) : (
        <ChatInput
          readonly={readonly || disabled}
          ref={ref as any}
          query={query}
          setQuery={(value) => {
            setQuery(value);
          }}
          inputClassName={inputClassName}
          maxRows={maxRows}
          handleSendMessage={handleSendMessageInternal}
          onUploadImage={handleImageUpload as (file: File) => Promise<void>}
          onUploadMultipleImages={handleMultipleImagesUpload as (files: File[]) => Promise<void>}
          onFocus={onFocus}
          placeholder={defaultPlaceholder}
        />
      )}

      {showActions && (
        <ChatActions
          query={query}
          modelInfo={modelInfo}
          contextItems={contextItems}
          selectedToolsets={selectedToolsets}
          setModelInfo={setModelInfo}
          setSelectedToolsets={setSelectedToolsets}
          className={actionsClassName}
          resultId={resultId}
          handleSendMessage={handleSendMessageInternal}
          handleAbort={handleAbort ?? (() => {})}
          onUploadImage={handleImageUpload as (file: File) => Promise<void>}
          isExecuting={isExecuting}
          enableChatModeSelector={enableChatModeSelector}
          customActions={customActions}
        />
      )}
    </div>
  );
});

ChatComposerComponent.displayName = 'ChatComposerComponent';

export const ChatComposer = memo(ChatComposerComponent);
