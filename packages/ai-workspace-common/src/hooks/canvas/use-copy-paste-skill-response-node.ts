import { useCallback, useEffect } from 'react';
import { useStore } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import { CanvasNode } from '@refly/canvas-common';
import { useDuplicateNode } from './use-duplicate-node';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

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

  /**
   * Copy selected skillResponse nodes
   */
  const handleCopy = useCallback(async () => {
    const selection = window.getSelection()?.toString();
    const selectedTextLength = typeof window === 'undefined' ? 0 : (selection?.length ?? 0);
    const hasTextSelection = selectedTextLength > 0;

    if (hasTextSelection) {
      await navigator.clipboard.writeText(selection);
      return;
    }

    if (readonly || workflowIsRunning) return;
    const selectedNodes = nodes.filter(
      (node) => node.selected && node.type === 'skillResponse',
    ) as CanvasNode[];

    if (selectedNodes.length > 0) {
      await navigator.clipboard.writeText(JSON.stringify(selectedNodes));
    }
  }, [nodes, readonly, workflowIsRunning]);

  /**
   * Safely parse JSON string, return null if invalid
   */
  const safeJsonParse = useCallback((str: string): CanvasNode[] | null => {
    if (!str || typeof str !== 'string') {
      return null;
    }

    // Quick check: valid JSON should start with '[' or '{'
    const trimmed = str.trim();
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
      return null;
    }

    try {
      const parsed = JSON.parse(str);
      // Ensure parsed data is an array
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  /**
   * Paste copied nodes at offset {x: 400, y: 100} from original position
   */
  const handlePaste = useCallback(async () => {
    const clipboardData = await navigator.clipboard.readText();
    const copiedNodes = safeJsonParse(clipboardData);
    const isCopySkillResponseNodes =
      copiedNodes?.length > 0 && copiedNodes?.every((node) => node.type === 'skillResponse');

    if (readonly || !canvasId || workflowIsRunning || !isCopySkillResponseNodes) return;

    // Fixed offset for pasted nodes (bottom right of original position)
    const fixedOffset = { x: 0, y: 200 };

    // Paste all copied nodes with fixed offset from original position
    for (const node of copiedNodes) {
      duplicateNode(node, canvasId, { offset: fixedOffset });
    }
  }, [duplicateNode, canvasId, readonly, workflowIsRunning, safeJsonParse]);

  /**
   * Handle keyboard shortcuts for copy and paste
   */
  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
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

      // Handle copy (Cmd/Ctrl + C) only when there is no text selection
      if (isModKey && e.key.toLowerCase() === 'c') {
        await handleCopy();
        return;
      }

      // Handle paste (Cmd/Ctrl + V) only when there is no text selection
      if (isModKey && e.key.toLowerCase() === 'v') {
        await handlePaste();
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
    handleCopy,
    handlePaste,
  };
};
