import { memo, useCallback, useEffect, useState, useRef } from 'react';

import { Copilot } from '../copilot';

interface CopilotContainerProps {
  copilotWidth: number;
  setCopilotWidth: (width: number) => void;
  maxPanelWidth: number;
}

export const CopilotContainer = memo(
  ({ copilotWidth, setCopilotWidth, maxPanelWidth }: CopilotContainerProps) => {
    // Handle drag resize for Copilot panel
    const [isResizing, setIsResizing] = useState(false);
    const resizeStartXRef = useRef<number>(0);
    const resizeStartWidthRef = useRef<number>(0);

    const handleResizeStart = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
        resizeStartXRef.current = e.clientX;
        resizeStartWidthRef.current = copilotWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      },
      [copilotWidth],
    );

    const handleResizeMove = useCallback(
      (e: MouseEvent) => {
        if (!isResizing) return;

        const deltaX = e.clientX - resizeStartXRef.current;
        const newWidth = resizeStartWidthRef.current + deltaX;
        const minWidth = 300;
        const maxWidth = maxPanelWidth;

        const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        setCopilotWidth(clampedWidth);
      },
      [isResizing, maxPanelWidth, setCopilotWidth],
    );

    const handleResizeEnd = useCallback(() => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }, []);

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
    }, [isResizing, handleResizeMove, handleResizeEnd]);

    if (copilotWidth <= 0) {
      return null;
    }

    return (
      <>
        <div
          className="absolute -top-[1px] left-[-1px] bottom-[-1px] bg-refly-bg-content-z2 border-solid border-[1px] border-refly-Card-Border shadow-refly-m z-[30] rounded-xl overflow-hidden"
          style={{ width: `${copilotWidth}px` }}
        >
          <Copilot copilotWidth={copilotWidth} setCopilotWidth={setCopilotWidth} />
        </div>
        <div
          className="absolute top-2 bottom-2 w-2 cursor-col-resize z-[30] group"
          style={{ left: `${copilotWidth - 4}px` }}
          onMouseDown={handleResizeStart}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-full" />
        </div>
      </>
    );
  },
);

CopilotContainer.displayName = 'CopilotContainer';
