import { PreviewComponent } from '@refly-packages/ai-workspace-common/components/canvas/node-preview';
import { memo } from 'react';
import { CanvasNode } from '@refly/canvas-common';
interface PreviewBoxInCanvasProps {
  node: CanvasNode;
}
export const PreviewBoxInCanvas = memo(({ node }: PreviewBoxInCanvasProps) => {
  if (!node) return null;
  if (['memo', 'group', 'skill', 'image', 'video', 'audio'].includes(node.type)) return null;
  return (
    <div className="z-30 absolute -top-[1px] -right-[1px] -bottom-[1px] w-[400px] flex flex-col rounded-xl bg-refly-bg-content-z2 border-solid border-[1px] border-refly-Card-Border shadow-refly-m overflow-hidden">
      <PreviewComponent node={node} />
    </div>
  );
});

PreviewBoxInCanvas.displayName = 'PreviewBoxInCanvas';
