import { useCallback, useRef } from 'react';
import { useReactFlow, addEdge, Edge, Connection } from '@xyflow/react';
import { genUniqueId } from '@refly/utils/id';

/**
 * Hook to manage temporary edge connections in the canvas
 * Used when a user drags an edge from a node but doesn't connect it to another node yet
 */
export function useDragToCreateNode(onConnect?: (params: Connection) => void) {
  const { screenToFlowPosition, setNodes, setEdges, getNodes, getEdges } = useReactFlow();

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
    (event, connectionState) => {
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

      // If distance moved is very small, consider it a click and don't create a node
      if (distanceMoved < 10) {
        return;
      }

      // Only create a skill node if the connection is invalid
      // and we have connection state information
      if (!connectionState || connectionState.isValid) {
        return;
      }

      // Extract connection information
      const { fromNode, fromHandle } = connectionState;

      // Get the node ID that initiated the connection
      let sourceNodeId = null;
      let targetNodeId = null;
      let handleType = null;

      // Determine connection direction based on which handle was used
      if (fromHandle?.type === 'source') {
        // User dragged from a source handle, so we need a target
        sourceNodeId = fromNode?.id;
        handleType = 'source';
      } else if (fromHandle?.type === 'target') {
        // User dragged from a target handle, so we need a source
        targetNodeId = fromNode?.id;
        handleType = 'target';
      } else {
        // No handle information, can't proceed
        return;
      }

      if (!sourceNodeId && !targetNodeId) return; // Safety check

      // Get the position where the user dropped the connection
      const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event;

      // Check if mouse is over a node area (not just the handle)
      const elementAtPoint = document.elementFromPoint(clientX, clientY);
      const nodeElement = elementAtPoint?.closest('.react-flow__node');
      const targetNodeIdFromElement = nodeElement?.getAttribute('data-id');

      // If mouse is over a node area, try to connect directly
      if (targetNodeIdFromElement && targetNodeIdFromElement !== fromNode?.id) {
        const nodes = getNodes();
        const targetNode = nodes.find((node) => node.id === targetNodeIdFromElement);

        if (targetNode && onConnect) {
          // Check if we can connect based on handle type
          if (handleType === 'source') {
            // Dragging from source handle, need to connect to target node
            // Find the target handle ID
            const targetHandleId = `${targetNodeIdFromElement}-target`;

            // Check if connection already exists
            const edges = getEdges();
            const connectionExists = edges?.some(
              (edge) => edge.source === sourceNodeId && edge.target === targetNodeIdFromElement,
            );

            if (!connectionExists) {
              // Try to create connection
              const connection = {
                source: sourceNodeId,
                sourceHandle: fromHandle?.id,
                target: targetNodeIdFromElement,
                targetHandle: targetHandleId,
              };

              // Use a small delay to ensure React Flow has processed the connection end event
              setTimeout(() => {
                onConnect(connection);
              }, 0);
            }
            return;
          } else if (handleType === 'target') {
            // Dragging from target handle, need to connect to source node
            // Find the source handle ID
            const sourceHandleId = `${targetNodeIdFromElement}-source`;

            // Check if connection already exists
            const edges = getEdges();
            const connectionExists = edges?.some(
              (edge) => edge.source === targetNodeIdFromElement && edge.target === targetNodeId,
            );

            if (!connectionExists) {
              const connection = {
                source: targetNodeIdFromElement,
                sourceHandle: sourceHandleId,
                target: targetNodeId,
                targetHandle: fromHandle?.id,
              };

              setTimeout(() => {
                onConnect(connection);
              }, 0);
            }
            return;
          }
        }
      }

      // Create ghost node at drop position
      const ghostNodeId = `ghost-${genUniqueId()}`;
      const flowPosition = screenToFlowPosition({
        x: clientX,
        y: clientY,
      });

      const ghostNode = {
        id: ghostNodeId,
        type: 'ghost',
        position: flowPosition,
        data: { metadata: { position: { x: clientX, y: clientY } } },

        draggable: false,
        selectable: false,
      };

      // Create temporary edge
      const tempEdge: Edge = {
        id: `temp-edge-${genUniqueId()}`,
        source: handleType === 'source' ? sourceNodeId : ghostNodeId,
        target: handleType === 'source' ? ghostNodeId : targetNodeId,
        style: { stroke: '#94a3b8', strokeDasharray: '5,5' },
      };

      // Add ghost node and temporary edge
      setNodes((nodes) => nodes.concat(ghostNode));
      setEdges((edges) => addEdge(tempEdge, edges));
    },
    [screenToFlowPosition, setNodes, setEdges, getNodes, getEdges, onConnect],
  );

  return {
    onConnectStart,
    onConnectEnd,
  };
}
