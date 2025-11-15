import { useCallback, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';

/**
 * Hook to manage temporary edge connections in the canvas
 * Used when a user drags an edge from a node but doesn't connect it to another node yet
 */
export function useDragToCreateNode() {
  const { setNodes, setEdges } = useReactFlow();

  // Track if we're actually dragging or just clicking
  const isDraggingRef = useRef(false);
  const startPositionRef = useRef({ x: 0, y: 0 });

  // Track when connection starts (mouse down on handle)
  const onConnectStart = useCallback((event) => {
    isDraggingRef.current = false;
    if ('clientX' in event && 'clientY' in event) {
      startPositionRef.current = { x: event.clientX, y: event.clientY };
    } else if (event?.touches?.[0]) {
      startPositionRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
  }, []);

  // Handle when a connection attempt ends without a valid target
  const onConnectEnd = useCallback(
    (event) => {
      // Determine if this was a drag or just a click
      let currentPosition = { x: 0, y: 0 };
      if ('clientX' in event && 'clientY' in event) {
        currentPosition = { x: event.clientX, y: event.clientY };
      } else if (event?.changedTouches?.[0]) {
        currentPosition = {
          x: event.changedTouches[0].clientX,
          y: event.changedTouches[0].clientY,
        };
      }

      // Calculate distance moved to determine if it was a drag
      const dx = currentPosition.x - startPositionRef.current.x;
      const dy = currentPosition.y - startPositionRef.current.y;
      const distanceMoved = Math.sqrt(dx * dx + dy * dy);

      // If distance moved is very small, consider it a click and don't proceed
      if (distanceMoved < 10) {
        return;
      }

      // If connection is invalid or dropped on empty pane, do nothing:
      // - React Flow will not add an edge when not valid
      // - Ensure no leftover temp nodes/edges from previous attempts
      setNodes((nodes) => nodes.filter((n) => n.type !== 'ghost' && n.type !== 'temporaryEdge'));
      setEdges((edges) => edges.filter((e) => !e.id.startsWith('temp-edge-')));
    },
    [setNodes, setEdges],
  );

  return {
    onConnectStart,
    onConnectEnd,
  };
}
