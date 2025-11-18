import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

interface CopilotState {
  // state
  currentSessionId: Record<string, string | null>;
  sessionResultIds: Record<string, string[]>;
  createdCopilotSessionIds: Record<string, boolean>;
  canvasCopilotWidth: Record<string, number | null | undefined>;

  // method
  setCurrentSessionId: (canvasId: string, sessionId: string | null) => void;
  setSessionResultIds: (sessionId: string, resultIds: string[]) => void;
  appendSessionResultId: (sessionId: string, resultId: string) => void;
  setCreatedCopilotSessionId: (sessionId: string) => void;
  setCanvasCopilotWidth: (canvasId: string, width: number) => void;
}

export const useCopilotStore = create<CopilotState>()(
  devtools(
    persist(
      (set) => ({
        currentSessionId: {},
        sessionResultIds: {},
        createdCopilotSessionIds: {},
        canvasCopilotWidth: {},

        setCurrentSessionId: (canvasId: string, sessionId: string | null) =>
          set((state) => ({
            currentSessionId: {
              ...state.currentSessionId,
              [canvasId]: sessionId,
            },
          })),

        setSessionResultIds: (sessionId: string, resultIds: string[]) =>
          set((state) => ({
            sessionResultIds: {
              ...state.sessionResultIds,
              [sessionId]: resultIds,
            },
          })),

        appendSessionResultId: (sessionId: string, resultId: string) =>
          set((state) => ({
            sessionResultIds: {
              ...state.sessionResultIds,
              [sessionId]: [...(state.sessionResultIds[sessionId] || []), resultId],
            },
          })),

        setCreatedCopilotSessionId: (sessionId: string) =>
          set((state) => ({
            createdCopilotSessionIds: {
              ...state.createdCopilotSessionIds,
              [sessionId]: true,
            },
          })),

        setCanvasCopilotWidth: (canvasId: string, width: number) =>
          set((state) => ({
            canvasCopilotWidth: {
              ...state.canvasCopilotWidth,
              [canvasId]: width,
            },
          })),
      }),
      {
        name: 'copilot-storage',
        partialize: (state) => ({
          currentSessionId: state.currentSessionId,
          canvasCopilotWidth: state.canvasCopilotWidth,
        }),
      },
    ),
  ),
);

export const useCopilotStoreShallow = <T>(selector: (state: CopilotState) => T) => {
  return useCopilotStore(useShallow(selector));
};
