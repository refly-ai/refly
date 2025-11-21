import { memo, useMemo } from 'react';
import { Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { cn } from '@refly/utils/cn';
import { ModelIcon } from '@lobehub/icons';
import { ResponseNodeMeta } from '@refly/canvas-common';
import { ModelInfo } from '@refly/openapi-schema';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';
import { IconError } from '@refly-packages/ai-workspace-common/components/common/icon';
import { X, File, AiChat } from 'refly-icons';
import { LabelDisplay } from '@refly-packages/ai-workspace-common/components/canvas/common/label-display';
import { parseMentionsFromQuery, processQueryWithMentions } from '@refly/utils/query-processor';
import { useRealtimeUpstreamAgents } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-upstream-agent';
import { useCanvasNodesStoreShallow } from '@refly/stores';

interface SkillResponseContentPreviewProps {
  nodeId: string;
  // Metadata containing model info, tools, and input variables
  metadata?: ResponseNodeMeta;
  // Additional CSS classes
  className?: string;
}

/**
 * Internal component to display model label with vision capability warning
 */
const ModelLabel = memo(
  ({ model, isContextIncludeImage }: { model: ModelInfo; isContextIncludeImage: boolean }) => {
    const { t } = useTranslation();

    return (
      <span className="text-xs flex items-center gap-1 text-refly-text-0 min-w-0 flex-1">
        <span className="truncate">{model.label}</span>
        {!model.capabilities?.vision && isContextIncludeImage && (
          <Tooltip title={t('copilot.modelSelector.noVisionSupport')}>
            <IconError className="w-3.5 h-3.5 text-[#faad14] flex-shrink-0" />
          </Tooltip>
        )}
      </span>
    );
  },
);

ModelLabel.displayName = 'ModelLabel';

/**
 * Renders the skill response content preview with four sections:
 * 1. Content preview (truncated with ellipsis if overflow)
 * 2. Model information as a tag
 * 3. Tools used as tag array
 * 4. Input variables as tag array
 */
export const SkillResponseContentPreview = memo(
  ({ nodeId, metadata, className = '' }: SkillResponseContentPreviewProps) => {
    const { i18n, t } = useTranslation();
    const { setHighlightedNodeId } = useCanvasNodesStoreShallow((state) => ({
      setHighlightedNodeId: state.setHighlightedNodeId,
    }));
    const currentLanguage = (i18n.language || 'en') as 'en' | 'zh';

    const query = metadata?.query ?? (metadata?.structuredData?.query as string) ?? '';
    const modelInfo = metadata?.modelInfo;
    const toolsets = metadata?.selectedToolsets ?? [];
    const contextItems = metadata?.contextItems ?? [];

    const upstreamAgentNodes = useRealtimeUpstreamAgents(nodeId);

    const files = useMemo(() => {
      return contextItems?.filter((item) => item.type === 'file');
    }, [contextItems]);

    const content = processQueryWithMentions(query)?.processedQuery || '';

    // Extract input variable names from contextItems
    const variableMentions = parseMentionsFromQuery(query)?.filter((item) => item.type === 'var');

    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <div
          className={cn('text-xs truncate w-full mb-1', { 'text-refly-text-2': !content })}
          title={content}
        >
          {content || t('canvas.nodeActions.selectToEdit')}
        </div>

        {modelInfo && (
          <LabelDisplay
            title={t('canvas.skillResponse.config.model')}
            labels={[
              {
                icon: <ModelIcon model={modelInfo.name} size={12} type={'color'} />,
                labeltext: modelInfo.label,
              },
            ]}
            labelClassnames="bg-refly-node-contrl-1"
            showMore={false}
          />
        )}

        <LabelDisplay
          title={t('canvas.skillResponse.config.input')}
          labels={variableMentions.map((varName) => ({
            labeltext: varName.name,
            icon: <X size={12} className="flex-shrink-0" />,
          }))}
          labelClassnames="bg-refly-node-contrl-2"
          showMore={false}
        />

        <LabelDisplay
          title={t('canvas.skillResponse.config.tool')}
          labels={toolsets.map((toolset) => ({
            icon: (
              <ToolsetIcon
                toolset={toolset}
                config={{
                  size: 12,
                  className: 'flex-shrink-0',
                  builtinClassName: '!rounded-[2.5px] !w-3 !h-3',
                }}
              />
            ),
            labeltext: toolset?.builtin
              ? ((toolset?.toolset?.definition?.labelDict?.[currentLanguage] as string) ??
                toolset.name)
              : toolset.name,
          }))}
          labelClassnames="bg-refly-node-contrl-1"
          showMore={false}
        />

        <LabelDisplay
          title={t('canvas.skillResponse.config.file')}
          labels={files.map((file) => ({
            labeltext: file.title || t('canvas.richChatInput.untitledFile'),
            icon: <File size={12} className="flex-shrink-0" />,
          }))}
          labelClassnames="bg-refly-node-input-control"
          showMore={false}
        />

        <LabelDisplay
          title={t('canvas.skillResponse.config.agent')}
          labels={upstreamAgentNodes.map((agent) => ({
            onMouseEnter: () => setHighlightedNodeId(agent.id),
            onMouseLeave: () => setHighlightedNodeId(null),
            labeltext: agent.data?.title || t('canvas.richChatInput.untitledAgent'),
            icon: <AiChat size={12} className="flex-shrink-0" />,
          }))}
          labelClassnames="bg-refly-node-contrl-2"
          showMore={false}
        />
      </div>
    );
  },
);

SkillResponseContentPreview.displayName = 'SkillResponseContentPreview';
