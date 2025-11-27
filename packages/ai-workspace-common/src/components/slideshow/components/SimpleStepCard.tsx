import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { ActionStep, Source } from '@refly/openapi-schema';
import { memo, useMemo, useState } from 'react';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { IconThinking } from '@refly-packages/ai-workspace-common/components/common/icon';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getParsedReasoningContent } from '@refly/utils';
import { safeParseJSON } from '@refly-packages/ai-workspace-common/utils/parse';

// Simplified version of ReasoningContent
const SimpleReasoningContent = memo(
  ({
    reasoningContent,
    sources,
  }: {
    reasoningContent: string;
    sources: Source[];
    step?: ActionStep;
  }) => {
    const { t } = useTranslation();
    const [collapsed, setCollapsed] = useState(false);

    if (!reasoningContent) return null;

    return (
      <div className="mb-4">
        <div
          className={cn(
            'p-3 bg-gray-50 rounded-lg border border-gray-200 transition-all dark:bg-gray-950 dark:border-gray-700',
            {
              'cursor-pointer hover:bg-gray-100 dark:hover-gray-800': collapsed,
            },
          )}
        >
          {collapsed ? (
            <div
              className="flex items-center justify-between text-sm"
              onClick={() => setCollapsed(false)}
            >
              <div className="flex items-center gap-1">
                <IconThinking className="w-4 h-4" />
                {t('canvas.skillResponse.reasoningContent')}
              </div>
              <ChevronDown className="w-4 h-4" />
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1 text-sm font-medium">
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
              <div>
                <Markdown
                  content={getParsedReasoningContent(reasoningContent)}
                  sources={sources}
                  mode="readonly"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);

// Simplified version of ActualContent
const SimpleActualContent = memo(({ content, sources }: { content: string; sources: Source[] }) => {
  if (!content?.trim()) return null;

  return (
    <div className="my-3 text-gray-600 text-base dark:text-gray-300">
      <Markdown content={content} sources={sources} mode="readonly" />
    </div>
  );
});

// Parse structured data helper
const parseStructuredData = (
  structuredData: Record<string, unknown> | undefined,
  field: string,
): any => {
  if (!structuredData || !structuredData[field]) return [];
  return typeof structuredData[field] === 'string'
    ? safeParseJSON(structuredData[field] as string)
    : structuredData[field];
};

// Simplified step card
export const SimpleStepCard = memo(({ step }: { step: ActionStep; index: number }) => {
  const sources = useMemo(
    () => parseStructuredData(step?.structuredData, 'sources') as Source[],
    [step?.structuredData],
  );

  return (
    <div className="flex flex-col gap-3 mb-6">
      {step.reasoningContent && (
        <SimpleReasoningContent reasoningContent={step.reasoningContent} sources={sources} />
      )}

      {step.content && <SimpleActualContent content={step.content} sources={sources} />}
    </div>
  );
});
