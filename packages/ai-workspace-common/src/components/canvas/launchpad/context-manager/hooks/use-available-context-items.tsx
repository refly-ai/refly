import { useCallback } from 'react';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { FiFile, FiCode, FiImage, FiLink, FiMessageSquare } from 'react-icons/fi';

/**
 * Get icon based on node type
 */
const getNodeTypeIcon = (type: string) => {
  switch (type) {
    case 'document':
      return <FiFile className="text-gray-500" />;
    case 'codeArtifact':
      return <FiCode className="text-gray-500" />;
    case 'image':
      return <FiImage className="text-gray-500" />;
    case 'website':
      return <FiLink className="text-gray-500" />;
    case 'skillResponse':
      return <FiMessageSquare className="text-gray-500" />;
    default:
      return <FiFile className="text-gray-500" />;
  }
};

/**
 * Hook to get available context items from the canvas
 */
export const useAvailableContextItems = () => {
  // Move the useCanvasContext call to the top level of the hook
  const { canvasId, readonly, provider } = useCanvasContext();

  /**
   * Check if a context item is already selected
   */
  const isContextItemSelected = (id: string, selectedContextItems: any[]) => {
    return selectedContextItems.some((item) => item.entityId === id);
  };

  /**
   * Get all available context items from the canvas
   */
  const getAvailableContextItems = useCallback(
    (selectedContextItems: any[] = []) => {
      if (!canvasId || readonly || !provider?.document) {
        return [];
      }

      try {
        // Get nodes from the Yjs document
        const canvasNodes = provider.document.getArray('nodes')?.toJSON() || [];

        return canvasNodes.map((node) => ({
          value: node.id,
          label: (
            <div className="flex items-center gap-2 h-6">
              {getNodeTypeIcon(node.type)}
              <span className="text-sm font-medium">{node.data?.title || 'Untitled'}</span>
              <span className="text-sm text-gray-500">{node.type}</span>
            </div>
          ),
          textLabel: node.data?.title || 'Untitled',
          nodeData: node,
          disabled: isContextItemSelected(node.id, selectedContextItems),
        }));
      } catch (error) {
        console.error('Error getting available context items:', error);
        return [];
      }
    },
    [canvasId, readonly, provider],
  );

  return {
    getAvailableContextItems,
    isContextItemSelected,
  };
};
