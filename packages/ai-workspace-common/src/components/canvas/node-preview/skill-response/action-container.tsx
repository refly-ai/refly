import { useMemo, useCallback, memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, message, Tooltip } from 'antd';
import { ModelIcon } from '@lobehub/icons';
import { ActionResult, ActionStep, GenericToolset, ModelInfo, Source } from '@refly/openapi-schema';
import { CheckCircleOutlined, CopyOutlined, ImportOutlined } from '@ant-design/icons';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { parseMarkdownCitationsAndCanvasTags, safeParseJSON } from '@refly/utils/parse';
import { useDocumentStoreShallow } from '@refly/stores';
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-document';
import { editorEmitter, EditorOperation } from '@refly/utils/event-emitter/editor';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { FollowingActions } from '../sharedComponents/following-actions';
import { IContextItem } from '@refly/common-types';
import { useFetchProviderItems } from '@refly-packages/ai-workspace-common/hooks/use-fetch-provider-items';
import { useGetCreditUsageByResultId } from '@refly-packages/ai-workspace-common/queries';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';

interface ActionContainerProps {
  step: ActionStep;
  result: ActionResult;
  nodeId?: string;
  initSelectedToolsets?: GenericToolset[];
}

const buttonClassName = 'text-xs flex justify-center items-center h-6 px-1 rounded-lg';

