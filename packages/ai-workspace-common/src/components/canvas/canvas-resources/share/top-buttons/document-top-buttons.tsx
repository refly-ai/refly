import { Button, Dropdown, message, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, Download, More, Location, Delete, Markdown, Doc1, Pdf } from 'refly-icons';
import { useActiveNode } from '@refly/stores';
import { useNodePosition } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-position';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { editorEmitter } from '@refly/utils/event-emitter/editor';
import { useExportDocument } from '@refly-packages/ai-workspace-common/hooks/use-export-document';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

export const DocumentTopButtons = () => {
  const { t } = useTranslation();
  const { canvasId } = useCanvasContext();
  const { setNodeCenter } = useNodePosition();
  const { deleteNode } = useDeleteNode();

  const { activeNode } = useActiveNode(canvasId);
  const [isSharing, setIsSharing] = useState(false);
  const { readonly } = useCanvasContext();
  const docId = activeNode?.data?.entityId ?? '';

  const [isExporting, setIsExporting] = useState(false);
  const { exportDocument } = useExportDocument();
  const handleShare = useCallback(() => {
    setIsSharing(true);
    editorEmitter.emit('shareDocument');
  }, []);

  useEffect(() => {
    editorEmitter.on('shareDocumentCompleted', () => {
      setIsSharing(false);
    });
    return () => {
      editorEmitter.off('shareDocumentCompleted');
    };
  }, []);

  // Export (download) menu
  const exportMenuItems: MenuProps['items'] = useMemo(() => {
    const items: MenuProps['items'] = [
      {
        key: 'exportMarkdown',
        label: (
          <div className="flex items-center gap-1 text-refly-text-0">
            <Markdown size={18} color="var(--refly-text-0)" />
            {t('workspace.exportDocumentToMarkdown')}
          </div>
        ),
        onClick: async () => handleExport('markdown'),
      },
      {
        key: 'exportDocx',
        label: (
          <div className="flex items-center gap-1 text-refly-text-0">
            <Doc1 size={18} color="var(--refly-Colorful-Blue)" />
            {t('workspace.exportDocumentToDocx')}
          </div>
        ),
        onClick: async () => handleExport('docx'),
      },
      {
        key: 'exportPdf',
        label: (
          <div className="flex items-center gap-1 text-refly-text-0">
            <Pdf size={18} color="var(--refly-Colorful-red)" />
            {t('workspace.exportDocumentToPdf')}
          </div>
        ),
        onClick: async () => handleExport('pdf'),
      },
    ];
    return items;
  }, [t]);

  const handleExport = useCallback(
    async (type: 'markdown' | 'docx' | 'pdf') => {
      if (isExporting) return;
      try {
        setIsExporting(true);
        let mimeType = '';
        let extension = '';

        const hide = message.loading({ content: t('workspace.exporting'), duration: 0 });
        const content = await exportDocument(docId, type);
        console.log('content', content);
        hide();

        switch (type) {
          case 'markdown':
            mimeType = 'text/markdown';
            extension = 'md';
            break;
          case 'docx':
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            extension = 'docx';
            break;
          case 'pdf':
            mimeType = 'application/pdf';
            extension = 'pdf';
            break;
        }

        const blob = new Blob([content ?? ''], { type: mimeType || 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeNode?.data?.title || t('common.untitled')}.${extension || 'md'}`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        message.success(t('workspace.exportSuccess'));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Export error:', error);
        message.error(t('workspace.exportFailed'));
      } finally {
        setIsExporting(false);
      }
    },
    [activeNode?.data?.title, docId, exportDocument, isExporting, t],
  );

  const handleLocateNode = useCallback(() => {
    if (activeNode?.id) setNodeCenter(activeNode.id, true);
  }, [activeNode?.id, setNodeCenter]);

  const handleDeleteNode = useCallback(() => {
    if (!activeNode) return;
    deleteNode(activeNode as any);
  }, [activeNode, deleteNode]);

  const moreMenuItems: MenuProps['items'] = useMemo(() => {
    return [
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
  }, [handleDeleteNode, handleLocateNode, handleShare, readonly, isSharing, t]);

  const DownloadMenu = (
    <Dropdown menu={{ items: exportMenuItems }} trigger={['click']} placement="bottomRight">
      <Button className="!h-5 !w-5 p-0" size="small" type="text" icon={<Download size={16} />} />
    </Dropdown>
  );

  return (
    <div className="flex items-center gap-3">
      {!readonly && (
        <>
          <Tooltip title={t('document.share', 'Share document')}>
            <Button
              className="!h-5 !w-5 p-0"
              disabled={isSharing}
              loading={isSharing}
              size="small"
              type="text"
              onClick={handleShare}
              icon={<Share size={16} />}
            />
          </Tooltip>
          {DownloadMenu}
        </>
      )}

      <Dropdown menu={{ items: moreMenuItems }} trigger={['click']} placement="bottomRight">
        <Button className="!h-5 !w-5 p-0" size="small" type="text" icon={<More size={16} />} />
      </Dropdown>
    </div>
  );
};
