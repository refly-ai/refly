import { Button, Popover, Input } from 'antd';
import { Check, Trash } from 'lucide-react';
import { useEditor, EditorInstance } from '../../core/components';
import { useEffect, useRef, useState } from 'react';
import { Link as LucideLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { InputRef } from 'antd';

export function isValidUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch (_e) {
    return false;
  }
}
export function getUrlFromString(str: string) {
  if (isValidUrl(str)) return str;
  try {
    if (str.includes('.') && !str.includes(' ')) {
      return new URL(`https://${str}`).toString();
    }
  } catch (_e) {
    return null;
  }
}
interface LinkSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerEditor?: EditorInstance;
}

export const LinkSelector = ({ open, onOpenChange, triggerEditor }: LinkSelectorProps) => {
  const { t } = useTranslation();
  const inputRef = useRef<InputRef>(null);
  const { editor: currentEditor } = useEditor();
  const editor = triggerEditor || currentEditor;
  const [inputValue, setInputValue] = useState<string>(editor?.getAttributes('link').href ?? '');

  const handleSubmit = () => {
    const url = getUrlFromString(inputValue);
    url && editor?.chain().focus().setLink({ href: url }).run();
  };

  useEffect(() => {
    inputRef.current?.focus();
  });

  if (!editor) return null;

  const content = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="flex w-60 p-1"
    >
      <Input
        ref={inputRef}
        type="text"
        onChange={(e) => {
          setInputValue(e.target.value);
        }}
        placeholder={t('editor.linkSelector.placeholder')}
        className="flex-1 bg-background p-1 text-sm outline-none border-none"
        defaultValue={editor?.getAttributes('link').href ?? ''}
      />
      {editor?.getAttributes('link').href ? (
        <Button
          size="small"
          type="text"
          className="flex h-8 items-center rounded-sm p-1 text-red-600 transition-all hover:bg-red-100"
          onClick={() => {
            editor?.chain().focus().unsetLink().run();
            if (inputRef.current) {
              inputRef.current.input.value = '';
            }
          }}
        >
          <Trash className="h-4 w-4" />
        </Button>
      ) : (
        <Button size="small" type="text" className="h-8 rounded-sm p-1" onClick={handleSubmit}>
          <Check className="h-4 w-4" />
        </Button>
      )}
    </form>
  );

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      content={content}
      trigger="click"
      placement="bottom"
      overlayClassName="editor-link-popover"
    >
      <Button type="text" className="gap-2 rounded-none border-none px-1.5">
        <LucideLink className="h-3.5 w-3.5 font-medium" />
      </Button>
    </Popover>
  );
};
