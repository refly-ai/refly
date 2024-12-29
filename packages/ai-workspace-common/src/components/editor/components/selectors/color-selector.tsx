import { Check, ChevronDown } from 'lucide-react';
import { EditorBubbleItem, EditorInstance, useEditor } from '../../core/components';

import { Button, Popover } from 'antd';

export interface BubbleColorMenuItem {
  name: string;
  color: string;
}

const TEXT_COLORS: BubbleColorMenuItem[] = [
  {
    name: 'Default',
    color: 'var(--novel-black)',
  },
  {
    name: 'Purple',
    color: '#9333EA',
  },
  {
    name: 'Red',
    color: '#E00000',
  },
  {
    name: 'Yellow',
    color: '#EAB308',
  },
  {
    name: 'Blue',
    color: '#2563EB',
  },
  {
    name: 'Green',
    color: '#008A00',
  },
  {
    name: 'Orange',
    color: '#FFA500',
  },
  {
    name: 'Pink',
    color: '#BA4081',
  },
  {
    name: 'Gray',
    color: '#A8A29E',
  },
];

const HIGHLIGHT_COLORS: BubbleColorMenuItem[] = [
  {
    name: 'Default',
    color: 'var(--novel-highlight-default)',
  },
  {
    name: 'Purple',
    color: 'var(--novel-highlight-purple)',
  },
  {
    name: 'Red',
    color: 'var(--novel-highlight-red)',
  },
  {
    name: 'Yellow',
    color: 'var(--novel-highlight-yellow)',
  },
  {
    name: 'Blue',
    color: 'var(--novel-highlight-blue)',
  },
  {
    name: 'Green',
    color: 'var(--novel-highlight-green)',
  },
  {
    name: 'Orange',
    color: 'var(--novel-highlight-orange)',
  },
  {
    name: 'Pink',
    color: 'var(--novel-highlight-pink)',
  },
  {
    name: 'Gray',
    color: 'var(--novel-highlight-gray)',
  },
];

interface ColorSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerEditor?: EditorInstance;
}

export const ColorSelector = ({ open, onOpenChange, triggerEditor }: ColorSelectorProps) => {
  const { editor: currentEditor } = useEditor();
  const editor = triggerEditor || currentEditor;

  if (!editor) return null;
  const activeColorItem = TEXT_COLORS.find(({ color }) => editor?.isActive('textStyle', { color }));
  const activeHighlightItem = HIGHLIGHT_COLORS.find(({ color }) => editor?.isActive('highlight', { color }));

  const content = (
    <div className="flex max-h-80 w-38 flex-col overflow-hidden overflow-y-auto">
      <div className="flex flex-col">
        <div className="my-1 px-2 text-xs font-semibold text-muted-foreground">Color</div>
        {TEXT_COLORS?.map(({ name, color }) => (
          <EditorBubbleItem
            key={name}
            triggerEditor={triggerEditor}
            onSelect={() => {
              editor?.commands.unsetColor();
              name !== 'Default' &&
                editor
                  ?.chain()
                  .focus()
                  .setColor(color ?? '')
                  .run();
            }}
            className="flex cursor-pointer items-center justify-between px-2 py-1 text-sm hover:bg-accent"
          >
            <div className="flex items-center gap-2 text-xs">
              <div className="rounded-sm border px-2 py-px font-medium" style={{ color }}>
                A
              </div>
              <span>{name}</span>
            </div>
          </EditorBubbleItem>
        ))}
      </div>
      <div>
        <div className="my-1 px-2 text-xs font-semibold text-muted-foreground">Background</div>
        {HIGHLIGHT_COLORS?.map(({ name, color }) => (
          <EditorBubbleItem
            key={name}
            triggerEditor={triggerEditor}
            onSelect={() => {
              editor?.commands.unsetHighlight();
              name !== 'Default' && editor?.commands.setHighlight({ color });
            }}
            className="flex cursor-pointer items-center justify-between px-2 py-1 text-sm hover:bg-accent"
          >
            <div className="flex items-center gap-2 text-xs">
              <div className="rounded-sm border px-2 py-px font-medium" style={{ backgroundColor: color }}>
                A
              </div>
              <span>{name}</span>
            </div>
            {editor?.isActive('highlight', { color }) && <Check className="h-4 w-4" />}
          </EditorBubbleItem>
        ))}
      </div>
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      content={content}
      trigger="click"
      placement="bottom"
      overlayClassName="editor-color-popover"
    >
      <Button type="text" className="gap-0.5 rounded-none pl-1 pr-2">
        <span
          className="rounded-sm px-1 text-sm font-normal"
          style={{
            color: activeColorItem?.color,
            backgroundColor: activeHighlightItem?.color,
          }}
        >
          A
        </span>
        <ChevronDown className="h-3 w-3 font-normal" />
      </Button>
    </Popover>
  );
};
