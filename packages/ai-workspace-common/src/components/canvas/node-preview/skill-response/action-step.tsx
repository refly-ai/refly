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
import { getWholeParsedContent } from '@refly-packages/utils/content-parser';

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
        className={cn('my-2 p-4 border border-solid border-gray-200 rounded-lg transition-all', {
          'px-4 py-3 cursor-pointer hover:bg-gray-50': collapsed,
          'relative pb-0': !collapsed,
        })}
      >
        {collapsed ? (
          <div
            className="text-gray-500 text-sm flex items-center justify-between"
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
              className="absolute right-2 top-2"
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
      <div className="my-3 text-gray-600 text-base">
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
      className="my-2 px-4 py-2 h-12 border border-solid border-gray-200 rounded-lg flex items-center justify-between space-x-2 cursor-pointer hover:bg-gray-50"
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

export const ActionStepCard = memo(
  ({
    result,
    step,
    stepStatus,
    index,
    query,
  }: {
    result: ActionResult;
    step: ActionStep;
    stepStatus: 'executing' | 'finish';
    index: number;
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
        <div className="my-1 text-gray-600 text-sm flex items-center gap-2 font-medium">
          {stepStatus === 'executing' ? (
            <IconLoading className="h-3 w-3 animate-spin text-green-500" />
          ) : (
            <IconCheck className="h-4 w-4 text-green-500" />
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
