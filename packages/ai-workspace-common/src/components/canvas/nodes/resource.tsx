import { Position, useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { CanvasNodeData, ResourceNodeMeta, CanvasNode, ResourceNodeProps } from './types';
import { Node } from '@xyflow/react';
import { CustomHandle } from './custom-handle';
import { useState, useCallback, useRef } from 'react';
import { useCanvasControl } from '@refly-packages/ai-workspace-common/hooks/use-canvas-control';
import { EDGE_STYLES } from '../constants';
import { getNodeCommonStyles } from './index';
import { ActionButtons } from './action-buttons';
import { useAddToContext } from '@refly-packages/ai-workspace-common/hooks/use-add-to-context';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/use-delete-node';
import { HiOutlineSquare3Stack3D } from 'react-icons/hi2';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { useThrottledCallback } from 'use-debounce';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import Moveable from 'react-moveable';

type ResourceNode = Node<CanvasNodeData<ResourceNodeMeta>, 'resource'>;

export const ResourceNode = ({
  data,
  selected,
  id,
  isPreview = false,
  hideActions = false,
  hideHandles = false,
  onNodeClick,
}: ResourceNodeProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const { edges } = useCanvasControl();
  const { setEdges } = useReactFlow();
  const ResourceIcon = data?.metadata?.resourceType === 'weblink' ? HiOutlineSquare3Stack3D : HiOutlineSquare3Stack3D;

  const { i18n, t } = useTranslation();
  const language = i18n.languages?.[0];

  const targetRef = useRef<HTMLDivElement>(null);
  const { getNode } = useReactFlow();
  const node = getNode(id);
  const [size, setSize] = useState({
    width: node?.measured?.width ?? 288,
    height: node?.measured?.height ?? 384,
  });

  // Check if node has any connections
  const isTargetConnected = edges?.some((edge) => edge.target === id);
  const isSourceConnected = edges?.some((edge) => edge.source === id);

  // 立即更新hover状态，但节流更新边缘样式
  const updateEdgeStyles = useThrottledCallback(
    (hoveredState: boolean) => {
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.source === id || edge.target === id) {
            return {
              ...edge,
              style: hoveredState ? EDGE_STYLES.hover : EDGE_STYLES.default,
            };
          }
          return edge;
        }),
      );
    },
    500,
    { leading: true, trailing: true },
  );

  const handleMouseEnter = useCallback(() => {
    if (!isHovered) {
      setIsHovered(true);
      updateEdgeStyles(true);
    }
  }, [isHovered, updateEdgeStyles]);

  const handleMouseLeave = useCallback(() => {
    if (isHovered) {
      setIsHovered(false);
      updateEdgeStyles(false);
    }
  }, [isHovered, updateEdgeStyles]);

  const handleAddToContext = useAddToContext(
    {
      id,
      type: 'resource',
      data,
      position: { x: 0, y: 0 },
    } as CanvasNode,
    'resource',
  );

  const handleDelete = useDeleteNode(
    {
      id,
      type: 'resource',
      data,
      position: { x: 0, y: 0 },
    } as CanvasNode,
    'resource',
  );

  const handleHelpLink = useCallback(() => {
    // Implement help link logic
    console.log('Open help link');
  }, []);

  const handleAbout = useCallback(() => {
    // Implement about logic
    console.log('Show about info');
  }, []);

  const { operatingNodeId } = useCanvasStoreShallow((state) => ({
    operatingNodeId: state.operatingNodeId,
  }));

  const isOperating = operatingNodeId === id;

  return (
    <div>
      <div
        ref={targetRef}
        className="relative group"
        onMouseEnter={!isPreview ? handleMouseEnter : undefined}
        onMouseLeave={!isPreview ? handleMouseLeave : undefined}
        onClick={onNodeClick}
        style={{
          width: `${size.width}px`,
          height: `${size.height}px`,
          userSelect: isOperating ? 'text' : 'none',
          cursor: isOperating ? 'text' : 'grab',
        }}
      >
        {!isPreview && !hideActions && !isResizing && (
          <ActionButtons
            type="resource"
            nodeId={id}
            onAddToContext={handleAddToContext}
            onDelete={handleDelete}
            onHelpLink={handleHelpLink}
            onAbout={handleAbout}
            isProcessing={false}
          />
        )}

        <div
          className={`
          relative
          h-full
          ${getNodeCommonStyles({ selected: !isPreview && selected, isHovered })}
        `}
        >
          <div className="absolute bottom-0 left-0 right-0 h-[30%] bg-gradient-to-t from-white to-transparent pointer-events-none z-10" />
          <div className="absolute bottom-0 left-0 right-0 h-[30%] bg-gradient-to-t from-white to-transparent pointer-events-none z-10">
            <div className="absolute bottom-2 left-3 text-[10px] text-gray-400 z-20">
              {time(data.createdAt, language as LOCALE)
                ?.utc()
                ?.fromNow()}
            </div>
          </div>

          {!isPreview && !hideHandles && (
            <>
              <CustomHandle
                type="target"
                position={Position.Left}
                isConnected={isTargetConnected}
                isNodeHovered={isHovered}
                nodeType="resource"
              />
              <CustomHandle
                type="source"
                position={Position.Right}
                isConnected={isSourceConnected}
                isNodeHovered={isHovered}
                nodeType="resource"
              />
            </>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div
                className="
                w-6 
                h-6 
                rounded 
                bg-[#17B26A] 
                shadow-[0px_2px_4px_-2px_rgba(16,24,60,0.06),0px_4px_8px_-2px_rgba(16,24,60,0.1)]
                flex 
                items-center 
                justify-center
                flex-shrink-0
              "
              >
                <ResourceIcon className="w-4 h-4 text-white" />
              </div>

              <span
                className="
                text-sm
                font-medium
                leading-normal
                text-[rgba(0,0,0,0.8)]
                truncate
              "
              >
                {data.title}
              </span>
            </div>

            <Markdown
              className={`text-xs ${isOperating ? 'pointer-events-auto' : 'pointer-events-none'}`}
              content={data.contentPreview || t('canvas.nodePreview.resource.noContentPreview')}
            />
          </div>
        </div>
      </div>

      {!isPreview && selected && (
        <Moveable
          target={targetRef}
          resizable={true}
          edge={false}
          throttleResize={1}
          renderDirections={['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se']}
          onResizeStart={({ setOrigin, dragStart }) => {
            setIsResizing(true);
            setOrigin(['%', '%']);
            if (dragStart && dragStart instanceof MouseEvent) {
              dragStart.preventDefault();
            }
          }}
          onResizeEnd={() => {
            setIsResizing(false);
          }}
          onResize={({ target, width, height, direction }) => {
            const newWidth = Math.max(100, width);
            const newHeight = Math.max(80, height);

            let newLeft = (target as HTMLElement).offsetLeft;
            let newTop = (target as HTMLElement).offsetTop;

            if (direction[0] === -1) {
              newLeft = (target as HTMLElement).offsetLeft - (newWidth - (target as HTMLElement).offsetWidth);
            }
            if (direction[1] === -1) {
              newTop = (target as HTMLElement).offsetTop - (newHeight - (target as HTMLElement).offsetHeight);
            }

            target.style.width = `${newWidth}px`;
            target.style.height = `${newHeight}px`;
            target.style.left = `${newLeft}px`;
            target.style.top = `${newTop}px`;

            setSize({ width: newWidth, height: newHeight });
          }}
          hideDefaultLines={true}
          className={`!pointer-events-auto ${!isHovered ? 'moveable-control-hidden' : 'moveable-control-show'}`}
        />
      )}
    </div>
  );
};
