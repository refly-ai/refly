import { Editor } from '@tiptap/react';
import { EditorState } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';

import { isTableSelected } from '../../utils';
import { Table } from '../..';

export const isColumnGripSelected = ({
  editor,
  view,
  state,
  from,
}: {
  editor: Editor;
  view: EditorView;
  state: EditorState;
  from: number;
}) => {
  if (!view || !editor?.isInitialized || !editor?.view) return false;

  try {
    const domAtPosResult = view.domAtPos(from);
    if (!domAtPosResult) return false;

    const domAtPos = domAtPosResult.node as HTMLElement;
    const nodeDOM = view.nodeDOM(from) as HTMLElement;
    const node = nodeDOM || domAtPos;

    if (!editor?.isActive(Table.name) || !node || isTableSelected(state?.selection)) {
      return false;
    }

    let container = node;

    while (container && !['TD', 'TH'].includes(container.tagName)) {
      container = container.parentElement!;
    }

    const gripColumn = container?.querySelector?.('a.grip-column.selected');

    return !!gripColumn;
  } catch (error) {
    console.error(error);
    return false;
  }
};

export default isColumnGripSelected;
