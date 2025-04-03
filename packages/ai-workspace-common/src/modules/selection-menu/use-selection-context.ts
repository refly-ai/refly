import { useCallback, useEffect, useState } from 'react';
import { IContextItem, useContextPanelStoreShallow } from '../../stores/context-panel';
import { getSelectionNodesMarkdown } from '@refly/utils/html2md';
import { Editor } from '@tiptap/react';

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
      const container =
        containerRef?.current ||
        (containerClass ? document.querySelector(`.${containerClass}`) : document.body);

      if (!container || !container.contains(range.commonAncestorContainer)) {
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
    (item: IContextItem) => {
      if (!selectedText) return;

      addContextItem(item);
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

    return () => {
      document.removeEventListener('selectionchange', handleSelection);
    };
  }, [enabled, handleSelection, editor]);

  return {
    selectedText,
    isSelecting,
    addToContext,
    removeSelection,
  };
};
