import { useCallback, useEffect } from 'react';
import { useStore, useReactFlow } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import { CanvasNode } from '@refly/canvas-common';
import { useDuplicateNode } from './use-duplicate-node';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  nodeActionEmitter,
  createNodeEventName,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
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
  const { t } = useTranslation();
  const { canvasId, readonly } = options;
  const { workflow: workflowRun } = useCanvasContext();
  const workflowIsRunning = !!(workflowRun.isInitializing || workflowRun.isPolling);
  const { getNode } = useReactFlow<CanvasNode<any>>();
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
      // Use utility function with fallback for better compatibility
      await copyToClipboard(selection ?? '');
      return;
    }

    if (readonly || workflowIsRunning) return;
    const selectedNodes = nodes.filter(
      (node) => node.selected && ['skillResponse', 'memo'].includes(node.type),
    ) as CanvasNode[];

    if (selectedNodes.length > 0) {
      // Use utility function with fallback for better compatibility
      const simplifiedSelectedNodes = selectedNodes.map((node) => ({
        type: node.type,
        id: node.id,
      }));
      await copyToClipboard(JSON.stringify(simplifiedSelectedNodes));
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
   * Paste copied nodes at offset {x: 0, y: 200} from original position
   * @param clipboardData - The clipboard text data to parse and paste
   */
  const handlePaste = useCallback(
    (clipboardData: string) => {
      const copiedNodes = safeJsonParse(clipboardData);
      const isCopyValidNodes =
        copiedNodes?.length > 0 &&
        copiedNodes?.every((node) => ['skillResponse', 'memo'].includes(node.type));

      if (readonly || !canvasId || workflowIsRunning || !isCopyValidNodes) return;

      // Fixed offset for pasted nodes (bottom right of original position)
      const fixedOffset = { x: 0, y: 200 };

      // Paste all copied nodes with fixed offset from original position
      for (const node of copiedNodes) {
        const originalNode = getNode(node.id);
        if (!originalNode) {
          continue;
        }
        if (originalNode.type === 'skillResponse') {
          duplicateNode(originalNode, canvasId, { offset: fixedOffset });
        } else if (originalNode.type === 'memo') {
          nodeActionEmitter.emit(createNodeEventName(originalNode.id, 'duplicate'), {
            dragCreateInfo: {
              nodeId: originalNode.id,
              handleType: 'source',
              position: {
                x: originalNode.position.x,
                y: originalNode.position.y + 300,
              },
            },
          });
        }
      }
    },
    [duplicateNode, canvasId, readonly, workflowIsRunning, nodeActionEmitter, safeJsonParse],
  );

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
        e.preventDefault();
        await handleCopy();
        return;
      }

      // Handle paste (Cmd/Ctrl + V) only when there is no text selection
      if (isModKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        // Read clipboard synchronously in user interaction context to avoid permission errors
        try {
          // Check if clipboard API is available
          if (!navigator?.clipboard?.readText) {
            console.warn('Clipboard API not available');
            return;
          }

          // Read clipboard in the user interaction context (synchronously)
          const clipboardData = await navigator.clipboard.readText();
          handlePaste(clipboardData);
        } catch (error) {
          // Handle permission errors gracefully
          if (error instanceof Error && error.name === 'NotAllowedError') {
            message.warning(
              t(
                'common.clipboard.permissionDenied',
                'Clipboard read permission denied. Please allow clipboard access in your browser settings.',
              ),
            );
          } else {
            message.error(
              t('common.clipboard.readFailed', 'Failed to read clipboard. Please try again.'),
            );
          }
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
    handleCopy,
    handlePaste,
  };
};
