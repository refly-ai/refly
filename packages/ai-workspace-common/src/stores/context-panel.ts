import { TreeProps } from '@arco-design/web-react';
import { ActionResult, SearchDomain, SearchResult } from '@refly/openapi-schema';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { Mark, ContextDomain, SelectedTextDomain } from '@refly/common-types';
import { CanvasNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes';

export const selectedTextCardDomainWeb = [
  {
    key: 'resourceSelection',
    labelDict: {
      en: 'Resource',
      'zh-CN': '资源选中',
    },
  },
  {
    key: 'documentSelection',
    labelDict: {
      en: 'Document',
      'zh-CN': '文档选中',
    },
  },
  {
    key: 'documentCursorSelection',
    labelDict: {
      en: 'Document Cursor Selection',
      'zh-CN': '文档光标选中文本',
    },
  },
  {
    key: 'documentBeforeCursorSelection',
    labelDict: {
      en: 'Document Before Cursor Selection',
      'zh-CN': '文档光标选中前文本',
    },
  },
  {
    key: 'documentAfterCursorSelection',
    labelDict: {
      en: 'Document After Cursor Selection',
      'zh-CN': '文档光标选中后文本',
    },
  },
];

export const selectedTextCardDomainExtension = [
  {
    key: 'extensionWeblinkSelection',
    labelDict: {
      en: 'Web Link',
      'zh-CN': '网页链选中',
    },
  },
];

export const defaultSelectedTextCardDomainKeysWeb: SelectedTextDomain[] = selectedTextCardDomainWeb.map(
  (item) => item.key as SelectedTextDomain,
);
export const defaultSelectedTextCardDomainKeysExtension: SelectedTextDomain[] = selectedTextCardDomainExtension.map(
  (item) => item.key as SelectedTextDomain,
);

export interface FilterErrorInfo {
  [key: string]: {
    limit: number;
    currentCount: number;
    required?: boolean;
  };
}

export interface NodeItem extends CanvasNode<any> {
  isPreview?: boolean; // is preview mode
  isCurrentContext?: boolean;
}

interface ContextPanelState {
  envContextInitMap: { resource: boolean; collection: boolean; note: boolean };

  // Canvas selected context items
  contextItems: NodeItem[];

  // Canvas selected history items
  historyItems: NodeItem[];

  // context card 的处理
  nowSelectedContextDomain: SearchDomain;

  // selected text card, suuport multi selected as it is all selected text
  selectedTextCardDomain: SelectedTextDomain[];
  // selection text
  currentSelectedMark: Mark;
  selectedDomain: SelectedTextDomain;
  enableMultiSelect: boolean;

  currentSelectedMarks: Mark[]; // 作为唯一的 context items 来源
  filterIdsOfCurrentSelectedMarks: string[]; // 作为 context items 的过滤
  filterErrorInfo: FilterErrorInfo;
  formErrors: Record<string, string>;

  // context card
  showContextCard: boolean;
  contextDomain: ContextDomain;

  // note cursor selection
  beforeSelectionNoteContent: string;
  afterSelectionNoteContent: string;
  currentSelectionContent: string;

  setCheckedKeys: (keys: string[]) => void;
  setExpandedKeys: (keys: string[]) => void;

  // selected text context 面板相关的内容
  updateCurrentSelectedMark: (mark: Mark) => void;
  updateSelectedDomain: (domain: SelectedTextDomain) => void;
  updateEnableMultiSelect: (enableMultiSelect: boolean) => void;
  updateCurrentSelectedMarks: (marks: Mark[]) => void;
  updateFilterIdsOfCurrentSelectedMarks: (ids: string[]) => void;
  resetSelectedTextCardState: () => void;
  setSelectedTextCardDomain: (domain: SelectedTextDomain[]) => void;
  updateFilterErrorInfo: (errorInfo: FilterErrorInfo) => void;
  setFormErrors: (errors: Record<string, string>) => void;

  // context card
  setShowContextCard: (showcontextCard: boolean) => void;
  setContextDomain: (contextDomain: ContextDomain) => void;
  setNowSelectedContextDomain: (domain: SearchDomain) => void;

  // note cursor selection
  updateBeforeSelectionNoteContent: (content: string) => void;
  updateAfterSelectionNoteContent: (content: string) => void;
  updateCurrentSelectionContent: (content: string) => void;

  resetState: () => void;

  // 新增的操作方法
  addMark: (mark: Mark) => void;
  removeMark: (id: string) => void;
  toggleMarkActive: (id: string) => void;
  clearMarks: () => void;
  updateMark: (mark: Mark) => void;

  addContextItem: (node: NodeItem) => void;
  setContextItems: (nodes: NodeItem[]) => void;
  removeContextItem: (id: string) => void;
  clearContextItems: () => void;
  updateContextItem: (node: NodeItem) => void;

  addHistoryItem: (item: NodeItem) => void;
  setHistoryItems: (items: NodeItem[]) => void;
  removeHistoryItem: (id: string) => void;
  removePreviewHistoryItem: () => void;
  clearHistoryItems: () => void;
  updateHistoryItem: (item: NodeItem) => void;

  // Add new method
  pinAllHistoryItems: () => void;
}

export const defaultSelectedTextCardState = {
  currentSelectedMark: null as Mark,
  selectedDomain: 'resource' as SelectedTextDomain,
  enableMultiSelect: true, // default enable multi select, later to see if we need to enable multiSelect ability
  currentSelectedMarks: [] as Mark[],
  filterIdsOfCurrentSelectedMarks: [] as string[],
  filterErrorInfo: {} as FilterErrorInfo,
  formErrors: {} as Record<string, string>,
};

export const defaultCurrentContext = {
  contextDomain: 'resource' as ContextDomain,
  showContextCard: false, // 插件状态下自动打开
};

// not add to currentSelectedMarks as it cannot delete, only can unselect
export const defaultNoteCursorSelection = {
  beforeSelectionNoteContent: '',
  afterSelectionNoteContent: '',
  currentSelectionContent: '',
};

export const defaultState = {
  envContextInitMap: { resource: false, collection: false, note: false },
  nowSelectedContextDomain: 'resource' as SearchDomain,
  contextPanelPopoverVisible: false,
  importPopoverVisible: false,
  contextItems: [],
  historyItems: [],
  checkedKeys: [],
  expandedKeys: [],

  // selected text card
  selectedTextCardDomain: [] as SelectedTextDomain[],
  ...defaultSelectedTextCardState,
  ...defaultCurrentContext,
  ...defaultNoteCursorSelection,
};

export const useContextPanelStore = create<ContextPanelState>()(
  devtools((set) => ({
    ...defaultState,

    setTreeData: (treeData: TreeProps['treeData']) => set((state) => ({ ...state, treeData })),
    setCheckedKeys: (keys: string[]) => set((state) => ({ ...state, checkedKeys: keys })),
    setExpandedKeys: (keys: string[]) => set((state) => ({ ...state, expandedKeys: keys })),
    setNowSelectedContextDomain: (domain: SearchDomain) =>
      set((state) => ({ ...state, nowSelectedContextDomain: domain })),
    setSelectedTextCardDomain: (domain: SelectedTextDomain[]) =>
      set((state) => ({ ...state, selectedTextCardDomain: domain })),

    // selected text
    updateCurrentSelectedMark: (mark: Mark) => set((state) => ({ ...state, currentSelectedMark: mark })),
    updateSelectedDomain: (selectedDomain: SelectedTextDomain) => set((state) => ({ ...state, selectedDomain })),
    updateEnableMultiSelect: (enableMultiSelect: boolean) => set((state) => ({ ...state, enableMultiSelect })),
    updateCurrentSelectedMarks: (marks: Mark[]) => set((state) => ({ ...state, currentSelectedMarks: marks })),
    updateFilterIdsOfCurrentSelectedMarks: (ids: string[]) =>
      set((state) => ({ ...state, filterIdsOfCurrentSelectedMarks: ids })),
    updateFilterErrorInfo: (errorInfo: FilterErrorInfo) =>
      set((state) => ({ ...state, filterErrorInfo: { ...state.filterErrorInfo, ...errorInfo } })),
    setFormErrors: (errors: Record<string, string>) => set((state) => ({ ...state, formErrors: errors })),

    addMark: (mark: Mark) =>
      set((state) => ({ ...state, currentSelectedMarks: [...state.currentSelectedMarks, mark] })),
    removeMark: (id: string) =>
      set((state) => ({ ...state, currentSelectedMarks: state.currentSelectedMarks.filter((mark) => mark.id !== id) })),
    toggleMarkActive: (id: string) =>
      set((state) => ({
        ...state,
        currentSelectedMarks: state.currentSelectedMarks.map((mark) => ({
          ...mark,
          active: mark.id === id ? !mark.active : false,
        })),
      })),
    clearMarks: () => set((state) => ({ ...state, currentSelectedMarks: [] })),
    updateMark: (mark: Mark) =>
      set((state) => ({
        ...state,
        currentSelectedMarks: state.currentSelectedMarks.map((item) =>
          item.id === mark.id ? { ...item, ...mark } : item,
        ),
      })),

    addContextItem: (node: CanvasNode) =>
      set((state) => {
        const existingIndex = state.contextItems.findIndex((item) => item.id === node.id);

        if (existingIndex >= 0) {
          // Update existing item
          const updatedItems = [...state.contextItems];
          updatedItems[existingIndex] = node;
          return {
            ...state,
            contextItems: updatedItems,
          };
        }

        // Add new item to end
        return {
          ...state,
          contextItems: [...state.contextItems, node],
        };
      }),
    setContextItems: (nodes: CanvasNode[]) => set((state) => ({ ...state, contextItems: nodes })),
    removeContextItem: (id: string) =>
      set((state) => ({
        ...state,
        contextItems: state.contextItems.filter((node) => node.id !== id),
      })),
    clearContextItems: () => set((state) => ({ ...state, contextItems: [] })),
    updateContextItem: (node: CanvasNode) =>
      set((state) => ({
        ...state,
        contextItems: state.contextItems.map((item) => (item.id === node.id ? { ...item, ...node } : item)),
      })),

    addHistoryItem: (item: NodeItem) =>
      set((state) => {
        const existingIndex = state.historyItems.findIndex((existing) => existing.id === item.id);

        if (existingIndex >= 0) {
          // Update existing item
          const updatedItems = [...state.historyItems];
          updatedItems[existingIndex] = item;
          return {
            ...state,
            historyItems: updatedItems,
          };
        }

        return {
          ...state,
          historyItems: item.isPreview ? [item, ...state.historyItems] : [...state.historyItems, item],
        };
      }),
    setHistoryItems: (items: NodeItem[]) => set((state) => ({ ...state, historyItems: items })),
    removeHistoryItem: (id: string) =>
      set((state) => ({
        ...state,
        historyItems: state.historyItems.filter((node) => node.id !== id),
      })),
    removePreviewHistoryItem: () =>
      set((state) => ({
        ...state,
        historyItems: state.historyItems.filter((node) => !node.isPreview),
      })),
    clearHistoryItems: () => set((state) => ({ ...state, historyItems: [] })),
    updateHistoryItem: (item: NodeItem) =>
      set((state) => ({
        ...state,
        historyItems: state.historyItems.map((historyItem) =>
          historyItem.id === item.id ? { ...historyItem, ...item } : historyItem,
        ),
      })),

    resetSelectedTextCardState: () => set((state) => ({ ...state, ...defaultSelectedTextCardState })),

    // context card
    setContextDomain: (contextDomain: ContextDomain) => set((state) => ({ ...state, contextDomain })),
    setShowContextCard: (showContextCard: boolean) => set((state) => ({ ...state, showContextCard })),

    // note cursor selection
    updateBeforeSelectionNoteContent: (content: string) =>
      set((state) => ({ ...state, beforeSelectionNoteContent: content })),
    updateAfterSelectionNoteContent: (content: string) =>
      set((state) => ({ ...state, afterSelectionNoteContent: content })),
    updateLastCursorPosRef: (pos: number) => set((state) => ({ ...state, lastCursorPosRef: pos })),
    updateCurrentSelectionContent: (content: string) =>
      set((state) => ({ ...state, currentSelectionContent: content })),

    resetState: () => set((state) => ({ ...state, ...defaultState })),

    pinAllHistoryItems: () =>
      set((state) => ({
        ...state,
        historyItems: state.historyItems.map((item) => ({
          ...item,
          isPreview: false,
        })),
      })),
  })),
);

export const useContextPanelStoreShallow = <T>(selector: (state: ContextPanelState) => T) => {
  return useContextPanelStore(useShallow(selector));
};
