import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { SourceObject, SiderData } from '../types/common';

export enum SettingsModalActiveTab {
  Language = 'language',
  Subscription = 'subscription',
  Account = 'account',
  ModelProviders = 'modelProviders',
  ModelConfig = 'modelConfig',
  ParserConfig = 'parserConfig',
  DefaultModel = 'defaultModel',
  ToolsConfig = 'toolsConfig',
  Appearance = 'appearance',
}

export type SiderCollapseState = 'expanded' | 'collapsed' | 'hidden';

interface SiderState {
  // state
  collapse: boolean;
  collapseState: SiderCollapseState;
  isManualCollapse: boolean;
  showSiderDrawer: boolean;
  canvasList: SiderData[];
  projectsList: SiderData[];
  sourceList: SourceObject[];
  showCanvasListModal: boolean;
  showLibraryModal: boolean;
  showSettingModal: boolean;
  showInvitationModal: boolean;
  settingsModalActiveTab: SettingsModalActiveTab | null;

  // method
  setCollapse: (val: boolean) => void;
  setCollapseState: (val: SiderCollapseState) => void;
  setIsManualCollapse: (val: boolean) => void;
  setShowSiderDrawer: (val: boolean) => void;
  setCanvasList: (val: SiderData[]) => void;
  setProjectsList: (val: SiderData[]) => void;
  setSourceList: (val: SourceObject[]) => void;
  setShowCanvasListModal: (val: boolean) => void;
  setShowLibraryModal: (val: boolean) => void;
  setShowSettingModal: (val: boolean) => void;
  setShowInvitationModal: (val: boolean) => void;
  setSettingsModalActiveTab: (val: SettingsModalActiveTab) => void;
  updateCanvasTitle: (canvasId: string, title: string) => void;
}

export const useSiderStore = create<SiderState>()(
  devtools((set) => ({
    collapse: false,
    collapseState: 'expanded',
    isManualCollapse: false,
    showSiderDrawer: false,
    canvasList: [],
    projectsList: [],
    sourceList: [],
    showLibraryModal: false,
    showCanvasListModal: false,
    showSettingModal: false,
    showInvitationModal: false,
    settingsModalActiveTab: null,

    setCollapse: (val: boolean) =>
      set({
        collapse: val,
        collapseState: val ? 'collapsed' : 'expanded',
      }),
    setCollapseState: (val: SiderCollapseState) =>
      set({
        collapseState: val,
        collapse: val !== 'expanded',
      }),
    setIsManualCollapse: (val: boolean) => set({ isManualCollapse: val }),
    setShowSiderDrawer: (val: boolean) => set({ showSiderDrawer: val }),
    setCanvasList: (val: SiderData[]) => set({ canvasList: val }),
    setProjectsList: (val: SiderData[]) => set({ projectsList: val }),
    setSourceList: (val: SourceObject[]) => set({ sourceList: val }),
    setShowCanvasListModal: (val: boolean) => set({ showCanvasListModal: val }),
    setShowLibraryModal: (val: boolean) => set({ showLibraryModal: val }),
    setShowSettingModal: (val: boolean) => set({ showSettingModal: val }),
    setShowInvitationModal: (val: boolean) => set({ showInvitationModal: val }),
    setSettingsModalActiveTab: (val: SettingsModalActiveTab) =>
      set({ settingsModalActiveTab: val }),
    updateCanvasTitle: (canvasId: string, title: string) => {
      set((state) => {
        const canvasList = state.canvasList.map((canvas) =>
          canvas.id === canvasId ? { ...canvas, name: title } : canvas,
        );
        return { canvasList };
      });
    },
  })),
);

export const useSiderStoreShallow = <T>(selector: (state: SiderState) => T) => {
  return useSiderStore(useShallow(selector));
};
