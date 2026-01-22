import { SVGProps } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { EditorBubbleItem, EditorInstance, useEditor } from '../../core/components';
import { LuCode, LuList, LuListOrdered, LuListTodo } from 'react-icons/lu';
import { RiH1, RiH2, RiH3, RiQuoteText, RiText } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import { Button, Popover } from 'antd';

type SelectorItem = {
  name: string;
  icon: (props: SVGProps<SVGSVGElement>) => React.ReactNode;
  command: (editor: ReturnType<typeof useEditor>['editor']) => void;
  isActive: (editor: ReturnType<typeof useEditor>['editor']) => boolean;
};

const items: SelectorItem[] = [
  {
    name: 'text',
    icon: RiText,
    command: (editor) => editor.chain().focus().clearNodes().run(),
    // I feel like there has to be a more efficient way to do this – feel free to PR if you know how!
    isActive: (editor) =>
      editor.isActive('paragraph') &&
      !editor.isActive('bulletList') &&
      !editor.isActive('orderedList'),
  },
  {
    name: 'heading1',
    icon: RiH1,
    command: (editor) => editor.chain().focus().clearNodes().toggleHeading({ level: 1 }).run(),
    isActive: (editor) => editor.isActive('heading', { level: 1 }),
  },
  {
    name: 'heading2',
    icon: RiH2,
    command: (editor) => editor.chain().focus().clearNodes().toggleHeading({ level: 2 }).run(),
    isActive: (editor) => editor.isActive('heading', { level: 2 }),
  },
  {
    name: 'heading3',
    icon: RiH3,
    command: (editor) => editor.chain().focus().clearNodes().toggleHeading({ level: 3 }).run(),
    isActive: (editor) => editor.isActive('heading', { level: 3 }),
  },
  {
    name: 'toDoList',
    icon: LuListTodo,
    command: (editor) => editor.chain().focus().clearNodes().toggleTaskList().run(),
    isActive: (editor) => editor.isActive('taskItem'),
  },
  {
    name: 'bulletList',
    icon: LuList,
    command: (editor) => editor.chain().focus().clearNodes().toggleBulletList().run(),
    isActive: (editor) => editor.isActive('bulletList'),
  },
  {
    name: 'numberedList',
    icon: LuListOrdered,
    command: (editor) => editor.chain().focus().clearNodes().toggleOrderedList().run(),
    isActive: (editor) => editor.isActive('orderedList'),
  },
  {
    name: 'quote',
    icon: RiQuoteText,
    command: (editor) => editor.chain().focus().clearNodes().toggleBlockquote().run(),
    isActive: (editor) => editor.isActive('blockquote'),
  },
  {
    name: 'code',
    icon: LuCode,
    command: (editor) => editor.chain().focus().clearNodes().toggleCodeBlock().run(),
    isActive: (editor) => editor.isActive('codeBlock'),
  },
];

interface NodeSelectorProps {
  triggerEditor?: EditorInstance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NodeSelector = ({ triggerEditor, open, onOpenChange }: NodeSelectorProps) => {
  const { t } = useTranslation();
  const { editor: currentEditor } = useEditor();
  const editor = triggerEditor || currentEditor;
  if (!editor) return null;
  const activeItem = items.filter((item) => item.isActive(editor)).pop() ?? items[0];

  const content = (
    <div className="w-38">
      {items.map((item) => (
        <EditorBubbleItem
          triggerEditor={triggerEditor}
          key={item.name}
          onSelect={(editor) => {
            item.command(editor);
            onOpenChange(false);
          }}
          className="flex cursor-pointer items-center justify-between rounded-sm p-1 text-xs hover:bg-gray-100"
        >
          <div className="flex items-center space-x-2">
            <div className="rounded-sm border p-1 flex items-center justify-center">
              <item.icon className="h-3 w-3" />
            </div>
            <span className="text-xs">{t(`editor.nodeSelector.${item.name}`)}</span>
          </div>
          {activeItem.name === item.name && <Check className="h-3.5 w-3.5" />}
        </EditorBubbleItem>
      ))}
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      content={content}
      trigger="click"
      placement="bottom"
      className="flex items-center"
      overlayClassName="editor-node-selector-popover"
    >
      <Button type="text" className="gap-0.5 flex items-center space-x-1 px-2 rounded-none">
        <activeItem.icon className="h-3.5 w-3.5" />
        <ChevronDown className="h-3 w-3" />
      </Button>
    </Popover>
  );
};
