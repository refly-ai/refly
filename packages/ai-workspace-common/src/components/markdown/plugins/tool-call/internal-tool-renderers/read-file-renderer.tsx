import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { InternalToolRendererProps } from './types';
import { ToolCallStatus } from '../types';
import cn from 'classnames';

/**
 * Truncate filename by keeping start and end, removing middle
 * @param fileName - Original filename
 * @param maxLength - Maximum total length (default: 30)
 * @returns Truncated filename
 */
function truncateFileName(fileName: string, maxLength = 30): string {
  if (!fileName || fileName.length <= maxLength) {
    return fileName;
  }

  // Keep 60% at start, 40% at end
  const keepLength = maxLength - 3; // Reserve 3 chars for "..."
  const keepStart = Math.ceil(keepLength * 0.6);
  const keepEnd = Math.floor(keepLength * 0.4);

  return `${fileName.slice(0, keepStart)}...${fileName.slice(-keepEnd)}`;
}

/**
 * Compact renderer for read_file tool
 * Display format: "Reading: filename.pdf"
 */
export const ReadFileRenderer = memo<InternalToolRendererProps>(
  ({ toolCallStatus, parametersContent, resultContent, durationText }) => {
    const { t } = useTranslation();
    const isExecuting = toolCallStatus === ToolCallStatus.EXECUTING;

    // Try to get fileName from parameters first, then from result
    const rawFileName = (parametersContent?.fileName ||
      parametersContent?.fileId ||
      resultContent?.fileName ||
      resultContent?.name ||
      '') as string;

    // Truncate filename intelligently (keep start and extension)
    const fileName = truncateFileName(rawFileName);

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
