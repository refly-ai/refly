import { IContextItem } from '@refly/common-types';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

interface PilotState {
  // state
  isPilotOpen: boolean;
  activeSessionIdByCanvas: Record<string, string | null>;
  contextItemsByCanvas: Record<string, IContextItem[]>;
  // method
  setIsPilotOpen: (val: boolean) => void;
  setActiveSessionId: (canvasId: string, sessionId: string | null) => void;
  setContextItems: (
    canvasId: string,
    items: IContextItem[] | ((prevItems: IContextItem[]) => IContextItem[]),
  ) => void;
}

export const usePilotStore = create<PilotState>()(
  devtools(
    persist(
      (set) => ({
        isPilotOpen: false,
        activeSessionIdByCanvas: {},
        contextItemsByCanvas: {},
        setContextItems: (
          canvasId: string,
          items: IContextItem[] | ((prevItems: IContextItem[]) => IContextItem[]),
        ) =>
          set((state) => {
            const currentItems = state.contextItemsByCanvas[canvasId] || [];
            const newItems = typeof items === 'function' ? items(currentItems) : items;
            return {
              contextItemsByCanvas: {
                ...state.contextItemsByCanvas,
                [canvasId]: newItems,
              },
            };
          }),
        setIsPilotOpen: (val: boolean) => set({ isPilotOpen: val }),
        setActiveSessionId: (canvasId: string, sessionId: string | null) =>
          set((state) => ({
            activeSessionIdByCanvas: {
              ...state.activeSessionIdByCanvas,
              [canvasId]: sessionId,
            },
          })),
      }),
      {
        name: 'pilot-storage', // unique name for the localStorage key
        partialize: (state) => ({
          isPilotOpen: state.isPilotOpen,
          activeSessionIdByCanvas: state.activeSessionIdByCanvas,
          contextItemsByCanvas: state.contextItemsByCanvas,
        }),
      },
    ),
  ),
);

export const usePilotStoreShallow = <T>(selector: (state: PilotState) => T) => {
  return usePilotStore(useShallow(selector));
};
