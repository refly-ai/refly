import React, { memo, useCallback, useMemo, useState } from 'react';
import { Typography, Button, Dropdown, message, notification } from 'antd';
import type { MenuProps } from 'antd';
import { Share, Download, Markdown, Doc1, Pdf } from 'refly-icons';
import { LuLayoutGrid } from 'react-icons/lu';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { FilePreview } from '@refly-packages/ai-workspace-common/components/canvas/canvas-resources/file-preview';
import { DriveFile, ResourceType, EntityType } from '@refly/openapi-schema';
import cn from 'classnames';
import { useActionResultStoreShallow } from '@refly/stores';
import { TbArrowBackUp } from 'react-icons/tb';
import { useDownloadFile } from '@refly-packages/ai-workspace-common/hooks/canvas/use-download-file';
import { useTranslation } from 'react-i18next';
import { getShareLink } from '@refly-packages/ai-workspace-common/utils/share';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { usePublicFileUrlContext } from '@refly-packages/ai-workspace-common/context/public-file-url';
import {
  useExportDocument,
  ExportCancelledError,
} from '@refly-packages/ai-workspace-common/hooks/use-export-document';
const { Paragraph } = Typography;

// Convert DriveFile type to ResourceType
const getResourceType = (fileType: string): ResourceType => {
  const typeMap: Record<string, ResourceType> = {
    'text/plain': 'file',
    'application/pdf': 'document',
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/gif': 'image',
    'video/mp4': 'video',
    'audio/mpeg': 'audio',
  };
  return typeMap[fileType] || 'file';
};

type ActionButtonProps = {
  label: string;
  icon: React.ReactElement;
  loading?: boolean;
  onClick?: () => void;
  dropdownMenuItems?: MenuProps['items'];
};

const ActionButton = memo<ActionButtonProps>(
  ({ label, icon, onClick, loading, dropdownMenuItems }) => {
    const buttonNode = (
      <Button
        type="text"
        size="small"
        icon={icon}
        onClick={onClick}
        aria-label={label}
        loading={loading}
        disabled={loading}
      />
    );

    if (dropdownMenuItems?.length) {
      return (
        <Dropdown menu={{ items: dropdownMenuItems }} trigger={['click']} placement="bottomRight">
          {buttonNode}
        </Dropdown>
      );
    }

    return buttonNode;
  },
);

ActionButton.displayName = 'ActionButton';

interface ProductCardProps {
  file: DriveFile;
  classNames?: string;
  source?: 'preview' | 'card';
  onAddToFileLibrary?: (file: DriveFile) => Promise<void>;
  isAddingToFileLibrary?: boolean;
}

