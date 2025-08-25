import { memo, useRef, useCallback, forwardRef, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchStoreShallow } from '@refly/stores';
import type { WorkflowVariable } from '@refly/openapi-schema';
import { cn } from '@refly/utils/cn';

import { useUserStoreShallow } from '@refly/stores';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { WorkflowVariableMention } from './extensions/workflow-variable-mention';

interface RichChatInputProps {
  readonly: boolean;
  query: string;
  setQuery: (text: string) => void;
  variables?: WorkflowVariable[];
  selectedSkillName?: string | null;
  placeholder?: string;
  inputClassName?: string;
  maxRows?: number;
  minRows?: number;
  handleSendMessage: () => void;

  onUploadImage?: (file: File) => Promise<void>;
  onUploadMultipleImages?: (files: File[]) => Promise<void>;
  onFocus?: () => void;
}

const RichChatInputComponent = forwardRef<HTMLDivElement, RichChatInputProps>(
  (
    {
      placeholder,
      readonly,
      query,
      setQuery,
      variables = [],
      selectedSkillName,
      inputClassName,
      maxRows = 6,
      minRows = 2,
      handleSendMessage,
      onUploadImage,
      onUploadMultipleImages,
      onFocus,
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const [isDragging, setIsDragging] = useState(false);
    const [isMac, setIsMac] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const isLogin = useUserStoreShallow((state) => state.isLogin);
    const editorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      // Detect if user is on macOS
      setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);
    }, []);

    const searchStore = useSearchStoreShallow((state) => ({
      setIsSearchOpen: state.setIsSearchOpen,
    }));

    // Filter workflow variables to only show startNode and resourceLibrary types
    const filteredVariables = useMemo(() => {
      return (
        variables?.filter(
          (variable) => variable.source === 'startNode' || variable.source === 'resourceLibrary',
        ) ?? []
      );
    }, [variables]);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          // Disable history to prevent conflicts
          history: false,
        }),
        Placeholder.configure({
          placeholder: placeholder ?? getPlaceholder(selectedSkillName),
        }),
        WorkflowVariableMention.configure({
          variables: filteredVariables,
        }),
      ],
      content: query || '',
      editable: !readonly,
      onUpdate: ({ editor }) => {
        // Get plain text for now, but could also get HTML or markdown
        const text = editor.getText();
        setQuery(text);
      },
      onFocus: () => {
        setIsFocused(true);
        onFocus?.();
      },
      onBlur: () => {
        setIsFocused(false);
      },
      editorProps: {
        attributes: {
          class: cn(
            'outline-none focus:outline-none resize-none border-none',
            'prose prose-sm max-w-none',
            inputClassName,
            readonly && 'cursor-not-allowed opacity-70',
            isFocused ? 'nodrag nopan nowheel cursor-text' : 'cursor-pointer',
          ),
          style: `min-height: ${minRows * 1.5}rem; max-height: ${maxRows * 1.5}rem; overflow-y: auto;`,
        },
        handleKeyDown: (_view, event) => {
          if (readonly) {
            event.preventDefault();
            return true;
          }

          // Handle Ctrl+K or Cmd+K to open search
          if (event.keyCode === 75 && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            searchStore.setIsSearchOpen(true);
            return true;
          }

          // Handle the Enter key
          if (event.keyCode === 13) {
            // Shift + Enter creates a new line (let default behavior handle it)
            if (event.shiftKey) {
              return false;
            }

            // Ctrl/Meta + Enter should always send the message
            if ((event.ctrlKey || event.metaKey) && (query?.trim() || !isLogin)) {
              event.preventDefault();
              handleSendMessage();
              return true;
            }

            // Regular Enter should send message
            if (!event.shiftKey) {
              event.preventDefault();
              if (query?.trim() || !isLogin) {
                handleSendMessage();
              }
              return true;
            }
          }

          return false;
        },
        handlePaste: (_view, event) => {
          if (readonly || (!onUploadImage && !onUploadMultipleImages)) {
            return false;
          }

          const items = event.clipboardData?.items;

          if (!items?.length) {
            return false;
          }

          const imageFiles: File[] = [];

          for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile();
              if (file) {
                imageFiles.push(file);
              }
            }
          }

          if (imageFiles.length > 0) {
            event.preventDefault();
            // Handle image upload asynchronously without blocking the editor
            if (imageFiles.length === 1 && onUploadImage) {
              onUploadImage(imageFiles[0]).catch(console.error);
            } else if (onUploadMultipleImages && imageFiles.length > 0) {
              onUploadMultipleImages(imageFiles).catch(console.error);
            }
            return true;
          }

          return false;
        },
      },
    });

    // Update editor content when query changes externally
    useEffect(() => {
      if (editor && editor.getText() !== query) {
        editor.commands.setContent(query || '');
      }
    }, [query, editor]);

    const handlePaste = useCallback(
      async (e: React.ClipboardEvent<HTMLDivElement>) => {
        if (readonly || (!onUploadImage && !onUploadMultipleImages)) {
          return;
        }

        const items = e.clipboardData?.items;

        if (!items?.length) {
          return;
        }

        const imageFiles: File[] = [];

        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              imageFiles.push(file);
            }
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

    // Get placeholder dynamically based on OS
    function getPlaceholder(skillName: string | null) {
      const defaultValue = isMac
        ? t('commonQnA.placeholderMac', {
            ns: 'skill',
            defaultValue: t('commonQnA.placeholder', { ns: 'skill' }),
          })
        : t('commonQnA.placeholder', { ns: 'skill' });

      return skillName
        ? t(`${skillName}.placeholder${isMac ? 'Mac' : ''}`, {
            ns: 'skill',
            defaultValue: t(`${skillName}.placeholder`, {
              ns: 'skill',
              defaultValue,
            }),
          })
        : defaultValue;
    }

    return (
      <div
        ref={ref}
        className={cn(
          'w-full h-full flex flex-col flex-grow overflow-y-auto relative',
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
        onPaste={handlePaste}
      >
        {isDragging && !readonly && (
          <div className="absolute inset-0 bg-green-50/50 flex items-center justify-center pointer-events-none z-10 rounded-lg border-2 border-green-500/30">
            <div className="text-green-600 text-sm font-medium">{t('common.dropImageHere')}</div>
          </div>
        )}
        <div ref={editorRef} className={cn('w-full h-full', readonly && 'pointer-events-none')}>
          <EditorContent editor={editor} className="w-full h-full" data-cy="rich-chat-input" />
        </div>
      </div>
    );
  },
);

RichChatInputComponent.displayName = 'RichChatInputComponent';

export const RichChatInput = memo(RichChatInputComponent, (prevProps, nextProps) => {
  return (
    prevProps.query === nextProps.query &&
    prevProps.selectedSkillName === nextProps.selectedSkillName &&
    prevProps.variables === nextProps.variables &&
    prevProps.onUploadImage === nextProps.onUploadImage &&
    prevProps.onUploadMultipleImages === nextProps.onUploadMultipleImages &&
    prevProps.onFocus === nextProps.onFocus
  );
}) as typeof RichChatInputComponent;

RichChatInput.displayName = 'RichChatInput';
