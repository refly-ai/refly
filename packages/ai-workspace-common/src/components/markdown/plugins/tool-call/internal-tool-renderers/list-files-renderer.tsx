import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { InternalToolRendererProps } from './types';
import { ToolCallStatus } from '../types';

/**
 * Compact renderer for list_files tool
 * Display format: "Browsing file list"
 */
export const ListFilesRenderer = memo<InternalToolRendererProps>(
  ({ toolCallStatus, durationText }) => {
    const { t } = useTranslation();
    const isExecuting = toolCallStatus === ToolCallStatus.EXECUTING;
    const label = t('components.markdown.internalTool.listFiles');

    return (
      <div className="flex items-center gap-1 px-3 text-sm font-normal">
        <span className={isExecuting ? 'text-shimmer' : 'text-refly-text-2'}>{label}</span>
        <span className="text-refly-text-3 text-xs ml-1">{durationText}</span>
      </div>
    );
  },
);

ListFilesRenderer.displayName = 'ListFilesRenderer';
