import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { persist } from 'zustand/middleware';

interface LaunchpadState {
  // state
  chatHistoryOpen: boolean;
  recommendQuestionsOpen: boolean;
  showPremiumBanner: boolean;
  mcpSelectorOpen: boolean;
  selectedMcpServers: string[];

  // method
  setChatHistoryOpen: (val: boolean) => void;
  setRecommendQuestionsOpen: (val: boolean) => void;
  setShowPremiumBanner: (val: boolean) => void;
  setMcpSelectorOpen: (val: boolean) => void;
  setSelectedMcpServers: (servers: string[]) => void;
}

export const useLaunchpadStore = create<LaunchpadState>()(
  devtools(
    persist(
      (set) => ({
        chatHistoryOpen: true,
        recommendQuestionsOpen: false,
        showPremiumBanner: true,
        mcpSelectorOpen: false,
        selectedMcpServers: [],

        setChatHistoryOpen: (open: boolean) => set({ chatHistoryOpen: open }),
        setRecommendQuestionsOpen: (open: boolean) => set({ recommendQuestionsOpen: open }),
        setShowPremiumBanner: (open: boolean) => set({ showPremiumBanner: open }),
        setMcpSelectorOpen: (open: boolean) => set({ mcpSelectorOpen: open }),
        setSelectedMcpServers: (servers: string[]) => set({ selectedMcpServers: servers }),
      }),
      {
        name: 'launchpad-storage',
        partialize: (state) => ({
          showPremiumBanner: state.showPremiumBanner,
          selectedMcpServers: state.selectedMcpServers,
        }),
      },
    ),
  ),
);

export const useLaunchpadStoreShallow = <T>(selector: (state: LaunchpadState) => T) => {
  return useLaunchpadStore(useShallow(selector));
};
