import { Input } from 'antd';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { RefTextAreaType } from '@arco-design/web-react/es/Input/textarea';
import { useSearchStoreShallow } from '@refly-packages/ai-workspace-common/stores/search';
import type { Skill } from '@refly/openapi-schema';

const TextArea = Input.TextArea;

interface ChatInputProps {
  query: string;
  setQuery: (text: string) => void;
  selectedSkill: Skill | null;
  handleSendMessage: () => void;
}

export const ChatInput = ({ query, setQuery, selectedSkill, handleSendMessage }: ChatInputProps) => {
  const { t } = useTranslation();
  const inputRef = useRef<RefTextAreaType>(null);
  const searchStore = useSearchStoreShallow((state) => ({
    setIsSearchOpen: state.setIsSearchOpen,
  }));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!query?.trim()) {
      if (e.keyCode === 13) {
        e.preventDefault();
        return;
      }
      return;
    }

    const preventEmptyLine = () => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        e.preventDefault();

        const cursorPos = e.target.selectionStart ?? 0;
        const text = query;

        const newValue = text.slice(0, cursorPos) + '\n' + text.slice(cursorPos);
        setQuery(newValue);

        setTimeout(() => {
          if (e.target instanceof HTMLTextAreaElement) {
            e.target.selectionStart = e.target.selectionEnd = cursorPos + 1;
          }
        }, 0);
      }
    };

    if (e.keyCode === 13) {
      if (e.ctrlKey || e.shiftKey || e.metaKey) {
        preventEmptyLine();
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
  };

  return (
    <div className="w-full flex flex-col">
      <TextArea
        ref={inputRef}
        autoFocus
        value={query === '' ? '' : query}
        onChange={(e) => {
          setQuery(e.target.value);
        }}
        onKeyDownCapture={(e) => handleKeyDown(e)}
        className="m-1 mb-0 bg-transparent outline-none border-none resize-none focus:outline-none focus:shadow-none focus:border-none"
        placeholder={
          selectedSkill
            ? t(`${selectedSkill?.name}.placeholder`, {
                ns: 'skill',
                defaultValue: t(`commonQnA.placeholder`, { ns: 'skill' }),
              })
            : t(`commonQnA.placeholder`, { ns: 'skill' })
        }
        autoSize={{
          minRows: 1,
          maxRows: 6,
        }}
      />
    </div>
  );
};
