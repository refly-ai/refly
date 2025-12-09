import { Button, Tooltip, message, Dropdown, Divider } from 'antd';
import { Download, Share, More, Location, Delete } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import { useCallback, useMemo, useState } from 'react';
import { useActiveNode, useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { getShareLink } from '@refly-packages/ai-workspace-common/utils/share';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { CodeArtifactType } from '@refly/openapi-schema';
import type { MenuProps } from 'antd';
import { useNodePosition } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-position';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { getFileExtensionFromType } from '@refly/utils';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

export const CodeArtifactTopButtons = () => {
  const { t } = useTranslation();
  const { readonly, canvasId } = useCanvasContext();
  const { setWideScreenVisible } = useCanvasResourcesPanelStoreShallow((state) => ({
    setWideScreenVisible: state.setWideScreenVisible,
  }));
  const { activeNode } = useActiveNode(canvasId);

  const entityId = activeNode?.data?.entityId ?? '';
  const title = activeNode?.data?.title ?? 'Code Artifact';
  const type = (activeNode?.data?.metadata?.type as CodeArtifactType) ?? 'text/html';
  const content = (activeNode?.data?.metadata as any)?.content ?? '';
  const nodeId = activeNode?.id ?? '';

  const { setNodeCenter } = useNodePosition();
  const { deleteNode } = useDeleteNode();
  const [isDownloading, setIsDownloading] = useState(false);

  const fileName = useMemo(() => {
    const ext = getFileExtensionFromType(type);
    return `${title}.${ext}`;
  }, [title, type]);

  const handleDownload = useCallback(async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      let fileContent = (content ?? '') as string;
      if (!fileContent && entityId) {
        const { data } = await getClient().getCodeArtifactDetail({
          query: { artifactId: entityId },
        });
        fileContent = data?.data?.content ?? '';
      }

      if (!fileContent) {
        message.error(t('codeArtifact.downloadError'));
        return;
      }

      const blob = new Blob([fileContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      message.success(t('codeArtifact.downloadSuccess', { fileName }));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to download file:', error);
      message.error(t('codeArtifact.downloadError'));
    } finally {
      setIsDownloading(false);
    }
  }, [content, entityId, fileName, t, isDownloading]);

  const handleShare = useCallback(async () => {
    if (!entityId) return;
    const loadingMessage = message.loading(t('codeArtifact.sharing'), 0);
    try {
      const { data, error } = await getClient().createShare({
        body: { entityId, entityType: 'codeArtifact' },
      });
      if (!data?.success || error) {
        throw new Error(error ? String(error) : 'Failed to create share');
      }
      const shareLink = getShareLink('codeArtifact', data.data?.shareId ?? '');
      copyToClipboard(shareLink);
      loadingMessage();
      message.success(t('codeArtifact.shareSuccess'));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to share code artifact:', err);
      loadingMessage();
      message.error(t('codeArtifact.shareError'));
    }
  }, [entityId, t]);

  const handleLocateNode = useCallback(() => {
    if (nodeId) setNodeCenter(nodeId, true);
  }, [nodeId, setNodeCenter]);

  const handleDeleteNode = useCallback(() => {
    if (!activeNode) return;
    deleteNode({
      id: activeNode.id,
      type: activeNode.type as any,
      position: activeNode.position as any,
      data: activeNode.data as any,
    });
    setWideScreenVisible(false);
  }, [activeNode, deleteNode, setWideScreenVisible]);

  const moreMenuItems: MenuProps['items'] = useMemo(() => {
    return [
      ...(readonly
        ? []
        : [
            {
              key: 'share',
              label: (
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <Share size={16} color="var(--refly-text-0)" />
                  {t('codeArtifact.buttons.share')}
                </div>
              ),
              onClick: handleShare,
            },
          ]),
      {
        key: 'locateNode',
        label: (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Location size={16} color="var(--refly-text-0)" />
            {t('canvas.nodeActions.centerNode')}
          </div>
        ),
        onClick: handleLocateNode,
      },
      ...(readonly
        ? []
        : [
            { type: 'divider' as const },
            {
              key: 'delete',
              label: (
                <div className="flex items-center gap-2 text-red-600 whitespace-nowrap">
                  <Delete size={16} color="var(--refly-func-danger-default)" />
                  {t('canvas.nodeActions.delete')}
                </div>
              ),
              onClick: handleDeleteNode,
            },
          ]),
    ];
  }, [handleDeleteNode, handleLocateNode, t]);

  return (
    <div className="flex items-center gap-3">
      <Tooltip title={t('codeArtifact.buttons.download', { fileName })}>
        <Button
          className="!h-5 !w-5 p-0"
          size="small"
          type="text"
          onClick={handleDownload}
          loading={isDownloading}
          icon={<Download size={16} />}
        />
      </Tooltip>

      <Dropdown menu={{ items: moreMenuItems }} trigger={['click']} placement="bottomRight">
        <Button className="!h-5 !w-5 p-0" size="small" type="text" icon={<More size={16} />} />
      </Dropdown>
      <Divider type="vertical" className="h-4 bg-refly-Card-Border m-0" />
    </div>
  );
};
