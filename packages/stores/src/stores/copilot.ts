import { CopilotSession, CanvasNodeType } from '@refly/openapi-schema';
import type { IContextItem } from '@refly/common-types';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

/**
 * Context for targeted node editing in Copilot.
 * When a user selects a node on the canvas, this context captures
 * the relevant information to enable Copilot to perform targeted edits.
 */
export interface NodeEditContext {
  /** The internal node ID from ReactFlow */
  nodeId: string;
  /** The entity ID used for referencing in workflows */
  entityId: string;
  /** The task ID from workflow plan, used for patch operations */
  taskId: string;
  /** The type of the selected node */
  nodeType: CanvasNodeType;
  /** Current state of the node that can be edited */
  currentState: {
    query?: string;
    toolsets?: string[];
    title?: string;
  };
  /** Graph context showing upstream and downstream dependencies */
  graphContext: {
    upstreamTaskIds: string[];
    downstreamTaskIds: string[];
  };
  /** The edit mode: modify the current node or extend from it */
  editMode: 'modify' | 'extend';
}

interface CopilotState {
  // state
  currentSessionId: Record<string, string | null>;
  sessionResultIds: Record<string, string[]>;
  createdCopilotSessionIds: Record<string, boolean>;
  canvasCopilotWidth: Record<string, number | null | undefined>;
  historyTemplateSessions: Record<string, CopilotSession[]>;
  pendingPrompt: Record<string, string | null>;
  /** Node edit context for targeted editing, keyed by canvasId */
  nodeEditContext: Record<string, NodeEditContext | null>;
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
  /** Set or clear the node edit context for targeted editing */
  setNodeEditContext: (canvasId: string, context: NodeEditContext | null) => void;
  /** Update the edit mode for the current node edit context */
  setNodeEditMode: (canvasId: string, editMode: 'modify' | 'extend') => void;
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
        nodeEditContext: {},
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

        setNodeEditContext: (canvasId: string, context: NodeEditContext | null) =>
          set((state) => ({
            nodeEditContext: {
              ...state.nodeEditContext,
              [canvasId]: context,
            },
          })),

        setNodeEditMode: (canvasId: string, editMode: 'modify' | 'extend') =>
          set((state) => {
            const currentContext = state.nodeEditContext[canvasId];
            if (!currentContext) return state;
            return {
              nodeEditContext: {
                ...state.nodeEditContext,
                [canvasId]: {
                  ...currentContext,
                  editMode,
                },
              },
            };
          }),
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
          pureCopilotCanvas: state.pureCopilotCanvas,
        }),
      },
    ),
  ),
);

export const useCopilotStoreShallow = <T>(selector: (state: CopilotState) => T) => {
  return useCopilotStore(useShallow(selector));
};
