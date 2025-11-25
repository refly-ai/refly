import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Steps, Button } from 'antd';
import { ActionResult, ActionStatus, ActionStep, Source } from '@refly/openapi-schema';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { CheckCircleOutlined } from '@ant-design/icons';
import { cn } from '@refly/utils/cn';
import { IconLoading } from '@refly-packages/ai-workspace-common/components/common/icon';
import { safeParseJSON } from '@refly/utils/parse';
import { SourceViewer } from './source-viewer';
import { getArtifactIcon } from '@refly-packages/ai-workspace-common/components/common/result-display';
import { RecommendQuestions } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response/recommend-questions';
import { useNodeSelection } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-selection';
import { getParsedReasoningContent } from '@refly/utils/content-parser';
import { Thinking, ArrowDown, ArrowUp } from 'refly-icons';

const parseStructuredData = (structuredData: Record<string, unknown>, field: string) => {
  return typeof structuredData[field] === 'string'
    ? safeParseJSON(structuredData[field])
    : (structuredData[field] as Source[]);
};

const LogBox = memo(
  ({
    logs,
    collapsed,
    onCollapse,
    t,
  }: {
    logs: any[];
    collapsed: boolean;
    onCollapse: (collapsed: boolean) => void;
    t: any;
    log?: { key: string; titleArgs?: any; descriptionArgs?: any };
  }) => {
    if (!logs?.length) return null;

    return (
      <div
        className={cn(
          'my-2 p-4 border border-solid border-gray-200 dark:border-gray-700 rounded-lg transition-all',
          {
            'px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800': collapsed,
            'relative pb-0': !collapsed,
          },
        )}
      >
        {collapsed ? (
          <div
            className="text-gray-500 text-sm flex items-center justify-between"
            onClick={(e) => {
              e.stopPropagation();
              onCollapse(false);
            }}
          >
            <div>
              <CheckCircleOutlined /> {t('canvas.skillResponse.stepCompleted')}
            </div>
            <div className="flex items-center">
              <ArrowDown size={16} />
            </div>
          </div>
        ) : (
          <>
            <Steps
              direction="vertical"
              current={logs?.length ?? 0}
              size="small"
              items={logs.map((log) => ({
                title: t(`${log.key}.title`, {
                  ...log.titleArgs,
                  ns: 'skillLog',
                  defaultValue: log.key,
                  interpolation: { escapeValue: false },
                }),
                description: t(`${log.key}.description`, {
                  ...log.descriptionArgs,
                  ns: 'skillLog',
                  defaultValue: '',
                  interpolation: { escapeValue: false },
                }),
                status: log.status === 'error' ? 'error' : 'finish',
              }))}
            />
            <Button
              type="text"
              icon={<ArrowUp size={16} />}
              onClick={(e) => {
                e.stopPropagation();
                onCollapse(true);
              }}
              className="absolute right-2 top-2"
            />
          </>
        )}
      </div>
    );
  },
);

const ReasoningContent = memo(
  ({
    resultId,
    reasoningContent,
    sources,
    step,
    status,
  }: {
    resultId: string;
    reasoningContent: string;
    sources: Source[];
    step: ActionStep;
    status: ActionStatus;
  }) => {
    const { t } = useTranslation();
    const [collapsed, setCollapsed] = useState(status !== 'executing');
    const isFinished = status === 'finish' || status === 'failed';

    // Auto-collapse when step status changes from executing to finish
    useEffect(() => {
      if (['executing', 'waiting'].includes(status)) {
        setCollapsed(false);
      } else {
        setCollapsed(true);
      }
    }, [status]);

    if (!reasoningContent) return null;

    return (
      <div className="p-3 bg-refly-bg-control-z0 rounded-lg transition-all">
        <div
          className="flex items-center justify-between cursor-pointer select-none min-h-[24px]"
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed(!collapsed);
          }}
        >
          <div className="flex items-center gap-2 text-sm font-semibold leading-5">
            <Thinking size={16} />
            {t('canvas.skillResponse.reasoningContent')}
          </div>
          <Button
            type="text"
            size="small"
            className="!w-4 !h-4 !rounded-[4px]"
            icon={collapsed ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed(!collapsed);
            }}
          />
        </div>

        {!collapsed && (
          <div
            className={`mt-3 skill-response-reasoning-${resultId}-${step.name} ${isFinished ? 'max-h-[400px] overflow-y-auto' : ''}`}
          >
            <Markdown
              content={getParsedReasoningContent(reasoningContent)}
              sources={sources}
              resultId={resultId}
            />
          </div>
        )}
      </div>
    );
  },
);

