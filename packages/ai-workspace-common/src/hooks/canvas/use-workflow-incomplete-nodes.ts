import { useReactFlow } from '@xyflow/react';
import { useMemo } from 'react';

/**
 * Hook to check if there are any incomplete skill response nodes in the workflow
 * A node is considered incomplete if:
 * - Its type is 'skillResponse'
 * - Its status is 'init' (not yet executed) or 'failed' (execution failed)
 */
export const useWorkflowIncompleteNodes = () => {
  const { getNodes } = useReactFlow();

  const hasIncompleteNodes = useMemo(() => {
    const nodes = getNodes();

    return nodes.some((node: any) => {
      // Only check skillResponse nodes
      if (node.type !== 'skillResponse') {
        return false;
      }

      const status = node.data?.metadata?.status;

      // Consider nodes as incomplete if they are in 'init' or 'failed' state
      return status === 'init' || status === 'failed';
    });
  }, [getNodes]);

  return { hasIncompleteNodes };
};
