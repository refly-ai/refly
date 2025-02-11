import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Steps, Button } from 'antd';
import { ActionResult, ActionStep, Source } from '@refly/openapi-schema';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { IconCheckCircle } from '@arco-design/web-react/icon';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@refly-packages/utils/cn';
import { IconCheck, IconLoading } from '@refly-packages/ai-workspace-common/components/common/icon';
import { genUniqueId } from '@refly-packages/utils/id';
import { SelectionContext } from '@refly-packages/ai-workspace-common/modules/selection-menu/selection-context';
import { ActionContainer } from './action-container';
import { safeParseJSON } from '@refly-packages/utils/parse';
import { SourceViewer } from './source-viewer';
import { getArtifactIcon } from '@refly-packages/ai-workspace-common/components/common/result-display';
import { RecommendQuestions } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response/recommend-questions';
import { useNodeSelection } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-selection';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { getWholeParsedContent } from '@refly-packages/ai-workspace-common/utils/content-parser';

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
        className={cn('p-4 my-2 rounded-lg border border-gray-200 border-solid transition-all', {
          'px-4 py-3 cursor-pointer hover:bg-gray-50': collapsed,
          'relative pb-0': !collapsed,
        })}
      >
        {collapsed ? (
          <div
            className="flex justify-between items-center text-sm text-gray-500"
            onClick={() => onCollapse(false)}
          >
            <div>
              <IconCheckCircle /> {t('canvas.skillResponse.stepCompleted')}
            </div>
            <div className="flex items-center">
              <ChevronDown className="w-4 h-4 text-gray-500" />
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
                }),
                description: t(`${log.key}.description`, {
                  ...log.descriptionArgs,
                  ns: 'skillLog',
                  defaultValue: '',
                }),
              }))}
            />
            <Button
              type="text"
              icon={<ChevronUp className="w-4 h-4 text-gray-500" />}
              onClick={() => onCollapse(true)}
              className="absolute top-2 right-2"
            />
          </>
        )}
      </div>
    );
  },
);

const StepContent = memo(
  ({
    resultId,
    content,
    sources,
    buildContextItem,
    step,
  }: {
    resultId: string;
    content: string;
    sources: Source[];
    buildContextItem: (text: string) => IContextItem;
    step: ActionStep;
  }) => {
    const getSourceNode = useCallback(() => {
      return {
        type: 'skillResponse' as const,
        entityId: resultId,
      };
    }, [resultId]);

    return (
      <div className="my-3 text-base text-gray-600">
        <div className={`skill-response-content-${resultId}-${step.name}`}>
          <Markdown content={content} sources={sources} />
          <SelectionContext
            containerClass={`skill-response-content-${resultId}-${step.name}`}
            getContextItem={buildContextItem}
            getSourceNode={getSourceNode}
          />
        </div>
      </div>
    );
  },
);

const ArtifactItem = memo(({ artifact, onSelect }: { artifact: any; onSelect: () => void }) => {
  const { t } = useTranslation();

  return (
    <div
      key={artifact.entityId}
      className="flex justify-between items-center px-4 py-2 my-2 space-x-2 h-12 rounded-lg border border-gray-200 border-solid cursor-pointer hover:bg-gray-50"
      onClick={onSelect}
    >
      <div className="flex items-center space-x-2">
        {getArtifactIcon(artifact, 'w-4 h-4')}
        <span className="text-gray-600 max-w-[200px] truncate inline-block">{artifact.title}</span>
      </div>
      <div
        className={cn('flex items-center space-x-1 text-xs', {
          'text-yellow-500': artifact.status === 'generating',
          'text-green-500': artifact.status === 'finish',
        })}
      >
        {artifact.status === 'generating' && (
          <>
            <IconLoading />
            <span>{t('artifact.generating')}</span>
          </>
        )}
        {artifact.status === 'finish' && (
          <>
            <IconCheckCircle />
            <span>{t('artifact.completed')}</span>
          </>
        )}
      </div>
    </div>
  );
});

