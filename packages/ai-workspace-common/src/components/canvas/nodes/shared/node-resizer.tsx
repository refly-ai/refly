import React, { useEffect, useCallback } from 'react';
import Moveable from 'react-moveable';

interface NodeResizerProps {
  moveableRef?: React.RefObject<Moveable>;
  targetRef: React.RefObject<HTMLElement>;
  isSelected: boolean;
  isHovered: boolean;
  isPreview?: boolean;
  sizeMode?: 'compact' | 'adaptive';
  onResize: (params: any) => void;
  onResizeEnd?: () => void;
}

export const NodeResizer: React.FC<NodeResizerProps> = ({
  moveableRef,
  targetRef,
  isSelected,
  isHovered,
  isPreview = false,
  sizeMode = 'adaptive',
  onResize,
  onResizeEnd,
}) => {
  const [isResizing, setIsResizing] = React.useState(false);

  // Handle global mouse events
  const handleGlobalMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      // Remove pointer-events-none class from iframes
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        iframe.style.pointerEvents = '';
      }
    }
  }, [isResizing]);

  // Add global mouse event listeners
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mouseup', handleGlobalMouseUp);
      window.addEventListener('mouseleave', handleGlobalMouseUp);

      return () => {
        window.removeEventListener('mouseup', handleGlobalMouseUp);
        window.removeEventListener('mouseleave', handleGlobalMouseUp);
      };
    }
  }, [isResizing, handleGlobalMouseUp]);

  if (isPreview || !isSelected || sizeMode !== 'adaptive') {
    return null;
  }

  return (
    <Moveable
      ref={moveableRef}
      target={targetRef}
      resizable={true}
      edge={false}
      throttleResize={1}
      renderDirections={['nw', 'ne', 'sw', 'se']}
      onResizeStart={({ setOrigin, dragStart }) => {
        setIsResizing(true);
        setOrigin(['%', '%']);
        if (dragStart && dragStart instanceof MouseEvent) {
          dragStart.preventDefault();
        }
        // Disable pointer events on iframes while resizing
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
          iframe.style.pointerEvents = 'none';
        }
      }}
      onResize={onResize}
      onResizeEnd={() => {
        setIsResizing(false);
        // Re-enable pointer events on iframes
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
          iframe.style.pointerEvents = '';
        }
        onResizeEnd?.();
      }}
      hideDefaultLines={true}
      className={`!pointer-events-auto ${!isHovered ? 'moveable-control-hidden' : 'moveable-control-show'}`}
      snappable={true}
      snapThreshold={5}
      elementGuidelines={['top', 'left', 'bottom', 'right']}
      verticalGuidelines={[0, 100, 200, 300]}
      horizontalGuidelines={[0, 100, 200, 300]}
    />
  );
};
