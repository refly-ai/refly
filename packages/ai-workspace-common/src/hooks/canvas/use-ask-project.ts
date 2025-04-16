import { useCallback, useEffect, useState } from 'react';
import { useProjectSelectorStoreShallow } from '@refly-packages/ai-workspace-common/stores/project-selector';

export const useAskProject = () => {
  const { selectedProjectId, setSelectedProjectId } = useProjectSelectorStoreShallow((state) => ({
    selectedProjectId: state.selectedProjectId,
    setSelectedProjectId: state.setSelectedProjectId,
  }));

  const [projectId, setProjectId] = useState<string | undefined>(selectedProjectId);

  // Initialize projectId from props or store once
  useEffect(() => {
    if (selectedProjectId) {
      setProjectId(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Handle project change
  const handleProjectChange = useCallback(
    (newProjectId: string) => {
      setProjectId(newProjectId);
    },
    [setSelectedProjectId],
  );

  const getFinalProjectId = useCallback(
    (comingProjectId?: string) => {
      return comingProjectId || projectId;
    },
    [projectId, selectedProjectId],
  );

  return { projectId, handleProjectChange, getFinalProjectId };
};
