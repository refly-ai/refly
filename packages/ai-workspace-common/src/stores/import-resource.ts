import { XYPosition } from '@xyflow/react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

export interface LinkMeta {
  key: string;
  url: string;
  title?: string;
  image?: string;
  description?: string;
  html?: string;
  isHandled?: boolean; // 已经爬取
  isError?: boolean; // 处理失败
}

export type ImportResourceMenuItem =
  | 'import-from-weblink'
  | 'import-from-paste-text'
  | 'import-from-web-search'
  | 'import-from-extension';

interface ImportResourceState {
  importResourceModalVisible: boolean;
  selectedMenuItem: ImportResourceMenuItem;

  // scrape
  scrapeLinks: LinkMeta[];
  copiedTextPayload: { content: string; title: string; url?: string };
  insertNodePosition: XYPosition | null;

  setImportResourceModalVisible: (visible: boolean) => void;
  setScrapeLinks: (links: LinkMeta[]) => void;
  setCopiedTextPayload: (
    payload: Partial<{ content: string; title: string; url?: string }>,
  ) => void;
  resetState: () => void;
  setSelectedMenuItem: (menuItem: ImportResourceMenuItem) => void;
  setInsertNodePosition: (position: XYPosition) => void;
}

export const defaultState = {
  copiedTextPayload: { content: '', title: '', url: '' },
  scrapeLinks: [],
  importResourceModalVisible: false,
  selectedMenuItem: 'import-from-web-search' as ImportResourceMenuItem,
  insertNodePosition: null,
};

export const useImportResourceStore = create<ImportResourceState>()(
  devtools((set) => ({
    ...defaultState,

    setImportResourceModalVisible: (visible: boolean) =>
      set((state) => ({ ...state, importResourceModalVisible: visible })),
    setScrapeLinks: (links: LinkMeta[]) => set((state) => ({ ...state, scrapeLinks: links })),
    setCopiedTextPayload: (payload: Partial<{ content: string; title: string; url?: string }>) =>
      set((state) => ({ ...state, copiedTextPayload: { ...state.copiedTextPayload, ...payload } })),
    resetState: () => set((state) => ({ ...state, ...defaultState })),
    setSelectedMenuItem: (menuItem: ImportResourceMenuItem) =>
      set((state) => ({ ...state, selectedMenuItem: menuItem })),
    setInsertNodePosition: (position: XYPosition) =>
      set((state) => ({ ...state, insertNodePosition: position })),
  })),
);

export const useImportResourceStoreShallow = <T>(selector: (state: ImportResourceState) => T) => {
  return useImportResourceStore(useShallow(selector));
};
