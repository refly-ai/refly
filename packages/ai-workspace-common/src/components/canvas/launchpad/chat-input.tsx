import { AutoComplete, AutoCompleteProps, Input } from 'antd';
import { memo, useRef, useMemo, useState, useCallback, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { RefTextAreaType } from '@arco-design/web-react/es/Input/textarea';
import { useSearchStoreShallow } from '@refly-packages/ai-workspace-common/stores/search';
import type { Skill } from '@refly/openapi-schema';
import { useSkillStoreShallow } from '@refly-packages/ai-workspace-common/stores/skill';
import { cn } from '@refly-packages/utils/cn';
import { useListSkills } from '@refly-packages/ai-workspace-common/hooks/use-find-skill';
import { getSkillIcon } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useContextPanelStoreShallow } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useAvailableContextItems } from './context-manager/hooks/use-available-context-items';

const TextArea = Input.TextArea;

interface ChatInputProps {
  query: string;
  setQuery: (text: string) => void;
  selectedSkillName: string | null;
  inputClassName?: string;
  maxRows?: number;
  autoCompletionPlacement?: 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight';
  handleSendMessage: () => void;
  handleSelectSkill?: (skill: Skill) => void;
  onUploadImage?: (file: File) => Promise<void>;
  onFocus?: () => void;
  contextItems?: any[];
}

