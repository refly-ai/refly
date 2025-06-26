import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface AppState {
  isInitialLoading: boolean;
  setInitialLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set) => ({
    isInitialLoading: true,
    setInitialLoading: (loading: boolean) => set({ isInitialLoading: loading }),
  })),
);

export const useAppStoreShallow = <T>(selector: (state: AppState) => T): T => useAppStore(selector);
