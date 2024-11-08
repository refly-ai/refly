import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { EditorInstance } from '@refly-packages/editor-core/components';
import { HocuspocusProvider } from '@hocuspocus/provider';

export interface IEditor {
  instance: EditorInstance;
  wsProvider: HocuspocusProvider;
  lastCursorPos?: number;
  isAiEditing?: boolean;
  pendingDelete?: boolean;
}

export interface EditorState {
  editorMap: Record<string, IEditor>;

  setEditor: (canvasId: string, editor: IEditor) => void;
  updateEditor: (canvasId: string, editor: Partial<IEditor>) => void;
  deleteEditor: (canvasId: string) => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  editorMap: {},
  setEditor: (editorId: string, editor: IEditor) => {
    set((state) => ({
      ...state,
      editorMap: {
        ...state.editorMap,
        [editorId]: editor,
      },
    }));
  },
  updateEditor: (editorId: string, editor: Partial<IEditor>) => {
    set((state) => ({
      ...state,
      editorMap: {
        ...state.editorMap,
        [editorId]: { ...state.editorMap[editorId], ...editor },
      },
    }));
  },
  deleteEditor: (canvasId: string) => {
    set((state) => {
      const { [canvasId]: editor, ...rest } = state.editorMap;
      if (editor) {
        editor.wsProvider.forceSync();
        editor.wsProvider.destroy();
        editor.instance.destroy();
      }
      return { editorMap: rest };
    });
  },
}));

export const useEditorStoreShallow = <T>(selector: (state: EditorState) => T) => {
  return useEditorStore(useShallow(selector));
};
