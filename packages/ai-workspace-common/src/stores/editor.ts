import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';
import { persist, createJSONStorage } from 'zustand/middleware';
import { EditorInstance } from '@refly-packages/editor-core/components';

interface Editor {
  instance: EditorInstance;
  lastCursorPos?: number;
  isAiEditing?: boolean;
}

export interface EditorState {}

export const useEditorStore = create<EditorState>()(
  persist(
    immer((set, get) => ({
      currentProjectId: '',
      copilotSize: 500,
      project: {
        data: null,
        loading: false,
      },
      canvases: {
        data: [],
        loading: false,
      },
      resources: {
        data: [],
        loading: false,
      },
      conversations: {
        data: [],
        loading: false,
      },

      projectActiveTab: {},
      projectTabs: {},
      projectActiveConvId: {},

      setProjectActiveConvId: (projectId, convId) =>
        set((state) => {
          state.projectActiveConvId[projectId] = convId;
        }),
      setCopilotSize: (size) =>
        set((state) => {
          state.copilotSize = size;
        }),
      setCurrentProjectId: (projectId) =>
        set((state) => {
          state.currentProjectId = projectId;
        }),
      setProjectActiveTab: (projectId, tab) =>
        set((state) => {
          state.projectActiveTab[projectId] = tab;
        }),
      setProjectTabs: (projectId, tabs) =>
        set((state) => {
          state.projectTabs[projectId] = tabs;
        }),
      setProject: (project) =>
        set((state) => {
          state.project.data = project;
        }),
      setProjectDirItems: (projectId, itemType, items) =>
        set((state) => {
          if (projectId !== state.currentProjectId) return;
          state[itemType].data = items;
        }),
      updateProjectDirItem: (projectId, itemType, itemId, updates) =>
        set((state) => {
          if (projectId !== state.currentProjectId) return;
          const itemIndex = state[itemType].data?.findIndex((c) => c.id === itemId);
          if (itemIndex !== -1) {
            state[itemType].data[itemIndex] = { ...state[itemType].data[itemIndex], ...updates };
          }
        }),
      fetchProjectDetail: async (projectId) => {
        if (projectId !== get().currentProjectId) return;

        set((state) => {
          state.project.loading = true;
        });
        const { data, error } = await getClient().getProjectDetail({
          query: { projectId },
        });

        set((state) => {
          state.project.loading = false;
          state.project.data = data?.data || null;
          if (error || !data?.success) {
            state.project.error = String(error) || 'request not success';
          }
        });
      },
      fetchProjectDirItems: async (projectId: string, itemType: ProjectDirListItemType) => {
        if (projectId !== get().currentProjectId) return;

        const config = FETCH_CONFIGS[itemType];

        set((state) => {
          state[config.stateKey].loading = true;
        });

        const { data, error } = await getClient()[config.listMethod]({
          query: { projectId, pageSize: 1000 },
        });

        set((state) => {
          state[config.stateKey].loading = false;
          state[config.stateKey].data = (data?.data || []).map((item) => ({
            id: item[config.idField],
            title: item.title,
            type: itemType,
            order: item.order,
            url: item.data?.url,
          }));
          if (error || !data?.success) {
            state[config.stateKey].error = String(error) || 'request not success';
          }
        });
      },
      fetchProjectAll: async (projectId) => {
        if (projectId !== get().currentProjectId) {
          return;
        }

        await Promise.all([
          get().fetchProjectDetail(projectId),
          get().fetchProjectDirItems(projectId, 'canvases'),
          get().fetchProjectDirItems(projectId, 'resources'),
          get().fetchProjectDirItems(projectId, 'conversations'),
        ]);
      },
    })),
    {
      name: 'project-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({}),
    },
  ),
);

export const useEditorStoreShallow = <T>(selector: (state: EditorState) => T) => {
  return useEditorStore(useShallow(selector));
};
