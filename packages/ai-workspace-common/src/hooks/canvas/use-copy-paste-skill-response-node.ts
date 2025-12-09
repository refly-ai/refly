import { useCallback, useState, useEffect } from 'react';
import { useStore } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import { CanvasNode } from '@refly/canvas-common';
import { useDuplicateNode } from './use-duplicate-node';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { logEvent } from '@refly/telemetry-web';

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
  const { workflow: workflowRun } = useCanvasContext();
  const workflowIsRunning = !!(workflowRun.isInitializing || workflowRun.isPolling);
  const { nodes } = useStore(
    useShallow((state) => ({
      nodes: state.nodes,
    })),
  );
  const { duplicateNode } = useDuplicateNode();

  // Store copied nodes for paste operation
  const [copiedNodes, setCopiedNodes] = useState<CanvasNode[]>([]);

  /**
   * Copy selected skillResponse nodes
   */
  const handleCopy = useCallback(() => {
    if (readonly || workflowIsRunning) return;

    const selectedNodes = nodes.filter(
      (node) => node.selected && node.type === 'skillResponse',
    ) as CanvasNode[];

    if (selectedNodes.length > 0) {
      setCopiedNodes(selectedNodes);
    }
  }, [nodes, readonly, workflowIsRunning]);

  /**
   * Paste copied nodes at offset {x: 400, y: 100} from original position
   */
  const handlePaste = useCallback(() => {
    if (readonly || copiedNodes.length === 0 || !canvasId || workflowIsRunning) return;

    // Fixed offset for pasted nodes (bottom right of original position)
    const fixedOffset = { x: 0, y: 200 };

    // Paste all copied nodes with fixed offset from original position
    for (const node of copiedNodes) {
      duplicateNode(node, canvasId, { offset: fixedOffset });
    }
  }, [copiedNodes, duplicateNode, canvasId, readonly, workflowIsRunning, logEvent]);

  /**
   * Handle keyboard shortcuts for copy and paste
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip all keyboard handling in readonly mode
      if (readonly || workflowIsRunning) return;

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
      const selectedTextLength =
        typeof window === 'undefined' ? 0 : (window.getSelection()?.toString()?.length ?? 0);
      const hasTextSelection = selectedTextLength > 0;

      // Handle copy (Cmd/Ctrl + C) only when there is no text selection
      if (isModKey && e.key.toLowerCase() === 'c') {
        if (!hasTextSelection) {
          handleCopy();
        }
        return;
      }

      // Handle paste (Cmd/Ctrl + V) only when there is no text selection
      if (isModKey && e.key.toLowerCase() === 'v') {
        if (!hasTextSelection) {
          handlePaste();
        }
        return;
      }
    },
    [readonly, handleCopy, handlePaste, workflowIsRunning],
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
