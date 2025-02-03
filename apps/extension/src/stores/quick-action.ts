import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {} from '@redux-devtools/extension';

interface BarPosition {
  top?: number;
  left?: number;
}

interface QuickActionState {
  // state
  selectedText: string;
  toolbarVisible: boolean;
  barDimension: {
    width: number;
    height: number;
  };
  barPosition: BarPosition;

  // method
  setSelectedText: (val: string) => void;
  setToolbarVisible: (val: boolean) => void;
  setBarPosition: (val: BarPosition) => void;
  resetState: () => void;
}

const defaultState = {
  selectedText: '',
  toolbarVisible: false,
};

export const useQuickActionStore = create<QuickActionState>()(
  devtools((set) => ({
    ...defaultState,
    barDimension: {
      width: 145,
      height: 33,
    },
    barPosition: {
      top: null,
      left: null,
    },

    setSelectedText: (val: string) => set({ selectedText: val }),
    setToolbarVisible: (val: boolean) => set({ toolbarVisible: val }),
    setBarPosition: (val: BarPosition) => set({ barPosition: val }),
    resetState: () => set((state) => ({ ...state, ...defaultState })),
  })),
);
