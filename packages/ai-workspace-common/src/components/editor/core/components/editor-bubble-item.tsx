import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { useCurrentEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { EditorInstance } from '@refly-packages/ai-workspace-common/components/editor/core/components';

interface EditorBubbleItemProps {
  readonly children: ReactNode;
  readonly asChild?: boolean;
  readonly onSelect?: (editor: Editor) => void;
  triggerEditor?: EditorInstance;
}

export const EditorBubbleItem = forwardRef<
  HTMLDivElement,
  EditorBubbleItemProps & Omit<ComponentPropsWithoutRef<'div'>, 'onSelect'>
>(({ children, asChild, onSelect, triggerEditor, ...rest }, ref) => {
  const { editor: currentEditor } = useCurrentEditor();
  const Comp = asChild ? Slot : 'div';
  const editor = triggerEditor || currentEditor;

  if (!editor) return null;

  return (
    <Comp ref={ref} {...rest} onClick={() => onSelect?.(editor)}>
      {children}
    </Comp>
  );
});

EditorBubbleItem.displayName = 'EditorBubbleItem';

export default EditorBubbleItem;
