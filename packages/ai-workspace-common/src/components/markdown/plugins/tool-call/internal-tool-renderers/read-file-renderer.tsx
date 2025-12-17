import React from 'react';
import { useTranslation } from 'react-i18next';
import { InternalToolRendererProps } from './types';
import { ToolCallStatus } from '../types';

/**
 * Compact renderer for read_file tool
 * Display format: "Reading: filename.pdf"
 */
export const ReadFileRenderer: React.FC<InternalToolRendererProps> = ({
  toolCallStatus,
  parametersContent,
  resultContent,
}) => {
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
    <div className="flex items-center gap-1 py-1 px-3 text-sm">
      <span className={isExecuting ? 'text-shimmer' : 'text-refly-text-0'}>
        {label}
        <span className={'text-refly-text-3'}>{fileName && `: ${fileName}`}</span>
      </span>
    </div>
  );
};
