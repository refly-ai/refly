import { create } from 'zustand';
import type {
  Skill,
  SkillTemplateConfig,
  SkillRuntimeConfig,
  MediaType,
} from '@refly/openapi-schema';

export interface MediaQueryData {
  mediaType: MediaType;
  query: string;
  model: string;
  providerItemId: string;
}

interface FrontPageState {
  query: string;
  canvasQueries: Record<string, string>; // Map canvasId to query
  selectedSkill: Skill | null;
  tplConfig: SkillTemplateConfig | null;
  runtimeConfig: SkillRuntimeConfig | null;
  mediaQueryData: MediaQueryData | null;
  setQuery?: (query: string, canvasId?: string) => void;
  getQuery?: (canvasId?: string) => string;
  clearCanvasQuery?: (canvasId: string) => void;
  setSelectedSkill?: (skill: Skill | null) => void;
  setTplConfig?: (tplConfig: SkillTemplateConfig | null) => void;
  setRuntimeConfig?: (runtimeConfig: SkillRuntimeConfig | null) => void;
  setMediaQueryData?: (mediaQueryData: MediaQueryData | null) => void;
  reset?: () => void;
}

const initialState: FrontPageState = {
  query: '',
  canvasQueries: {},
  selectedSkill: null,
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
  setSelectedSkill: (selectedSkill) => set({ selectedSkill }),
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
