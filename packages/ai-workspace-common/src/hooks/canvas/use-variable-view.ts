import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useNodePreviewControl } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { locateToVariableEmitter } from '@refly-packages/ai-workspace-common/events/locateToVariable';
import type { CanvasNode, WorkflowVariable } from '@refly/openapi-schema';

interface HandleVariableViewOptions {
  autoOpenEdit?: boolean;
  showError?: boolean;
}

/**
 * Hook for handling variable view operations
 * Provides functionality to open start node preview and locate to specific variables
 */
export const useVariableView = (canvasId: string) => {
  const { getNodes } = useReactFlow();
  const { handleNodePreview } = useNodePreviewControl({ canvasId });

  const handleVariableView = useCallback(
    (variable: WorkflowVariable, options?: HandleVariableViewOptions) => {
      // Find the start node in the canvas
      const nodes = getNodes();
      const startNode = nodes.find((node) => node.type === 'start');

      if (startNode) {
        const canvasNode = startNode as CanvasNode;

        // Open the start node preview
        handleNodePreview(canvasNode);

        // Emit event to locate to the specific variable
        setTimeout(() => {
          locateToVariableEmitter.emit('locateToVariable', {
            canvasId,
            nodeId: startNode.id,
            variableId: variable.variableId,
            variableName: variable.name,
            autoOpenEdit: options?.autoOpenEdit,
            showError: options?.showError,
          });
        }, 100); // Small delay to ensure preview is open
      }
    },
    [canvasId, getNodes, handleNodePreview],
  );

  return {
    handleVariableView,
  };
};
