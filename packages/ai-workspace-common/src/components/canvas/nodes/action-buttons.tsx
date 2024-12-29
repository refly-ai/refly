import { FC, memo, useState } from 'react';
import { NodeActionMenu } from '../node-action-menu';
import { CanvasNodeType } from '@refly/openapi-schema';

type ActionButtonsProps = {
  nodeId: string;
  type: CanvasNodeType;
  isNodeHovered: boolean;
};

export const ActionButtons: FC<ActionButtonsProps> = memo(
  ({ nodeId, type, isNodeHovered }) => {
    const [isMenuHovered, setIsMenuHovered] = useState(false);

    return (
      <>
        <div
          className={`
            absolute
            -right-[30px]
            top-0
            w-[30px]
            h-full
            ${isNodeHovered || isMenuHovered ? '' : 'pointer-events-none'}
          `}
          onMouseEnter={() => setIsMenuHovered(true)}
          onMouseLeave={() => setIsMenuHovered(false)}
        />
        <div
          className={`
            absolute
            -right-[154px]
            top-0
            transition-opacity
            duration-200
            ease-in-out
            z-50
            w-[150px]
            bg-white
            rounded-lg
            ${isNodeHovered || isMenuHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}
          `}
          onMouseEnter={() => setIsMenuHovered(true)}
          onMouseLeave={() => setIsMenuHovered(false)}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <NodeActionMenu nodeId={nodeId} nodeType={type} />
        </div>
      </>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.nodeId === nextProps.nodeId &&
      prevProps.type === nextProps.type &&
      prevProps.isNodeHovered === nextProps.isNodeHovered
    );
  },
);

ActionButtons.displayName = 'ActionButtons';
