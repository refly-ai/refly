import { useCallback, useEffect, useState } from 'react';
import {
  IContextItem,
  useContextPanelStoreShallow,
  useContextPanelStore,
  ContextTarget,
} from '../../stores/context-panel';
import { getSelectionNodesMarkdown } from '@refly/utils/html2md';
import { Editor } from '@tiptap/react';
import { message } from 'antd';
import React from 'react';
import { emitAddToContext, emitAddToContextCompleted } from '../../utils/event-emitter/context';
import AddToContextMessageContent from '../../components/message/add-to-context-message';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';

interface UseSelectionContextProps {
  containerClass?: string;
  containerRef?: React.RefObject<HTMLElement>;
  enabled?: boolean;
  editor?: Editor;
}

export const useSelectionContext = ({
  containerClass,
  containerRef,
  enabled = true,
  editor,
}: UseSelectionContextProps) => {
  const [selectedText, setSelectedText] = useState<string>('');
  const [isSelecting, setIsSelecting] = useState(false);
  const { addContextItem } = useContextPanelStoreShallow((state) => ({
    addContextItem: state.addContextItem,
  }));

  const { showLinearThread, setShowLinearThread } = useCanvasStoreShallow((state) => ({
    showLinearThread: state.showLinearThread,
    setShowLinearThread: state.setShowLinearThread,
  }));

  const handleSelection = useCallback(() => {
    if (!enabled) return;

    // Check if we have a Tiptap editor instance
    if (editor) {
      // Skip if no selection in the editor
      if (!editor.state.selection || editor.state.selection.empty) {
        setIsSelecting(false);
        setSelectedText('');
        return;
      }

      try {
        // Get text directly from the editor
        const { view, state } = editor;
        const { from, to } = view.state.selection;

        // use markdown serializer to get formatted text
        const selectedFragment = state.doc.slice(from, to).content;

        let markdownText = '';
        if (editor.storage?.markdown?.serializer) {
          const tempDoc = state.doc.copy(selectedFragment);
          markdownText = editor.storage.markdown.serializer.serialize(tempDoc);
        } else {
          markdownText = state.doc.textBetween(from, to, '');
        }

        if (!markdownText) {
          setIsSelecting(false);
          // setSelectedText(''); // I still don't know why this must be commented out :)
          return;
        }

        setSelectedText(markdownText);
        setIsSelecting(true);
      } catch (error) {
        console.error('Tiptap selection error:', error);
        setIsSelecting(false);
        setSelectedText('');
      }
      return; // Return early if editor is available
    }

    // Fallback to browser selection API when editor is not available
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      setIsSelecting(false);
      setSelectedText('');
      return;
    }

    try {
      const range = selection.getRangeAt(0);
      const text = getSelectionNodesMarkdown();

      if (!text || selection.isCollapsed) {
        setIsSelecting(false);
        setSelectedText('');
        return;
      }

      // Prefer containerRef to check container
      if (containerRef?.current) {
        if (!containerRef.current.contains(range.commonAncestorContainer)) {
          setIsSelecting(false);
          setSelectedText('');
          return;
        }
      } else if (containerClass) {
        const containers = document.querySelectorAll(`.${containerClass}`);
        let isWithinContainer = false;

        // Check if selection is within any container with this class
        for (const container of containers) {
          if (container.contains(range.commonAncestorContainer)) {
            isWithinContainer = true;
            break;
          }
        }

        if (!isWithinContainer) {
          setIsSelecting(false);
          setSelectedText('');
          return;
        }
      } else if (!document.body.contains(range.commonAncestorContainer)) {
        setIsSelecting(false);
        setSelectedText('');
        return;
      }

      setSelectedText(text);
      setIsSelecting(true);
    } catch (error) {
      console.error('Selection error:', error);
      setIsSelecting(false);
      setSelectedText('');
    }
  }, [containerClass, containerRef, enabled, editor]);

  // Add selected text to context
  const addToContext = useCallback(
    async (item: IContextItem) => {
      if (!selectedText) return;

      const { activeResultId } = useContextPanelStore.getState();
      const resultId = activeResultId || ContextTarget.Global;
      const contextStore = useContextPanelStore.getState();
      const selectedContextItems = contextStore.contextItems;
      const nodeType = item?.type;

      if (resultId === ContextTarget.Global && !showLinearThread) {
        setShowLinearThread(true);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Check if item is already in context
      const isAlreadyAdded = selectedContextItems.some(
        (selectedItem) => selectedItem.entityId === item.entityId && !selectedItem.isPreview,
      );

      // Get node title based on type
      const nodeTitle = item?.title ?? 'Untitled';

      if (isAlreadyAdded) {
        message.warning({
          content: React.createElement(AddToContextMessageContent, {
            title: nodeTitle,
            nodeType: nodeType,
            action: 'already added to context',
          }),
          key: 'already-added-warning',
        });

        // Emit event that adding to context is completed (but failed)
        emitAddToContext(item, resultId);
        emitAddToContextCompleted(item, resultId, false);
        return;
      }

      // Emit event that we're adding to context
      emitAddToContext(item, resultId);

      // Add to context
      addContextItem(item);

      message.success({
        content: React.createElement(AddToContextMessageContent, {
          title: nodeTitle || 'Untitled',
          nodeType: nodeType,
          action: 'added to context successfully',
        }),
        key: 'add-success',
      });

      // Emit event that adding to context is completed
      emitAddToContextCompleted(item, resultId, true);
    },
    [selectedText, addContextItem, editor],
  );

  const removeSelection = useCallback(() => {
    if (editor) {
      // Use Tiptap to clear selection
      editor.commands.focus('end');
    } else {
      // Fallback to browser API
      window.getSelection()?.removeAllRanges();
    }

    setSelectedText('');
    setIsSelecting(false);
  }, [editor]);

  // Setup event listeners
  useEffect(() => {
    if (!enabled) {
      setIsSelecting(false);
      setSelectedText('');
      return;
    }

    // If we have a Tiptap editor, use its selection change event
    if (editor) {
      // Tiptap doesn't have a direct selection change event,
      // but we can use the update event which fires on selection changes
      const updateHandler = ({ editor: updatedEditor }: { editor: Editor }) => {
        if (updatedEditor.isActive) {
          handleSelection();
        }
      };

      editor.on('selectionUpdate', updateHandler);
      editor.on('update', updateHandler);

      return () => {
        editor.off('selectionUpdate', updateHandler);
        editor.off('update', updateHandler);
      };
    }

    // Fallback to browser selection events
    document.addEventListener('selectionchange', handleSelection);
    // Add mouseup event to better handle selections when using mouse
    document.addEventListener('mouseup', handleSelection);

    return () => {
      document.removeEventListener('selectionchange', handleSelection);
      document.removeEventListener('mouseup', handleSelection);
    };
  }, [enabled, handleSelection, editor]);

  return {
    selectedText,
    isSelecting,
    addToContext,
    removeSelection,
  };
};
