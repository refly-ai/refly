import { AutoComplete, AutoCompleteProps, Input } from 'antd';
import { memo, useRef, useMemo, useState, useCallback, forwardRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { RefTextAreaType } from '@arco-design/web-react/es/Input/textarea';
import { useSearchStoreShallow } from '@refly-packages/ai-workspace-common/stores/search';
import type { Skill } from '@refly/openapi-schema';
import { useSkillStoreShallow } from '@refly-packages/ai-workspace-common/stores/skill';
import { cn } from '@refly-packages/utils/cn';
import { useListSkills } from '@refly-packages/ai-workspace-common/hooks/use-find-skill';
import { getSkillIcon } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

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
    const [showSkillSelector, setShowSkillSelector] = useState(false);

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

    const [options, setOptions] = useState<AutoCompleteProps['options']>([]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (readonly) {
          e.preventDefault();
          return;
        }

        if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !showSkillSelector) {
          e.stopPropagation();
          return;
        }

        if (e.key === '/') {
          setShowSkillSelector(true);
        } else if (!['ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
          showSkillSelector && setShowSkillSelector(false);
        }

        if (e.keyCode === 13) {
          if (showSkillSelector && hasMatchedOptions.current) {
            e.preventDefault();
            return;
          }

          if (e.ctrlKey || e.shiftKey || e.metaKey) {
            e.preventDefault();
            if (e.target instanceof HTMLTextAreaElement) {
              const cursorPos = e.target.selectionStart ?? 0;
              const newValue = `${query.slice(0, cursorPos)}\n${query.slice(cursorPos)}`;
              setQuery(newValue);
              setTimeout(() => {
                if (e.target instanceof HTMLTextAreaElement) {
                  e.target.selectionStart = e.target.selectionEnd = cursorPos + 1;
                }
              }, 0);
            }
          } else {
            e.preventDefault();
            if (query?.trim()) {
              handleSendMessage();
            }
          }
        }

        if (e.keyCode === 75 && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          searchStore.setIsSearchOpen(true);
        }
      },
      [query, readonly, showSkillSelector, setQuery, handleSendMessage, searchStore],
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
          const lastSlashIndex = query.lastIndexOf('/');
          const prefix = lastSlashIndex !== -1 ? query.slice(0, lastSlashIndex) : '';
          setQuery(prefix);
          setSelectedSkill(skill);
        }
      },
      [skills, setSelectedSkill, handleSelectSkill, query, setQuery],
    );

    // Update options when query changes and contains a slash
    useEffect(() => {
      const lastSlashIndex = query.lastIndexOf('/');
      if (lastSlashIndex !== -1) {
        setOptions(skillOptions);
        setShowSkillSelector(true);
      } else if (showSkillSelector) {
        setOptions([]);
        setShowSkillSelector(false);
      }
    }, [query, skillOptions, showSkillSelector]);

    const filterOption = useCallback((inputValue: string, option: any) => {
      const lastSlashIndex = inputValue.lastIndexOf('/');
      const searchText = lastSlashIndex !== -1 ? inputValue.slice(lastSlashIndex + 1) : inputValue;
      const searchVal = searchText.toLowerCase();
      const isMatch =
        !searchVal ||
        option.value.toString().toLowerCase().includes(searchVal) ||
        option.textLabel.toLowerCase().includes(searchVal);

      if (isMatch) {
        hasMatchedOptions.current = true;
      }
      return isMatch;
    }, []);

    const onSelect = useCallback(
      (value: string) => {
        if (!readonly) handleSearchListConfirm(value);
      },
      [readonly, handleSearchListConfirm],
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
          open={showSkillSelector && !readonly}
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
    prevProps.onFocus === nextProps.onFocus
  );
}) as typeof ChatInputComponent;

ChatInput.displayName = 'ChatInput';
