import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

// 搜索的内容来源
enum SearchTarget {
  None = 'none', // 无上下文
  All = 'all', // 整个 Workspace
  CurrentPage = 'currentPage', // 当前 resource
  SelectedPages = 'selectedPages', // 选中的多个资源
  CurrentKnowledgeBase = 'currentKnowledgeBase', // 选中知识库 -> 后续应该内聚到知识库中，通过关联、接力等能力，随着时间推移变得更好
  SearchEnhance = 'searchEnhance', // 搜索增强
}

interface SearchState {
  // state
  searchTarget: SearchTarget;

  // method
  setSearchTarget: (searchTarget: SearchTarget) => void;
}

const defaultState = {
  searchTarget: SearchTarget.All as SearchTarget,
};

export const useSearchStateStore = create<SearchState>()(
  devtools((set) => ({
    ...defaultState,

    setSearchTarget: (searchTarget: SearchTarget) => set((state) => ({ ...state, searchTarget })),
  })),
);

export const useSearchStateStoreShallow = <T>(selector: (state: SearchState) => T) => {
  return useSearchStateStore(useShallow(selector));
};
