import { useCallback } from 'react';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { CanvasNodeType } from '@refly/openapi-schema';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useSiderStoreShallow } from '@refly/stores';

export const useUpdateNodeTitle = () => {
  const { projectId } = useGetProjectCanvasId();
  const { canvasId } = useCanvasContext();

  const { sourceList, setSourceList } = useSiderStoreShallow((state) => ({
    sourceList: state.sourceList,
    setSourceList: state.setSourceList,
  }));

  const setNodeDataByEntity = useSetNodeDataByEntity();

  const handleTitleUpdate = useCallback(
    (newTitle: string, entityId: string, _nodeId: string, nodeType: CanvasNodeType) => {
      setNodeDataByEntity(
        {
          entityId: entityId,
          type: nodeType,
        },
        {
          title: newTitle,
        },
      );

      if (nodeType === 'document' && projectId) {
        const source = sourceList.find((s) => s.id === entityId);
        if (source) {
          setSourceList(sourceList.map((s) => (s.id === entityId ? { ...s, title: newTitle } : s)));
        }
      }
    },
    [setNodeDataByEntity, canvasId, sourceList, setSourceList, projectId],
  );

  return handleTitleUpdate;
};
