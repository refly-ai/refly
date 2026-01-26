import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { Source } from '@refly/openapi-schema';

interface SourceListDrawer {
  visible: boolean;
  sources?: Source[];
  query?: string;
}

export type LibraryModalActiveKey = 'document' | 'resource' | 'project';

interface KnowledgeBaseState {
  libraryModalActiveKey: LibraryModalActiveKey;
  sourceListDrawer: SourceListDrawer;

  updateSourceListDrawer: (sourceListDrawer: Partial<SourceListDrawer>) => void;
  updateLibraryModalActiveKey: (key: LibraryModalActiveKey) => void;
}

const defaultState = {
  sourceListDrawer: {
    visible: false,
    sources: [],
    query: '',
  },

  libraryModalActiveKey: 'project' as LibraryModalActiveKey,
};

export const useKnowledgeBaseStore = create<KnowledgeBaseState>()(
  devtools((set) => ({
    ...defaultState,

    updateSourceListDrawer: (sourceListDrawer: Partial<SourceListDrawer>) =>
      set((state) => ({
        ...state,
        sourceListDrawer: { ...state.sourceListDrawer, ...sourceListDrawer },
      })),
    updateLibraryModalActiveKey: (key: LibraryModalActiveKey) =>
      set((state) => ({ ...state, libraryModalActiveKey: key })),
  })),
);

export const useKnowledgeBaseStoreShallow = <T>(selector: (state: KnowledgeBaseState) => T) => {
  return useKnowledgeBaseStore(useShallow(selector));
};
