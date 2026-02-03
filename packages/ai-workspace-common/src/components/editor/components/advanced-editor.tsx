import {
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandItem,
  EditorCommandList,
} from '../core/components';
import { configureSuggestionItems } from './slash-command';

import './styles/globals.css';
import './styles/prosemirror.css';
import './styles/table.css';

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