export const ProductCard = memo(
  ({
    file,
    classNames,
    source = 'card',
    onAddToFileLibrary,
    isAddingToFileLibrary = false,
  }: ProductCardProps) => {
    const { setCurrentFile } = useActionResultStoreShallow((state) => ({
      setCurrentFile: state.setCurrentFile,
    }));
    const inheritedUsePublicFileUrl = usePublicFileUrlContext();
    const { t } = useTranslation();
    const { handleDownload, isDownloading } = useDownloadFile();
    const { exportDocument } = useExportDocument();

    const title = file?.name ?? 'Untitled file';

    const isMediaFile = useMemo(() => {
      return (
        getResourceType(file.type) === 'image' ||
        getResourceType(file.type) === 'video' ||
        getResourceType(file.type) === 'audio'
      );
    }, [file.type]);

    const handlePreview = useCallback(() => {
      setCurrentFile(file, { usePublicFileUrl: inheritedUsePublicFileUrl });
    }, [file, inheritedUsePublicFileUrl, setCurrentFile]);

    const handleDownloadProduct = useCallback(() => {
      handleDownload({
        currentFile: file,
        contentType: file.type,
      });
    }, [handleDownload, file]);

    const [isSharing, setIsSharing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

    const handleExport = useCallback(
      async (type: 'markdown' | 'docx' | 'pdf') => {
        if (isExporting || !file?.fileId) {
          return;
        }

        const notificationKey = `export-${file.fileId}-${Date.now()}`;
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

          const content = await exportDocument(
            file.fileId,
            type,
            undefined,
            abortController.signal,
          );

          const blob =
            content instanceof Blob
              ? content
              : new Blob([content ?? ''], { type: mimeType || 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;

          // Remove existing extension from title to avoid double extensions like "file.txt.docx"
          const baseName = (title || t('common.untitled')).replace(/\.(txt|md|docx|pdf|doc)$/i, '');
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
          message.error(t('workspace.exportFailed'));
        } finally {
          setIsExporting(false);
        }
      },
      [exportDocument, file?.fileId, isExporting, t, title],
    );

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

    const handleShare = useCallback(async () => {
      if (!file?.fileId) {
        return;
      }

      setIsSharing(true);
      const loadingMessage = message.loading(t('driveFile.sharing', 'Sharing file...'), 0);

      try {
        const { data, error } = await getClient().createShare({
          body: {
            entityId: file.fileId,
            entityType: 'driveFile' as EntityType,
          },
        });

        if (!data?.success || error) {
          throw new Error(error ? String(error) : 'Failed to share file');
        }

        const shareLink = getShareLink('driveFile', data.data?.shareId ?? '');
        copyToClipboard(shareLink);
        loadingMessage();
        message.success(
          t('driveFile.shareSuccess', 'File shared successfully! Link copied to clipboard.'),
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to share file:', err);
        loadingMessage();
        message.error(t('driveFile.shareError', 'Failed to share file'));
      } finally {
        setIsSharing(false);
      }
    }, [file?.fileId, t]);

    const handleAddToFileLibrary = useCallback(async () => {
      if (!onAddToFileLibrary || isAdding || isAddingToFileLibrary) {
        return;
      }

      setIsAdding(true);
      try {
        await onAddToFileLibrary(file);
      } catch (error) {
        // Error handling is done in the parent component
        console.error('Failed to add file to library:', error);
      } finally {
        setIsAdding(false);
      }
    }, [onAddToFileLibrary, file, isAdding, isAddingToFileLibrary]);

    const actions = useMemo<ActionButtonProps[]>(() => {
      const baseShareAction: ActionButtonProps | null = !isMediaFile
        ? {
            label: 'Share',
            icon: <Share size={16} />,
            onClick: handleShare,
            loading: isSharing,
          }
        : null;

      const addToFileLibraryAction: ActionButtonProps | null = onAddToFileLibrary
        ? {
            label: 'Add to File Library',
            icon: <LuLayoutGrid size={16} />,
            onClick: handleAddToFileLibrary,
            loading: isAdding || isAddingToFileLibrary,
          }
        : null;

      if (file?.type === 'text/plain') {
        return [
          {
            label: 'Download',
            icon: <Download size={16} />,
            loading: isExporting,
            dropdownMenuItems: exportMenuItems,
          },
          addToFileLibraryAction,
          baseShareAction,
        ].filter((action): action is ActionButtonProps => Boolean(action));
      }

      return [
        {
          label: 'Download',
          icon: <Download size={16} />,
          onClick: handleDownloadProduct,
          loading: isDownloading,
        },
        addToFileLibraryAction,
        baseShareAction,
      ].filter((action): action is ActionButtonProps => Boolean(action));
    }, [
      exportMenuItems,
      file?.type,
      handleDownloadProduct,
      handleShare,
      handleAddToFileLibrary,
      isDownloading,
      isExporting,
      isMediaFile,
      isSharing,
      isAdding,
      isAddingToFileLibrary,
      onAddToFileLibrary,
    ]);

    const handleClosePreview = useCallback(() => {
      setCurrentFile(null);
    }, [setCurrentFile]);

    return (
      <div
        className={cn(
          classNames,
          'overflow-hidden flex flex-col',
          source === 'card' ? 'rounded-lg border-[1px] border-solid border-refly-Card-Border' : '',
        )}
        style={
          source === 'card'
            ? {
                contentVisibility: 'auto',
                containIntrinsicSize: '0 300px',
              }
            : undefined
        }
      >
        <div className="w-full px-3 py-4 flex justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {source === 'preview' && (
              <Button
                type="text"
                size="small"
                icon={<TbArrowBackUp className="text-refly-text-0 w-5 h-5" />}
                onClick={handleClosePreview}
              />
            )}
            <NodeIcon type="file" filename={title} fileType={file.type} filled={false} small />
            <Paragraph
              className="!m-0 text-sm font-semibold flex-1 min-w-0"
              ellipsis={{
                rows: 1,
                tooltip: {
                  title: <div className="max-h-[200px] overflow-y-auto">{title}</div>,
                  placement: 'left',
                  arrow: false,
                },
              }}
            >
              {title}
            </Paragraph>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {actions.map(
              (action) =>
                action && (
                  <ActionButton
                    key={action.label}
                    icon={action.icon}
                    label={action.label}
                    onClick={action.onClick}
                    loading={action.loading}
                    dropdownMenuItems={action.dropdownMenuItems}
                  />
                ),
            )}
          </div>
        </div>

        <div
          className={cn(
            'relative w-full px-3 pb-3 overflow-y-auto group',
            !isMediaFile && source === 'card'
              ? 'max-h-[240px] !overflow-hidden relative'
              : 'h-full',
          )}
        >
          <FilePreview
            file={file}
            markdownClassName="text-sm min-h-[50px]"
            source={source}
            onPreview={handlePreview}
          />
        </div>
      </div>
    );
  },
);

ProductCard.displayName = 'ProductCard';
