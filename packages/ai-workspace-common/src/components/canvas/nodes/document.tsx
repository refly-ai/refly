import { Position, NodeProps, useReactFlow } from '@xyflow/react';
import { CanvasNode, CanvasNodeData, DocumentNodeMeta, DocumentNodeProps } from './types';
import { Node } from '@xyflow/react';
import { CustomHandle } from './custom-handle';
import { useState, useCallback } from 'react';
import { useCanvasControl } from '@refly-packages/ai-workspace-common/hooks/use-canvas-control';
import { EDGE_STYLES } from '../constants';
import { getNodeCommonStyles } from './index';
import { ActionButtons } from './action-buttons';
import { useTranslation } from 'react-i18next';
import { useAddToContext } from '@refly-packages/ai-workspace-common/hooks/use-add-to-context';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/use-delete-node';
import { HiOutlineDocumentText } from 'react-icons/hi2';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';

type DocumentNode = Node<CanvasNodeData<DocumentNodeMeta>, 'document'>;

export const DocumentNode = ({
  data,
  selected,
  id,
  isPreview = false,
  hideActions = false,
  hideHandles = false,
  onNodeClick,
}: DocumentNodeProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const { edges } = useCanvasControl();
  const { setEdges } = useReactFlow();
  const { i18n, t } = useTranslation();
  const language = i18n.languages?.[0];

  // Check if node has any connections
  const isTargetConnected = edges?.some((edge) => edge.target === id);
  const isSourceConnected = edges?.some((edge) => edge.source === id);

  // Handle node hover events
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    // Update connected edges with hover styles
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
    // Restore default edge styles
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
      type: 'document',
      data,
      position: { x: 0, y: 0 },
    } as CanvasNode,
    'document',
  );

  const handleDelete = useDeleteNode(
    {
      id,
      type: 'document',
      data,
      position: { x: 0, y: 0 },
    } as CanvasNode,
    'document',
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
      className={`relative group ${onNodeClick ? 'cursor-pointer' : ''}`}
      onMouseEnter={!isPreview ? handleMouseEnter : undefined}
      onMouseLeave={!isPreview ? handleMouseLeave : undefined}
      onClick={onNodeClick}
    >
      {!isPreview && !hideActions && (
        <ActionButtons
          type="document"
          onAddToContext={handleAddToContext}
          onDelete={handleDelete}
          onHelpLink={handleHelpLink}
          onAbout={handleAbout}
        />
      )}

      <div
        className={`
        w-[170px]
        h-[186px]
        relative
        ${getNodeCommonStyles({ selected: !isPreview && selected, isHovered })}
      `}
      >
        {!isPreview && !hideHandles && (
          <>
            <CustomHandle
              type="target"
              position={Position.Left}
              isConnected={isTargetConnected}
              isNodeHovered={isHovered}
              nodeType="document"
            />
            <CustomHandle
              type="source"
              position={Position.Right}
              isConnected={isSourceConnected}
              isNodeHovered={isHovered}
              nodeType="document"
            />
          </>
        )}

        <div className="flex flex-col gap-2">
          {/* Header with Icon and Type */}
          <div className="flex items-center gap-2">
            <div
              className="
                w-6 
                h-6 
                rounded 
                bg-[#00968F]
                shadow-[0px_2px_4px_-2px_rgba(16,24,60,0.06),0px_4px_8px_-2px_rgba(16,24,60,0.1)]
                flex 
                items-center 
                justify-center
                flex-shrink-0
              "
            >
              <HiOutlineDocumentText className="w-4 h-4 text-white" />
            </div>

            {/* Node Type */}
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

          <Spin spinning={status === 'executing' && !data.contentPreview} style={{ height: 100 }}>
            <div className="text-xs leading-4 text-gray-500 line-clamp-6 overflow-hidden text-ellipsis">
              {data.contentPreview || t('canvas.nodePreview.document.noContentPreview')}
            </div>
          </Spin>

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
