import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { InternalToolRendererProps } from './types';
import { ToolCallStatus } from '../types';

/**
 * Compact renderer for get_canvas_snapshot tool
 * Display format: "Reading canvas snapshot"
 */
export const CopilotSnapshotRenderer = memo<InternalToolRendererProps>(
  ({ toolCallStatus, durationText }) => {
    const { t } = useTranslation();
    const isExecuting = toolCallStatus === ToolCallStatus.EXECUTING;
    const label = t('components.markdown.internalTool.copilotSnapshot');

    return (
      <div className="flex items-center gap-2 px-3 text-sm font-normal">
        <span className={isExecuting ? 'text-shimmer' : 'text-refly-text-2'}>{label}</span>
        <span className="text-refly-text-3 text-xs">{durationText}</span>
      </div>
    );
  },
);

CopilotSnapshotRenderer.displayName = 'CopilotSnapshotRenderer';
