import {
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandItem,
  EditorCommandList,
} from '../core/components';
import { useState } from 'react';
import { Divider } from 'antd';
import { ColorSelector } from './selectors/color-selector';
import { LinkSelector } from './selectors/link-selector';
import { NodeSelector } from './selectors/node-selector';
import { AIBtnSelector } from './selectors/ai-btn-selector';

import GenerativeMenuSwitch from './generative-menu-switch';
import { TextButtons } from './selectors/text-buttons';
import { configureSuggestionItems } from './slash-command';

import './styles/globals.css';
import './styles/prosemirror.css';
import './styles/table.css';
import { CreateMemoSelector } from '@refly-packages/ai-workspace-common/components/editor/components/selectors/create-memo-selector';

export const CollabEditorCommand = (props: { entityId: string; entityType: string }) => {
  const suggestionItems = configureSuggestionItems(props);

  return (
    <EditorCommand className="z-50 h-auto max-h-[330px] overflow-y-auto rounded-md border border-muted bg-background px-1 py-2 shadow-refly-m transition-all">
      <EditorCommandList>
        <EditorCommandEmpty className="px-2 text-muted-foreground">No results</EditorCommandEmpty>
        {suggestionItems.map((item) => (
          <EditorCommandItem
            value={item.title}
            onCommand={(val) => item.command(val)}
            className="flex items-center px-2 py-1 space-x-2 w-full text-sm text-left rounded-md hover:bg-accent aria-selected:bg-accent"
            key={item.title}
          >
            <div className="flex justify-center items-center w-10 h-10 rounded-md border border-muted bg-background">
              {item.icon}
            </div>
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
          </EditorCommandItem>
        ))}
      </EditorCommandList>
    </EditorCommand>
  );
};

interface CollabGenAIMenuSwitchProps {
  contentSelector: {
    text: string;
    handleClick: () => void;
    createMemo: () => void;
  };
}
export const CollabGenAIMenuSwitch: React.FC<CollabGenAIMenuSwitchProps> = (props) => {
  const { contentSelector } = props;
  const [openNode, setOpenNode] = useState(false);
  const [openColor, setOpenColor] = useState(false);
  const [openLink, setOpenLink] = useState(false);
  const [openAI, setOpenAI] = useState(false);

  return (
    <GenerativeMenuSwitch open={openAI} onOpenChange={setOpenAI}>
      <AIBtnSelector open={openAI} onOpenChange={setOpenAI} />
      {/* <ContentSelectorButtons
        text={contentSelector?.text}
        handleClick={contentSelector?.handleClick}
      /> */}
      <CreateMemoSelector text={contentSelector?.text} handleClick={contentSelector?.createMemo} />
      <Divider className="mx-0 h-8" type="vertical" />
      <NodeSelector open={openNode} onOpenChange={setOpenNode} />
      <Divider className="mx-0 h-8" type="vertical" />
      <TextButtons />
      <LinkSelector open={openLink} onOpenChange={setOpenLink} />
      <Divider className="mx-0 h-8" type="vertical" />
      <ColorSelector open={openColor} onOpenChange={setOpenColor} />
    </GenerativeMenuSwitch>
  );
};
