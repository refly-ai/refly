import { useMemo, CSSProperties, useCallback } from 'react';
import { Tooltip } from 'antd';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DraggingStyle,
  NotDraggingStyle,
} from 'react-beautiful-dnd';
import { type NodeRelation } from './ArtifactRenderer';
import { NodeRenderer } from './NodeRenderer';
import { getNodeTitle } from '../utils/nodeUtils';
import { useTranslation } from 'react-i18next';

// Sidebar minimap component
function SidebarMinimap({
  nodes,
  activeNodeIndex,
  onNodeSelect,
  onReorderNodes,
  readonly = false,
}: {
  nodes: NodeRelation[];
  activeNodeIndex: number;
  onNodeSelect: (index: number) => void;
  onReorderNodes: (newOrder: NodeRelation[]) => void;
  readonly?: boolean;
}) {
  const { t } = useTranslation();

  // Handle node selection and scroll to corresponding content
  const handleNodeSelect = useCallback(
    (index: number) => {
      // Call the original onNodeSelect function
      onNodeSelect(index);

      // Use setTimeout to ensure scrolling happens after state update
      setTimeout(() => {
        // Find the corresponding content node
        const contentNode = document.getElementById(`content-block-${index}`);
        if (contentNode) {
          // Scroll to the content node
          contentNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    },
    [onNodeSelect],
  );

  // Handle drag end event
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    const items = Array.from(nodes);
    const [reorderedItem] = items.splice(sourceIndex, 1);
    items.splice(destinationIndex, 0, reorderedItem);

    // Update node order
    onReorderNodes(items);

    // After dragging, set the selected node to the dragged node's new position
    handleNodeSelect(destinationIndex);
  };

  // Cache thumbnail card style
  const thumbnailCardStyle = useMemo(
    (): CSSProperties => ({
      pointerEvents: 'none',
      transform: 'scale(0.4)',
      transformOrigin: 'top left',
      width: '250%',
      height: '250%',
      overflow: 'hidden',
    }),
    [],
  );

  // Custom drag style to ensure the dragged item stays under the cursor
  const getItemStyle = (
    isDragging: boolean,
    draggableStyle: DraggingStyle | NotDraggingStyle | undefined,
  ): React.CSSProperties => ({
    // some basic styles to make the items look a bit nicer
    userSelect: 'none',

    // styles we need to apply on draggables
    ...draggableStyle,

    // When dragging, ensure the item stays positioned correctly relative to cursor
    ...(isDragging && {
      position: 'relative',
      // These adjustments help position the item under the cursor
      left: 0,
      top: 0,
      margin: 0,
    }),
  });

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-2 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {t('pages.components.navigationDirectory')}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {nodes.length === 0 ? (
          <div className="text-center p-6 text-gray-400">
            <div className="text-xs">{t('common.empty')}</div>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="sidebar-nodes" isDropDisabled={readonly}>
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                  {nodes.map((node, index) => (
                    <Draggable
                      key={node.relationId || `node-${index}`}
                      draggableId={node.relationId || `node-${index}`}
                      index={index}
                      isDragDisabled={readonly}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={getItemStyle(snapshot.isDragging, provided.draggableProps.style)}
                          className={`relative rounded ${!readonly ? 'cursor-grab' : 'cursor-pointer'} transition border overflow-hidden shadow-sm dark:shadow-gray-700/30 hover:shadow-md dark:hover:shadow-gray-600 ${
                            activeNodeIndex === index
                              ? 'ring-2 ring-green-600 bg-green-50 dark:bg-green-950'
                              : 'border-gray-200 hover:border-green-300'
                          } ${snapshot.isDragging ? 'z-50' : ''}`}
                          onClick={() => handleNodeSelect(index)}
                        >
                          {/* Card title */}
                          <div className="py-1.5 px-2 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700 z-10 relative flex items-center justify-between">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-xs text-gray-500">{index + 1}.</span>
                              <Tooltip title={getNodeTitle(node)}>
                                <span className="truncate text-xs font-medium text-gray-600 dark:text-gray-300 max-w-[100px]">
                                  {getNodeTitle(node)}
                                </span>
                              </Tooltip>
                            </div>
                          </div>

                          {/* Content preview area */}
                          <div className="h-20 overflow-hidden relative bg-gray-50 dark:bg-gray-950">
                            <div style={thumbnailCardStyle}>
                              <NodeRenderer node={node} isMinimap={true} />
                            </div>

                            {/* Gradient mask */}
                            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent dark:from-black dark:to-transparent" />
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
    </div>
  );
}

export { SidebarMinimap };
