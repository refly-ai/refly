import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { CanvasNode } from '@refly/canvas-common';
import { CanvasNodeType } from '@refly/openapi-schema';
import { genSkillID } from '@refly/utils/id';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { logEvent } from '@refly/telemetry-web';

interface DuplicateNodeOptions {
  /** Offset for the new node position (default: { x: 400, y: 100 }) */
  offset?: { x: number; y: number };
  /** Whether to log telemetry event (default: true) */
  logTelemetry?: boolean;
}

export const useDuplicateNode = () => {
  const { getNode } = useReactFlow();

  const duplicateNode = useCallback(
    (node: CanvasNode<any>, canvasId?: string, options: DuplicateNodeOptions = {}) => {
      const { offset = { x: 400, y: 100 }, logTelemetry = true } = options;

      // Only support duplicating skillResponse nodes for now
      if (node.type !== 'skillResponse') {
        console.warn(`Duplicating ${node.type} nodes is not supported yet`);
        return false;
      }

      const { data } = node;

      if (logTelemetry) {
        logEvent('duplicate_node_skill_response', null, {
          canvasId,
          nodeId: node.id,
        });
      }

      // Extract metadata for duplication
      const { contextItems, selectedToolsets, modelInfo, runtimeConfig } = data?.metadata || {};
      const title = String(data?.title || '');
      const query = data?.metadata?.structuredData?.query;

      if (!query) {
        console.warn('Cannot duplicate node: missing query data');
        return false;
      }

      // Get current node position
      const currentNode = getNode(node.id);
      const currentPosition = currentNode?.position || { x: 0, y: 0 };

      // Generate a new skill ID for the duplicated node
      const newSkillId = genSkillID();

      // Emit addNode event to create the duplicate
      nodeOperationsEmitter.emit('addNode', {
        node: {
          type: 'skillResponse' as CanvasNodeType,
          data: {
            title: title,
            entityId: newSkillId,
            metadata: {
              query,
              contextItems,
              selectedToolsets,
              modelInfo,
              runtimeConfig,
              status: 'init',
            },
          },
          // Position offset from current node to avoid overlapping
          position: {
            x: currentPosition.x + offset.x,
            y: currentPosition.y + offset.y,
          },
        },
      });

      return true;
    },
    [getNode],
  );

  return {
    duplicateNode,
  };
};
