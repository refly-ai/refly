import { FC, useState } from 'react';
import { EditorInstance } from '@refly-packages/ai-workspace-common/components/editor/core/components';
import { ColorPicker, Divider } from 'antd';
import { Color } from 'antd/es/color-picker';
import { NodeSelector } from '@refly-packages/ai-workspace-common/components/editor/components/selectors/node-selector';
import { TextButtons } from '@refly-packages/ai-workspace-common/components/editor/components/selectors/text-buttons';
import { LinkSelector } from '@refly-packages/ai-workspace-common/components/editor/components/selectors/link-selector';
import { ColorSelector } from '@refly-packages/ai-workspace-common/components/editor/components/selectors/color-selector';
import './memo-editor.scss';
type MemoEditorProps = {
  editor: EditorInstance;
  bgColor: string;
  onChangeBackground?: (bgColor: string) => void;
};

export const MemoEditor: FC<MemoEditorProps> = ({ editor, bgColor, onChangeBackground }) => {
  const [open, setOpen] = useState(false);
  const [openLink, setOpenLink] = useState(false);
  const [openColor, setOpenColor] = useState(false);
  const colorChange = (color: Color, css: string) => {
    onChangeBackground?.(css);
  };
  return (
    <div className="absolute left-0 -top-[48px] z-50 px-2 bg-white rounded-lg shadow-lg">
      <div className="flex gap-1">
        <ColorPicker
          className="memo-color-picker items-center border-none rounded-none hover:bg-gray-100"
          defaultValue={bgColor}
          onChange={colorChange}
        />
        <Divider className="mx-0 h-8" type="vertical" />
        <NodeSelector open={open} onOpenChange={setOpen} triggerEditor={editor} />
        <Divider className="mx-0 h-8" type="vertical" />
        {/* <ColorSelector open={openColor} onOpenChange={setOpenColor} triggerEditor={editor} />
        <Divider className="mx-0 h-8" type="vertical" /> */}
        <TextButtons triggerEditor={editor} />
        <LinkSelector open={openLink} onOpenChange={setOpenLink} triggerEditor={editor} />
      </div>
    </div>
  );
};
