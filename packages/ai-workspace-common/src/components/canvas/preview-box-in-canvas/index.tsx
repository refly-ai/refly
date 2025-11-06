import { PreviewComponent } from '@refly-packages/ai-workspace-common/components/canvas/node-preview';
import { memo } from 'react';
import { CanvasNode } from '@refly/canvas-common';
interface PreviewBoxInCanvasProps {
  node: CanvasNode;
}
export const PreviewBoxInCanvas = memo(({ node }: PreviewBoxInCanvasProps) => {
  if (!node) return null;
  if (['memo', 'group'].includes(node.type)) return null;
  return (
    <div className="z-30 absolute top-0 bottom-0 right-0 w-[400px] flex flex-col rounded-xl bg-refly-bg-content-z2 border-solid border-[1px] border-refly-Card-Border shadow-refly-m">
      <PreviewComponent node={node} />
    </div>
  );
});

PreviewBoxInCanvas.displayName = 'PreviewBoxInCanvas';