// Progress bar component
const DeepResearchProgress = memo(
  ({
    progress,
  }: {
    progress: {
      maxDepth: number;
      totalSteps: number;
      currentDepth: number;
      completedSteps: number;
    };
  }) => {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
          <span>Research in progress...</span>
          <span>{Math.round((progress.completedSteps / progress.totalSteps) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-orange-500 h-2 rounded-full transition-all duration-500"
            style={{
              width: `${Math.round((progress.completedSteps / progress.totalSteps) * 100)}%`,
            }}
          />
        </div>
      </div>
    );
  },
);

// Tab panel component
const DeepResearchPanel = memo(
  ({
    activity,
    sources,
  }: {
    activity: Array<{
      type: 'search' | 'extract' | 'analyze' | 'reasoning' | 'synthesis' | 'thought';
      status: 'pending' | 'complete' | 'error';
      message: string;
      timestamp: string;
      depth?: number;
      completedSteps?: number;
      totalSteps?: number;
    }>;
    sources: Array<{
      url: string;
      title: string;
      description: string;
    }>;
  }) => {
    const [activeTab, setActiveTab] = useState<'activity' | 'sources'>('activity');

    return (
      <div className="fixed right-4 top-20 w-80 bg-background border rounded-lg shadow-lg p-4 max-h-[80vh] flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b mb-4">
          <Button
            className={cn('flex-1 pb-2 text-sm font-medium border-b-2 transition-colors', {
              'border-orange-500 text-orange-600': activeTab === 'activity',
              'border-transparent text-muted-foreground hover:text-foreground':
                activeTab !== 'activity',
            })}
            onClick={() => setActiveTab('activity')}
          >
            Activity
          </Button>
          <Button
            className={cn('flex-1 pb-2 text-sm font-medium border-b-2 transition-colors', {
              'border-orange-500 text-orange-600': activeTab === 'sources',
              'border-transparent text-muted-foreground hover:text-foreground':
                activeTab !== 'sources',
            })}
            onClick={() => setActiveTab('sources')}
          >
            Sources
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'activity' && (
            <div className="space-y-2">
              {[...activity].reverse().map((item, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <div
                    className={cn('size-2 rounded-full', {
                      'bg-yellow-500': item.status === 'pending',
                      'bg-green-500': item.status === 'complete',
                      'bg-red-500': item.status === 'error',
                    })}
                  />
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{item.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'sources' && (
            <div className="space-y-2">
              {sources.map((source, index) => (
                <div key={index} className="flex flex-col gap-1">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline"
                  >
                    {source.title}
                  </a>
                  <div className="text-xs text-muted-foreground">
                    {new URL(source.url).hostname}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  },
);

export const ActionStepCard = memo(
  ({
    result,
    step,
    stepStatus,
    index,
    query,
    deepResearchState,
  }: {
    result: ActionResult;
    step: ActionStep;
    stepStatus: 'executing' | 'finish';
    index: number;
    query: string;
    deepResearchState: {
      activity: Array<{
        type: 'search' | 'extract' | 'analyze' | 'reasoning' | 'synthesis' | 'thought';
        status: 'pending' | 'complete' | 'error';
        message: string;
        timestamp: string;
        depth?: number;
        completedSteps?: number;
        totalSteps?: number;
      }>;
      sources: Array<{
        url: string;
        title: string;
        description: string;
      }>;
      progress: {
        maxDepth: number;
        totalSteps: number;
        currentDepth: number;
        completedSteps: number;
      };
    };
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

    const buildContextItem = useCallback(
      (text: string) => {
        const item: IContextItem = {
          type: 'skillResponseSelection',
          entityId: genUniqueId(),
          title: text.slice(0, 50),
          selection: {
            content: text,
            sourceEntityType: 'skillResponse',
            sourceEntityId: result.resultId ?? '',
            sourceTitle: result.title ?? '',
          },
        };

        return item;
      },
      [result.resultId, result.title],
    );

    const parsedData = useMemo(
      () => ({
        sources: parseStructuredData(step?.structuredData, 'sources'),
        recommendedQuestions: parseStructuredData(step?.structuredData, 'recommendedQuestions'),
      }),
      [step?.structuredData],
    );

    const logs = step?.logs?.filter((log) => log?.key);
    const skillName = result.actionMeta?.name || 'commonQnA';

    const content = getWholeParsedContent(step.reasoningContent, step.content);

    const handleArtifactSelect = useCallback(
      (artifact) => {
        setSelectedNodeByEntity({
          type: artifact.type,
          entityId: artifact.entityId,
        });
      },
      [setSelectedNodeByEntity],
    );

    return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-2 items-center my-1 text-sm font-medium text-gray-600">
          {stepStatus === 'executing' ? (
            <IconLoading className="w-3 h-3 text-green-500 animate-spin" />
          ) : (
            <IconCheck className="w-4 h-4 text-green-500" />
          )}
          {t('canvas.skillResponse.stepTitle', { index })}{' '}
          {` · ${t(`${skillName}.steps.${step.name}.name`, { ns: 'skill', defaultValue: step.name })}`}
        </div>

        {logs?.length > 0 && (
          <LogBox
            logs={logs}
            collapsed={logBoxCollapsed}
            onCollapse={setLogBoxCollapsed}
            t={t}
            log={step?.logs?.[step.logs.length - 1]}
          />
        )}

        {/* Replace old DeepResearch component with new split components */}
        {step.name === 'deepResearch' && (
          <>
            <DeepResearchProgress progress={deepResearchState.progress} />
            <DeepResearchPanel
              activity={deepResearchState.activity}
              sources={deepResearchState.sources}
            />
          </>
        )}

        {parsedData.sources && <SourceViewer sources={parsedData.sources} query={query} />}

        {content && (
          <StepContent
            resultId={result.resultId}
            content={content}
            sources={parsedData.sources}
            buildContextItem={buildContextItem}
            step={step}
          />
        )}

        {step.artifacts?.map((artifact) => (
          <ArtifactItem
            key={artifact.entityId}
            artifact={artifact}
            onSelect={() => handleArtifactSelect(artifact)}
          />
        ))}

        <RecommendQuestions relatedQuestions={parsedData.recommendedQuestions?.questions || []} />

        <ActionContainer result={result} step={step} />
      </div>
    );
  },
);
