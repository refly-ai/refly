import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { InternalToolRendererProps } from './types';
import { ToolCallStatus } from '../types';
import cn from 'classnames';

/**
 * Compact renderer for read_file tool
 * Display format: "Reading: filename.pdf"
 */
export const ReadFileRenderer = memo<InternalToolRendererProps>(
  ({ toolCallStatus, parametersContent, resultContent, durationText }) => {
    const { t } = useTranslation();
    const isExecuting = toolCallStatus === ToolCallStatus.EXECUTING;

    // Try to get fileName from parameters first, then from result
    const fileName = (parametersContent?.fileName ||
      parametersContent?.fileId ||
      resultContent?.fileName ||
      resultContent?.name ||
      '') as string;

    const label = t('components.markdown.internalTool.readFile');

    return (
      <div
        className={cn('flex flex-wrap items-center gap-x-1 px-3 text-sm font-normal', {
          'text-shimmer': isExecuting,
          'text-refly-text-2': !isExecuting,
        })}
      >
        <span className="shrink-0">{label}</span>
        <span className="text-refly-text-3 break-all">{fileName}</span>
        <span className="text-refly-text-3 text-xs">{durationText}</span>
      </div>
    );
  },
);

ReadFileRenderer.displayName = 'ReadFileRenderer';
