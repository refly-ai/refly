import { PreviewComponent } from '@refly-packages/ai-workspace-common/components/canvas/node-preview';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { CanvasNode } from '@refly/canvas-common';
import { WorkflowRun } from '@refly-packages/ai-workspace-common/components/canvas/workflow-run';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';

interface PreviewBoxInCanvasProps {
  node?: CanvasNode;
  previewWidth: number;
  setPreviewWidth: (width: number) => void;
  maxPanelWidth: number;
}

export const PreviewBoxInCanvas = memo(
  ({ node, previewWidth, setPreviewWidth, maxPanelWidth }: PreviewBoxInCanvasProps) => {
    const [isResizing, setIsResizing] = useState(false);
    const resizeStartXRef = useRef<number>(0);
    const resizeStartWidthRef = useRef<number>(0);
    const { showWorkflowRun } = useCanvasResourcesPanelStoreShallow((state) => ({
      showWorkflowRun: state.showWorkflowRun,
    }));

    const showPreview = useMemo(() => {
      return ['skillResponse', 'start'].includes(node?.type ?? '') || showWorkflowRun;
    }, [node?.type, showWorkflowRun]);

    const handleResizeStart = useCallback(
      (event: ReactMouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsResizing(true);
        resizeStartXRef.current = event.clientX;
        resizeStartWidthRef.current = previewWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      },
      [previewWidth],
    );

    const handleResizeMove = useCallback(
      (event: MouseEvent) => {
        if (!isResizing) return;

        const deltaX = resizeStartXRef.current - event.clientX;
        const newWidth = resizeStartWidthRef.current + deltaX;
        const minWidth = 400;
        const maxWidth = maxPanelWidth;

        const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        setPreviewWidth(clampedWidth);
      },
      [isResizing, maxPanelWidth, setPreviewWidth],
    );

    const handleResizeEnd = useCallback(() => {
      if (!isResizing) return;
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }, [isResizing]);

    useEffect(() => {
      if (!isResizing) return;

      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }, [isResizing, handleResizeEnd, handleResizeMove]);

    if (!showPreview) return null;

    return (
      <>
        <div
          className="z-30 absolute -top-[1px] -right-[1px] -bottom-[1px] flex flex-col rounded-xl bg-refly-bg-content-z2 border-solid border-[1px] border-refly-Card-Border shadow-refly-m overflow-hidden"
          style={{ width: `${previewWidth}px` }}
        >
          {showWorkflowRun ? <WorkflowRun /> : <PreviewComponent node={node} />}
        </div>
        <div
          className="absolute top-2 bottom-2 w-2 cursor-col-resize z-[31] group"
          style={{ right: `${previewWidth - 4}px` }}
          onMouseDown={handleResizeStart}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-full" />
        </div>
      </>
    );
  },
);

PreviewBoxInCanvas.displayName = 'PreviewBoxInCanvas';
