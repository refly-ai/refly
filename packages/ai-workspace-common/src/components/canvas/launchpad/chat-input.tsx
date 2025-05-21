// TipTap Core and Extensions
import { useEditor, EditorContent, EditorEvents } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import HardBreak from '@tiptap/extension-hard-break';
import UserMention, { UserMentionPluginKey } from './UserMentionExtension';
import SkillMention, { SkillMentionPluginKey } from './SkillMentionExtension';

// React and i18n
import { memo, useState, useCallback, forwardRef, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

// Project specific imports
import { useSearchStoreShallow } from '@refly-packages/ai-workspace-common/stores/search';
import type { Skill } from '@refly/openapi-schema';
import { cn } from '@refly/utils/cn';

interface ChatInputProps {
  readonly: boolean;
  query: string;
  setQuery: (text: string) => void;
  selectedSkillName: string | null;
  inputClassName?: string;
  maxRows?: number;
  minRows?: number;
  handleSendMessage: (contentHTML: string, contentText: string) => void;
  handleSelectSkill?: (skill: Skill) => void;
  onUploadImage?: (file: File) => Promise<void>;
  onUploadMultipleImages?: (files: File[]) => Promise<void>;
  onFocus?: () => void;
}

const BaseChatInput = forwardRef<HTMLDivElement, ChatInputProps>(
  (
    {
      readonly,
      query,
      setQuery,
      selectedSkillName,
      inputClassName,
      maxRows,
      minRows,
      handleSendMessage,
      onFocus,
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const [isMac, setIsMac] = useState(false);
    const searchStore = useSearchStoreShallow((state) => ({
      setIsSearchOpen: state.setIsSearchOpen,
    }));
    const mentionListRef = useRef<MentionListRef>(null);

    useEffect(() => {
      setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);
    }, []);

    const getPlaceholderText = useCallback(() => {
      const defaultValue = isMac
        ? t('commonQnA.placeholderMac', {
            ns: 'skill',
            defaultValue: t('commonQnA.placeholder', { ns: 'skill' }),
          })
        : t('commonQnA.placeholder', { ns: 'skill' });
      return selectedSkillName
        ? t(`${selectedSkillName}.placeholder${isMac ? 'Mac' : ''}`, {
            ns: 'skill',
            defaultValue: t(`${selectedSkillName}.placeholder`, { ns: 'skill', defaultValue }),
          })
        : defaultValue;
    }, [t, isMac, selectedSkillName]);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: false,
          blockquote: false,
          codeBlock: false,
          bulletList: false,
          orderedList: false,
          listItem: false,
          horizontalRule: false,
          dropcursor: { color: 'rgb(var(--selection-color))', width: 2 },
        }),
        HardBreak,
        Placeholder.configure({
          placeholder: getPlaceholderText,
          emptyEditorClass: 'is-editor-empty',
        }),
        UserMention, // Use the custom UserMention extension
        SkillMention, // Use the custom SkillMention extension
      ],
      content: query,
      editable: !readonly,
      onUpdate: ({ editor: currentEditor }: EditorEvents['update']) => {
        setQuery(currentEditor.getText());
      },
      onCreate: ({ editor: _currentEditor }: EditorEvents['create']) => {
        if (!readonly && onFocus) onFocus();
      },
      onFocus: ({ editor: _currentEditor, event: _event }: EditorEvents['focus']) => {
        if (!readonly && onFocus) onFocus();
      },
      editorProps: {
        attributes: {
          class: cn(
            'prose dark:prose-invert prose-sm sm:prose-base focus:outline-none w-full h-full',
            'bg-transparent !outline-none !box-border !border-none !resize-none focus:!shadow-none',
            '!p-0' /* Force remove padding */,
            inputClassName,
            readonly && 'cursor-not-allowed text-opacity-70',
            'leading-normal',
          ),
          style: `min-height: ${minRows ? minRows * 1.6 : 1.6}em; max-height: ${maxRows ? maxRows * 1.6 : 9.6}em; overflow-y: auto; white-space: pre-wrap; word-wrap: break-word;`,
        },
        handleKeyDown: (view, event) => {
          const userMentionState = UserMentionPluginKey.getState(editor!.state);
          const skillMentionState = SkillMentionPluginKey.getState(editor!.state);

          if (
            (userMentionState?.active || skillMentionState?.active) &&
            (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Enter')
          ) {
            return mentionListRef.current?.onKeyDown({ event }) || false;
          }
          if (readonly) {
            event.preventDefault();
            return true;
          }
          if (event.key === 'Enter' && event.shiftKey) return false;
          if (event.key === 'Enter' && (!event.shiftKey || event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            const currentText = view.state.doc.textContent.trim();
            const currentHTML = editor?.getHTML() || '';
            if (currentText) handleSendMessage(currentHTML, currentText);
            return true;
          }
          if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            searchStore.setIsSearchOpen(true);
            return true;
          }
          return false;
        },
      },
    });

    useEffect(() => {
      if (editor && !editor.isDestroyed && editor.getText() !== query) {
        if (!editor.isFocused || query === '') editor.commands.setContent(query, false);
      }
    }, [query, editor]);

    useEffect(() => {
      if (editor && !editor.isDestroyed) editor.setEditable(!readonly);
    }, [readonly, editor]);

    useEffect(() => {
      if (
        editor &&
        !editor.isDestroyed &&
        editor.extensionManager.extensions.find((ext) => ext.name === 'placeholder')
      ) {
        editor.view.dispatch(editor.state.tr);
      }
    }, [selectedSkillName, getPlaceholderText, editor, t]);

    return (
      <div
        ref={ref}
        className={cn(
          'w-full h-full flex flex-col flex-grow relative',
          readonly && 'opacity-70 cursor-not-allowed',
          'border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 tiptap-editor-wrapper',
        )}
      >
        <EditorContent
          editor={editor}
          className="flex-grow overflow-y-auto tiptap-scroll-container"
        />
      </div>
    );
  },
);

BaseChatInput.displayName = 'BaseChatInput';

export const ChatInput = memo(BaseChatInput, (prevProps, nextProps) => {
  return (
    prevProps.query === nextProps.query &&
    prevProps.selectedSkillName === nextProps.selectedSkillName &&
    prevProps.readonly === nextProps.readonly &&
    prevProps.inputClassName === nextProps.inputClassName &&
    prevProps.minRows === nextProps.minRows &&
    prevProps.maxRows === nextProps.maxRows &&
    prevProps.handleSendMessage === nextProps.handleSendMessage &&
    prevProps.handleSelectSkill === nextProps.handleSelectSkill &&
    prevProps.onUploadImage === nextProps.onUploadImage &&
    prevProps.onUploadMultipleImages === nextProps.onUploadMultipleImages &&
    prevProps.onFocus === nextProps.onFocus
  );
}) as typeof BaseChatInput;

ChatInput.displayName = 'ChatInput';
