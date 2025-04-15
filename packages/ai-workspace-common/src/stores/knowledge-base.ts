import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

import { Resource, Source } from '@refly/openapi-schema';

export enum ActionSource {
  KnowledgeBase = 'knowledge-base',
  Conv = 'conv',
  Note = 'note',
}

export interface KnowledgeBaseTab {
  title: string;
  key: string;
  content: string;
  resourceId: string;
}

export interface SourceListDrawer {
  visible: boolean;
  sources?: Source[];
  query?: string;
}

export type LibraryModalActiveKey = 'document' | 'resource' | 'project';

export interface KnowledgeBaseState {
  isSaveKnowledgeBaseModalVisible: boolean;
  pageSize: number;
  currentPage: number;
  hasMore: boolean;
  isRequesting: boolean;
  libraryModalActiveKey: LibraryModalActiveKey;
  // tabs
  tabs: KnowledgeBaseTab[];
  activeTab: string;
  resourcePanelVisible: boolean;
  isKnowledgeBaseEnabled: boolean;

  currentResource: null | Resource;

  // 会话 modal
  convModalVisible: boolean;
  kbModalVisible: boolean;
  actionSource: ActionSource;

  // source-list
  sourceListDrawer: SourceListDrawer;

  updateIsSaveKnowledgeBaseModalVisible: (isSaveKnowledgeBaseModalVisible: boolean) => void;
  updateIsRequesting: (isRequesting: boolean) => void;
  updateResource: (resource: Resource) => void;
  updateCurrentPage: (currentPage: number) => void;
  updateHasMore: (hasMore: boolean) => void;
  updateConvModalVisible: (convModalVisible: boolean) => void;
  updateActionSource: (actionSource: ActionSource) => void;
  updateKbModalVisible: (kbModalVisible: boolean) => void;
  updateSourceListDrawer: (sourceListDrawer: Partial<SourceListDrawer>) => void;
  updateTabs: (tabs: KnowledgeBaseTab[]) => void;
  updateActiveTab: (key: string) => void;
  updateResourcePanelVisible: (visible: boolean) => void;
  updateIsKnowledgeBaseEnabled: (enabled: boolean) => void;
  resetState: () => void;
  resetTabs: () => void;

  updateLibraryModalActiveKey: (key: string) => void;
}

export const defaultState = {
  isSaveKnowledgeBaseModalVisible: false,
  tabs: [
    {
      title: 'New Tab',
      key: 'key1',
      content: 'Content of Tab Pane 1',
    },
  ] as KnowledgeBaseTab[],
  activeTab: 'key1',
  resourcePanelVisible: false,
  isKnowledgeBaseEnabled: false,
  convModalVisible: false,
  kbModalVisible: false,
  sourceListDrawer: {
    visible: false,
    sources: [],
    query: '',
  },
  actionSource: ActionSource.Conv,
  currentKnowledgeBase: null,
  currentResource: null,
  knowledgeBaseList: [],
  pageSize: 10,
  currentPage: 1,
  hasMore: true,
  isRequesting: false,

  libraryModalActiveKey: 'project' as LibraryModalActiveKey,
};

export const useKnowledgeBaseStore = create<KnowledgeBaseState>()(
  devtools((set) => ({
    ...defaultState,

    updateIsSaveKnowledgeBaseModalVisible: (isSaveKnowledgeBaseModalVisible: boolean) =>
      set((state) => ({ ...state, isSaveKnowledgeBaseModalVisible })),
    updateResource: (resource: Resource) =>
      set((state) => ({
        ...state,
        currentResource: resource,
      })),
    updateCurrentPage: (currentPage: number) => set((state) => ({ ...state, currentPage })),
    updateHasMore: (hasMore: boolean) => set((state) => ({ ...state, hasMore })),
    updateConvModalVisible: (convModalVisible: boolean) =>
      set((state) => ({ ...state, convModalVisible })),
    updateKbModalVisible: (kbModalVisible: boolean) =>
      set((state) => ({ ...state, kbModalVisible })),
    updateIsRequesting: (isRequesting: boolean) => set((state) => ({ ...state, isRequesting })),
    updateActionSource: (actionSource: ActionSource) =>
      set((state) => ({ ...state, actionSource })),
    updateSourceListDrawer: (sourceListDrawer: Partial<SourceListDrawer>) =>
      set((state) => ({
        ...state,
        sourceListDrawer: { ...state.sourceListDrawer, ...sourceListDrawer },
      })),

    updateTabs: (tabs: KnowledgeBaseTab[]) => set((state) => ({ ...state, tabs })),
    updateActiveTab: (key: string) => set((state) => ({ ...state, activeTab: key })),
    resetState: () => set((state) => ({ ...state, knowledgeBaseList: [] })),
    resetTabs: () =>
      set((state) => ({
        ...state,
        activeTab: 'key1',
        tabs: [
          {
            title: 'New Tab',
            key: 'key1',
            content: 'Content of Tab Pane 1',
            collectionId: '',
            resourceId: '',
          },
        ],
      })),

    // tabs
    updateResourcePanelVisible: (visible: boolean) =>
      set((state) => ({ ...state, resourcePanelVisible: visible })),
    updateNotePanelVisible: (visible: boolean) =>
      set((state) => ({ ...state, notePanelVisible: visible })),
    updateLibraryModalActiveKey: (key: LibraryModalActiveKey) =>
      set((state) => ({ ...state, libraryModalActiveKey: key })),
    updateIsKnowledgeBaseEnabled: (enabled: boolean) =>
      set((state) => ({ ...state, isKnowledgeBaseEnabled: enabled })),
  })),
);

export const useKnowledgeBaseStoreShallow = <T>(selector: (state: KnowledgeBaseState) => T) => {
  return useKnowledgeBaseStore(useShallow(selector));
};
