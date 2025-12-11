import { Input } from 'antd';
import { memo, useRef, useState, useCallback, forwardRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import { useSearchStoreShallow } from '@refly/stores';
import { cn } from '@refly/utils/cn';
import { useUserStoreShallow } from '@refly/stores';

const TextArea = Input.TextArea;

interface ChatInputProps {
  readonly: boolean;
  query: string;
  setQuery: (text: string) => void;
  placeholder?: string;
  inputClassName?: string;
  maxRows?: number;
  minRows?: number;
  handleSendMessage: () => void;
  onUploadImage?: (file: File) => Promise<void>;
  onUploadMultipleImages?: (files: File[]) => Promise<void>;
  onFocus?: () => void;
}

const ChatInputComponent = forwardRef<HTMLDivElement, ChatInputProps>(
  (
    {
      placeholder,
      readonly,
      query,
      setQuery,
      inputClassName,
      maxRows,
      minRows,
      handleSendMessage,
      onUploadImage,
      onUploadMultipleImages,
      onFocus,
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const [isDragging, setIsDragging] = useState(false);
    const isLogin = useUserStoreShallow((state) => state.isLogin);

    const inputRef = useRef<TextAreaRef>(null);
    const [isFocused, setIsFocused] = useState(false);

    const searchStore = useSearchStoreShallow((state) => ({
      setIsSearchOpen: state.setIsSearchOpen,
    }));

    const defaultPlaceholder = useMemo(() => {
      return placeholder || t('canvas.richChatInput.defaultPlaceholder');
    }, [placeholder, t]);

    const handlePaste = useCallback(
      async (e: React.ClipboardEvent<HTMLDivElement | HTMLTextAreaElement>) => {
        if (readonly || (!onUploadImage && !onUploadMultipleImages)) {
          return;
        }

        const items = e.clipboardData?.items;

        if (!items?.length) {
          return;
        }

        const imageFiles: File[] = [];

        for (const item of Array.from(items)) {
          const file = item.getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }

        if (imageFiles.length > 0) {
          e.preventDefault();
          if (imageFiles.length === 1 && onUploadImage) {
            await onUploadImage(imageFiles[0]);
          } else if (onUploadMultipleImages && imageFiles.length > 0) {
            await onUploadMultipleImages(imageFiles);
          }
        }
      },
      [onUploadImage, onUploadMultipleImages, readonly],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (readonly) {
          e.preventDefault();
          return;
        }

        // Handle Ctrl+K or Cmd+K to open search
        if (e.keyCode === 75 && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          searchStore.setIsSearchOpen(true);
        }

        // Handle the Enter key
        if (e.keyCode === 13) {
          // Shift + Enter creates a new line (let default behavior handle it)
          if (e.shiftKey) {
            return;
          }

          // Ctrl/Meta + Enter should always send the message regardless of skill selector
          if ((e.ctrlKey || e.metaKey) && (query?.trim() || !isLogin)) {
            e.preventDefault();
            handleSendMessage();
            return;
          }

          // For regular Enter key
          if (!e.shiftKey) {
            // enter should send message when the query contains '//'
            if (query?.includes('//')) {
              e.preventDefault();
              if (query?.trim() || !isLogin) {
                handleSendMessage();
              }
              return;
            }

            // Otherwise send message on Enter
            e.preventDefault();
            if (query?.trim() || !isLogin) {
              handleSendMessage();
            }
          }
        }
      },
      [query, readonly, handleSendMessage, searchStore, isLogin],
    );

    const handleInputChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setQuery(value);
      },
      [setQuery],
    );

    // Handle focus event and propagate it upward, then move cursor to end
    const handleFocus = useCallback(() => {
      setIsFocused(true);
      if (onFocus && !readonly) {
        onFocus();
      }
      // Ensure cursor is placed at end of text
      setTimeout(() => {
        const el =
          (inputRef.current as any)?.resizableTextArea?.textArea ||
          (inputRef.current as any)?.textarea;
        if (el) {
          const length = el.value.length;
          el.setSelectionRange(length, length);
        }
      }, 0);
    }, [onFocus, readonly, setIsFocused]);

    return (
      <div
        ref={ref}
        className={cn(
          'w-full h-full flex flex-col flex-grow overflow-y-auto overflow-x-hidden relative ',
          isDragging && 'ring-2 ring-green-500 ring-opacity-50 rounded-lg',
          readonly && 'opacity-70 cursor-not-allowed',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!readonly) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!readonly) setIsDragging(false);
        }}
        onDrop={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (readonly) return;

          setIsDragging(false);

          if (!onUploadImage && !onUploadMultipleImages) return;

          const files = Array.from(e.dataTransfer.files);
          const imageFiles = files.filter((file) => file.type.startsWith('image/'));

          if (imageFiles.length > 0) {
            try {
              if (imageFiles.length === 1 && onUploadImage) {
                await onUploadImage(imageFiles[0]);
              } else if (onUploadMultipleImages) {
                await onUploadMultipleImages(imageFiles);
              }
            } catch (error) {
              console.error('Failed to upload images:', error);
            }
          }
        }}
      >
        {isDragging && !readonly && (
          <div className="absolute inset-0 bg-green-50/50 flex items-center justify-center pointer-events-none z-10 rounded-lg border-2 border-green-500/30">
            <div className="text-green-600 text-sm font-medium">{t('common.dropImageHere')}</div>
          </div>
        )}
        <TextArea
          ref={inputRef}
          style={{ paddingLeft: 0, paddingRight: 0, paddingTop: '4px', paddingBottom: '4px' }}
          autoFocus={!readonly}
          disabled={readonly}
          onFocus={handleFocus}
          onBlur={() => {
            setIsFocused(false);
          }}
          value={query ?? ''}
          onChange={handleInputChange}
          onKeyDownCapture={handleKeyDown}
          onPaste={handlePaste}
          className={cn(
            '!m-0 !bg-transparent outline-none box-border border-none resize-none focus:outline-none focus:shadow-none focus:border-none',
            inputClassName,
            readonly && 'cursor-not-allowed',
            isFocused ? 'nodrag nopan nowheel cursor-text' : '!cursor-pointer',
          )}
          autoSize={{
            minRows: minRows ?? 2,
            maxRows: maxRows ?? 6,
          }}
          placeholder={defaultPlaceholder}
          data-cy="chat-input"
        />
      </div>
    );
  },
);

ChatInputComponent.displayName = 'ChatInputComponent';

export const ChatInput = memo(ChatInputComponent) as typeof ChatInputComponent;

ChatInput.displayName = 'ChatInput';
