import { FC, useState } from 'react';
import { EditorInstance } from '@refly-packages/ai-workspace-common/components/editor/core/components';
import { Divider } from 'antd';
import { NodeSelector } from '@refly-packages/ai-workspace-common/components/editor/components/selectors/node-selector';
import { TextButtons } from '@refly-packages/ai-workspace-common/components/editor/components/selectors/text-buttons';
import { LinkSelector } from '@refly-packages/ai-workspace-common/components/editor/components/selectors/link-selector';
import { ColorSelector } from '@refly-packages/ai-workspace-common/components/editor/components/selectors/color-selector';

import './memo-editor.scss';
import CommonColorPicker from '../shared/color-picker';

type MemoEditorProps = {
  editor: EditorInstance;
  bgColor: string;
  onChangeBackground?: (bgColor: string) => void;
};

export const MemoEditor: FC<MemoEditorProps> = ({ editor, bgColor, onChangeBackground }) => {
  const [openNode, setOpenNode] = useState(false);
  const [openLink, setOpenLink] = useState(false);
  const [openColor, setOpenColor] = useState(false);

  return (
    <div className="absolute left-0 -top-[48px] z-50 px-2 bg-white rounded-lg shadow-lg">
      <div className="flex gap-1">
        <CommonColorPicker color={bgColor} onChange={onChangeBackground} />
        <Divider className="mx-0 h-8" type="vertical" />
        <NodeSelector open={openNode} onOpenChange={setOpenNode} triggerEditor={editor} />
        <Divider className="mx-0 h-8" type="vertical" />
        <ColorSelector open={openColor} onOpenChange={setOpenColor} triggerEditor={editor} />
        <Divider className="mx-0 h-8" type="vertical" />
        <TextButtons triggerEditor={editor} />
        <LinkSelector open={openLink} onOpenChange={setOpenLink} triggerEditor={editor} />
      </div>
    </div>
  );
};
