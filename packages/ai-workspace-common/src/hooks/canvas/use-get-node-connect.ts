import { useCallback } from 'react';
import { useReactFlow, XYPosition } from '@xyflow/react';
import { CanvasNodeType } from '@refly/openapi-schema';
import { CanvasNodeFilter } from '@refly/canvas-common';
import { NodeDragCreateInfo } from '@refly-packages/ai-workspace-common/events/nodeOperations';

export function useGetNodeConnectFromDragCreateInfo() {
  const { screenToFlowPosition } = useReactFlow();

  const getConnectionInfo = useCallback(
    (
      data: {
        entityId: string;
        type: CanvasNodeType;
      },
      dragCreateInfo?: NodeDragCreateInfo,
    ) => {
      let position: XYPosition | undefined;
      let connectTo: CanvasNodeFilter[] | undefined = [
        { type: data.type, entityId: data.entityId, handleType: 'source' },
      ];

      if (dragCreateInfo) {
        // Convert screen coordinates to flow coordinates
        position = screenToFlowPosition({
          x: dragCreateInfo.position.x,
          y: dragCreateInfo.position.y,
        });

        // Determine connection based on handleType
        if (dragCreateInfo.handleType === 'target') {
          // If the original handle was target, new node should connect as source
          connectTo = [{ type: data.type, entityId: data.entityId, handleType: 'target' }];
        }
      }

      return { position, connectTo };
    },
    [screenToFlowPosition],
  );

  return {
    getConnectionInfo,
  };
}
