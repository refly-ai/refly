import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, message, Dropdown, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import { ActionResult, ActionStep, Source } from '@refly/openapi-schema';
import { FilePlus, MoreHorizontal, Target, Trash2 } from 'lucide-react';
import {
  CheckCircleOutlined,
  CopyOutlined,
  ImportOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { parseMarkdownCitationsAndCanvasTags, safeParseJSON } from '@refly/utils/parse';
import { useDocumentStoreShallow } from '@refly/stores';
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-document';
import { editorEmitter, EditorOperation } from '@refly/utils/event-emitter/editor';
import { HiOutlineCircleStack, HiOutlineSquare3Stack3D } from 'react-icons/hi2';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { getShareLink } from '@refly-packages/ai-workspace-common/utils/share';
import { useAddToContext } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-to-context';
import { useNodePosition } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-position';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { useCanvasStore } from '@refly/stores';

interface ActionContainerProps {
  step: ActionStep;
  result: ActionResult;
  nodeId?: string;
}

const buttonClassName = 'text-xs flex justify-center items-center h-6 px-1 rounded-lg';

const ActionContainerComponent = ({ result, step, nodeId }: ActionContainerProps) => {
  const { t } = useTranslation();
  const { debouncedCreateDocument, isCreating } = useCreateDocument();
  const { readonly } = useCanvasContext();
  const { hasEditorSelection, activeDocumentId } = useDocumentStoreShallow((state) => ({
    hasEditorSelection: state.hasEditorSelection,
    activeDocumentId: state.activeDocumentId,
  }));

  const { addToContext } = useAddToContext();
  const { setNodeCenter } = useNodePosition();
  const { deleteNode } = useDeleteNode();
  const { removeLinearThreadMessageByNodeId } = useCanvasStore((state) => ({
    removeLinearThreadMessageByNodeId: state.removeLinearThreadMessageByNodeId,
  }));

  const { title } = result ?? {};
  const isPending = result?.status === 'executing';
  const [isSharing, setIsSharing] = useState(false);

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
      {
        icon: <FilePlus style={{ fontSize: 14, width: 14, height: 14 }} />,
        key: 'createDocument',
        enabled: step.content,
      },
    ],
    [step.content, activeDocumentId, hasEditorSelection],
  );

  const [tokenUsage, setTokenUsage] = useState(0);

  useEffect(() => {
    let total = 0;
    for (const item of step?.tokenUsage || []) {
      total += (item?.inputTokens || 0) + (item?.outputTokens || 0);
    }
    setTokenUsage(total);
  }, [step?.tokenUsage]);

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

  const tokenUsageDropdownList: MenuProps['items'] = useMemo(
    () =>
      step?.tokenUsage?.map((item: any) => ({
        key: item?.modelName,
        label: (
          <div className="flex items-center">
            <span>
              {item?.modelName}:{' '}
              {t('copilot.tokenUsage', {
                inputCount: item?.inputTokens,
                outputCount: item?.outputTokens,
              })}
            </span>
          </div>
        ),
      })),
    [step?.tokenUsage, t],
  );

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    const loadingMessage = message.loading(t('codeArtifact.sharing'), 0);

    try {
      // Create share using the API
      const { data, error } = await getClient().createShare({
        body: {
          entityId: result.resultId,
          entityType: 'skillResponse',
          shareData: JSON.stringify(result),
        },
      });

      if (!data?.success || error) {
        throw new Error(error ? String(error) : 'Failed to share skill response');
      }

      // Generate share link
      const shareLink = getShareLink('skillResponse', data.data?.shareId ?? '');

      // Copy the sharing link to clipboard
      copyToClipboard(shareLink);

      // Clear loading message and show success
      loadingMessage();
      message.success(
        t(
          'canvas.skillResponse.shareSuccess',
          'Skill response shared successfully! Link copied to clipboard.',
        ),
      );
    } catch (err) {
      console.error('Failed to share skill response:', err);
      loadingMessage();
      message.error(t('canvas.skillResponse.shareError', 'Failed to share skill response'));
    } finally {
      setIsSharing(false);
    }
  }, [result, t]);

  const handleAddToContext = useCallback(() => {
    if (!result.resultId) return;

    addToContext({
      type: 'skillResponse',
      title: result.title ?? '',
      entityId: result.resultId,
      // Safely pass metadata as any to avoid type errors
      metadata: (result as any)?.metadata,
    });
  }, [result, addToContext]);

  const handleLocateNode = useCallback(() => {
    if (nodeId) {
      setNodeCenter(nodeId, true);
    }
  }, [nodeId, setNodeCenter]);

  const handleDeleteNode = useCallback(() => {
    if (nodeId) {
      // Remove the Refly Pilot message first
      removeLinearThreadMessageByNodeId(nodeId);

      // Then delete the node
      deleteNode({
        id: nodeId,
        type: 'skillResponse',
        position: { x: 0, y: 0 },
        data: {
          title: result.title ?? '',
          entityId: result.resultId,
        },
      });
    }
  }, [nodeId, deleteNode, result, removeLinearThreadMessageByNodeId]);

  // More menu items
  const moreMenuItems: MenuProps['items'] = useMemo(() => {
    if (!nodeId || isShareMode || readonly) return [];

    return [
      {
        key: 'locateNode',
        label: (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Target className="w-4 h-4 flex-shrink-0" />
            {t('canvas.nodeActions.centerNode')}
          </div>
        ),
        onClick: handleLocateNode,
      },
      {
        key: 'addToContext',
        label: (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <HiOutlineSquare3Stack3D className="w-4 h-4 flex-shrink-0" />
            {t('canvas.nodeActions.addToContext')}
          </div>
        ),
        onClick: handleAddToContext,
      },
      {
        type: 'divider',
      },
      {
        key: 'delete',
        label: (
          <div className="flex items-center gap-2 text-red-600 whitespace-nowrap">
            <Trash2 className="w-4 h-4 flex-shrink-0" />
            {t('canvas.nodeActions.delete')}
          </div>
        ),
        onClick: handleDeleteNode,
        className: 'hover:bg-red-50',
      },
    ];
  }, [nodeId, isShareMode, readonly, t, handleLocateNode, handleAddToContext, handleDeleteNode]);

  return (
    <div className="flex items-center justify-between">
      <div className="-ml-1">
        {step?.tokenUsage && step.tokenUsage.length > 0 && !isShareMode && (
          <Dropdown menu={{ items: tokenUsageDropdownList }}>
            <Button
              type="text"
              size="small"
              icon={<HiOutlineCircleStack style={{ fontSize: 14 }} />}
              className="text-gray-500 text-xs"
            >
              {tokenUsage} tokens
            </Button>
          </Dropdown>
        )}
      </div>
      {!isPending && step?.content && (
        <div className="flex flex-row justify-between items-center text-sm">
          <div className="-ml-1 text-sm flex flex-row items-center gap-1">
            {!readonly && !isShareMode && step.content && (
              <>
                <Tooltip title={t('copilot.message.copy')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined style={{ fontSize: 14 }} />}
                    className={buttonClassName}
                    onClick={() => handleCopyToClipboard(step.content ?? '')}
                  />
                </Tooltip>

                <Tooltip title={t('common.share')}>
                  <Button
                    type="text"
                    size="small"
                    loading={isSharing}
                    icon={<ShareAltOutlined style={{ fontSize: 14 }} />}
                    className={buttonClassName}
                    onClick={handleShare}
                  />
                </Tooltip>
              </>
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

            {/* More actions dropdown button */}
            {nodeId && moreMenuItems.length > 0 && (
              <Dropdown
                menu={{ items: moreMenuItems }}
                trigger={['click']}
                placement="bottomRight"
                getPopupContainer={(triggerNode) => triggerNode.parentNode as HTMLElement}
                overlayClassName="min-w-[160px] w-max"
              >
                <Button type="text" size="small" className={buttonClassName}>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </Dropdown>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const ActionContainer = memo(ActionContainerComponent, (prevProps, nextProps) => {
  return (
    prevProps.step === nextProps.step &&
    prevProps.result === nextProps.result &&
    prevProps.nodeId === nextProps.nodeId
  );
});
