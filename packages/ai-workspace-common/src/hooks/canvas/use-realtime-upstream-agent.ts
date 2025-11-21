import { CanvasNode, ResponseNodeMeta } from '@refly/canvas-common';
import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';

export const useRealtimeUpstreamAgents = (nodeId: string) => {
  const { nodes, edges } = useRealtimeCanvasData();
  return edges
    .filter((edge) => edge.target === nodeId)
    .map((edge) => nodes.find((node) => node.id === edge.source))
    .filter((node) => node?.type === 'skillResponse') as CanvasNode<ResponseNodeMeta>[];
};
