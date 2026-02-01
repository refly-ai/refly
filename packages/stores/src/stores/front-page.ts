import { create } from 'zustand';
import type {
  SkillTemplateConfig,
  SkillRuntimeConfig,
  MediaType,
  GenericToolset,
  ModelInfo,
} from '@refly/openapi-schema';

export interface MediaQueryData {
  mediaType: MediaType;
  query: string;
  modelInfo: ModelInfo;
  providerItemId: string;
}

interface FrontPageState {
  query: string;
  canvasQueries: Record<string, string>; // Map canvasId to query
  selectedToolsets: GenericToolset[];
  tplConfig: SkillTemplateConfig | null;
  runtimeConfig: SkillRuntimeConfig | null;
  mediaQueryData: MediaQueryData | null;
  setQuery?: (query: string, canvasId?: string) => void;
  getQuery?: (canvasId?: string) => string;
  clearCanvasQuery?: (canvasId: string) => void;
  setSelectedToolsets?: (toolsets: GenericToolset[]) => void;
  setTplConfig?: (tplConfig: SkillTemplateConfig | null) => void;
  setRuntimeConfig?: (runtimeConfig: SkillRuntimeConfig | null) => void;
  setMediaQueryData?: (mediaQueryData: MediaQueryData | null) => void;
  reset?: () => void;
}

const initialState: FrontPageState = {
  query: '',
  canvasQueries: {},
  selectedToolsets: [],
  tplConfig: null,
  runtimeConfig: { disableLinkParsing: true, enabledKnowledgeBase: false },
  mediaQueryData: null,
};

export const useFrontPageStore = create<FrontPageState>((set, get) => ({
  ...initialState,
  setQuery: (query, canvasId) => {
    if (canvasId) {
      // Set query for specific canvas
      set((state) => ({
        canvasQueries: {
          ...state.canvasQueries,
          [canvasId]: query,
        },
      }));
    } else {
      // Set global query (for backward compatibility)
      set({ query });
    }
  },
  getQuery: (canvasId) => {
    const state = get();
    if (canvasId) {
      return state.canvasQueries[canvasId] || '';
    }
    return state.query;
  },
  clearCanvasQuery: (canvasId) => {
    set((state) => {
      const { [canvasId]: _, ...remainingQueries } = state.canvasQueries;
      return { canvasQueries: remainingQueries };
    });
  },
  setSelectedToolsets: (selectedToolsets) => set({ selectedToolsets }),
  setTplConfig: (tplConfig) => {
    set({ tplConfig });
  },
  setRuntimeConfig: (runtimeConfig) => set({ runtimeConfig }),
  setMediaQueryData: (mediaQueryData) => {
    set({ mediaQueryData });
  },
  reset: () => set(initialState),
}));

export const useFrontPageStoreShallow = (selector: (state: FrontPageState) => any) => {
  return useFrontPageStore(selector);
};
