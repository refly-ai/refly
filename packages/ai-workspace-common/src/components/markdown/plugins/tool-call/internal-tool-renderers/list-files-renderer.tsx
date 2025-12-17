import React from 'react';
import { useTranslation } from 'react-i18next';
import { InternalToolRendererProps } from './types';
import { ToolCallStatus } from '../types';

/**
 * Compact renderer for list_files tool
 * Display format: "Browsing file list"
 */
export const ListFilesRenderer: React.FC<InternalToolRendererProps> = ({ toolCallStatus }) => {
  const { t } = useTranslation();
  const isExecuting = toolCallStatus === ToolCallStatus.EXECUTING;
  const label = t('components.markdown.internalTool.listFiles');

  return (
    <div className="flex items-center gap-1 py-1 px-3 text-sm">
      <span className={isExecuting ? 'text-shimmer' : 'text-refly-text-0'}>{label}</span>
    </div>
  );
};
