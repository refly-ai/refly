import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

interface ProjectSelectorState {
  selectedProjectId: string | undefined;
  setSelectedProjectId: (id: string) => void;
}

export const useProjectSelectorStore = create<ProjectSelectorState>((set) => ({
  selectedProjectId: undefined,
  setSelectedProjectId: (id: string) => set({ selectedProjectId: id }),
}));

export const useProjectSelectorStoreShallow = <T>(selector: (state: ProjectSelectorState) => T) => {
  return useProjectSelectorStore(useShallow(selector));
};
