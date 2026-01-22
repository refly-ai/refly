import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

import type { ModelInfo, ProviderItem } from '@refly/openapi-schema';

export type ChatMode = 'ask' | 'agent' | 'media';

interface ChatState {
  newQAText: string;
  selectedModel: ModelInfo | null;
  skillSelectedModel: ModelInfo | null;
  chatMode: ChatMode;
  enableKnowledgeBaseSearch: boolean;
  mediaSelectedModel: ProviderItem | null;
  mediaModelList: ProviderItem[];
  mediaModelListLoading: boolean;

  // method
  setNewQAText: (val: string) => void;
  setSelectedModel: (val: ModelInfo) => void;
  setSkillSelectedModel: (val: ModelInfo | null) => void;
  setChatMode: (val: ChatMode) => void;
  setEnableKnowledgeBaseSearch: (val: boolean) => void;
  setMediaSelectedModel: (val: ProviderItem) => void;
  setMediaModelList: (val: ProviderItem[]) => void;
  setMediaModelListLoading: (val: boolean) => void;
  resetState: () => void;
}

const defaultConfigurableState = {
  selectedModel: null,
  skillSelectedModel: null,
  chatMode: 'ask' as ChatMode,
  enableKnowledgeBaseSearch: true,
  mediaSelectedModel: null,
  mediaModelList: [],
  mediaModelListLoading: false,
};

const defaultNewQAText = '';

const defaultState = {
  newQAText: defaultNewQAText,
  ...defaultConfigurableState,
};

export const useChatStore = create<ChatState>()(
  devtools(
    persist(
      (set) => ({
        ...defaultState,

        setNewQAText: (val: string) => set({ newQAText: val }),
        setSelectedModel: (val: ModelInfo) => set({ selectedModel: val }),
        setSkillSelectedModel: (val: ModelInfo | null) => set({ skillSelectedModel: val }),
        setChatMode: (val: ChatMode) => set({ chatMode: val }),
        setEnableKnowledgeBaseSearch: (val: boolean) => set({ enableKnowledgeBaseSearch: val }),
        setMediaSelectedModel: (val: ProviderItem) => set({ mediaSelectedModel: val }),
        setMediaModelList: (val: ProviderItem[]) => set({ mediaModelList: val }),
        setMediaModelListLoading: (val: boolean) => set({ mediaModelListLoading: val }),
        resetState: () => {
          return set((state) => ({ ...state }));
        },
      }),
      {
        name: 'chat-storage',
        partialize: (state) => ({
          newQAText: state.newQAText,
          selectedModel: state.selectedModel,
          skillSelectedModel: state.skillSelectedModel,
          chatMode: state.chatMode,
          mediaSelectedModel: state.mediaSelectedModel,
        }),
      },
    ),
  ),
);

export const useChatStoreShallow = <T>(selector: (state: ChatState) => T) => {
  return useChatStore(useShallow(selector));
};
