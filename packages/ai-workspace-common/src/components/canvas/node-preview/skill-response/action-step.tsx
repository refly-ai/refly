import { useTranslation } from 'react-i18next';
import { Divider } from 'antd';
import { ActionResult, ActionStep, Artifact, Source } from '@refly/openapi-schema';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { IconCheckCircle, IconLoading } from '@arco-design/web-react/icon';
import { cn } from '@refly-packages/utils/cn';
import { useCanvasControl } from '@refly-packages/ai-workspace-common/hooks/use-canvas-control';
import { genUniqueId } from '@refly-packages/utils/id';
import { CanvasNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { SelectionContext } from '@refly-packages/ai-workspace-common/components/selection-context';
import { ActionContainer } from './action-container';
import { safeParseJSON } from '@refly-packages/utils/parse';
import { SourceViewer } from './source-viewer';
import { getArtifactIcon } from '@refly-packages/ai-workspace-common/components/common/result-display';
import { RecommendQuestions } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response/recommend-questions';

export const ActionStepCard = ({
  result,
  step,
  index,
  query,
}: {
  result: ActionResult;
  step: ActionStep;
  index: number;
  query: string;
}) => {
  const { t } = useTranslation();
  const { setSelectedNodeByEntity } = useCanvasControl();

  const buildNodeData = (text: string) => {
    const id = genUniqueId();

    const node: CanvasNode = {
      id,
      type: 'skillResponse',
      position: { x: 0, y: 0 },
      data: {
        entityId: result.resultId ?? '',
        title: result.title ?? 'Selected Content',
        metadata: {
          contentPreview: text,
          selectedContent: text,
          xPath: id,
          sourceEntityId: result.resultId ?? '',
          sourceEntityType: 'skillResponse',
          sourceType: 'skillResponseSelection',
        },
      },
    };

    return node;
  };

  let sources =
    typeof step?.structuredData?.['sources'] === 'string'
      ? safeParseJSON(step?.structuredData?.['sources'])
      : (step?.structuredData?.['sources'] as Source[]);
  let recommendedQuestions =
    typeof step?.structuredData?.['recommendedQuestions'] === 'string'
      ? safeParseJSON(step?.structuredData?.['recommendedQuestions'])
      : (step?.structuredData?.['recommendedQuestions'] as Array<string>);

  console.log('result', result);

  return (
    <div>
      <Divider className="my-2" />
      <div className="my-3 text-gray-600 text-sm">
        {t('canvas.skillResponse.stepTitle', { index })}{' '}
        {' - ' + t(`${result.actionMeta?.name}.steps.${step.name}.name`, { ns: 'skill', defaultValue: step.name })}
      </div>

      {sources && <SourceViewer sources={sources} query={query} />}

      {step.content && (
        <div className="my-3 text-gray-600 text-base skill-response-content">
          <Markdown content={step.content} />
          <SelectionContext
            containerClass="skill-response-content"
            getNodeData={(text) => buildNodeData(text)}
          ></SelectionContext>
        </div>
      )}

      {step.artifacts?.map((artifact) => (
        <div
          key={artifact.entityId}
          className="my-3 px-4 py-2 h-12 border border-solid border-gray-200 rounded-lg flex items-center justify-between space-x-2 cursor-pointer hover:bg-gray-50"
          onClick={() => {
            setSelectedNodeByEntity({ type: artifact.type, entityId: artifact.entityId });
          }}
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
      ))}

      <RecommendQuestions relatedQuestions={recommendedQuestions?.questions || []} />

      <ActionContainer result={result} step={step} />
    </div>
  );
};
