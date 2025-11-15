import { Handle, Position, HandleType, useConnection } from '@xyflow/react';
import React, { CSSProperties } from 'react';
import { CanvasNodeType } from '@refly/openapi-schema';
import { cn } from '@refly/utils/cn';

interface CustomHandleProps {
  id: string;
  type: HandleType;
  position: Position;
  isConnected?: boolean;
  isNodeHovered?: boolean;
  nodeType?: CanvasNodeType;
  nodeId?: string;
  className?: string;
  /**
   * When set to 'overlay', renders a full-area invisible target handle that
   * allows connecting to any region of the node. Default is 'dot' (small circle).
   */
  variant?: 'dot' | 'overlay';
  /**
   * Used for overlay variant to control visibility and pointer events.
   */
  isPreview?: boolean;
  hideHandles?: boolean;
}

export const CustomHandle = React.memo(
  ({
    id,
    type,
    position,
    nodeId,
    className,
    variant = 'dot',
    isPreview,
    hideHandles,
  }: CustomHandleProps) => {
    const connection = useConnection();

    const isDragging = connection.inProgress && connection.fromNode?.id === nodeId;
    const isTarget = connection.inProgress && connection.fromNode?.id !== nodeId;

    if (variant === 'overlay') {
      const overlayStyle: CSSProperties = {
        width: '100%',
        height: '100%',
        background: 'transparent',
        position: 'absolute',
        top: 0,
        left: 0,
        borderRadius: '1rem',
        transform: 'none',
        border: 'none',
        opacity: 0,
        cursor: 'crosshair',
        // Enable during active connection to this node (and not preview/hidden)
        pointerEvents:
          !isPreview && !hideHandles && isTarget ? ('auto' as const) : ('none' as const),
      };

      return (
        <Handle
          id={id}
          type={type}
          position={position}
          isConnectableStart={false}
          style={overlayStyle}
          className={className}
        />
      );
    }

    const sideOffsetProp =
      position === Position.Left
        ? 'left'
        : position === Position.Right
          ? 'right'
          : position === Position.Top
            ? 'top'
            : 'bottom';

    const handleStyle: CSSProperties = {
      width: '14px',
      height: '14px',
      background: '#fff',
      border: isDragging ? '1.5px solid black' : '1.5px solid #B9C1C1',
      minWidth: '14px',
      minHeight: '14px',
      borderRadius: '50%',
      opacity: 1,
      cursor: 'crosshair',
      position: 'absolute',
      [sideOffsetProp]: '-6px',
      transform:
        position === Position.Left || position === Position.Right
          ? 'translateY(-50%)'
          : 'translateX(-50%)',
      zIndex: 11,
    };

    const wrapperSideClass =
      position === Position.Left
        ? 'left-0 h-full items-center'
        : position === Position.Right
          ? 'right-0 h-full items-center'
          : position === Position.Top
            ? 'top-0 w-full justify-center'
            : 'bottom-0 w-full justify-center';

    return (
      <div className={cn('absolute flex pointer-events-none', wrapperSideClass)}>
        <Handle
          id={id}
          type={type}
          position={position}
          style={handleStyle}
          isConnectable={true}
          className={cn(
            'hover:opacity-100 hover:border-[#0E9F77] hover:scale-110 transition-all',
            className,
          )}
        >
          {isDragging && (
            <div className="rounded-[5px] bg-black w-[5px] h-[5px] translate-x-[3.5px] translate-y-[3.5px] pointer-events-none" />
          )}
        </Handle>
      </div>
    );
  },
);

CustomHandle.displayName = 'CustomHandle';
