import { AutoComplete, AutoCompleteProps, Input } from 'antd';
import { memo, useRef, useMemo, useState, useCallback, forwardRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import { useSearchStoreShallow } from '@refly-packages/ai-workspace-common/stores/search';
import type { Skill } from '@refly/openapi-schema';
import { useSkillStoreShallow } from '@refly-packages/ai-workspace-common/stores/skill';
import { cn } from '@refly/utils/cn';
import { useListSkills } from '@refly-packages/ai-workspace-common/hooks/use-find-skill';
import { getSkillIcon } from '@refly-packages/ai-workspace-common/components/common/icon';

const TextArea = Input.TextArea;

interface ChatInputProps {
  readonly: boolean;
  query: string;
  setQuery: (text: string) => void;
  selectedSkillName: string | null;
  inputClassName?: string;
  maxRows?: number;
  minRows?: number;
  autoCompletionPlacement?: 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight';
  handleSendMessage: () => void;
  handleSelectSkill?: (skill: Skill) => void;
  onUploadImage?: (file: File) => Promise<void>;
  onUploadMultipleImages?: (files: File[]) => Promise<void>;
  onFocus?: () => void;
}

const ChatInputComponent = forwardRef<HTMLDivElement, ChatInputProps>(
  (
    {
      readonly,
      query,
      setQuery,
      selectedSkillName,
      inputClassName,
      autoCompletionPlacement,
      maxRows,
      minRows,
      handleSendMessage,
      handleSelectSkill,
      onUploadImage,
      onUploadMultipleImages,
      onFocus,
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const [isDragging, setIsDragging] = useState(false);
    const [isMac, setIsMac] = useState(false);

    useEffect(() => {
      // Detect if user is on macOS
      setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);
    }, []);

    const inputRef = useRef<TextAreaRef>(null);
    const hasMatchedOptions = useRef(false);

    const searchStore = useSearchStoreShallow((state) => ({
      setIsSearchOpen: state.setIsSearchOpen,
    }));
    const { setSelectedSkill } = useSkillStoreShallow((state) => ({
      setSelectedSkill: state.setSelectedSkill,
    }));
    const [showSkillSelector, setShowSkillSelector] = useState(false);

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

    const [options, setOptions] = useState<AutoCompleteProps['options']>([]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (readonly) {
          e.preventDefault();
          return;
        }

        // When the user presses Ctrl+/ or Cmd+/ key, open the skill selector
        if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          setQuery(`${query}/`);
          setShowSkillSelector(true);
          setOptions(skillOptions);
          hasMatchedOptions.current = true;
          return;
        }

        // Handle Ctrl+K or Cmd+K to open search
        if (e.keyCode === 75 && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          searchStore.setIsSearchOpen(true);
        }

        // Only intercept ArrowUp and ArrowDown when skill selector is active and has options
        if (
          (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
          showSkillSelector &&
          hasMatchedOptions.current &&
          options.length > 0
        ) {
          // Allow the default behavior for AutoComplete navigation
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
            // enter should not be used to select when the skill selector is active and has options
            if (showSkillSelector && hasMatchedOptions.current && options.length > 0) {
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

        // Update the skill selector state - exclude navigation keys to allow proper navigation
        const navigationKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'];
        if (
          !navigationKeys.includes(e.key) &&
          !(e.key === '/' && (e.ctrlKey || e.metaKey)) &&
          showSkillSelector
        ) {
          setShowSkillSelector(false);
        }
      },
      [query, readonly, showSkillSelector, options, handleSendMessage, searchStore, skillOptions],
    );

    const handleInputChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setQuery(value);
      },
      [setQuery],
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
          setQuery('');
          setSelectedSkill(skill);
        }
      },
      [skills, setSelectedSkill, handleSelectSkill, setQuery],
    );

    const filterOption = useCallback(
      (inputValue: string, option: any) => {
        // Ctrl+/ was just pressed, show all options
        if (showSkillSelector && inputValue === query) {
          return true;
        }

        const searchVal = inputValue.toLowerCase();
        const isMatch =
          !searchVal ||
          option.value.toString().toLowerCase().includes(searchVal) ||
          option.textLabel.toLowerCase().includes(searchVal);

        if (isMatch) {
          hasMatchedOptions.current = true;
        }
        return isMatch;
      },
      [showSkillSelector, query],
    );

    const onSelect = useCallback(
      (value: string) => {
        if (!readonly) handleSearchListConfirm(value);
      },
      [readonly, handleSearchListConfirm],
    );

    // Handle focus event and propagate it upward, then move cursor to end
    const handleFocus = useCallback(() => {
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
    }, [onFocus, readonly]);

    // Get placeholder dynamically based on OS
    const getPlaceholder = useCallback(
      (skillName: string | null) => {
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
      },
      [t, isMac],
    );

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
      >
        {isDragging && !readonly && (
          <div className="absolute inset-0 bg-green-50/50 flex items-center justify-center pointer-events-none z-10 rounded-lg border-2 border-green-500/30">
            <div className="text-green-600 text-sm font-medium">{t('common.dropImageHere')}</div>
          </div>
        )}
        {showSkillSelector && !readonly ? (
          <AutoComplete
            className="h-full"
            autoFocus={!readonly}
            open={true}
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
                }, 100);
              }}
              value={query ?? ''}
              onChange={handleInputChange}
              onKeyDownCapture={handleKeyDown}
              onPaste={handlePaste}
              className={cn(
                '!m-0 bg-transparent outline-none box-border border-none resize-none focus:outline-none focus:shadow-none focus:border-none focus',
                inputClassName,
                readonly && 'cursor-not-allowed !text-black !bg-transparent',
                'dark:hover:bg-transparent dark:hover:!bg-none dark:focus:bg-transparent dark:active:bg-transparent dark:bg-transparent dark:!bg-transparent',
              )}
              placeholder={getPlaceholder(selectedSkillName)}
              autoSize={{
                minRows: minRows ?? 1,
                maxRows: maxRows ?? 6,
              }}
              data-cy="chat-input"
            />
          </AutoComplete>
        ) : (
          <TextArea
            style={{ paddingLeft: 0, paddingRight: 0, height: '100%' }}
            ref={inputRef}
            autoFocus={!readonly}
            disabled={readonly}
            onFocus={handleFocus}
            onBlur={() => {
              setTimeout(() => {
                setShowSkillSelector(false);
              }, 100);
            }}
            value={query ?? ''}
            onChange={handleInputChange}
            onKeyDownCapture={handleKeyDown}
            onPaste={handlePaste}
            className={cn(
              '!m-0 bg-transparent outline-none box-border border-none resize-none focus:outline-none focus:shadow-none focus:border-none',
              inputClassName,
              readonly && 'cursor-not-allowed !text-black !bg-transparent',
              'dark:hover:bg-transparent dark:hover:!bg-none dark:focus:bg-transparent dark:active:bg-transparent dark:bg-transparent dark:!bg-transparent',
            )}
            placeholder={getPlaceholder(selectedSkillName)}
            autoSize={{
              minRows: minRows ?? 1,
              maxRows: maxRows ?? 6,
            }}
            data-cy="chat-input"
          />
        )}
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
    prevProps.onUploadMultipleImages === nextProps.onUploadMultipleImages &&
    prevProps.onFocus === nextProps.onFocus
  );
}) as typeof ChatInputComponent;

ChatInput.displayName = 'ChatInput';
