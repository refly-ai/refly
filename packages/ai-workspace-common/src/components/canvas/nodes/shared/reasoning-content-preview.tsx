import { memo, useState, useEffect } from 'react';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { Source } from '@refly/openapi-schema';
import { cn } from '@refly/utils/cn';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { getParsedReasoningContent } from '@refly/utils/content-parser';
import { Thinking, ArrowDown, ArrowUp } from 'refly-icons';

interface ReasoningContentPreviewProps {
  content: string;
  sources?: Source[];
  stepStatus: 'executing' | 'finish';
  className?: string;
  resultId?: string;
}

export const ReasoningContentPreview = memo(
  ({ content, sources, stepStatus, className = '', resultId }: ReasoningContentPreviewProps) => {
    const { t } = useTranslation();
    const isExecuting = ['executing', 'waiting'].includes(stepStatus);
    const [collapsed, setCollapsed] = useState(!isExecuting);

    // Auto-collapse when step status changes from executing to finish
    // or when sizeMode changes to compact
    useEffect(() => {
      if (isExecuting) {
        setCollapsed(false);
      } else {
        setCollapsed(true);
      }
    }, [isExecuting]);

    if (!content?.trim()) return null;

    return (
      <div className={cn('bg-refly-bg-control-z0 rounded-lg', className)}>
        <div
          className="p-3 flex items-center justify-between cursor-pointer"
          onClick={() => setCollapsed(!collapsed)}
        >
          <div className="flex items-center gap-2 text-sm font-medium leading-5 text-refly-text-0">
            <Thinking size={16} />
            {t('canvas.skillResponse.reasoningContent')}
          </div>
          <Button
            type="text"
            icon={collapsed ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
            onClick={() => setCollapsed(!collapsed)}
            size="small"
            className="flex items-center justify-center h-6 w-6 min-w-0 p-0"
          />
        </div>
        {!collapsed && (
          <Markdown
            className={cn('p-3 pt-0 text-xs overflow-hidden', {
              'max-h-[300px] overflow-y-auto': !isExecuting,
            })}
            content={getParsedReasoningContent(content)}
            sources={sources || []}
            resultId={resultId}
          />
        )}
      </div>
    );
  },
);
