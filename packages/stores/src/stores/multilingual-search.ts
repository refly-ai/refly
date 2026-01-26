import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { Source, SearchStep } from '@refly/openapi-schema';
import { SearchLocale, SearchPageState, defaultLocalesMap } from '@refly/common-types';

interface SearchState {
  query: string;
  searchLocales: SearchLocale[];
  outputLocale: SearchLocale;
  isSearching: boolean;
  searchProgress: number;
  searchSteps: SearchStep[];
  results: Source[];

  selectedItems: Source[];
  setSelectedItems: (items: Source[]) => void;
  toggleSelectedItem: (item: Source, checked: boolean) => void;
  clearSelectedItems: () => void;

  setQuery: (query: string) => void;
  setIsSearching: (isSearching: boolean) => void;
  setSearchLocales: (locales: SearchLocale[]) => void;
  setOutputLocale: (locale: SearchLocale) => void;
  updateProgress: (progress: number) => void;
  addSearchStep: (step: SearchStep) => void;
  setProcessingStep: () => void;
  setResults: (results: Source[]) => void;
  resetSearch: () => void;

  pageState: SearchPageState;
  setPageState: (state: SearchPageState) => void;

  resetAll: () => void;

  clearSearchSteps: () => void;
}

const defaultLocales = defaultLocalesMap.en;
const defaultSelectedLocales = ['en', 'zh-CN', 'ja'];

export const useMultilingualSearchStore = create<SearchState>((set) => ({
  query: '',
  searchLocales: defaultLocales.filter((locale) => defaultSelectedLocales.includes(locale.code)),
  outputLocale: { code: '', name: '' },
  isSearching: false,
  searchProgress: 0,
  searchSteps: [],
  results: [],

  selectedItems: [],
  setSelectedItems: (items) => set({ selectedItems: items }),
  toggleSelectedItem: (item, checked) =>
    set((state) => ({
      selectedItems: checked
        ? [...state.selectedItems, item]
        : state.selectedItems.filter((i) => i !== item),
    })),
  clearSelectedItems: () => set({ selectedItems: [] }),

  setQuery: (query) => set({ query }),
  setSearchLocales: (locales) => set({ searchLocales: locales }),
  setOutputLocale: (locale) => set({ outputLocale: locale }),
  setIsSearching: (isSearching) =>
    set((state) => ({
      isSearching,
      searchSteps: isSearching ? [] : state.searchSteps,
      searchProgress: isSearching ? 0 : state.searchProgress,
    })),

  updateProgress: (progress) => set({ searchProgress: progress }),
  addSearchStep: (step) =>
    set((state) => ({
      searchSteps: [...state.searchSteps.filter((s) => s.step !== 'Processing...'), step],
    })),
  setProcessingStep: () =>
    set((state) => ({
      searchSteps: [...state.searchSteps, { step: 'Processing...', duration: 0 }],
    })),
  setResults: (results) =>
    set({
      results,
      isSearching: false,
      searchProgress: 100,
    }),
  resetSearch: () =>
    set({
      query: '',
      isSearching: false,
      searchProgress: 0,
      searchSteps: [],
      results: [],
    }),

  pageState: 'home',
  setPageState: (state) => set({ pageState: state }),

  resetAll: () =>
    set({
      query: '',
      searchLocales: defaultLocales.filter((locale) =>
        defaultSelectedLocales.includes(locale.code),
      ),
      outputLocale: { code: '', name: '' },
      isSearching: false,
      searchProgress: 0,
      searchSteps: [],
      results: [],
      selectedItems: [],
      pageState: 'home',
    }),

  clearSearchSteps: () =>
    set({
      searchSteps: [],
      searchProgress: 0,
    }),
}));

export const useMultilingualSearchStoreShallow = <T>(selector: (state: SearchState) => T) => {
  return useMultilingualSearchStore(useShallow(selector));
};
