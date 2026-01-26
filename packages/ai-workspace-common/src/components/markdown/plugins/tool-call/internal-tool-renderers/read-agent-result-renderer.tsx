import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { InternalToolRendererProps } from './types';
import { ToolCallStatus } from '../types';
import cn from 'classnames';

/**
 * Compact renderer for read_agent_result tool
 * Display format: "Reading result: [title]"
 */
export const ReadAgentResultRenderer = memo<InternalToolRendererProps>(
  ({ toolCallStatus, parametersContent, resultContent, durationText }) => {
    const { t } = useTranslation();
    const isExecuting = toolCallStatus === ToolCallStatus.EXECUTING;

    // Try to get title from result first, then from parameters
    const rawTitle = (resultContent?.title || parametersContent?.resultId || '') as string;
    // Truncate title to max 20 characters for display
    const title = rawTitle.length > 20 ? `${rawTitle.slice(0, 20)}...` : rawTitle;

    const label = t('components.markdown.internalTool.readAgentResult');

    return (
      <div
        className={cn('flex flex-wrap items-center gap-x-1 px-3 text-sm font-normal', {
          'text-shimmer': isExecuting,
          'text-refly-text-2': !isExecuting,
        })}
      >
        <span className="shrink-0">{label}</span>
        <span className="text-refly-text-3 break-all">{title}</span>
        <span className="text-refly-text-3 text-xs">{durationText}</span>
      </div>
    );
  },
);

ReadAgentResultRenderer.displayName = 'ReadAgentResultRenderer';
