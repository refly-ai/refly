import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { immer } from 'zustand/middleware/immer';
import { Document } from '@refly/openapi-schema';

export enum ActionSource {
  KnowledgeBase = 'knowledge-base',
  Conv = 'conv',
  Canvas = 'canvas',
}

export interface TableOfContentsItem {
  isActive: boolean;
  isScrolledOver: boolean;
  id: string;
  itemIndex: number;
  textContent: string;
  level: number;
}

interface DocumentData {
  document?: Document;
  documentCharsCount?: number;
  lastCursorPosRef?: number;
}

interface DocumentConfig {
  readOnly?: boolean;
  localSyncedAt?: number;
  remoteSyncedAt?: number;
}

interface DocumentBaseState {
  // Canvas specific states stored by docId
  activeDocumentId: string;
  hasEditorSelection: boolean;
  data: Record<string, DocumentData>;
  config: Record<string, DocumentConfig>;

  setHasEditorSelection: (hasEditorSelection: boolean) => void;
  updateDocument: (docId: string, document: Document) => void;
  updateDocumentCharsCount: (docId: string, count: number) => void;
  updateLastCursorPosRef: (docId: string, pos: number) => void;
  setActiveDocumentId: (docId: string) => void;

  setDocumentReadOnly: (docId: string, readOnly: boolean) => void;
  setDocumentLocalSyncedAt: (docId: string, syncedAt: number) => void;
  setDocumentRemoteSyncedAt: (docId: string, syncedAt: number) => void;

  deleteDocumentData: (docId: string) => void;

  resetState: (docId: string) => void;
  clearState: () => void;
}

export const defaultState = () => ({
  hasEditorSelection: false,
  activeDocumentId: '',
  data: {},
  config: {},
});

export const useDocumentStore = create<DocumentBaseState>()(
  persist(
    immer((set) => ({
      ...defaultState(),

      setHasEditorSelection: (hasEditorSelection: boolean) =>
        set((state) => {
          state.hasEditorSelection = hasEditorSelection;
        }),

      updateDocument: (docId: string, document: Document) =>
        set((state) => {
          state.data[docId] ??= {};
          state.data[docId].document = document;
        }),

      updateDocumentCharsCount: (docId: string, count: number) =>
        set((state) => {
          state.data[docId] ??= {};
          state.data[docId].documentCharsCount = count;
        }),

      updateLastCursorPosRef: (docId: string, pos: number) =>
        set((state) => {
          state.data[docId] ??= {};
          state.data[docId].lastCursorPosRef = pos;
        }),

      setActiveDocumentId: (docId: string) =>
        set((state) => {
          state.activeDocumentId = docId;
        }),

      setDocumentReadOnly: (docId: string, readOnly: boolean) =>
        set((state) => {
          state.config[docId] ??= {};
          state.config[docId].readOnly = readOnly;
        }),

      setDocumentLocalSyncedAt: (docId: string, syncedAt: number) =>
        set((state) => {
          state.config[docId] ??= {};
          state.config[docId].localSyncedAt = syncedAt;
        }),

      setDocumentRemoteSyncedAt: (docId: string, syncedAt: number) =>
        set((state) => {
          state.config[docId] ??= {};
          state.config[docId].remoteSyncedAt = syncedAt;
        }),

      deleteDocumentData: (docId: string) =>
        set((state) => {
          delete state.config[docId];
          delete state.data[docId];
        }),

      resetState: (docId: string) =>
        set((state) => {
          state.data[docId] = {};
        }),

      clearState: () => set(defaultState()),
    })),
    {
      name: 'document-storage',
      partialize: (state) => ({
        config: state.config,
      }),
    },
  ),
);

export const useDocumentStoreShallow = <T>(selector: (state: DocumentBaseState) => T) => {
  return useDocumentStore(useShallow(selector));
};
