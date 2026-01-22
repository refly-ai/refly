import { EditorInstance } from '@refly-packages/ai-workspace-common/components/editor/core/components';
import { Extension } from '@tiptap/core';

/**
 * A global keymap extension to provide consistent editing behavior for inline atom nodes
 * (such as mention). This centralizes Backspace/Delete/Mod-Backspace/Mod-Delete handling
 * instead of scattering logic in specific node extensions.
 */
const AtomicInlineKeymap = Extension.create({
  name: 'atomicInlineKeymap',

  addKeyboardShortcuts() {
    const backspace = ({ editor }: { editor: EditorInstance }) => {
      try {
        const state = editor?.state;
        const { selection } = state ?? {};
        if (!selection || !selection.empty) return false;

        const $from = selection.$from;
        const pos = $from.pos;

        // Case 1: node directly before cursor is a mention
        const nodeBefore = $from.nodeBefore as any;
        if (nodeBefore?.type?.name === 'mention') {
          const from = pos - nodeBefore.nodeSize;
          editor.chain().focus().deleteRange({ from, to: pos }).run();
          return true;
        }

        const nodeAfter = $from.nodeAfter as any;
        if (nodeAfter?.type?.name === 'mention') {
          const $left = state.doc.resolve(Math.max(0, pos));
          const leftBefore = $left.nodeBefore as any;
          if (leftBefore?.type?.name === 'mention') {
            const from = pos - leftBefore.nodeSize;
            editor.chain().focus().deleteRange({ from, to: pos }).run();
            return true;
          }
          if (leftBefore?.isText) {
            editor
              .chain()
              .focus()
              .deleteRange({ from: pos - 1, to: pos })
              .run();
            return true;
          }
        }

        return false;
      } catch {
        return false;
      }
    };

    // const modeBackspace = ({ editor }: { editor: EditorInstance }) => {
    //   try {
    //     const state = editor?.state;
    //     const { selection } = state ?? {};
    //     if (!selection) return false;

    //     const $from = selection.$from;
    //     const to = selection.from;
    //     const parentStart = $from.start();

    //     // Find the previous hardBreak inside the same parent (i.e., line start)
    //     let from = parentStart;
    //     let scanPos = to;
    //     while (scanPos > parentStart) {
    //       const $pos = state?.doc?.resolve(scanPos);
    //       const nodeBefore = $pos?.nodeBefore as any;
    //       if (nodeBefore?.type?.name === 'hardBreak') {
    //         // Delete from right after the hardBreak to the cursor
    //         from = scanPos;
    //         break;
    //       }
    //       scanPos -= 1;
    //     }

    //     if (from < to) {
    //       editor.chain().focus().deleteRange({ from, to }).run();
    //       return true;
    //     }
    //     return false;
    //   } catch {
    //     return false;
    //   }
    // };

    return {
      Backspace: backspace,
      // 'Mod-Backspace': modeBackspace,
    } as const;
  },
});

export default AtomicInlineKeymap;
