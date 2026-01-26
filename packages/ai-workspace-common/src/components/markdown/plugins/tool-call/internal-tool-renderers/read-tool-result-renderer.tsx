import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { InternalToolRendererProps } from './types';
import { ToolCallStatus } from '../types';
import cn from 'classnames';

/**
 * Compact renderer for read_tool_result tool
 * Display format: "Reading tool output: [toolName]"
 */
export const ReadToolResultRenderer = memo<InternalToolRendererProps>(
  ({ toolCallStatus, parametersContent, resultContent, durationText }) => {
    const { t } = useTranslation();
    const isExecuting = toolCallStatus === ToolCallStatus.EXECUTING;

    // Try to get toolName from result first, then from parameters
    const toolName = (resultContent?.toolName || parametersContent?.callId || '') as string;

    const label = t('components.markdown.internalTool.readToolResult');

    return (
      <div
        className={cn('flex flex-wrap items-center gap-x-1 px-3 text-sm font-normal', {
          'text-shimmer': isExecuting,
          'text-refly-text-2': !isExecuting,
        })}
      >
        <span className="shrink-0">{label}</span>
        <span className="text-refly-text-3 break-all">{toolName}</span>
        <span className="text-refly-text-3 text-xs">{durationText}</span>
      </div>
    );
  },
);

ReadToolResultRenderer.displayName = 'ReadToolResultRenderer';
