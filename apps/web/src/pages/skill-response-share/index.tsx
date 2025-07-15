import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { Button, Result } from 'antd';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import { PreviewChatInput } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response/preview-chat-input';
import { ActionStep, Source } from '@refly/openapi-schema';
import { memo, useMemo, useEffect, useCallback } from 'react';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import {
  IconThinking,
  IconCheck,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { getParsedReasoningContent } from '@refly/utils/content-parser';
import { safeParseJSON } from '@refly-packages/ai-workspace-common/utils/parse';
import PoweredByRefly from '@/components/common/PoweredByRefly';

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
  if (!content) return null;

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
export const SimpleStepCard = memo(({ step, index }: { step: ActionStep; index: number }) => {
  const { t } = useTranslation();
  const sources = useMemo(
    () => parseStructuredData(step?.structuredData, 'sources') as Source[],
    [step?.structuredData],
  );

  const skillName = 'commonQnA'; // Default skill name

  return (
    <div className="flex flex-col gap-3 mb-6">
      <div className="text-gray-600 text-sm flex items-center gap-2 font-medium border-b pb-2 dark:text-gray-300">
        <IconCheck className="h-4 w-4 text-green-500" />
        {t('canvas.skillResponse.stepTitle', { index })}{' '}
        {` · ${t(`${skillName}.steps.${step.name}.name`, { ns: 'skill', defaultValue: step.name })}`}
      </div>

      {step.reasoningContent && (
        <SimpleReasoningContent reasoningContent={step.reasoningContent} sources={sources} />
      )}

      {step.content && <SimpleActualContent content={step.content} sources={sources} />}
    </div>
  );
});

const SkillResponseSharePage = () => {
  const { shareId = '' } = useParams();
  const { t } = useTranslation();
  const { collapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));
  const { data: skillResponseData, loading: isLoading } = useFetchShareData(shareId);

  // Force collapse by default
  useEffect(() => {
    setCollapse(true);
  }, [setCollapse]);

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    setCollapse(!collapse);
  }, [collapse, setCollapse]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full grow items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">
          {t('canvas.skillResponse.shareLoading', 'Loading shared skill response...')}
        </div>
      </div>
    );
  }

  if (!skillResponseData) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Result
          status="404"
          title={t('canvas.skillResponse.notFound', 'Skill Response Not Found')}
          subTitle={t(
            'canvas.skillResponse.notFoundDesc',
            'The skill response you are looking for does not exist or has been removed.',
          )}
        />
      </div>
    );
  }

  const { title, steps = [], actionMeta } = skillResponseData;

  return (
    <div className="flex h-full w-full grow relative">
      {collapse && <PoweredByRefly onClick={toggleSidebar} />}

      <div
        className={`absolute h-16 bottom-0 left-0 right-0 box-border flex justify-between items-center py-2 px-4 pr-0 bg-transparent ${
          collapse ? 'w-[calc(100vw-12px)]' : 'w-[calc(100vw-260px)]'
        }`}
      >
        {/* Removed the collapse button since we now use PoweredByRefly for toggling */}
      </div>

      {/* Main content */}
      <div className="flex h-full w-full grow bg-white overflow-auto dark:bg-gray-900">
        <div className="flex flex-col space-y-4 p-4 h-full max-w-[1024px] mx-auto w-full">
          {title && (
            <PreviewChatInput
              enabled={true}
              readonly={true}
              contextItems={[]}
              query={title}
              actionMeta={actionMeta}
              setEditMode={() => {}}
            />
          )}

          <div className="flex-grow">
            {steps.map((step: ActionStep, index: number) => (
              <SimpleStepCard key={step.name} step={step} index={index + 1} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillResponseSharePage;
