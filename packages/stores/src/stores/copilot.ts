import { CopilotSession } from '@refly/openapi-schema';
import type { IContextItem } from '@refly/common-types';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

interface CopilotState {
  // state
  currentSessionId: Record<string, string | null>;
  sessionResultIds: Record<string, string[]>;
  createdCopilotSessionIds: Record<string, boolean>;
  canvasCopilotWidth: Record<string, number | null | undefined>;
  historyTemplateSessions: Record<string, CopilotSession[]>;
  pendingPrompt: Record<string, string | null>;
  pendingFiles: Record<string, IContextItem[] | null>;
  pureCopilotCanvas: Record<string, { canvasId: string; createdAt: number } | null>;

  // method
  setCurrentSessionId: (canvasId: string, sessionId: string | null) => void;
  setSessionResultIds: (sessionId: string, resultIds: string[]) => void;
  appendSessionResultId: (sessionId: string, resultId: string) => void;
  setCreatedCopilotSessionId: (sessionId: string) => void;
  setCanvasCopilotWidth: (canvasId: string, width: number) => void;
  addHistoryTemplateSession: (canvasId: string, session: CopilotSession) => void;
  removeHistoryTemplateSession: (canvasId: string, sessionId: string) => void;
  setPendingPrompt: (canvasId: string, prompt: string | null) => void;
  setPendingFiles: (canvasId: string, files: IContextItem[] | null) => void;
  setPureCopilotCanvas: (source: string, canvasId: string | null) => void;
  clearPureCopilotCanvas: (source: string) => void;
}

export const useCopilotStore = create<CopilotState>()(
  devtools(
    persist(
      (set) => ({
        currentSessionId: {},
        sessionResultIds: {},
        createdCopilotSessionIds: {},
        canvasCopilotWidth: {},
        historyTemplateSessions: {},
        pendingPrompt: {},
        pendingFiles: {},
        pureCopilotCanvas: {},

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

        addHistoryTemplateSession: (canvasId: string, session: CopilotSession) =>
          set((state) => ({
            historyTemplateSessions: {
              ...state.historyTemplateSessions,
              [canvasId]: [...(state.historyTemplateSessions[canvasId] || []), session],
            },
          })),

        removeHistoryTemplateSession: (canvasId: string, sessionId: string) =>
          set((state) => ({
            historyTemplateSessions: {
              ...state.historyTemplateSessions,
              [canvasId]:
                state.historyTemplateSessions[canvasId]?.filter((s) => s.sessionId !== sessionId) ??
                [],
            },
          })),

        setPendingPrompt: (canvasId: string, prompt: string | null) =>
          set((state) => ({
            pendingPrompt: {
              ...state.pendingPrompt,
              [canvasId]: prompt,
            },
          })),

        setPendingFiles: (canvasId: string, files: IContextItem[] | null) =>
          set((state) => ({
            pendingFiles: {
              ...state.pendingFiles,
              [canvasId]: files,
            },
          })),

        setPureCopilotCanvas: (source: string, canvasId: string | null) =>
          set((state) => ({
            pureCopilotCanvas: {
              ...state.pureCopilotCanvas,
              [source]: canvasId ? { canvasId, createdAt: Date.now() } : null,
            },
          })),

        clearPureCopilotCanvas: (source: string) =>
          set((state) => ({
            pureCopilotCanvas: {
              ...state.pureCopilotCanvas,
              [source]: null,
            },
          })),
      }),
      {
        name: 'copilot-storage',
        partialize: (state) => ({
          currentSessionId: state.currentSessionId,
          canvasCopilotWidth: state.canvasCopilotWidth,
          historyTemplateSessions: state.historyTemplateSessions,
          pendingPrompt: state.pendingPrompt,
        }),
      },
    ),
  ),
);

export const useCopilotStoreShallow = <T>(selector: (state: CopilotState) => T) => {
  return useCopilotStore(useShallow(selector));
};
