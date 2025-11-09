import { memo, useMemo } from 'react';
import { Tag, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { ModelIcon } from '@lobehub/icons';
import { ResponseNodeMeta } from '@refly/canvas-common';
import { IContextItem } from '@refly/common-types';
import { GenericToolset, ModelInfo } from '@refly/openapi-schema';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';
import { IconError } from '@refly-packages/ai-workspace-common/components/common/icon';
import { X } from 'refly-icons';
import { useListMentionItems } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/rich-chat-input/hooks/use-list-mention-items';
import { MentionItem } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/rich-chat-input/mentionList';

interface SkillResponseContentPreviewProps {
  // Preview content to display (will be truncated if overflow)
  nodeId: string;

  content: string;
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
  ({ nodeId, content, metadata, className = '' }: SkillResponseContentPreviewProps) => {
    const { i18n } = useTranslation();
    const allItems = useListMentionItems(nodeId);

    const currentLanguage = (i18n.language || 'en') as 'en' | 'zh';

    // Check if context includes image
    const isContextIncludeImage = useMemo(() => {
      return metadata?.contextItems?.some((item: IContextItem) => item.type === 'image') ?? false;
    }, [metadata?.contextItems]);

    // Extract model info
    const modelInfo = useMemo(() => {
      return metadata?.modelInfo || null;
    }, [metadata?.modelInfo]);

    // Extract toolsets with full object info for icon and localized labels
    const toolsets = useMemo(() => {
      const tools: GenericToolset[] = [];

      // Add additional toolsets if available
      const selectedToolsets = metadata?.selectedToolsets || [];
      for (const toolset of selectedToolsets) {
        if (toolset) {
          tools.push(toolset);
        }
      }

      return tools;
    }, [metadata?.selectedToolsets]);

    // Extract input variable names from contextItems
    const inputVariables = useMemo(() => {
      const variableItems = allItems.filter((item) => item.source === 'variables');
      return variableItems.map((item: MentionItem) => item?.name || item?.entityId).filter(Boolean);
    }, [allItems]);

    return (
      <div className={`flex flex-col ${className}`} style={{ gap: '8px' }}>
        {/* Content preview - first line with ellipsis if overflow */}
        {content && (
          <div className="text-xs text-gray-700 truncate w-full" title={content}>
            {content}
          </div>
        )}

        {/* Model information - second line */}
        {modelInfo && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 flex-shrink-0">Model:</span>
            <Tag className="text-xs m-0 flex items-center gap-1">
              <ModelIcon model={modelInfo.name} size={16} type={'color'} />
              <ModelLabel model={modelInfo} isContextIncludeImage={isContextIncludeImage} />
            </Tag>
          </div>
        )}

        {/* Tools used - third line */}
        {toolsets.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 flex-shrink-0">Tool:</span>
            <div className="flex flex-wrap gap-1">
              {toolsets.map((toolset, index) => {
                // Get localized label for builtin toolsets, otherwise use name
                const labelName = toolset?.builtin
                  ? ((toolset?.toolset?.definition?.labelDict?.[currentLanguage] as string) ??
                    toolset.name)
                  : toolset.name;

                return (
                  <Tag
                    key={`${toolset.id || toolset.name}-${index}`}
                    className="text-xs m-0 flex items-center gap-1"
                  >
                    <ToolsetIcon
                      toolset={toolset}
                      config={{
                        size: 16,
                        className: 'flex-shrink-0',
                        builtinClassName: '!w-4 !h-4',
                      }}
                    />
                    <span>{labelName}</span>
                  </Tag>
                );
              })}
            </div>
          </div>
        )}

        {/* Input variables - fourth line */}
        {inputVariables.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 flex-shrink-0">Input:</span>
            <div className="flex flex-wrap gap-1">
              {inputVariables.map((varName, index) => (
                <Tag
                  key={`${varName}-${index}`}
                  className="text-xs m-0 flex items-center gap-1 bg-[#FEF2CF]"
                >
                  <X className="w-3.5 h-3.5 text-[#faad14] flex-shrink-0" />
                  {varName}
                </Tag>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  },
  // Memoization comparison function to prevent unnecessary re-renders
  (prevProps, nextProps) => {
    return (
      prevProps.content === nextProps.content &&
      prevProps.className === nextProps.className &&
      JSON.stringify(prevProps.metadata?.modelInfo) ===
        JSON.stringify(nextProps.metadata?.modelInfo) &&
      JSON.stringify(prevProps.metadata?.selectedToolsets) ===
        JSON.stringify(nextProps.metadata?.selectedToolsets) &&
      JSON.stringify(prevProps.metadata?.contextItems) ===
        JSON.stringify(nextProps.metadata?.contextItems)
    );
  },
);

// Set display name for better debugging experience
SkillResponseContentPreview.displayName = 'SkillResponseContentPreview';
