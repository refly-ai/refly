import { Position, NodeProps, useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { CanvasNodeData, ResponseNodeMeta, CanvasNode, SkillResponseNodeProps } from './types';
import { Node } from '@xyflow/react';
import { useState, useCallback } from 'react';
import { CustomHandle } from './custom-handle';
import { useCanvasControl } from '@refly-packages/ai-workspace-common/hooks/use-canvas-control';
import { EDGE_STYLES } from '../constants';
import { getNodeCommonStyles } from './index';
import { ActionButtons } from './action-buttons';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/use-delete-node';
import { useInsertToDocument } from '@refly-packages/ai-workspace-common/hooks/use-insert-to-document';
import { getRuntime } from '@refly-packages/ai-workspace-common/utils/env';
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/use-create-document';
import { useAddToChatHistory } from '@refly-packages/ai-workspace-common/hooks/use-add-to-chat-history';
import { IconCanvas } from '@refly-packages/ai-workspace-common/components/common/icon';
import { NodeItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { getArtifactIcon } from '@refly-packages/ai-workspace-common/components/common/result-display';

type SkillResponseNode = Node<CanvasNodeData<ResponseNodeMeta>, 'skillResponse'>;

export const SkillResponseNode = (props: SkillResponseNodeProps) => {
  const { data, selected, id, hideActions = false, isPreview = false, hideHandles = false, onNodeClick } = props;
  const [isHovered, setIsHovered] = useState(false);
  const { edges } = useCanvasControl();
  const { setEdges } = useReactFlow();

  const { t, i18n } = useTranslation();
  const language = i18n.languages?.[0];

  const { title, contentPreview, metadata, createdAt } = data;
  const { status, modelName, steps } = metadata ?? {};

  // Get query and response content from result
  const query = title || t('copilot.chatHistory.loading');
  const content = steps
    ?.map((step) => step.content)
    ?.filter(Boolean)
    .join('\n\n');
  const artifacts = steps?.flatMap((step) => step.artifacts);

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

  const { getNode } = useReactFlow();
  const handleAddToChatHistory = useAddToChatHistory(getNode(id) as NodeItem);

  const handleRerun = useCallback(() => {
    // Implement rerun logic
    console.log('Rerun:', id);
  }, [id]);

  const runtime = getRuntime();
  const isWeb = runtime === 'web';
  const handleInsertToDoc = useInsertToDocument(data.entityId);

  const handleDelete = useDeleteNode(
    {
      id,
      type: 'skillResponse',
      data,
      position: { x: 0, y: 0 },
    } as CanvasNode,
    'skillResponse',
  );

  const handleHelpLink = useCallback(() => {
    // Implement help link logic
    console.log('Open help link');
  }, []);

  const handleAbout = useCallback(() => {
    // Implement about logic
    console.log('Show about info');
  }, []);

  const { debouncedCreateDocument, isCreating } = useCreateDocument();

  const handleCreateDocument = useCallback(async () => {
    await debouncedCreateDocument(data?.title ?? modelName, content, {
      sourceNodeId: data.entityId,
      addToCanvas: true,
    });
  }, [content, debouncedCreateDocument, data.entityId, data?.title, modelName]);

  return (
    <div
      className="relative group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onNodeClick}
    >
      {isWeb && !hideActions && (
        <ActionButtons
          type="skill-response"
          onAddToChatHistory={handleAddToChatHistory}
          onRerun={handleRerun}
          onInsertToDoc={() => handleInsertToDoc('insertBlow')}
          onCreateDocument={content ? handleCreateDocument : undefined}
          onDelete={handleDelete}
          onHelpLink={handleHelpLink}
          onAbout={handleAbout}
          isCompleted={metadata?.status === 'finish'}
          isCreatingDocument={isCreating}
        />
      )}

      {/* Main Card Container */}
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
              nodeType="response"
            />
            <CustomHandle
              type="source"
              position={Position.Right}
              isConnected={isSourceConnected}
              isNodeHovered={isHovered}
              nodeType="response"
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
                bg-[#F79009]
                shadow-[0px_2px_4px_-2px_rgba(16,24,60,0.06),0px_4px_8px_-2px_rgba(16,24,60,0.1)]
                flex 
                items-center 
                justify-center
                flex-shrink-0
              "
            >
              <IconCanvas className="w-4 h-4 text-white" />
            </div>

            <span className="text-sm font-medium leading-normal truncate">{query}</span>
          </div>

          <Spin spinning={status === 'executing' && !contentPreview} style={{ height: 100 }}>
            <div
              className="
              text-xs
              text-gray-500
              leading-4
              line-clamp-6
              overflow-hidden
              text-ellipsis
            "
            >
              {(isPreview ? contentPreview : content) || t('canvas.nodePreview.skillResponse.noContentPreview')}
            </div>
            <div className="flex items-center gap-2">
              {artifacts?.map((artifact) => (
                <div
                  key={artifact.entityId}
                  className="border border-solid border-gray-300 rounded-sm px-2 py-1 w-full flex items-center gap-1"
                >
                  {getArtifactIcon(artifact, 'text-gray-500')}
                  <span className="text-xs text-gray-500">{artifact.title}</span>
                </div>
              ))}
            </div>
          </Spin>

          <div className="absolute bottom-2 left-3 text-[10px] text-gray-400">
            {time(createdAt, language as LOCALE)
              ?.utc()
              ?.fromNow()}
          </div>
        </div>
      </div>
    </div>
  );
};
