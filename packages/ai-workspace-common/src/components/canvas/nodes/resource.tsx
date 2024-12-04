import { Position, useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { CanvasNodeData, ResourceNodeMeta, CanvasNode, ResourceNodeProps } from './types';
import { Node } from '@xyflow/react';
import { CustomHandle } from './custom-handle';
import { useState, useCallback } from 'react';
import { useCanvasControl } from '@refly-packages/ai-workspace-common/hooks/use-canvas-control';
import { EDGE_STYLES } from '../constants';
import { getNodeCommonStyles } from './index';
import { ActionButtons } from './action-buttons';
import { useAddToContext } from '@refly-packages/ai-workspace-common/hooks/use-add-to-context';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/use-delete-node';
import { HiOutlineSquare3Stack3D } from 'react-icons/hi2';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';

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
  const { edges } = useCanvasControl();
  const { setEdges } = useReactFlow();
  const ResourceIcon = data?.metadata?.resourceType === 'weblink' ? HiOutlineSquare3Stack3D : HiOutlineSquare3Stack3D;

  const { i18n, t } = useTranslation();
  const language = i18n.languages?.[0];

  // Check if node has any connections
  const isTargetConnected = edges?.some((edge) => edge.target === id);
  const isSourceConnected = edges?.some((edge) => edge.source === id);

  // Handle node hover events
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.source === id || edge.target === id) {
          return {
            ...edge,
            style: EDGE_STYLES.hover,
          };
        }
        return edge;
      }),
    );
  }, [id, setEdges]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.source === id || edge.target === id) {
          return {
            ...edge,
            style: EDGE_STYLES.default,
          };
        }
        return edge;
      }),
    );
  }, [id, setEdges]);

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

  return (
    <div
      className="relative group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onNodeClick}
    >
      {!isPreview && !hideActions && (
        <ActionButtons
          type="resource"
          onAddToContext={handleAddToContext}
          onDelete={handleDelete}
          onHelpLink={handleHelpLink}
          onAbout={handleAbout}
          isProcessing={false}
        />
      )}

      <div
        className={`
          w-[170px]
          h-[186px]
          relative
          ${getNodeCommonStyles({ selected, isHovered })}
        `}
      >
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

          <div className="text-xs leading-4 text-gray-500 line-clamp-6 overflow-hidden text-ellipsis">
            {data.contentPreview || t('canvas.nodePreview.resource.noContentPreview')}
          </div>

          <div className="absolute bottom-2 left-3 text-[10px] text-gray-400">
            {time(data.createdAt, language as LOCALE)
              ?.utc()
              ?.fromNow()}
          </div>
        </div>
      </div>
    </div>
  );
};
