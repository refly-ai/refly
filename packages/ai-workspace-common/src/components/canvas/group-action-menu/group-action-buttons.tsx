import { FC, memo, useState } from 'react';
import { GroupActionMenu } from './index';

type GroupActionButtonsProps = {
  nodeId: string;
  isTemporary?: boolean;
  isNodeHovered: boolean;
};

export const GroupActionButtons: FC<GroupActionButtonsProps> = memo(
  ({ nodeId, isTemporary, isNodeHovered }) => {
    const [isMenuHovered, setIsMenuHovered] = useState(false);

    const shouldShowMenu = isTemporary || isNodeHovered || isMenuHovered;

    return (
      <>
        {/* Hover detection area */}
        <div
          className={`
            absolute
            -bottom-[60px]
            left-0
            w-full
            h-[60px]
            ${shouldShowMenu ? '' : 'pointer-events-none'}
          `}
          onMouseEnter={() => setIsMenuHovered(true)}
          onMouseLeave={() => setIsMenuHovered(false)}
        />
        {/* Menu container */}
        <div
          className={`
            absolute
            -bottom-[56px]
            left-1/2
            transform
            -translate-x-1/2
            transition-opacity
            duration-200
            ease-in-out
            z-50
          `}
          style={{
            opacity: shouldShowMenu ? 1 : 0,
            pointerEvents: shouldShowMenu ? 'auto' : 'none',
          }}
          onMouseEnter={() => setIsMenuHovered(true)}
          onMouseLeave={() => setIsMenuHovered(false)}
        >
          <GroupActionMenu nodeId={nodeId} isTemporary={isTemporary} />
        </div>
      </>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.nodeId === nextProps.nodeId &&
      prevProps.isTemporary === nextProps.isTemporary &&
      prevProps.isNodeHovered === nextProps.isNodeHovered
    );
  },
);

GroupActionButtons.displayName = 'GroupActionButtons';
