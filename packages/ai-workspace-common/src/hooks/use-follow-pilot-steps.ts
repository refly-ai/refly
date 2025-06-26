import { useCallback, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { usePilotStore, usePilotStoreShallow } from '../stores/pilot';
import { ResponseNodeMeta } from '@refly-packages/ai-workspace-common/components/canvas/nodes';

/**
 * Hook that follows pilot steps by automatically fitting view to nodes associated
 * with active pilot session steps
 *
 * - Runs an interval check every 500ms when activeSessionId is present
 * - Finds nodes with matching pilotSessionId
 * - Fits view to those nodes if they have status 'waiting' or 'executing'
 */
export const useFollowPilotSteps = () => {
  // Keep track of interval ID for cleanup
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get React Flow instance to control the canvas view
  const reactFlowInstance = useReactFlow();

  const activeSessionId = usePilotStoreShallow((state) => state.activeSessionId);

  // Function to check for relevant nodes and fit view
  const checkAndFitView = useCallback(() => {
    console.log('[useFollowPilotSteps] checking for nodes to fit view');

    // Get active session ID from pilot store
    const { activeSessionId } = usePilotStore.getState();
    if (!activeSessionId) return;

    console.log('[useFollowPilotSteps] activeSessionId', activeSessionId);

    // Get all nodes from the React Flow instance
    const nodes = reactFlowInstance.getNodes();

    // Filter nodes matching our criteria:
    // 1. Type is skillResponse
    // 2. Has pilotSessionId matching activeSessionId
    // 3. Status is either 'waiting' or 'executing'
    const matchedNodes = nodes.filter((node) => {
      if (node.type !== 'skillResponse') return false;
      const metadata = node.data?.metadata as ResponseNodeMeta;
      return (
        metadata?.pilotSessionId === activeSessionId &&
        (metadata?.status === 'waiting' || metadata?.status === 'executing')
      );
    });

    console.log('[useFollowPilotSteps] matchedNodes', matchedNodes);

    // If we found matching nodes, fit the view to them
    if (matchedNodes.length > 0) {
      reactFlowInstance.fitView({
        padding: 0.2,
        duration: 200,
        minZoom: 0.6,
        maxZoom: 1,
        nodes: matchedNodes,
      });
    }
  }, [reactFlowInstance]);

  useEffect(() => {
    // Start interval if activeSessionId is present
    if (activeSessionId) {
      console.log('[useFollowPilotSteps] Starting interval check');

      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Set new interval (runs every 500ms)
      intervalRef.current = setInterval(checkAndFitView, 500);

      // Initial check immediately
      checkAndFitView();
    } else if (intervalRef.current) {
      // Clear interval if no activeSessionId
      console.log('[useFollowPilotSteps] Clearing interval check');
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Cleanup function to clear interval when component unmounts or activeSessionId changes
    return () => {
      if (intervalRef.current) {
        console.log('[useFollowPilotSteps] Cleanup: clearing interval');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [checkAndFitView, activeSessionId]);

  // Return an empty object since this hook is only for side effects
  return {};
};
