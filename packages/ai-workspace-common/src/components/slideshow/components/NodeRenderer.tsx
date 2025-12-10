import { memo, useMemo, useCallback, useState } from 'react';
import { type NodeRelation } from './ArtifactRenderer';
import { NodeBlockHeader } from './NodeBlockHeader';
import { useTranslation } from 'react-i18next';
import { Tooltip, Button, Dropdown, message } from 'antd';
import type { MenuProps } from 'antd';
import { DownloadIcon } from 'lucide-react';
import {
  hasDownloadableData,
  shareNodeData,
  hasShareableData,
  type NodeData,
} from '@refly-packages/ai-workspace-common/utils/download-node-data';
import { Share, Pdf, Doc1, Markdown } from 'refly-icons';
import { logEvent } from '@refly/telemetry-web';
import { CanvasNode, DriveFile } from '@refly/openapi-schema';
import { ResultItemPreview } from '@refly-packages/ai-workspace-common/components/workflow-app/ResultItemPreview';
import { useExportDocument } from '@refly-packages/ai-workspace-common/hooks/use-export-document';
import { useDownloadFile } from '@refly-packages/ai-workspace-common/hooks/canvas/use-download-file';

// Content renderer component
const NodeRenderer = memo(
  ({
    node,
    isFullscreen = false,
    isModal = false,
    isMinimap = false,
    fromProducts = false,
    onDelete,
    inModal = false,
  }: {
    node: NodeRelation;
    isFullscreen?: boolean;
    isModal?: boolean;
    isMinimap?: boolean;
    isFocused?: boolean;
    fromProducts?: boolean;
    onDelete?: (nodeId: string) => void;
    onStartSlideshow?: (nodeId: string) => void;
    onWideMode?: (nodeId: string) => void;
    inModal?: boolean;
  }) => {
    const { t } = useTranslation();
    const { handleDownload } = useDownloadFile();
    const { exportDocument } = useExportDocument();
    const [isExporting, setIsExporting] = useState(false);

    // Check if node has downloadable data
    const nodeData: NodeData = useMemo(
      () => ({
        nodeId: node.nodeId,
        nodeType: node.nodeType,
        entityId: node.entityId,
        title: node.nodeData?.title,
        metadata: node.nodeData?.metadata,
      }),
      [node],
    );

    const canDownload = useMemo(() => hasDownloadableData(nodeData), [nodeData]);
    const canShare = useMemo(() => hasShareableData(nodeData), [nodeData]);

    // Handle download for any node type
    const handleDownloadNode = useCallback(async () => {
      const file = nodeData.metadata as DriveFile;
      file.name = nodeData.title;
      handleDownload({
        currentFile: file,
        contentType: file.type,
      });
    }, [nodeData, handleDownload]);

    // Handle share for any node type
    const handleShare = useCallback(async () => {
      if (fromProducts) {
        logEvent('share_template_result', null, {
          nodeId: nodeData.nodeId,
          nodeType: nodeData.nodeType,
          title: nodeData.title,
        });
      }
      await shareNodeData(nodeData, t);
    }, [nodeData, t, fromProducts]);

    // Handle export for document type
    const handleExport = useCallback(
      async (type: 'markdown' | 'docx' | 'pdf') => {
        const fileId = nodeData?.metadata?.fileId;
        if (isExporting || !fileId) {
          return;
        }

        try {
          setIsExporting(true);
          let mimeType = '';
          let extension = '';

          const hide = message.loading({ content: t('workspace.exporting'), duration: 0 });
          const content = await exportDocument(fileId, type);
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
          a.download = `${nodeData.title || t('common.untitled')}.${extension || 'md'}`;
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
      [exportDocument, nodeData?.metadata?.fileId, isExporting, t, nodeData.title],
    );

    // Export menu items for document type
    const exportMenuItems: MenuProps['items'] = useMemo(
      () => [
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
          key: 'exportMarkdown',
          label: (
            <div className="flex items-center gap-1 text-refly-text-0">
              <Markdown size={18} color="var(--refly-text-0)" />
              {t('workspace.exportDocumentToMarkdown')}
            </div>
          ),
          onClick: async () => handleExport('markdown'),
        },
      ],
      [handleExport, t],
    );

    // Generic node block header
    const renderNodeHeader =
      !isFullscreen && !isModal ? (
        <NodeBlockHeader
          isFullscreen={isFullscreen}
          isModal={isModal}
          node={node}
          isMinimap={isMinimap}
          onDelete={onDelete}
          nodeHeaderClassName={fromProducts ? 'bg-transparent' : undefined}
          rightActions={
            <div className="flex items-center gap-1">
              {canDownload && (
                <Tooltip title={t('canvas.nodeActions.download', 'Download')}>
                  {nodeData?.metadata?.type === 'text/plain' ? (
                    <Dropdown
                      menu={{ items: exportMenuItems }}
                      trigger={['click']}
                      placement="bottomRight"
                    >
                      <Button
                        type="text"
                        className="flex items-center justify-center border-none bg-[var(--refly-bg-float-z3)] hover:bg-[var(--refly-fill-hover)] text-[var(--refly-text-1)] hover:text-[var(--refly-primary-default)] transition"
                        icon={<DownloadIcon size={16} />}
                        loading={isExporting}
                      >
                        {/* <span className="sr-only" /> */}
                      </Button>
                    </Dropdown>
                  ) : (
                    <Button
                      type="text"
                      className="flex items-center justify-center border-none bg-[var(--refly-bg-float-z3)] hover:bg-[var(--refly-fill-hover)] text-[var(--refly-text-1)] hover:text-[var(--refly-primary-default)] transition"
                      icon={<DownloadIcon size={16} />}
                      onClick={handleDownloadNode}
                    >
                      {/* <span className="sr-only" /> */}
                    </Button>
                  )}
                </Tooltip>
              )}
              {canShare && (
                <Tooltip title={t('canvas.nodeActions.share', 'Share')}>
                  <Button
                    type="text"
                    className="flex items-center justify-center border-none bg-[var(--refly-bg-float-z3)] hover:bg-[var(--refly-fill-hover)] text-[var(--refly-text-1)] hover:text-[var(--refly-primary-default)] transition"
                    icon={<Share size={16} />}
                    onClick={handleShare}
                  >
                    {/* <span className="sr-only" /> */}
                  </Button>
                </Tooltip>
              )}
            </div>
          }
        />
      ) : null;

    return (
      <div className="flex flex-col h-full bg-[var(--refly-bg-content-z2)] text-[var(--refly-text-1)]">
        {renderNodeHeader}
        <div className="m-3 mt-0 h-full overflow-hidden rounded-lg cursor-pointer border border-[var(--refly-Card-Border)] bg-[var(--refly-bg-main-z1)] hover:bg-[var(--refly-bg-control-z0)]">
          <ResultItemPreview
            inModal={inModal}
            node={{ ...node, data: node.nodeData, type: node.nodeType } as unknown as CanvasNode}
          />
        </div>
      </div>
    );
  },
  // Custom comparison function, only re-render when key properties change
  (prevProps, nextProps) => {
    // Check if key properties have changed
    return (
      prevProps.node.nodeId === nextProps.node.nodeId &&
      prevProps.node.nodeType === nextProps.node.nodeType &&
      prevProps.isFullscreen === nextProps.isFullscreen &&
      prevProps.isModal === nextProps.isModal &&
      prevProps.isMinimap === nextProps.isMinimap &&
      prevProps.isFocused === nextProps.isFocused
    );
  },
);

export { NodeRenderer };
