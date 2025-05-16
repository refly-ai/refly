import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
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
  devtools((set) => ({
    isPilotOpen: false,
    activeSessionId: null,

    setIsPilotOpen: (val: boolean) => set({ isPilotOpen: val }),
    setActiveSessionId: (sessionId: string | null) => set({ activeSessionId: sessionId }),
  })),
);

export const usePilotStoreShallow = <T>(selector: (state: PilotState) => T) => {
  return usePilotStore(useShallow(selector));
};
