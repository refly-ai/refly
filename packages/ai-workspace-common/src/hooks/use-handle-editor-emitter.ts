import { useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '@refly-packages/ai-workspace-common/stores/chat';
import { editorEmitter } from '@refly-packages/utils/event-emitter/editor';
import { useEditorStore, useEditorStoreShallow } from '@refly-packages/ai-workspace-common/stores/editor';
import { TokenStreamProcessor } from '@refly-packages/ai-workspace-common/utils/stream-token-processor';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';

export const useHandleEditorEmitter = () => {
  const { updateEditor } = useEditorStoreShallow((state) => ({
    updateEditor: state.updateEditor,
  }));
  const { currentCanvas } = useCanvasStoreShallow((state) => ({
    currentCanvas: state.currentCanvas,
  }));
  const processorRef = useRef<TokenStreamProcessor>();

  const handleInsertBelow = (content: string) => {
    const editor = useEditorStore.getState().editorMap[currentCanvas?.canvasId];
    if (!editor?.instance) {
      console.warn('editor not found for canvas', currentCanvas?.canvasId);
      return;
    }

    const isFocused = editor.instance.isFocused;

    if (isFocused) {
      const lastCursorPos = editor.instance.view?.state?.selection?.$head?.pos;
      updateEditor(currentCanvas?.canvasId, { lastCursorPos });
      editor.instance.commands?.insertContentAt?.(lastCursorPos, content);
    } else if (editor.lastCursorPos) {
      editor.instance
        .chain()
        .focus(editor.lastCursorPos)
        .insertContentAt(
          {
            from: editor.lastCursorPos,
            to: editor.lastCursorPos,
          },
          content,
        )
        .run();
    }
  };

  const handleStreamContent = (event: { canvasId: string; isFirst: boolean; content: string }) => {
    console.log('handleStreamContent', event);
    const { canvasId, isFirst, content } = event || {};
    const editorMap = useEditorStore.getState().editorMap;
    console.log('editorMap', editorMap);
    const editor = editorMap[canvasId];
    console.log('editor', editor);

    if (editor?.instance) {
      if (!editor.isAiEditing) {
        updateEditor(canvasId, { isAiEditing: true });
      }

      if (isFirst || !processorRef.current) {
        processorRef.current = new TokenStreamProcessor();
      }

      processorRef.current.setEditor(editor.instance);
      try {
        processorRef.current.process(content);
      } catch (error) {
        console.error('streamCanvasContent error', error);
      }
    }
  };

  const handleStreamEditCanvasContent = (event: { canvasId: string; isFirst: boolean; content: string }) => {
    try {
      const { messageIntentContext } = useChatStore.getState();
      const canvasEditConfig = messageIntentContext?.canvasEditConfig;

      const { canvasId, isFirst, content } = event;
      const editor = useEditorStore.getState().editorMap[canvasId];

      if (editor?.instance && canvasEditConfig?.selectedRange) {
        if (!editor.isAiEditing) {
          updateEditor(canvasId, { isAiEditing: true });
        }

        if (!processorRef.current || isFirst) {
          processorRef.current = new TokenStreamProcessor();
        }
        const { selectedRange } = canvasEditConfig;
        processorRef.current.setEditor(editor.instance);

        if (isFirst) {
          // 1. Select and delete the content range
          editor.instance.commands.setTextSelection({
            from: selectedRange.startIndex,
            to: selectedRange.endIndex,
          });
          editor.instance.commands.deleteSelection();

          // 2. Move cursor to start position
          editor.instance.commands.setTextSelection(selectedRange.startIndex);
        }

        // Process content using the same logic as regular streaming
        processorRef.current.process(content);
      }
    } catch (error) {
      console.error('handleStreamEditCanvasContent error', error);
    }
  };

  useEffect(() => {
    // Listen for stream content events
    editorEmitter.on('insertBlow', handleInsertBelow);
    editorEmitter.on('streamCanvasContent', handleStreamContent);
    editorEmitter.on('streamEditCanvasContent', handleStreamEditCanvasContent);

    return () => {
      editorEmitter.off('insertBlow', handleInsertBelow);
      editorEmitter.off('streamCanvasContent', handleStreamContent);
      editorEmitter.off('streamEditCanvasContent', handleStreamEditCanvasContent);
    };
  }, []);
};
