import { useEffect } from 'react';
import { CanvasNode, CanvasNodeData, ResponseNodeMeta } from '@refly/canvas-common';
import { useReactFlow } from '@xyflow/react';
import { genUniqueId } from '@refly/utils/id';

export const useSyncAgentConnections = (
  nodeId: string,
  nodeData: CanvasNodeData<ResponseNodeMeta>,
) => {
  const { getNodes, setEdges } = useReactFlow<CanvasNode<any>>();
  const resultIds = nodeData?.metadata?.upstreamResultIds ?? [];

  useEffect(() => {
    const nodes = getNodes();

    const entityToNodeId = new Map<string, string>();
    for (const node of nodes ?? []) {
      const entityId = node?.data?.entityId;
      if (entityId && node.type === 'skillResponse') {
        entityToNodeId.set(entityId, node.id);
      }
    }

    const uniqueSourceIds: string[] = [];
    const seenSourceIds = new Set<string>();
    for (const resultId of resultIds ?? []) {
      const sourceId = entityToNodeId.get(resultId);
      if (!sourceId || sourceId === nodeId || seenSourceIds.has(sourceId)) {
        continue;
      }
      seenSourceIds.add(sourceId);
      uniqueSourceIds.push(sourceId);
    }

    const desiredSourceSet = new Set(uniqueSourceIds);
    setEdges((prevEdges = []) => {
      const currentEdges = prevEdges.filter((edge) => edge.target === nodeId);
      const edgesToRemove = currentEdges.filter((edge) => !desiredSourceSet.has(edge.source));
      const edgesToAdd = uniqueSourceIds
        .filter((sourceId) => !currentEdges.some((edge) => edge.source === sourceId))
        .map((sourceId) => ({
          id: `edge-${genUniqueId()}`,
          source: sourceId,
          target: nodeId,
          type: 'default',
        }));

      if (!edgesToAdd.length && !edgesToRemove.length) {
        return prevEdges;
      }

      const removeIds = new Set(edgesToRemove.map((edge) => edge.id));
      const filteredEdges = prevEdges.filter((edge) => !removeIds.has(edge.id));
      const updatedEdges = [...filteredEdges, ...edgesToAdd];

      return updatedEdges;
    });
  }, [resultIds, getNodes, setEdges, nodeId]);
};
