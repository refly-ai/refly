import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

interface AppState {
  isInitialLoading: boolean;
  setInitialLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>()(
  devtools((set) => ({
    isInitialLoading: true,
    setInitialLoading: (loading: boolean) => set({ isInitialLoading: loading }),
  })),
);

export const useAppStoreShallow = <T>(selector: (state: AppState) => T) => {
  return useAppStore(useShallow(selector));
};
