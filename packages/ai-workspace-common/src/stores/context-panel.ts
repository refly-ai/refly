import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { SkillRuntimeConfig } from '@refly/openapi-schema';
import { IContextItem } from '@refly/common-types';
import { purgeContextItems } from '@refly/canvas-common';

export interface FilterErrorInfo {
  [key: string]: {
    limit: number;
    currentCount: number;
    required?: boolean;
  };
}

export enum ContextTarget {
  Global = 'global',
}

interface ContextPanelState {
  // Canvas selected context items
  contextItems: IContextItem[];

  activeResultId: string;
  setActiveResultId: (resultId: string) => void;

  // selection text
  enableMultiSelect: boolean;

  runtimeConfig?: SkillRuntimeConfig;
  filterErrorInfo: FilterErrorInfo;
  formErrors: Record<string, string>;

  // selected text context 面板相关的内容
  updateEnableMultiSelect: (enableMultiSelect: boolean) => void;
  updateFilterErrorInfo: (errorInfo: FilterErrorInfo) => void;
  setFormErrors: (errors: Record<string, string>) => void;

  resetState: () => void;

  setRuntimeConfig: (runtimeConfig: SkillRuntimeConfig) => void;
  addContextItem: (item: IContextItem) => void;
  setContextItems: (items: IContextItem[]) => void;
  removeContextItem: (entityId: string) => void;
  clearContextItems: () => void;
}

export const defaultSelectedTextCardState = {
  enableMultiSelect: true, // default enable multi select, later to see if we need to enable multiSelect ability
  filterErrorInfo: {} as FilterErrorInfo,
  formErrors: {} as Record<string, string>,
};

export const defaultState = {
  contextPanelPopoverVisible: false,
  importPopoverVisible: false,
  contextItems: [],
  checkedKeys: [],
  expandedKeys: [],
  runtimeConfig: {
    disableLinkParsing: true,
    enabledKnowledgeBase: false,
  } as SkillRuntimeConfig,

  activeResultId: ContextTarget.Global,

  ...defaultSelectedTextCardState,
};

export const useContextPanelStore = create<ContextPanelState>()(
  devtools((set) => ({
    ...defaultState,

    // selected text
    updateEnableMultiSelect: (enableMultiSelect: boolean) =>
      set((state) => ({ ...state, enableMultiSelect })),
    updateFilterErrorInfo: (errorInfo: FilterErrorInfo) =>
      set((state) => ({ ...state, filterErrorInfo: { ...state.filterErrorInfo, ...errorInfo } })),
    setFormErrors: (errors: Record<string, string>) =>
      set((state) => ({ ...state, formErrors: errors })),

    setRuntimeConfig: (runtimeConfig: SkillRuntimeConfig) =>
      set((state) => ({ ...state, runtimeConfig: { ...state.runtimeConfig, ...runtimeConfig } })),
    addContextItem: (item: IContextItem) =>
      set((state) => {
        const existingIndex = state.contextItems.findIndex(
          (contextItem) => contextItem.entityId === item.entityId,
        );

        if (existingIndex >= 0) {
          // Update existing item
          const updatedItems = [...state.contextItems];
          updatedItems[existingIndex] = item;
          return {
            ...state,
            contextItems: purgeContextItems(updatedItems),
          };
        }

        // Add new item to end
        return {
          ...state,
          contextItems: purgeContextItems([...state.contextItems, item]),
        };
      }),
    setContextItems: (items: IContextItem[]) =>
      set((state) => ({ ...state, contextItems: purgeContextItems(items) })),
    removeContextItem: (entityId: string) =>
      set((state) => ({
        ...state,
        contextItems: state.contextItems.filter((item) => item.entityId !== entityId),
      })),
    clearContextItems: () => set((state) => ({ ...state, contextItems: [] })),

    setActiveResultId: (resultId: string) =>
      set((state) => ({
        ...state,
        activeResultId: resultId,
      })),

    resetState: () => set((state) => ({ ...state, ...defaultState })),
  })),
);

export const useContextPanelStoreShallow = <T>(selector: (state: ContextPanelState) => T) => {
  return useContextPanelStore(useShallow(selector));
};