const ChatInputComponent = forwardRef<HTMLDivElement, ChatInputProps>(
  (
    {
      query,
      setQuery,
      selectedSkillName,
      inputClassName,
      autoCompletionPlacement,
      maxRows,
      handleSendMessage,
      handleSelectSkill,
      onUploadImage,
      onFocus,
      contextItems = [],
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const { readonly } = useCanvasContext();
    const [isDragging, setIsDragging] = useState(false);

    const inputRef = useRef<RefTextAreaType>(null);
    const hasMatchedOptions = useRef(false);

    const searchStore = useSearchStoreShallow((state) => ({
      setIsSearchOpen: state.setIsSearchOpen,
    }));
    const { setSelectedSkill } = useSkillStoreShallow((state) => ({
      setSelectedSkill: state.setSelectedSkill,
    }));
    const { setContextItems } = useContextPanelStoreShallow((state) => ({
      setContextItems: state.setContextItems,
      contextItems: state.contextItems,
    }));

    const [showSkillSelector, setShowSkillSelector] = useState(false);
    const [showContextSelector, setShowContextSelector] = useState(false);
    const [options, setOptions] = useState<AutoCompleteProps['options']>([]);

    // Use our custom hook to get available context items
    const { getAvailableContextItems } = useAvailableContextItems();

    const handlePaste = useCallback(
      async (e: React.ClipboardEvent<HTMLDivElement | HTMLTextAreaElement>) => {
        if (readonly || !onUploadImage) {
          return;
        }

        const items = e.clipboardData?.items;

        if (!items?.length) {
          return;
        }

        for (const item of items) {
          if (item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            if (file) {
              await onUploadImage(file);
            }
            break;
          }
        }
      },
      [onUploadImage, readonly],
    );

    const skills = useListSkills();

    const skillOptions = useMemo(() => {
      return skills.map((skill) => ({
        value: skill.name,
        label: (
          <div className="flex items-center gap-2 h-6">
            {getSkillIcon(skill.name)}
            <span className="text-sm font-medium">{t(`${skill.name}.name`, { ns: 'skill' })}</span>
            <span className="text-sm text-gray-500">
              {t(`${skill.name}.description`, { ns: 'skill' })}
            </span>
          </div>
        ),
        textLabel: t(`${skill.name}.name`, { ns: 'skill' }),
      }));
    }, [t, skills]);

    // 确保引用稳定的上下文选项
    const computedContextOptions = useMemo(() => {
      return getAvailableContextItems(contextItems);
    }, [contextItems, getAvailableContextItems]);

    // 更新为一个更简单的处理键盘输入的方法
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (readonly) {
          e.preventDefault();
          return;
        }

        // When the user presses the '/' key, open the skill selector
        if (e.key === '/') {
          setOptions(skillOptions);
          setShowSkillSelector(true);
          setShowContextSelector(false);
          hasMatchedOptions.current = false;
          return;
        }

        // When the user presses the '@' key, open the context selector
        if (e.key === '@') {
          setOptions(computedContextOptions);
          setShowContextSelector(true);
          setShowSkillSelector(false);
          hasMatchedOptions.current = false;
          return;
        }

        // Handle Ctrl+K or Cmd+K to open search
        if (e.keyCode === 75 && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          searchStore.setIsSearchOpen(true);
          return;
        }

        // Handle the Enter key
        if (e.keyCode === 13) {
          // Shift + Enter creates a new line (let default behavior handle it)
          if (e.shiftKey) {
            return;
          }

          // Ctrl/Meta + Enter should always send the message regardless of skill selector
          if ((e.ctrlKey || e.metaKey) && query?.trim()) {
            e.preventDefault();
            handleSendMessage();
            return;
          }

          // For regular Enter key
          if (!e.shiftKey) {
            // enter should not be used to select when selectors are active and have options
            if (
              (showSkillSelector || showContextSelector) &&
              hasMatchedOptions.current &&
              options.length > 0
            ) {
              e.preventDefault();
              return;
            }

            // enter should send message when the query contains '//'
            if (query?.includes('//')) {
              e.preventDefault();
              if (query?.trim()) {
                handleSendMessage();
              }
              return;
            }

            // Otherwise send message on Enter
            e.preventDefault();
            if (query?.trim()) {
              handleSendMessage();
            }
          }
        }

        // Update selector states for keys other than navigation and special keys
        if (!['ArrowUp', 'ArrowDown', 'Enter', '/', '@'].includes(e.key)) {
          if (showSkillSelector) {
            setShowSkillSelector(false);
          }
          if (showContextSelector) {
            setShowContextSelector(false);
          }
        }
      },
      [
        query,
        readonly,
        skillOptions,
        computedContextOptions,
        showSkillSelector,
        showContextSelector,
        options,
        searchStore,
        handleSendMessage,
      ],
    );

    const handleInputChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setQuery(value);

        // 检测输入中的 / 和 @，并实时更新选项
        const lastSlashIndex = value.lastIndexOf('/');
        const lastAtIndex = value.lastIndexOf('@');

        if (lastSlashIndex !== -1) {
          const afterSlash = value.slice(lastSlashIndex + 1);
          if (!afterSlash.includes('/')) {
            setOptions(skillOptions);
            setShowSkillSelector(true);
            setShowContextSelector(false);
          } else {
            setShowSkillSelector(false);
          }
        } else if (lastAtIndex !== -1) {
          const afterAt = value.slice(lastAtIndex + 1);
          if (!afterAt.includes('@')) {
            setOptions(computedContextOptions);
            setShowContextSelector(true);
            setShowSkillSelector(false);
          } else {
            setShowContextSelector(false);
          }
        } else {
          setOptions([]);
          setShowSkillSelector(false);
          setShowContextSelector(false);
        }
      },
      [setQuery, skillOptions, computedContextOptions],
    );

    const handleSearchListConfirm = useCallback(
      (value: string) => {
        setOptions([]);
        setShowSkillSelector(false);
        const skill = skills.find((skill) => skill.name === value);
        if (!skill) {
          return;
        }
        if (handleSelectSkill) {
          handleSelectSkill(skill);
        } else {
          const lastSlashIndex = query.lastIndexOf('/');
          const prefix = lastSlashIndex !== -1 ? query.slice(0, lastSlashIndex) : '';
          setQuery(prefix);
          setSelectedSkill(skill);
        }
      },
      [skills, setSelectedSkill, handleSelectSkill, query, setQuery],
    );

    const handleContextSelect = useCallback(
      (value: string) => {
        setOptions([]);
        setShowContextSelector(false);

        // Find the selected node from computedContextOptions
        const contextOption = computedContextOptions.find((opt) => opt.value === value);
        if (!contextOption || !contextOption.nodeData) {
          return;
        }

        // Add the node to context items
        const node = contextOption.nodeData;
        const newContextItem = {
          title: node.data?.title || 'Untitled',
          entityId: node.id,
          type: node.type,
          metadata: node.data?.metadata,
        };

        // Add to context items and update the store
        setContextItems([...contextItems, newContextItem]);

        // Replace @mention with empty text
        const lastAtIndex = query.lastIndexOf('@');
        const prefix = lastAtIndex !== -1 ? query.slice(0, lastAtIndex) : query;
        const suffix = lastAtIndex !== -1 ? query.slice(lastAtIndex + value.length + 1) : '';
        setQuery(prefix + suffix);
      },
      [computedContextOptions, contextItems, setContextItems, query, setQuery],
    );

    const filterOption = useCallback(
      (inputValue: string, option: any) => {
        let searchVal = '';

        if (showSkillSelector) {
          const lastSlashIndex = inputValue.lastIndexOf('/');
          searchVal =
            lastSlashIndex !== -1 ? inputValue.slice(lastSlashIndex + 1).toLowerCase() : '';
        } else if (showContextSelector) {
          const lastAtIndex = inputValue.lastIndexOf('@');
          searchVal = lastAtIndex !== -1 ? inputValue.slice(lastAtIndex + 1).toLowerCase() : '';
        }

        const isMatch =
          !searchVal ||
          option.value.toString().toLowerCase().includes(searchVal) ||
          option.textLabel.toLowerCase().includes(searchVal);

        if (isMatch) {
          hasMatchedOptions.current = true;
        }
        return isMatch;
      },
      [showSkillSelector, showContextSelector],
    );

    const onSelect = useCallback(
      (value: string) => {
        if (readonly) return;

        if (showSkillSelector) {
          handleSearchListConfirm(value);
        } else if (showContextSelector) {
          handleContextSelect(value);
        }
      },
      [
        readonly,
        showSkillSelector,
        showContextSelector,
        handleSearchListConfirm,
        handleContextSelect,
      ],
    );

    // Handle focus event and propagate it upward
    const handleFocus = useCallback(() => {
      if (onFocus && !readonly) {
        onFocus();
      }
    }, [onFocus, readonly]);

    return (
      <div
        ref={ref}
        className={cn(
          'w-full h-full flex flex-col flex-grow overflow-y-auto relative',
          isDragging && 'ring-2 ring-green-500 ring-opacity-50 rounded-lg',
          readonly && 'opacity-70 cursor-not-allowed',
        )}
        onPaste={handlePaste}
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

          if (!onUploadImage) return;

          const files = Array.from(e.dataTransfer.files);
          const imageFile = files.find((file) => file.type.startsWith('image/'));

          if (imageFile) {
            try {
              await onUploadImage(imageFile);
            } catch (error) {
              console.error('Failed to upload image:', error);
            }
          }
        }}
      >
        {isDragging && !readonly && (
          <div className="absolute inset-0 bg-green-50/50 flex items-center justify-center pointer-events-none z-10 rounded-lg border-2 border-green-500/30">
            <div className="text-green-600 text-sm font-medium">{t('common.dropImageHere')}</div>
          </div>
        )}
        <AutoComplete
          className="h-full"
          autoFocus={!readonly}
          open={(showSkillSelector || showContextSelector) && !readonly}
          options={options}
          popupMatchSelectWidth={false}
          placement={autoCompletionPlacement}
          value={query}
          disabled={readonly}
          filterOption={filterOption}
          onSelect={onSelect}
        >
          <TextArea
            style={{ paddingLeft: 0, paddingRight: 0, height: '100%' }}
            ref={inputRef}
            autoFocus={!readonly}
            disabled={readonly}
            onFocus={handleFocus}
            onBlur={() => {
              setTimeout(() => {
                setShowSkillSelector(false);
                setShowContextSelector(false);
              }, 100);
            }}
            value={query ?? ''}
            onChange={handleInputChange}
            onKeyDownCapture={handleKeyDown}
            onPaste={(e) => {
              if (readonly) return;
              if (e.clipboardData?.items) {
                for (const item of e.clipboardData.items) {
                  if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    e.stopPropagation();
                    break;
                  }
                }
              }
            }}
            className={cn(
              '!m-0 bg-transparent outline-none box-border border-none resize-none focus:outline-none focus:shadow-none focus:border-none',
              inputClassName,
              readonly && 'cursor-not-allowed !text-black !bg-transparent',
            )}
            placeholder={
              selectedSkillName
                ? t(`${selectedSkillName}.placeholder`, {
                    ns: 'skill',
                    defaultValue: t('commonQnA.placeholder', { ns: 'skill' }),
                  })
                : t('commonQnA.placeholder', { ns: 'skill' })
            }
            autoSize={{
              minRows: 1,
              maxRows: maxRows ?? 6,
            }}
            data-cy="chat-input"
          />
        </AutoComplete>
      </div>
    );
  },
);

ChatInputComponent.displayName = 'ChatInputComponent';

export const ChatInput = memo(ChatInputComponent, (prevProps, nextProps) => {
  return (
    prevProps.query === nextProps.query &&
    prevProps.selectedSkillName === nextProps.selectedSkillName &&
    prevProps.handleSelectSkill === nextProps.handleSelectSkill &&
    prevProps.onUploadImage === nextProps.onUploadImage &&
    prevProps.onFocus === nextProps.onFocus &&
    JSON.stringify(prevProps.contextItems) === JSON.stringify(nextProps.contextItems)
  );
}) as typeof ChatInputComponent;

ChatInput.displayName = 'ChatInput';
