import { Check, ChevronDown } from 'lucide-react';
import { EditorBubbleItem, EditorInstance, useEditor } from '../../core/components';
import { useTranslation } from 'react-i18next';
import { Button, Popover } from 'antd';
import './color-selector.scss';

interface BubbleColorMenuItem {
  name: string;
  color: string;
}

const TEXT_COLORS: BubbleColorMenuItem[] = [
  {
    name: 'default',
    color: 'var(--novel-black)',
  },
  {
    name: 'purple',
    color: '#9333EA',
  },
  {
    name: 'red',
    color: '#E00000',
  },
  {
    name: 'yellow',
    color: '#EAB308',
  },
  {
    name: 'blue',
    color: '#2563EB',
  },
  {
    name: 'green',
    color: '#008A00',
  },
  {
    name: 'orange',
    color: '#FFA500',
  },
  {
    name: 'pink',
    color: '#BA4081',
  },
  {
    name: 'gray',
    color: '#A8A29E',
  },
];

const HIGHLIGHT_COLORS: BubbleColorMenuItem[] = [
  {
    name: 'default',
    color: 'var(--novel-highlight-default)',
  },
  {
    name: 'purple',
    color: 'var(--novel-highlight-purple)',
  },
  {
    name: 'red',
    color: 'var(--novel-highlight-red)',
  },
  {
    name: 'yellow',
    color: 'var(--novel-highlight-yellow)',
  },
  {
    name: 'blue',
    color: 'var(--novel-highlight-blue)',
  },
  {
    name: 'green',
    color: 'var(--novel-highlight-green)',
  },
  {
    name: 'orange',
    color: 'var(--novel-highlight-orange)',
  },
  {
    name: 'pink',
    color: 'var(--novel-highlight-pink)',
  },
  {
    name: 'gray',
    color: 'var(--novel-highlight-gray)',
  },
];

interface ColorSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerEditor?: EditorInstance;
}

export const ColorSelector = ({ open, onOpenChange, triggerEditor }: ColorSelectorProps) => {
  const { t } = useTranslation();

  const { editor: currentEditor } = useEditor();
  const editor = triggerEditor || currentEditor;

  if (!editor) return null;
  const activeColorItem = TEXT_COLORS.find(({ color }) => editor?.isActive('textStyle', { color }));
  const activeHighlightItem = HIGHLIGHT_COLORS.find(({ color }) =>
    editor?.isActive('highlight', { color }),
  );

  const content = (
    <div className="flex max-h-80 w-38 flex-col overflow-hidden overflow-y-auto p-3">
      <div className="flex flex-col">
        <div className="my-1 px-2 text-xs font-semibold text-muted-foreground">
          {t('editor.colorSelector.color')}
        </div>
        {TEXT_COLORS?.map(({ name, color }) => (
          <EditorBubbleItem
            key={name}
            triggerEditor={triggerEditor}
            onSelect={() => {
              editor?.commands.unsetColor();
              if (name !== 'default') {
                editor
                  ?.chain()
                  .focus()
                  .setColor(color ?? '')
                  .run();

                // Force the editor to trigger an update event
                setTimeout(() => {
                  editor?.commands.focus();
                }, 0);
              }
            }}
            className="flex cursor-pointer items-center justify-between px-2 py-1 text-sm hover:bg-accent"
          >
            <div className="flex items-center gap-2 text-xs">
              <div className="rounded-sm border px-2 py-px font-medium" style={{ color }}>
                A
              </div>
              <span>{t(`editor.colorSelector.${name}`)}</span>
            </div>
          </EditorBubbleItem>
        ))}
      </div>
      <div>
        <div className="my-1 px-2 text-xs font-semibold text-muted-foreground">
          {t('editor.colorSelector.background')}
        </div>
        {HIGHLIGHT_COLORS?.map(({ name, color }) => (
          <EditorBubbleItem
            key={name}
            triggerEditor={triggerEditor}
            onSelect={() => {
              editor?.commands.unsetHighlight();
              if (name !== 'default') {
                editor?.commands.setHighlight({ color });

                // Force the editor to trigger an update event
                setTimeout(() => {
                  editor?.commands.focus();
                }, 0);
              }
            }}
            className="flex cursor-pointer items-center justify-between px-2 py-1 text-sm hover:bg-accent"
          >
            <div className="flex items-center gap-2 text-xs">
              <div
                className="rounded-sm border px-2 py-px font-medium"
                style={{ backgroundColor: color }}
              >
                A
              </div>
              <span>{t(`editor.colorSelector.${name}`)}</span>
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
