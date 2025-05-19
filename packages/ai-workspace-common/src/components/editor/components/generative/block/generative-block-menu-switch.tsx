import {
  Editor,
  useEditor,
  EditorBubble,
} from '@refly-packages/ai-workspace-common/components/editor/core/components';
import { removeAIHighlight } from '@refly-packages/ai-workspace-common/components/editor/core/extensions';
import { useEffect, useRef, useCallback } from 'react';
import { AISelector } from '../common/ai-selector';
import { editorEmitter } from '@refly/utils/event-emitter/editor';
import type { Instance } from 'tippy.js';

import { posToDOMRect } from '@tiptap/react';
import { useDocumentStoreShallow } from '@refly-packages/ai-workspace-common/stores/document';

interface GenerativeBlockMenuSwitchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
const GenerativeBlockMenuSwitch = ({ open, onOpenChange }: GenerativeBlockMenuSwitchProps) => {
  const { editor } = useEditor();
  const bubbleRef = useRef<Instance | null>(null);
  const editorRef = useRef<Editor | null>(null);

  const docId = editor?.options?.editorProps?.attributes?.['data-doc-id'];
  const { activeDocumentId } = useDocumentStoreShallow((state) => ({
    activeDocumentId: state.activeDocumentId,
  }));

  useEffect(() => {
    if (activeDocumentId && activeDocumentId !== docId) {
      editorEmitter.emit('activeAskAI', { value: false, docId });
    }
  }, [activeDocumentId, docId]);

  useEffect(() => {
    if (!open) removeAIHighlight(editor);
  }, [open, editor]);

  const handleBubbleClose = () => {
    if (bubbleRef.current) {
      // bubbleRef.current?.hide();
      // bubbleRef.current.popperInstance?.update();

      handleBubbleHide();

      requestAnimationFrame(() => {
        editor.chain().setTextSelection(editor.state.selection.from).run();
      });
    }
  };

  const handleBubbleHide = () => {
    onOpenChange(false);
    editor?.chain().unsetHighlight().run();
    removeAIHighlight(editor);
  };

  const handleAskAI = useCallback(
    ({ value, docId: eventDocId }: { value: boolean; docId?: string }) => {
      if (eventDocId && eventDocId !== docId) {
        return;
      }

      onOpenChange(value);

      if (!value) {
        bubbleRef.current?.hide();
      } else {
        const editor = editorRef.current;
        const pos = editor.state.selection.from;
        editor.commands.setTextSelection(pos);

        requestAnimationFrame(() => {
          if (bubbleRef.current) {
            const { state, view } = editor;
            const { from, to } = state.selection;

            bubbleRef.current.setProps({
              getReferenceClientRect: () => posToDOMRect(view, from, to),
            });

            bubbleRef.current.show();
            bubbleRef.current.popperInstance?.update();
          }
        });
      }
    },
    [docId, onOpenChange],
  );

  useEffect(() => {
    editorEmitter.on('activeAskAI', handleAskAI);
    return () => {
      editorEmitter.off('activeAskAI', handleAskAI);
    };
  }, [docId]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
        editorEmitter.emit('activeAskAI', { value: false, docId });
        // Focus editor after closing AI selector
        setTimeout(() => {
          editor?.commands.focus();
        }, 0);
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onOpenChange, editor, docId]);

  useEffect(() => {
    if (editor) {
      editorRef.current = editor;
    }

    return () => {
      removeAIHighlight(editor);
      handleBubbleHide();
    };
  }, [editor]);

  return (
    <EditorBubble
      tippyOptions={{
        placement: open ? 'bottom-start' : 'top',
        onHidden: () => {
          handleBubbleHide();
        },
        onCreate: (instance) => {
          bubbleRef.current = instance;
        },
      }}
      className="z-50 flex w-fit max-w-[90vw] overflow-hidden rounded-md border border-solid border-gray-200 dark:border-gray-700 bg-background shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
    >
      {open && (
        <AISelector
          open={open}
          onOpenChange={onOpenChange}
          inPlaceEditType="block"
          handleBubbleClose={handleBubbleClose}
        />
      )}
    </EditorBubble>
  );
};

export default GenerativeBlockMenuSwitch;
