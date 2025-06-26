import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

import type { IRuntime } from '@refly/common-types';
import { ModelInfo } from '@refly/openapi-schema';

// types
import type { CanvasEditConfig, InPlaceActionType } from '@refly/utils';
import { MessageIntentSource } from '@refly-packages/ai-workspace-common/types/copilot';

export type ChatBehavior = 'askIntentMatch' | 'askFollowUp' | 'askNew';

export interface MessageIntentContext {
  canvasEditConfig?: CanvasEditConfig;
  inPlaceActionType?: InPlaceActionType;
  canvasContext?: {
    canvasId?: string;
  };
  resourceContext?: {
    resourceId?: string; // may sendMessage from resource's copilot
  };
  convId?: string;
  enableWebSearch?: boolean;
  enableDeepReasonWebSearch?: boolean;
  enableKnowledgeBaseSearch?: boolean;
  env: {
    runtime: IRuntime;
    source: MessageIntentSource;
  };
}

export interface ChatState {
  newQAText: string;

  messageIntentContext: MessageIntentContext | undefined; // has messageIntentContext means sendMessage interaction, otherwise means route jump interaction

  selectedModel: ModelInfo;
  skillSelectedModel: ModelInfo;
  isPilotActivated: boolean;
  enableWebSearch: boolean;
  enableDeepReasonWebSearch: boolean;
  enableKnowledgeBaseSearch: boolean;

  // method
  setNewQAText: (val: string) => void;
  setMessageIntentContext: (val: MessageIntentContext) => void;
  setSelectedModel: (val: ModelInfo) => void;
  setSkillSelectedModel: (val: ModelInfo) => void;
  setIsPilotActivated: (val: boolean) => void;
  setEnableWebSearch: (val: boolean) => void;
  setEnableDeepReasonWebSearch: (val: boolean) => void;
  setEnableKnowledgeBaseSearch: (val: boolean) => void;
  resetState: () => void;
}

const defaultConfigurableState = {
  selectedModel: null,
  skillSelectedModel: null,
  isPilotActivated: false,
  enableWebSearch: true,
  enableDeepReasonWebSearch: false,
  enableKnowledgeBaseSearch: true,
};

export const defaultNewQAText = '';

export const defaultExtraState = {
  messageIntentContext: undefined,
};

export const defaultState = {
  newQAText: defaultNewQAText,
  ...defaultConfigurableState,
  ...defaultExtraState,
};

export const useChatStore = create<ChatState>()(
  devtools(
    persist(
      (set) => ({
        ...defaultState,

        setNewQAText: (val: string) => set({ newQAText: val }),
        setMessageIntentContext: (val: MessageIntentContext) => set({ messageIntentContext: val }),
        setSelectedModel: (val: ModelInfo) => set({ selectedModel: val }),
        setSkillSelectedModel: (val: ModelInfo) => set({ skillSelectedModel: val }),
        setIsPilotActivated: (val: boolean) => set({ isPilotActivated: val }),
        setEnableWebSearch: (val: boolean) => set({ enableWebSearch: val }),
        setEnableDeepReasonWebSearch: (val: boolean) => set({ enableDeepReasonWebSearch: val }),
        setEnableKnowledgeBaseSearch: (val: boolean) => set({ enableKnowledgeBaseSearch: val }),
        resetState: () => {
          return set((state) => ({ ...state, ...defaultExtraState }));
        },
      }),
      {
        name: 'chat-storage',
        partialize: (state) => ({
          newQAText: state.newQAText,
          selectedModel: state.selectedModel,
          skillSelectedModel: state.skillSelectedModel,
          isPilotActivated: state.isPilotActivated,
        }),
      },
    ),
  ),
);

export const useChatStoreShallow = <T>(selector: (state: ChatState) => T) => {
  return useChatStore(useShallow(selector));
};
