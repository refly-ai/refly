import { SVGProps } from 'react';
import { ChevronDown } from 'lucide-react';
import { EditorBubbleItem, EditorInstance, useEditor } from '../../core/components';
import { HiOutlineTableCells } from 'react-icons/hi2';
import { Button, Popover } from 'antd';
import { useTranslation } from 'react-i18next';

export type SelectorItem = {
  name: string;
  icon: (props: SVGProps<SVGSVGElement>) => React.ReactNode;
  command: (editor: ReturnType<typeof useEditor>['editor']) => void;
  isActive: (editor: ReturnType<typeof useEditor>['editor']) => boolean;
};

interface TableActionProps {
  triggerEditor?: EditorInstance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TableAction = ({ triggerEditor, open, onOpenChange }: TableActionProps) => {
  const { t } = useTranslation();

  const items = [
    {
      key: 'addRowBefore',
      label: t('editor.table.addRowBefore'),
      onClick: (editor: EditorInstance) => editor.chain().focus().addRowBefore().run(),
    },
    {
      key: 'addRowAfter',
      label: t('editor.table.addRowAfter'),
      onClick: (editor: EditorInstance) => editor.chain().focus().addRowAfter().run(),
    },
    {
      key: 'deleteRow',
      label: t('editor.table.deleteRow'),
      onClick: (editor: EditorInstance) => editor.chain().focus().deleteRow().run(),
    },
    {
      key: 'addColumnBefore',
      label: t('editor.table.addColumnBefore'),
      onClick: (editor: EditorInstance) => editor.chain().focus().addColumnBefore().run(),
    },
    {
      key: 'addColumnAfter',
      label: t('editor.table.addColumnAfter'),
      onClick: (editor: EditorInstance) => editor.chain().focus().addColumnAfter().run(),
    },
    {
      key: 'deleteColumn',
      label: t('editor.table.deleteColumn'),
      onClick: (editor: EditorInstance) => editor.chain().focus().deleteColumn().run(),
    },
    {
      key: 'deleteTable',
      label: t('editor.table.deleteTable'),
      onClick: (editor: EditorInstance) => editor.chain().focus().deleteTable().run(),
    },
  ];

  const { editor: currentEditor } = useEditor();
  const editor = triggerEditor || currentEditor;
  if (!editor) return null;

  const content = (
    <div className="w-38">
      {items.map((item) => (
        <EditorBubbleItem
          triggerEditor={triggerEditor}
          key={item.key}
          onSelect={(editor) => {
            item.onClick(editor);
            onOpenChange(false);
          }}
          className="flex cursor-pointer items-center justify-between rounded-sm p-1 text-xs hover:bg-gray-100"
        >
          <div className="flex items-center space-x-2">
            <span className="text-xs">{item.label}</span>
          </div>
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
        <HiOutlineTableCells className="h-3.5 w-3.5" />
        <ChevronDown className="h-3 w-3" />
      </Button>
    </Popover>
  );
};
