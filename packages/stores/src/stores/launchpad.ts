import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { persist } from 'zustand/middleware';
import { GenericToolset } from '@refly/openapi-schema';

interface LaunchpadState {
  // state
  chatHistoryOpen: boolean;
  recommendQuestionsOpen: boolean;
  showPremiumBanner: boolean;
  selectedToolsets: GenericToolset[];

  // method
  setChatHistoryOpen: (val: boolean) => void;
  setRecommendQuestionsOpen: (val: boolean) => void;
  setShowPremiumBanner: (val: boolean) => void;
  setSelectedToolsets: (toolsets: GenericToolset[]) => void;
}

export const useLaunchpadStore = create<LaunchpadState>()(
  devtools(
    persist(
      (set) => ({
        chatHistoryOpen: true,
        recommendQuestionsOpen: false,
        showPremiumBanner: true,
        selectedToolsets: [],

        setChatHistoryOpen: (open: boolean) => set({ chatHistoryOpen: open }),
        setRecommendQuestionsOpen: (open: boolean) => set({ recommendQuestionsOpen: open }),
        setShowPremiumBanner: (open: boolean) => set({ showPremiumBanner: open }),
        setSelectedToolsets: (toolsets: GenericToolset[]) => set({ selectedToolsets: toolsets }),
      }),
      {
        name: 'launchpad-storage',
        partialize: (state) => ({
          showPremiumBanner: state.showPremiumBanner,
          selectedToolsets: state.selectedToolsets,
        }),
      },
    ),
  ),
);

export const useLaunchpadStoreShallow = <T>(selector: (state: LaunchpadState) => T) => {
  return useLaunchpadStore(useShallow(selector));
};
