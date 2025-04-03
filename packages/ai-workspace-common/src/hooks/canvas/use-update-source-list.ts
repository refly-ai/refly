import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { Resource, Document } from '@refly/openapi-schema';
import { useCallback } from 'react';

export const useUpdateSourceList = () => {
  const { projectId: currentProjectId } = useGetProjectCanvasId();
  const { sourceList, setSourceList } = useSiderStoreShallow((state) => ({
    sourceList: state.sourceList,
    setSourceList: state.setSourceList,
  }));

  const updateSourceList = useCallback(
    (addedList: Document[] | Resource[], projectId: string) => {
      if (currentProjectId === projectId) {
        const newSourceList = addedList.map((source) => ({
          ...source,
          entityId: source.resourceId,
          entityType: 'resource' as const,
        }));
        setSourceList([...newSourceList, ...sourceList]);
      }
    },
    [currentProjectId, sourceList, setSourceList],
  );

  return { sourceList, updateSourceList };
};
