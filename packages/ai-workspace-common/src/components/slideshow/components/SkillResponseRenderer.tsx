import { memo, useMemo } from 'react';
import { useGetActionResult } from '@refly-packages/ai-workspace-common/queries/queries';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import { ActionStep, GetActionResultResponse } from '@refly-packages/ai-workspace-common/requests';
import { PreviewChatInput } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response/preview-chat-input';
import { SimpleStepCard } from './SimpleStepCard';
import { useTranslation } from 'react-i18next';

interface SkillResponseProps {
  node: {
    nodeData?: {
      title?: string;
      entityId?: string;
      metadata?: {
        status?: string;
        shareId?: string;
        content?: string;
      };
    };
  };
  isFullscreen?: boolean;
  isMinimap?: boolean;
}

export const SkillResponseRenderer = memo(({ node, isMinimap = false }: SkillResponseProps) => {
  const { t } = useTranslation();
  const entityId = node.nodeData?.entityId || '';
  const shareId = node.nodeData?.metadata?.shareId;

  // Use shared data or directly get Action result
  const { data: shareData } = useFetchShareData<GetActionResultResponse['data']>(shareId);

  const { data: actionResultData } = useGetActionResult(
    {
      query: { resultId: entityId },
    },
    [entityId],
    {
      enabled: Boolean(!shareId && entityId),
    },
  );

  // Merge data sources
  const resultData = useMemo(
    () => shareData || actionResultData?.data || null,
    [shareData, actionResultData],
  );

  // If no entityId
  if (!resultData) {
    return (
      <div className="h-full flex items-center justify-center bg-white rounded p-3">
        <span className="text-gray-500">{t('pages.components.skillResponse.notSelected')}</span>
      </div>
    );
  }

  const { title, steps = [], actionMeta } = resultData;

  return (
    <div className={`flex h-full w-full grow relative ${isMinimap ? 'overflow-hidden' : ''}`}>
      {/* Main content */}
      <div
        className={'flex h-full w-full grow bg-white overflow-auto dark:bg-gray-900 rounded-lg'}
        style={isMinimap ? { height: 'calc(var(--screen-height) - 100px)' } : undefined}
      >
        <div
          className={`flex flex-col space-y-4 p-4 h-full ${isMinimap ? 'w-full max-w-none' : 'max-w-[1024px] mx-auto w-full'}`}
        >
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
});

SkillResponseRenderer.displayName = 'SkillResponseRenderer';
