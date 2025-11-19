import { useCallback, useState, useEffect } from 'react';
import { useReactFlow, useStore } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import { CanvasNode } from '@refly/canvas-common';
import { useDuplicateNode } from './use-duplicate-node';

interface CopyPasteSkillResponseNodeOptions {
  /** Canvas ID */
  canvasId?: string;
  /** Whether the canvas is in readonly mode */
  readonly?: boolean;
}

/**
 * Hook for handling copy and paste operations for skillResponse nodes
 * Supports Ctrl/Cmd+C for copy and Ctrl/Cmd+V for paste
 */
export const useCopyPasteSkillResponseNode = (options: CopyPasteSkillResponseNodeOptions = {}) => {
  const { canvasId, readonly } = options;
  const { nodes } = useStore(
    useShallow((state) => ({
      nodes: state.nodes,
    })),
  );
  const reactFlowInstance = useReactFlow();
  const { duplicateNode } = useDuplicateNode();

  // Store copied nodes for paste operation
  const [copiedNodes, setCopiedNodes] = useState<CanvasNode[]>([]);

  /**
   * Copy selected skillResponse nodes
   */
  const handleCopy = useCallback(() => {
    if (readonly) return;

    const selectedNodes = nodes.filter(
      (node) => node.selected && node.type === 'skillResponse',
    ) as CanvasNode[];

    if (selectedNodes.length > 0) {
      setCopiedNodes(selectedNodes);
    }
  }, [nodes, readonly]);

  /**
   * Paste copied nodes at viewport center
   */
  const handlePaste = useCallback(() => {
    if (readonly || copiedNodes.length === 0 || !canvasId) return;

    // Get viewport center for positioning pasted nodes
    const viewportCenter = reactFlowInstance.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    if (copiedNodes.length === 1) {
      // Single node: paste at viewport center
      const node = copiedNodes[0];
      const currentNode = reactFlowInstance.getNode(node.id);
      const currentPosition = currentNode?.position || { x: 0, y: 0 };
      const offset = {
        x: viewportCenter.x - currentPosition.x,
        y: viewportCenter.y - currentPosition.y,
      };
      duplicateNode(node, canvasId, { offset });
    } else {
      // Multiple nodes: maintain relative positions, move group to viewport center
      // Calculate center of copied nodes
      const copiedPositions = copiedNodes.map((node) => {
        const currentNode = reactFlowInstance.getNode(node.id);
        return currentNode?.position || { x: 0, y: 0 };
      });
      const copiedCenter = {
        x: copiedPositions.reduce((sum, pos) => sum + pos.x, 0) / copiedPositions.length,
        y: copiedPositions.reduce((sum, pos) => sum + pos.y, 0) / copiedPositions.length,
      };

      // Calculate offset to move group center to viewport center
      const groupOffset = {
        x: viewportCenter.x - copiedCenter.x,
        y: viewportCenter.y - copiedCenter.y,
      };

      // Paste each node with adjusted offset
      for (const node of copiedNodes) {
        const currentNode = reactFlowInstance.getNode(node.id);
        const currentPosition = currentNode?.position || { x: 0, y: 0 };
        const nodeOffset = {
          x: groupOffset.x + (currentPosition.x - copiedCenter.x),
          y: groupOffset.y + (currentPosition.y - copiedCenter.y),
        };
        duplicateNode(node, canvasId, { offset: nodeOffset });
      }
    }
  }, [copiedNodes, reactFlowInstance, duplicateNode, canvasId, readonly]);

  /**
   * Handle keyboard shortcuts for copy and paste
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip all keyboard handling in readonly mode
      if (readonly) return;

      const target = e.target as HTMLElement;

      // Ignore input, textarea and contentEditable elements
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      // Check for mod key (Command on Mac, Ctrl on Windows/Linux)
      const isModKey = e.metaKey || e.ctrlKey;

      // Handle copy (Cmd/Ctrl + C)
      if (isModKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopy();
        return;
      }

      // Handle paste (Cmd/Ctrl + V)
      if (isModKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePaste();
        return;
      }
    },
    [readonly, handleCopy, handlePaste],
  );

  // Add keyboard event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    copiedNodes,
    handleCopy,
    handlePaste,
  };
};
