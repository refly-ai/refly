import { Button, Popover } from 'antd';
import { Check, Trash } from 'lucide-react';
import { useEditor, EditorInstance } from '../../core/components';
import { useEffect, useRef } from 'react';
import { Link as LucideLink } from 'lucide-react';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const { editor: currentEditor } = useEditor();
  const editor = triggerEditor || currentEditor;

  useEffect(() => {
    inputRef.current?.focus();
  });

  if (!editor) return null;

  const content = (
    <form
      onSubmit={(e) => {
        const target = e.currentTarget as HTMLFormElement;
        e.preventDefault();
        const input = target[0] as HTMLInputElement;
        const url = getUrlFromString(input.value);
        url && editor?.chain().focus().setLink({ href: url }).run();
      }}
      className="flex w-60 p-1"
    >
      <input
        ref={inputRef}
        type="text"
        placeholder="Paste a link"
        className="flex-1 bg-background p-1 text-sm outline-none border-none"
        defaultValue={editor?.getAttributes('link').href ?? ''}
      />
      {editor?.getAttributes('link').href ? (
        <Button
          size="small"
          type="text"
          className="flex h-8 items-center rounded-sm p-1 text-red-600 transition-all hover:bg-red-100 dark:hover:bg-red-800"
          onClick={() => {
            editor?.chain().focus().unsetLink().run();
            if (inputRef.current) {
              inputRef.current.value = '';
            }
          }}
        >
          <Trash className="h-4 w-4" />
        </Button>
      ) : (
        <Button size="small" type="text">
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
      <Button type="text" className="gap-2 rounded-none border-none px-2">
        <LucideLink className="h-4 w-4 font-medium" />
      </Button>
    </Popover>
  );
};
