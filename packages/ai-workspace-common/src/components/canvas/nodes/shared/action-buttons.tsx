import { FC, memo, useState, useRef, useEffect, useCallback } from 'react';
import { NodeActionMenu } from '../../node-action-menu';
import { CanvasNodeType } from '@refly/openapi-schema';
import { useReactFlow } from '@xyflow/react';

type ActionButtonsProps = {
  nodeId: string;
  type: CanvasNodeType;
  isNodeHovered: boolean;
};

export const ActionButtons: FC<ActionButtonsProps> = memo(
  ({ nodeId, type, isNodeHovered }) => {
    const [isMenuHovered, setIsMenuHovered] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0 });
    const [shouldAdjustPosition, setShouldAdjustPosition] = useState(true);
    const menuRef = useRef<HTMLDivElement>(null);
    const nodeRef = useRef<HTMLDivElement | null>(null);
    const lastNodePosition = useRef<{ x: number; y: number } | null>(null);
    const lastZoom = useRef<number | null>(null);
    const { getZoom } = useReactFlow();

    const SAFETY_MARGIN = 5;

    const shouldShowMenu = isNodeHovered || isMenuHovered;

    const resetMenuPosition = useCallback(() => {
      setMenuPosition({ top: 0 });
      setShouldAdjustPosition(true);
    }, []);

    // Check if node has moved or canvas has been zoomed
    const hasNodeMovedOrZoomed = useCallback(() => {
      if (!nodeRef.current || !lastNodePosition.current) return false;

      const rect = nodeRef.current.getBoundingClientRect();
      const currentPos = { x: rect.left, y: rect.top };
      const currentZoom = getZoom();

      const hasMoved =
        Math.abs(currentPos.x - lastNodePosition.current.x) > 5 ||
        Math.abs(currentPos.y - lastNodePosition.current.y) > 5;

      const hasZoomed =
        lastZoom.current !== null && Math.abs(currentZoom - lastZoom.current) > 0.01;

      // Update latest position and zoom
      if (hasMoved || hasZoomed) {
        lastNodePosition.current = currentPos;
        lastZoom.current = currentZoom;
      }

      return hasMoved || hasZoomed;
    }, [getZoom]);

    // Check if menu is obstructed by viewport top or bottom
    const isMenuObstructed = useCallback(() => {
      const menuEl = menuRef.current;
      if (!menuEl) return false;

      const menuRect = menuEl.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Check if menu is obstructed at the top or bottom
      const isTopObstructed = menuRect.top < SAFETY_MARGIN;
      const isBottomObstructed = menuRect.bottom > viewportHeight - SAFETY_MARGIN;

      return isTopObstructed || isBottomObstructed;
    }, []);

    // Adjust menu position to ensure it's fully visible
    const adjustMenuPosition = useCallback(() => {
      if (!shouldAdjustPosition) return;

      const menuEl = menuRef.current;
      if (!menuEl) return;

      // Detect if adjustment is needed
      const hasChanged = hasNodeMovedOrZoomed();

      // Delay calculation to ensure DOM is updated
      setTimeout(() => {
        if (!menuEl) return;

        const menuRect = menuEl.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        // If menu height exceeds available viewport space (with safety margins),
        // align menu with top of viewport and skip regular adjustment
        if (menuRect.height > viewportHeight - 2 * SAFETY_MARGIN) {
          setMenuPosition({ top: 0 });
          setShouldAdjustPosition(false);
          return;
        }

        // Check obstructions
        const isTopObstructed = menuRect.top < SAFETY_MARGIN;
        const isBottomObstructed = menuRect.bottom > viewportHeight - SAFETY_MARGIN;

        if (!hasChanged && !isTopObstructed && !isBottomObstructed) return;

        // If both top and bottom are obstructed, don't adjust position
        if (isTopObstructed && isBottomObstructed) {
          return;
        }

        let newTop = menuPosition.top;

        // Handle top obstruction
        if (isTopObstructed) {
          const topOverflow = SAFETY_MARGIN - menuRect.top;
          newTop = menuPosition.top + topOverflow;
        }
        // Handle bottom obstruction
        else if (isBottomObstructed) {
          const bottomOverflow = menuRect.bottom - viewportHeight + SAFETY_MARGIN;
          newTop = menuPosition.top - bottomOverflow;
        }
        // If node moved but no obstruction, reset top position
        else if (hasChanged) {
          newTop = 0;
        }

        // Only update if position actually needs to change
        if (newTop !== menuPosition.top) {
          setMenuPosition({ top: newTop });
        }

        // After adjustment, if position is stable, pause adjustment
        if (!hasChanged && !isTopObstructed && !isBottomObstructed) {
          setShouldAdjustPosition(false);
        } else {
          setShouldAdjustPosition(true);
        }
      }, 0);
    }, [menuPosition, hasNodeMovedOrZoomed, shouldAdjustPosition]);

    // Record initial node position and zoom
    useEffect(() => {
      if (!shouldShowMenu) return;

      const parentNode = menuRef.current?.closest('.react-flow__node');
      if (parentNode) {
        nodeRef.current = parentNode as HTMLDivElement;

        const rect = parentNode.getBoundingClientRect();
        lastNodePosition.current = { x: rect.left, y: rect.top };
        lastZoom.current = getZoom();

        setShouldAdjustPosition(true);
      }
    }, [shouldShowMenu, getZoom]);

    // Monitor menu position and adjust when necessary
    useEffect(() => {
      if (!shouldShowMenu || !menuRef.current) return;

      adjustMenuPosition();

      window.addEventListener('resize', adjustMenuPosition);

      const intervalId = setInterval(() => {
        if (hasNodeMovedOrZoomed() || isMenuObstructed()) {
          adjustMenuPosition();
        }
      }, 300);

      return () => {
        window.removeEventListener('resize', adjustMenuPosition);
        clearInterval(intervalId);
      };
    }, [shouldShowMenu, adjustMenuPosition, hasNodeMovedOrZoomed, isMenuObstructed]);

    // Monitor menu content changes that might affect menu height
    useEffect(() => {
      if (!shouldShowMenu || !menuRef.current) return;

      const observer = new MutationObserver(() => {
        if (isMenuObstructed()) {
          adjustMenuPosition();
        }
      });

      observer.observe(menuRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
      });

      return () => observer.disconnect();
    }, [shouldShowMenu, adjustMenuPosition, isMenuObstructed]);

    useEffect(() => {
      if (shouldShowMenu) {
        resetMenuPosition();
      }
    }, [shouldShowMenu, resetMenuPosition]);

    return (
      <>
        <div
          className={`
            absolute
            -right-[30px]
            top-0
            w-[30px]
            h-full
            ${shouldShowMenu ? '' : 'pointer-events-none'}
          `}
          onMouseEnter={() => setIsMenuHovered(true)}
          onMouseLeave={() => setIsMenuHovered(false)}
        />
        <div
          ref={menuRef}
          style={{ top: `${menuPosition.top}px` }}
          className={`
            absolute
            -right-[154px]
            transition-opacity
            duration-200
            ease-in-out
            z-50
            ${shouldShowMenu ? 'opacity-100' : 'opacity-0 pointer-events-none'}
          `}
        >
          {/* Menu container */}
          <div
            className="w-[150px] bg-white rounded-lg"
            onMouseEnter={() => setIsMenuHovered(true)}
            onMouseLeave={() => setIsMenuHovered(false)}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            {shouldShowMenu && <NodeActionMenu nodeId={nodeId} nodeType={type} />}
          </div>

          {/* Transparent bridge layer */}
          <div
            className={`
              absolute 
              top-0 
              right-[-20px] 
              w-[20px] 
              h-full 
              bg-transparent
              ${shouldShowMenu ? '' : 'pointer-events-none'}
            `}
            onMouseEnter={() => setIsMenuHovered(true)}
            onMouseLeave={() => setIsMenuHovered(false)}
          />
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
