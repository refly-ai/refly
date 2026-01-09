import { Button, Dropdown, message, Tooltip, notification } from 'antd';
import type { MenuProps } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, Download, More, Location, Delete, Markdown, Doc1, Pdf } from 'refly-icons';
import { useActiveNode } from '@refly/stores';
import { useNodePosition } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-position';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { editorEmitter } from '@refly/utils/event-emitter/editor';
import {
  useExportDocument,
  ExportCancelledError,
} from '@refly-packages/ai-workspace-common/hooks/use-export-document';
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
      const notificationKey = `export-${docId}-${Date.now()}`;
      const abortController = new AbortController();

      try {
        setIsExporting(true);
        let mimeType = '';
        let extension = '';

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

        notification.info({
          key: notificationKey,
          message: t('workspace.exporting'),
          duration: 0,
          onClose: () => {
            abortController.abort();
          },
        });

        // exportDocument returns string for markdown, Blob for pdf/docx
        // Will throw error if export fails
        const result = await exportDocument(docId, type, undefined, abortController.signal);

        // For markdown, empty string is valid but we should still check
        if (!result && type !== 'markdown') {
          throw new Error('Export returned empty result');
        }

        // Create blob - result is already a Blob for pdf/docx, string for markdown
        const blob = result instanceof Blob ? result : new Blob([result], { type: mimeType });

        // Remove existing extension from title to avoid double extensions like "file.txt.pdf"
        const title = activeNode?.data?.title || t('common.untitled');
        const baseName = title.replace(/\.(txt|md|docx|pdf|doc)$/i, '');

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}.${extension || 'md'}`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        notification.destroy(notificationKey);
        message.success(t('workspace.exportSuccess'));
      } catch (error) {
        notification.destroy(notificationKey);
        // Don't show error message if cancelled
        if (error instanceof ExportCancelledError) {
          return;
        }
        // eslint-disable-next-line no-console
        console.error('Export error:', error);
        const errorMessage = error instanceof Error ? error.message : t('workspace.exportFailed');
        message.error(errorMessage);
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
