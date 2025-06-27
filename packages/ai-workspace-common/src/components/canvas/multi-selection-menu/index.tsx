import { useState } from 'react';
import { useStore, useReactFlow } from '@xyflow/react';
import { GroupActionMenu } from '../group-action-menu';
import { SelectionActionMenu } from './selection-action-menu';
import { calculateGroupBoundaries } from '@refly/canvas-common';

export const MultiSelectionMenus = () => {
  const [isTopMenuHovered, setIsTopMenuHovered] = useState(false);
  const [isRightMenuHovered, setIsRightMenuHovered] = useState(false);

  // Get transform from React Flow store
  const transform = useStore((state) => state.transform);
  const nodes = useStore((state) => state.nodes);
  const selectedNodes = nodes.filter((node) => node?.selected);
  const { getZoom } = useReactFlow();
  const zoom = getZoom();

  const shouldShowMenus = selectedNodes.length >= 2 || isTopMenuHovered || isRightMenuHovered;

  if (!shouldShowMenus) return null;

  // Calculate boundaries
  const { dimensions, minX, minY } = calculateGroupBoundaries(selectedNodes, nodes);

  // Calculate positions for menus
  const topMenuPosition = {
    x: minX + dimensions.width / 2, // Center horizontally
    y: minY - 12, // Slightly above the selection
  };

  const rightMenuPosition = {
    x: minX + dimensions.width + 12, // Only 4px from the right edge
    y: minY, // Align with top
  };

  return (
    <>
      {/* Top Group Action Menu */}
      <div
        className="react-flow__node-toolbar"
        style={{
          position: 'absolute',
          left: `${topMenuPosition.x * zoom + transform[0]}px`,
          top: `${topMenuPosition.y * zoom + transform[1]}px`,
          transform: `translate(-50%, -100%) scale(${zoom})`,
          transformOrigin: 'center bottom',
          zIndex: 51,
          pointerEvents: 'all',
        }}
        onMouseEnter={() => setIsTopMenuHovered(true)}
        onMouseLeave={() => setIsTopMenuHovered(false)}
      >
        <GroupActionMenu nodeId={selectedNodes[0]?.id} isTemporary={true} />
      </div>

      {/* Right Node Action Menu */}
      <div
        className="react-flow__node-toolbar"
        style={{
          position: 'absolute',
          left: `${rightMenuPosition.x * zoom + transform[0]}px`,
          top: `${rightMenuPosition.y * zoom + transform[1]}px`,
          transform: `scale(${zoom})`,
          transformOrigin: 'left top',
          zIndex: 51,
          pointerEvents: 'all',
        }}
        onMouseEnter={() => setIsRightMenuHovered(true)}
        onMouseLeave={() => setIsRightMenuHovered(false)}
      >
        <SelectionActionMenu />
      </div>
    </>
  );
};
