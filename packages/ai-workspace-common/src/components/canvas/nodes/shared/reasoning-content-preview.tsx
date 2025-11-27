import { memo, useMemo, useState, useEffect } from 'react';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { Source } from '@refly/openapi-schema';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@refly/utils/cn';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { getParsedReasoningContent } from '@refly/utils/content-parser';
import { IconThinking } from '@refly-packages/ai-workspace-common/components/common/icon';

interface ReasoningContentPreviewProps {
  content: string;
  sources?: Source[];
  stepStatus: 'executing' | 'finish';
  className?: string;
  resultId?: string;
  sizeMode?: 'compact' | 'adaptive';
}

export const ReasoningContentPreview = memo(
  ({
    content,
    sources,
    stepStatus,
    className = '',
    resultId,
    sizeMode = 'adaptive',
  }: ReasoningContentPreviewProps) => {
    const { t } = useTranslation();
    const [collapsed, setCollapsed] = useState(
      stepStatus !== 'executing' || sizeMode === 'compact',
    );

    // Auto-collapse when step status changes from executing to finish
    // or when sizeMode changes to compact
    useEffect(() => {
      if (stepStatus === 'executing' && sizeMode !== 'compact') {
        setCollapsed(false);
      } else {
        setCollapsed(true);
      }
    }, [stepStatus, sizeMode]);

    const markdownClassName = useMemo(() => `text-xs overflow-hidden ${className}`, [className]);

    if (!content?.trim()) return null;

    return (
      <div>
        <div
          className={cn(
            'bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-all',
            {
              'cursor-pointer hover:bg-gray-100': collapsed,
              'p-3': sizeMode !== 'compact',
              'p-2': sizeMode === 'compact',
            },
          )}
        >
          {collapsed ? (
            <div
              className="flex items-center justify-between text-xs"
              onClick={() => sizeMode !== 'compact' && setCollapsed(false)}
            >
              <div className="flex items-center gap-1">
                <IconThinking
                  className={cn('text-gray-500', {
                    'w-4 h-4': sizeMode !== 'compact',
                    'w-3 h-3': sizeMode === 'compact',
                  })}
                />
                <span
                  className={cn({
                    truncate: sizeMode === 'compact',
                    'max-w-[200px]': sizeMode === 'compact',
                  })}
                >
                  {t('canvas.skillResponse.reasoningContent')}
                </span>
              </div>
              {sizeMode !== 'compact' && <ChevronDown className="w-4 h-4" />}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1 text-xs font-medium">
                  <IconThinking className="w-4 h-4" />
                  {t('canvas.skillResponse.reasoningContent')}
                </div>
                <Button
                  type="text"
                  icon={<ChevronUp className="w-4 h-4" />}
                  onClick={() => setCollapsed(true)}
                  size="small"
                  className="flex items-center justify-center h-6 w-6 min-w-0 p-0"
                />
              </div>
              <Markdown
                className={markdownClassName}
                content={getParsedReasoningContent(content)}
                sources={sources || []}
                resultId={resultId}
              />
            </div>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.content === nextProps.content &&
      prevProps.stepStatus === nextProps.stepStatus &&
      prevProps.className === nextProps.className &&
      prevProps.sizeMode === nextProps.sizeMode &&
      JSON.stringify(prevProps.sources) === JSON.stringify(nextProps.sources)
    );
  },
);
