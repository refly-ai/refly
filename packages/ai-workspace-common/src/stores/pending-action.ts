import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { SkillTemplateConfig, ModelInfo, Skill } from '@refly/openapi-schema';

export interface PendingActionParams {
  query: string;
  selectedSkill: Skill | null;
  selectedModel: ModelInfo | null;
  contextItems: any[];
  tplConfig: SkillTemplateConfig | null;
  runtimeConfig: Record<string, any> | null;
  projectId?: string;
}

interface PendingActionState {
  // state
  pendingActionParams: PendingActionParams | null;
  targetCanvasId: string | null;
  isActionPending: boolean;

  // methods
  setPendingAction: (params: PendingActionParams, targetCanvasId: string | null) => void;
  clearPendingAction: () => void;
  consumePendingAction: (canvasId: string) => PendingActionParams | null;
}

export const usePendingActionStore = create<PendingActionState>()(
  devtools((set, get) => ({
    pendingActionParams: null,
    targetCanvasId: null,
    isActionPending: false,

    setPendingAction: (params: PendingActionParams, targetCanvasId: string | null) =>
      set({
        pendingActionParams: params,
        targetCanvasId,
        isActionPending: true,
      }),

    clearPendingAction: () =>
      set({
        pendingActionParams: null,
        targetCanvasId: null,
        isActionPending: false,
      }),

    consumePendingAction: (canvasId: string) => {
      const { isActionPending, targetCanvasId, pendingActionParams, clearPendingAction } = get();

      // If there's a pending action and either the targetCanvasId matches or is null
      if (isActionPending && (targetCanvasId === canvasId || targetCanvasId === null)) {
        const params = pendingActionParams;
        clearPendingAction();
        return params;
      }

      return null;
    },
  })),
);

export const usePendingActionStoreShallow = <T>(selector: (state: PendingActionState) => T) => {
  return usePendingActionStore(useShallow(selector));
};
