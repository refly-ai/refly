import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

interface PilotState {
  // state
  isPilotOpen: boolean;
  activeSessionId: string | null;

  // method
  setIsPilotOpen: (val: boolean) => void;
  setActiveSessionId: (sessionId: string | null) => void;
}

export const usePilotStore = create<PilotState>()(
  devtools(
    persist(
      (set) => ({
        isPilotOpen: false,
        activeSessionId: null,

        setIsPilotOpen: (val: boolean) => set({ isPilotOpen: val }),
        setActiveSessionId: (sessionId: string | null) => set({ activeSessionId: sessionId }),
      }),
      {
        name: 'pilot-storage', // unique name for the localStorage key
        partialize: (state) => ({
          isPilotOpen: state.isPilotOpen,
        }), // only persist these fields
      },
    ),
  ),
);

export const usePilotStoreShallow = <T>(selector: (state: PilotState) => T) => {
  return usePilotStore(useShallow(selector));
};