const ActionContainerComponent = ({
  result,
  step,
  nodeId,
  initSelectedToolsets,
}: ActionContainerProps) => {
  const { t } = useTranslation();
  const { debouncedCreateDocument, isCreating } = useCreateDocument();
  const { readonly } = useCanvasContext();
  const setNodeDataByEntity = useSetNodeDataByEntity();
  const { hasEditorSelection, activeDocumentId } = useDocumentStoreShallow((state) => ({
    hasEditorSelection: state.hasEditorSelection,
    activeDocumentId: state.activeDocumentId,
  }));

  const { title } = result ?? {};
  const isPending = result?.status === 'executing';

  // Check if we're in share mode by checking if resultId exists
  // This indicates a "proper" result vs a shared result that might be loaded from share data
  const isShareMode = !result.resultId;

  const sources = useMemo(
    () =>
      typeof step?.structuredData?.sources === 'string'
        ? safeParseJSON(step?.structuredData?.sources)
        : (step?.structuredData?.sources as Source[]),
    [step?.structuredData],
  );

  const editorActionList = useMemo(
    () => [
      {
        icon: <ImportOutlined style={{ fontSize: 14 }} />,
        key: 'insertBelow',
        enabled: step.content && activeDocumentId,
      },
      {
        icon: <CheckCircleOutlined style={{ fontSize: 14 }} />,
        key: 'replaceSelection',
        enabled: step.content && activeDocumentId && hasEditorSelection,
      },
    ],
    [step.content, activeDocumentId, hasEditorSelection],
  );

  const handleEditorOperation = useCallback(
    async (type: EditorOperation | 'createDocument', content: string) => {
      const parsedContent = parseMarkdownCitationsAndCanvasTags(content, sources);

      if (type === 'insertBelow' || type === 'replaceSelection') {
        editorEmitter.emit(type, parsedContent);
      } else if (type === 'createDocument') {
        await debouncedCreateDocument(title ?? '', content, {
          sourceNodeId: result.resultId,
          addToCanvas: true,
        });
      }
    },
    [sources, title, result.resultId, debouncedCreateDocument],
  );

  const handleCopyToClipboard = useCallback(
    (content: string) => {
      const parsedText = parseMarkdownCitationsAndCanvasTags(content, sources);
      copyToClipboard(parsedText || '');
      message.success(t('copilot.message.copySuccess'));
    },
    [sources, t],
  );

  const { data: providerItemList } = useFetchProviderItems({
    category: 'llm',
    enabled: true,
  });

  // Query credit usage when skill is completed
  const { data: creditUsage } = useGetCreditUsageByResultId(
    {
      query: {
        resultId: result?.resultId ?? '',
      },
    },
    undefined,
    {
      enabled: !isPending && !!result?.resultId,
    },
  );

  const tokenUsage = step?.tokenUsage?.[0];

  const providerItem = useMemo(() => {
    if (!tokenUsage || !providerItemList) return null;

    // If providerItemId is provided, use it to find the provider item
    if (tokenUsage?.providerItemId) {
      return providerItemList?.find((item) => item.itemId === tokenUsage?.providerItemId);
    }

    // Fallback to modelName if providerItemId is not provided
    return providerItemList?.find((item) => item.config?.modelId === tokenUsage?.modelName) || null;
  }, [providerItemList, tokenUsage]);

  const initContextItems = useMemo(() => {
    if (!result.resultId) {
      return [];
    }

    const currentNodeContext: IContextItem = {
      type: 'skillResponse',
      entityId: result.resultId,
      title: result.title ?? '',
      metadata: {
        withHistory: true,
      },
    };

    return [currentNodeContext];
  }, [result.resultId, result.title]);

  const initModelInfo = useMemo(() => {
    if (providerItem && providerItem.category === 'llm') {
      const modelInfo: ModelInfo = {
        name: (providerItem.config as any)?.modelId || providerItem.name,
        label: providerItem.name,
        provider: providerItem.provider?.name || '',
        providerItemId: providerItem.itemId,
        contextLimit: (providerItem.config as any)?.contextLimit || 0,
        maxOutput: (providerItem.config as any)?.maxOutput || 0,
        capabilities: (providerItem.config as any)?.capabilities || {},
      };
      return modelInfo;
    }
    return null;
  }, [providerItem]);

  // Update node metadata with credit cost when credit usage is available
  useEffect(() => {
    if (creditUsage?.data?.total && result?.resultId && !isPending) {
      setNodeDataByEntity(
        {
          type: 'skillResponse',
          entityId: result.resultId,
        },
        {
          metadata: {
            creditCost: creditUsage.data.total,
          },
        },
      );
    }
  }, [creditUsage?.data?.total, result?.resultId, isPending, setNodeDataByEntity]);

  if (isPending) {
    return null;
  }

  return (
    <div
      className="border-[1px] border-solid border-b-0 border-x-0 border-refly-Card-Border"
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      {!readonly && (
        <FollowingActions
          initContextItems={initContextItems}
          initModelInfo={initModelInfo}
          nodeId={nodeId}
          initSelectedToolsets={initSelectedToolsets}
        />
      )}

      <div className="w-full flex gap-2 items-center p-3 rounded-b-xl">
        {tokenUsage && (
          <div className="flex flex-1 items-center gap-1 min-w-0">
            <ModelIcon size={16} model={tokenUsage?.modelName} type="color" />
            <div className="flex-1 truncate text-gray-500 text-sm">
              {tokenUsage?.modelLabel || providerItem?.name}
            </div>
          </div>
        )}
        {!isPending && step?.content && (
          <div className="flex-shrink-0 flex items-center gap-1">
            {!readonly && !isShareMode && step.content && (
              <Tooltip title={t('copilot.message.copy')}>
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined style={{ fontSize: 14 }} />}
                  className={buttonClassName}
                  onClick={() => handleCopyToClipboard(step.content ?? '')}
                />
              </Tooltip>
            )}
            {!readonly &&
              !isShareMode &&
              editorActionList.map((item) => (
                <Tooltip key={item.key} title={t(`copilot.message.${item.key}`)}>
                  <Button
                    key={item.key}
                    size="small"
                    type="text"
                    className={buttonClassName}
                    icon={item.icon}
                    disabled={!item.enabled}
                    loading={isCreating}
                    onClick={() => {
                      const parsedText = parseMarkdownCitationsAndCanvasTags(
                        step.content ?? '',
                        sources,
                      );
                      handleEditorOperation(item.key as EditorOperation, parsedText || '');
                    }}
                  />
                </Tooltip>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const ActionContainer = memo(ActionContainerComponent);
