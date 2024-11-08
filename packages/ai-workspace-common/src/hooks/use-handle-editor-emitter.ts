import { useChatStore } from '@refly-packages/ai-workspace-common/stores/chat';
import { editorEmitter } from '@refly-packages/utils/event-emitter/editor';

export const useHandleEditorEmitter = () => {
  const chatStore = useChatStore();

  editorEmitter.on('insertBlow', (content) => {
    const isFocused = editorRef.current?.isFocused;

    if (isFocused) {
      lastCursorPosRef.current = editorRef.current?.view?.state?.selection?.$head?.pos;
      editorRef.current?.commands?.insertContentAt?.(lastCursorPosRef.current, content);
    } else if (lastCursorPosRef.current) {
      editorRef.current
        .chain()
        .focus(lastCursorPosRef.current)
        .insertContentAt(
          {
            from: lastCursorPosRef.current,
            to: lastCursorPosRef.current,
          },
          content,
        )
        .run();
    }
  });

  const handleStreamContent = (event: { isFirst: boolean; content: string }) => {
    const { isFirst, content } = event || {};
    if (editorRef.current) {
      if (isFirst || !processorRef.current) {
        processorRef.current = new TokenStreamProcessor();
      }

      processorRef.current.setEditor(editorRef.current);
      try {
        processorRef.current.process(content);
      } catch (error) {
        console.error('streamCanvasContent error', error);
      }
    }
  };

  const handleStreamEditCanvasContent = (event: { isFirst: boolean; content: string }) => {
    try {
      const { messageIntentContext } = useChatStore.getState();
      const canvasEditConfig = messageIntentContext?.canvasEditConfig;

      const { isFirst, content } = event;
      if (editorRef.current && canvasEditConfig?.selectedRange) {
        if (!processorRef.current || isFirst) {
          processorRef.current = new TokenStreamProcessor();
        }
        const { selectedRange } = canvasEditConfig;
        processorRef.current.setEditor(editorRef.current);

        if (isFirst) {
          // 1. Select and delete the content range
          editorRef.current.commands.setTextSelection({
            from: selectedRange.startIndex,
            to: selectedRange.endIndex,
          });
          editorRef.current.commands.deleteSelection();

          // 2. Move cursor to start position
          editorRef.current.commands.setTextSelection(selectedRange.startIndex);
        }

        // Process content using the same logic as regular streaming
        processorRef.current.process(content);
      }
    } catch (error) {
      console.error('handleStreamEditCanvasContent error', error);
    }
  };

  // Listen for stream content events
  editorEmitter.on('streamCanvasContent', handleStreamContent);
  editorEmitter.on('streamEditCanvasContent', handleStreamEditCanvasContent);
};
