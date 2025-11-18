import { forwardRef, memo, useMemo, useCallback, useRef, useImperativeHandle } from 'react';
import type { IContextItem } from '@refly/common-types';
import type { GenericToolset, ModelInfo } from '@refly/openapi-schema';
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

export interface ChatComposerProps {
  query: string;
  setQuery: (text: string) => void;
  handleSendMessage: () => void;
  handleAbort?: () => void;

  // Context items
  contextItems: IContextItem[];
  setContextItems: (
    items: IContextItem[] | ((prevItems: IContextItem[]) => IContextItem[]),
  ) => void;

  modelInfo: ModelInfo | null;
  setModelInfo: (model: ModelInfo | null) => void;

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

  // Toolsets
  selectedToolsets?: GenericToolset[];
  onSelectedToolsetsChange?: (toolsets: GenericToolset[]) => void;

  // Execution state
  isExecuting?: boolean;

  enableChatModeSelector?: boolean;

  // Custom actions
  customActions?: CustomAction[];

  nodeId?: string;

  // Show/hide ChatActions
  showActions?: boolean;
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
    query,
    setQuery,
    handleSendMessage,
    handleAbort,
    contextItems,
    setContextItems,
    modelInfo,
    setModelInfo,
    placeholder,
    inputClassName = 'px-1 py-0',
    maxRows = 6,
    onFocus,
    resultId,
    className = '',
    actionsClassName = '',
    enableRichInput = false,
    mentionPosition = 'bottom-start',
    selectedToolsets,
    onSelectedToolsetsChange,
    isExecuting = false,
    enableChatModeSelector = false,
    customActions,
    nodeId,
    showActions = true,
  } = props;

  const { handleUploadImage, handleUploadMultipleImages } = useUploadImage();
  const { canvasId, readonly } = useCanvasContext();
  const { t } = useTranslation();

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
      const resource = await handleUploadImage(file, canvasId);
      if (resource) {
        setTimeout(() => {
          // Use functional update to avoid state race conditions
          setContextItems((prevContextItems) => [
            ...(prevContextItems || []),
            {
              type: 'resource',
              entityId: resource.resourceId,
              title: resource.title,
              metadata: {
                resourceType: resource.resourceType,
                resourceMeta: resource.data,
                storageKey: resource.storageKey,
                rawFileKey: resource.rawFileKey,
                downloadURL: resource.downloadURL,
              },
            },
          ]);
        }, 10);
      }
    },
    [handleUploadImage, setContextItems, canvasId],
  );

  const handleMultipleImagesUpload = useCallback(
    async (files: File[]) => {
      const resources = await handleUploadMultipleImages(files, canvasId);
      if (resources?.length) {
        setTimeout(() => {
          const newContextItems: IContextItem[] = resources.map((resource) => ({
            type: 'resource' as const,
            entityId: resource.resourceId,
            title: resource.title,
            metadata: {
              resourceType: resource.resourceType,
              resourceMeta: resource.data,
              storageKey: resource.storageKey,
              rawFileKey: resource.rawFileKey,
              downloadURL: resource.downloadURL,
            },
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
          readonly={readonly}
          ref={inputRef}
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
          contextItems={contextItems}
          setContextItems={setContextItems}
          placeholder={defaultPlaceholder}
          mentionPosition={mentionPosition}
          selectedToolsets={selectedToolsets}
          setSelectedToolsets={onSelectedToolsetsChange}
          nodeId={nodeId}
        />
      ) : (
        <ChatInput
          readonly={readonly}
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
          className={actionsClassName}
          query={query}
          model={modelInfo}
          setModel={setModelInfo}
          resultId={resultId}
          handleSendMessage={handleSendMessageInternal}
          handleAbort={handleAbort ?? (() => {})}
          onUploadImage={handleImageUpload as (file: File) => Promise<void>}
          contextItems={contextItems}
          selectedToolsets={selectedToolsets}
          setSelectedToolsets={onSelectedToolsetsChange}
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
