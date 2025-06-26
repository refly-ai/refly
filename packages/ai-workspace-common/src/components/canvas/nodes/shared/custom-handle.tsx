import { Handle, Position, HandleType } from '@xyflow/react';
import React, { CSSProperties, useCallback } from 'react';
import { Tooltip } from 'antd';
import { IconPlus } from '@refly-packages/ai-workspace-common/components/common/icon';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { CanvasNodeType } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';

interface CustomHandleProps {
  id: string;
  type: HandleType;
  position: Position;
  isConnected: boolean;
  isNodeHovered: boolean;
  nodeType: CanvasNodeType;
  nodeId?: string;
}

export const CustomHandle = React.memo(
  ({ id, type, position, isConnected, isNodeHovered, nodeType, nodeId }: CustomHandleProps) => {
    const { t } = useTranslation();

    const handlePlusClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        // Use the actual node id, not the handle id
        const actualNodeId = nodeId || id.split('-')[0];

        // Get mouse coordinates
        const x = e.clientX;
        const y = e.clientY - 30;

        // Emit event to open context menu
        nodeOperationsEmitter.emit('openNodeContextMenu', {
          x,
          y,
          nodeId: actualNodeId,
          nodeType: nodeType as CanvasNodeType,
          source: 'handle',
        });
      },
      [nodeId, id, nodeType],
    );

    // Only show plus icon on right handle when node is hovered
    const shouldShowPlusIcon = isNodeHovered && position === Position.Right && type === 'source';

    // Dynamic handle style based on the current state
    const handleStyle: CSSProperties = shouldShowPlusIcon
      ? {
          // Plus icon style
          width: '18px',
          height: '18px',
          right: '-9px',
          top: '50%',
          transform: 'translateY(-50%)',
          backgroundColor: '#00968F',
          border: '2px solid #00968F',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
          opacity: 1,
          cursor: 'crosshair',
          zIndex: 10,
          transition: 'all 0.2s ease',
        }
      : {
          // Normal handle style
          width: '14px',
          height: '14px',
          background: '#fff',
          border: `2px solid ${isNodeHovered ? '#00968F' : '#D0D5DD'}`,
          minWidth: '14px',
          minHeight: '14px',
          borderRadius: '50%',
          opacity: isNodeHovered ? 1 : isConnected ? 0.8 : 0.4,
          cursor: 'crosshair',
          position: 'absolute' as const,
          [position === Position.Left
            ? 'left'
            : position === Position.Right
              ? 'right'
              : position === Position.Top
                ? 'top'
                : 'bottom']: '-6px',
          transform:
            position === Position.Left || position === Position.Right
              ? 'translateY(-50%)'
              : 'translateX(-50%)',
          zIndex: 5,
          transition: 'all 0.2s ease',
        };

    return (
      <div
        className={`
        absolute ${position === Position.Left ? 'left-0' : position === Position.Right ? 'right-0' : ''}
        ${position === Position.Top ? 'top-0' : position === Position.Bottom ? 'bottom-0' : ''}
        ${position === Position.Left || position === Position.Right ? 'h-full' : 'w-full'}
        flex ${position === Position.Left || position === Position.Right ? 'items-center' : 'justify-center'}
        pointer-events-none
      `}
      >
        {shouldShowPlusIcon ? (
          <div className="pointer-events-auto">
            <Tooltip
              title={
                <span>
                  {t('canvas.nodeActions.clickToAdd')}
                  <br />
                  {t('canvas.nodeActions.dragToConnect')}
                </span>
              }
              placement="top"
            >
              <Handle
                id={id}
                type={type}
                position={position}
                style={handleStyle}
                isConnectable={true}
                className="hover:scale-110"
                onClick={handlePlusClick}
              >
                <IconPlus className="w-5 h-5 text-[#fff] pointer-events-none" />
              </Handle>
            </Tooltip>
          </div>
        ) : (
          <Handle
            id={id}
            type={type}
            position={position}
            style={handleStyle}
            isConnectable={true}
            className="hover:opacity-100 hover:border-[#00968F] hover:scale-110 transition-all"
          />
        )}
      </div>
    );
  },
);

CustomHandle.displayName = 'CustomHandle';
