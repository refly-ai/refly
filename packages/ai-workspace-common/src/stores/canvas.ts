import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

import { Canvas } from '@refly/openapi-schema';

export enum ActionSource {
  KnowledgeBase = 'knowledge-base',
  Conv = 'conv',
  Canvas = 'canvas',
}

export interface CanvasTab {
  title: string;
  key: string;
  content: string;
  canvasId: string;
  projectId: string;
}

export type CanvasServerStatus = 'disconnected' | 'connected';
export type CanvasSaveStatus = 'Saved' | 'Unsaved';

export interface TableOfContentsItem {
  isActive: boolean;
  isScrolledOver: boolean;
  id: string;
  itemIndex: number;
  textContent: string;
}

interface CanvasBaseState {
  currentCanvas: Canvas | null;
  isRequesting: boolean;
  newCanvasCreating: boolean;

  // tabs
  tabs: CanvasTab[];
  activeTab: string;
  canvasPanelVisible: boolean;

  canvasServerStatus: CanvasServerStatus;
  canvasCharsCount: number;
  canvasSaveStatus: CanvasSaveStatus;

  lastCursorPosRef: number | null;

  // tocItems
  tocItems: TableOfContentsItem[];

  updateCurrentCanvas: (canvas: Canvas) => void;
  updateIsRequesting: (isRequesting: boolean) => void;
  updateNewCanvasCreating: (creating: boolean) => void;
  updateTabs: (tabs: CanvasTab[]) => void;
  updateActiveTab: (key: string) => void;
  updateCanvasPanelVisible: (visible: boolean) => void;
  updateCanvasServerStatus: (status: CanvasServerStatus) => void;
  updateCanvasSaveStatus: (status: CanvasSaveStatus) => void;
  updateCanvasCharsCount: (count: number) => void;

  updateLastCursorPosRef: (pos: number) => void;
  updateTocItems: (items: TableOfContentsItem[]) => void;

  resetState: () => void;
}

export const defaultState = {
  currentCanvas: null as null | Canvas,
  tabs: [],
  activeTab: 'key1',
  canvasPanelVisible: false,
  isRequesting: false,
  newCanvasCreating: false,
  tocItems: [],

  // canvases
  editor: null,
  editorMap: {},
  canvasServerStatus: 'disconnected' as CanvasServerStatus,
  canvasCharsCount: 0,
  canvasSaveStatus: 'Unsaved' as CanvasSaveStatus,

  // canvas selection status content, main for skill consume
  lastCursorPosRef: null,
};

export const useCanvasStore = create<CanvasBaseState>()(
  devtools((set) => ({
    ...defaultState,

    updateCurrentCanvas: (canvas) => set((state) => ({ ...state, currentCanvas: canvas })),
    updateIsRequesting: (isRequesting: boolean) => set((state) => ({ ...state, isRequesting })),
    updateTabs: (tabs: CanvasTab[]) => set((state) => ({ ...state, tabs })),
    updateActiveTab: (key: string) => set((state) => ({ ...state, activeTab: key })),
    updateNewCanvasCreating: (creating: boolean) => set((state) => ({ ...state, newCanvasCreating: creating })),

    // tabs
    updateCanvasPanelVisible: (visible: boolean) => set((state) => ({ ...state, canvasPanelVisible: visible })),

    // canvases
    updateCanvasServerStatus: (status: CanvasServerStatus) =>
      set((state) => ({ ...state, canvasServerStatus: status })),
    updateCanvasSaveStatus: (status: CanvasSaveStatus) => set((state) => ({ ...state, canvasSaveStatus: status })),
    updateCanvasCharsCount: (count: number) => set((state) => ({ ...state, canvasCharsCount: count })),
    updateLastCursorPosRef: (pos: number) => set((state) => ({ ...state, lastCursorPosRef: pos })),
    updateTocItems: (items: TableOfContentsItem[]) => set((state) => ({ ...state, tocItems: items })),

    resetState: () => set((state) => ({ ...state, ...defaultState })),
  })),
);

export const useCanvasStoreShallow = <T>(selector: (state: CanvasBaseState) => T) => {
  return useCanvasStore(useShallow(selector));
};