const ActualContent = memo(
  ({
    resultId,
    content,
    sources,
    step,
  }: {
    resultId: string;
    content: string;
    sources: Source[];
    step: ActionStep;
  }) => {
    if (!content) return null;

    return (
      <div className="my-3 text-base">
        <div className={`skill-response-content-${resultId}-${step.name}`}>
          <Markdown content={content} sources={sources} resultId={resultId} />
        </div>
      </div>
    );
  },
);

const ArtifactItem = memo(({ artifact, onSelect }: { artifact: any; onSelect: () => void }) => {
  const { t } = useTranslation();

  if (!artifact?.title) return null;

  return (
    <div
      key={artifact.entityId}
      className="my-2 px-4 py-2 h-12 border border-solid border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-between space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div className="flex items-center space-x-2">
        {getArtifactIcon(artifact, 'w-4 h-4')}
        <span className="text-gray-600 dark:text-gray-300 max-w-[200px] truncate inline-block">
          {artifact.title}
        </span>
      </div>
      <div
        className={cn('flex items-center space-x-1 text-xs', {
          'text-yellow-500': artifact?.status === 'generating',
          'text-green-500': artifact?.status === 'finish',
        })}
      >
        {artifact?.status === 'generating' && (
          <>
            <IconLoading />
            <span>{t('artifact.generating')}</span>
          </>
        )}
        {artifact?.status === 'finish' && (
          <>
            <CheckCircleOutlined />
            <span>{t('artifact.completed')}</span>
          </>
        )}
      </div>
    </div>
  );
});

export const ActionStepCard = memo(
  ({
    result,
    step,
    status,
    query,
  }: {
    result: ActionResult;
    step: ActionStep;
    status: ActionStatus;
    query: string;
  }) => {
    const { t } = useTranslation();
    const { setSelectedNodeByEntity } = useNodeSelection();
    const [logBoxCollapsed, setLogBoxCollapsed] = useState(false);

    useEffect(() => {
      if (result?.status === 'finish') {
        setLogBoxCollapsed(true);
      } else if (result?.status === 'executing') {
        setLogBoxCollapsed(false);
      }
    }, [result?.status]);

    // Prioritize original query from structuredData over other sources
    const displayQuery = useMemo(() => {
      const structuredData = step?.structuredData;
      if (structuredData?.query) {
        return structuredData.query; // Original query with variables
      }
      return query; // Fallback to processed query
    }, [step?.structuredData, query]);

    const parsedData = useMemo(
      () => ({
        sources: parseStructuredData(step?.structuredData ?? {}, 'sources'),
        recommendedQuestions: parseStructuredData(
          step?.structuredData ?? {},
          'recommendedQuestions',
        ),
      }),
      [step?.structuredData],
    );

    const logs = step?.logs?.filter((log) => log?.key);

    const handleArtifactSelect = useCallback(
      (artifact: any) => {
        setSelectedNodeByEntity({
          type: artifact.type,
          entityId: artifact.entityId,
        });
      },
      [setSelectedNodeByEntity],
    );

    if (!step) return null;

    return (
      <div className="flex flex-col">
        {logs && logs.length > 0 && (
          <LogBox
            logs={logs ?? []}
            collapsed={logBoxCollapsed}
            onCollapse={setLogBoxCollapsed}
            t={t}
            log={step?.logs?.[step.logs.length - 1]}
          />
        )}

        {/* Ensure sources is an array and query is a string */}
        {Array.isArray(parsedData.sources) && (
          <SourceViewer
            sources={parsedData.sources}
            query={typeof displayQuery === 'string' ? displayQuery : ''}
          />
        )}

        {step?.reasoningContent && (
          <ReasoningContent
            resultId={result?.resultId}
            reasoningContent={step.reasoningContent}
            sources={parsedData.sources}
            step={step}
            status={status}
          />
        )}

        {step.content && (
          <ActualContent
            resultId={result?.resultId}
            content={step?.content}
            sources={parsedData.sources}
            step={step}
          />
        )}

        {Array.isArray(step?.artifacts) &&
          step?.artifacts?.map((artifact) => (
            <ArtifactItem
              key={artifact.entityId}
              artifact={artifact}
              onSelect={() => handleArtifactSelect(artifact)}
            />
          ))}

        <RecommendQuestions relatedQuestions={parsedData.recommendedQuestions?.questions || []} />
      </div>
    );
  },
);
