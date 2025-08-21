import { type XYPosition } from '@xyflow/react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { Source } from '@refly/openapi-schema';

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

export interface FileItem {
  title: string;
  url: string;
  storageKey: string;
  uid?: string;
  status?: 'uploading' | 'done' | 'error';
  extension?: string;
  type?: 'file' | 'image';
}

export interface ImageItem {
  title: string;
  url: string;
  storageKey: string;
  uid?: string;
  status?: 'uploading' | 'done' | 'error';
}

// Waiting list item interface for pending files
export interface WaitingListItem {
  id: string;
  type: 'text' | 'file' | 'weblink';
  title?: string;
  url?: string;
  content?: string;
  source?: Source; // For web search results
  file?: FileItem; // For file uploads
  link?: LinkMeta; // For weblink imports
  progress?: number; // For upload progress
  status?: 'pending' | 'processing' | 'done' | 'error';
}

export type ImportResourceMenuItem =
  | 'import-from-file'
  | 'import-from-weblink'
  | 'import-from-paste-text'
  | 'import-from-web-search'
  | 'import-from-extension'
  | 'import-from-image';

interface ImportResourceState {
  importResourceModalVisible: boolean;
  selectedMenuItem: ImportResourceMenuItem;
  extensionModalVisible: boolean;
  // scrape
  scrapeLinks: LinkMeta[];
  fileList: FileItem[];
  imageList: ImageItem[];
  copiedTextPayload: { content: string; title: string; url?: string };
  insertNodePosition: XYPosition | null;

  // waiting list for pending files
  waitingList: WaitingListItem[];

  setImportResourceModalVisible: (visible: boolean) => void;
  setScrapeLinks: (links: LinkMeta[]) => void;
  setFileList: (fileList: FileItem[]) => void;
  setImageList: (imageList: ImageItem[]) => void;
  setCopiedTextPayload: (
    payload: Partial<{ content: string; title: string; url?: string }>,
  ) => void;
  resetState: () => void;
  setSelectedMenuItem: (menuItem: ImportResourceMenuItem) => void;
  setInsertNodePosition: (position: XYPosition) => void;

  // waiting list actions
  addToWaitingList: (item: WaitingListItem) => void;
  removeFromWaitingList: (id: string) => void;
  updateWaitingListItem: (id: string, updates: Partial<WaitingListItem>) => void;
  clearWaitingList: () => void;
  setExtensionModalVisible: (visible: boolean) => void;
}

export const defaultState = {
  copiedTextPayload: { content: '', title: '', url: '' },
  scrapeLinks: [],
  fileList: [],
  imageList: [],
  importResourceModalVisible: false,
  selectedMenuItem: 'import-from-web-search' as ImportResourceMenuItem,
  insertNodePosition: null,
  waitingList: [],
  extensionModalVisible: false,
};

export const useImportResourceStore = create<ImportResourceState>()(
  devtools((set) => ({
    ...defaultState,

    setImportResourceModalVisible: (visible: boolean) =>
      set((state) => ({ ...state, importResourceModalVisible: visible })),
    setExtensionModalVisible: (visible: boolean) =>
      set((state) => ({ ...state, extensionModalVisible: visible })),
    setScrapeLinks: (links: LinkMeta[]) => set((state) => ({ ...state, scrapeLinks: links })),
    setCopiedTextPayload: (payload: Partial<{ content: string; title: string; url?: string }>) =>
      set((state) => ({ ...state, copiedTextPayload: { ...state.copiedTextPayload, ...payload } })),
    resetState: () => set((state) => ({ ...state, ...defaultState })),
    setFileList: (fileList: FileItem[]) => set((state) => ({ ...state, fileList })),
    setImageList: (imageList: ImageItem[]) => set((state) => ({ ...state, imageList })),
    setSelectedMenuItem: (menuItem: ImportResourceMenuItem) =>
      set((state) => ({ ...state, selectedMenuItem: menuItem })),
    setInsertNodePosition: (position: XYPosition) =>
      set((state) => ({ ...state, insertNodePosition: position })),

    // waiting list actions
    addToWaitingList: (item: WaitingListItem) =>
      set((state) => ({ ...state, waitingList: [...state.waitingList, item] })),
    removeFromWaitingList: (id: string) =>
      set((state) => ({
        ...state,
        waitingList: state.waitingList.filter((item) => item.id !== id),
      })),
    updateWaitingListItem: (id: string, updates: Partial<WaitingListItem>) =>
      set((state) => ({
        ...state,
        waitingList: state.waitingList.map((item) =>
          item.id === id ? { ...item, ...updates } : item,
        ),
      })),
    clearWaitingList: () => set((state) => ({ ...state, waitingList: [] })),
  })),
);

export const useImportResourceStoreShallow = <T>(selector: (state: ImportResourceState) => T) => {
  return useImportResourceStore(useShallow(selector));
};
