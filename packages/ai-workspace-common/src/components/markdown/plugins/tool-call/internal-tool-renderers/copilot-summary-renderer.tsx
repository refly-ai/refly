import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { InternalToolRendererProps } from './types';
import { ToolCallStatus } from '../types';

/**
 * Compact renderer for get_workflow_summary tool
 * Display format: "Reading workflow summary"
 */
export const CopilotSummaryRenderer = memo<InternalToolRendererProps>(
  ({ toolCallStatus, durationText }) => {
    const { t } = useTranslation();
    const isExecuting = toolCallStatus === ToolCallStatus.EXECUTING;
    const label = t('components.markdown.internalTool.copilotSummary');

    return (
      <div className="flex items-center gap-2 px-3 text-sm font-normal">
        <span className={isExecuting ? 'text-shimmer' : 'text-refly-text-2'}>{label}</span>
        <span className="text-refly-text-3 text-xs">{durationText}</span>
      </div>
    );
  },
);

CopilotSummaryRenderer.displayName = 'CopilotSummaryRenderer';
