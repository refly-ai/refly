import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import { CanvasNodeFilter } from '@refly/canvas-common/src/types';
import { useCallback } from 'react';
import { CanvasNodeType, XYPosition } from '@refly/openapi-schema';
import { genNodeEntityId } from '@refly/utils/id';

export const useAddAgentGlobal = () => {
  const { addNode } = useAddNode();
  const { nodes } = useCanvasData();

  const addGlobalAgent = useCallback(
    (options: { position?: XYPosition } = {}) => {
      const { position } = options;

      // Find selected skillResponse node
      const selectedSkillResponseNode = nodes?.find(
        (node) => node.selected && node.type === 'skillResponse',
      );

      let connectTo: CanvasNodeFilter[] | undefined = undefined;

      if (selectedSkillResponseNode?.data?.entityId) {
        // If there's a selected skillResponse node, connect to it
        connectTo = [
          {
            type: selectedSkillResponseNode.type as CanvasNodeType,
            entityId: selectedSkillResponseNode.data.entityId,
            handleType: 'source',
          },
        ];
      } else {
        // Otherwise, find all skillResponse nodes and get the latest one
        const skillResponseNodes = nodes?.filter((node) => node.type === 'skillResponse') ?? [];

        if (skillResponseNodes.length > 0) {
          // Sort by createdAt (latest first), fallback to entityId if createdAt is not available
          const sortedNodes = [...skillResponseNodes].sort((a, b) => {
            const aTime = a.data?.createdAt ? new Date(a.data.createdAt).getTime() : 0;
            const bTime = b.data?.createdAt ? new Date(b.data.createdAt).getTime() : 0;

            if (aTime !== bTime) {
              return bTime - aTime; // Latest first
            }

            // Fallback to entityId comparison if createdAt is the same or missing
            return (b.data?.entityId ?? '').localeCompare(a.data?.entityId ?? '');
          });

          const latestNode = sortedNodes[0];
          if (latestNode?.data?.entityId) {
            connectTo = [
              {
                type: latestNode.type as CanvasNodeType,
                entityId: latestNode.data.entityId,
                handleType: 'source',
              },
            ];
          }
        }
      }

      addNode(
        {
          type: 'skillResponse',
          data: {
            title: '',
            entityId: genNodeEntityId('skillResponse'),
            metadata: {
              status: 'init',
              ...(connectTo?.length > 0 && {
                contextItems: [{ type: 'skillResponse', entityId: connectTo[0].entityId }],
              }),
            },
          },
          position,
        },
        connectTo,
        true,
        true,
      );
    },
    [addNode, nodes],
  );
  return { addGlobalAgent };
};
