import React, { memo, useCallback, useMemo, useState } from 'react';
import { Typography, Button, message } from 'antd';
import { Share, Download } from 'refly-icons';
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
  onClick: () => void;
};

const ActionButton = memo<ActionButtonProps>(({ label, icon, onClick, loading }) => (
  <Button
    type="text"
    size="small"
    icon={icon}
    onClick={onClick}
    aria-label={label}
    loading={loading}
    disabled={loading}
  />
));

ActionButton.displayName = 'ActionButton';

interface ProductCardProps {
  file: DriveFile;
  classNames?: string;
  source?: 'preview' | 'card';
}

export const ProductCard = memo(({ file, classNames, source = 'card' }: ProductCardProps) => {
  const { setCurrentFile } = useActionResultStoreShallow((state) => ({
    setCurrentFile: state.setCurrentFile,
  }));
  const inheritedUsePublicFileUrl = usePublicFileUrlContext();
  const { t } = useTranslation();
  const { handleDownload, isDownloading } = useDownloadFile();

  const title = file?.name ?? 'Untitled file';

  const isMediaFile = useMemo(() => {
    return (
      getResourceType(file.type) === 'image' ||
      getResourceType(file.type) === 'video' ||
      getResourceType(file.type) === 'audio'
    );
  }, [file.type]);

  const canPreview = useMemo(() => {
    return getResourceType(file.type) !== 'video' && getResourceType(file.type) !== 'audio';
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

  const actions = useMemo<ActionButtonProps[]>(
    () => [
      {
        label: 'Download',
        icon: <Download size={16} />,
        onClick: handleDownloadProduct,
        loading: isDownloading,
      },
      !isMediaFile && {
        label: 'Share',
        icon: <Share size={16} />,
        onClick: handleShare,
        loading: isSharing,
      },
    ],
    [handleDownloadProduct, handleShare, isDownloading, isMediaFile, isSharing],
  );

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
                />
              ),
          )}
        </div>
      </div>

      <div
        className={cn(
          'relative w-full px-3 pb-3 overflow-y-auto group',
          !isMediaFile && source === 'card' ? 'max-h-[240px] !overflow-hidden relative' : 'h-full',
        )}
      >
        {canPreview && source === 'card' && (
          <div className="absolute z-10 bottom-3 left-3 right-3 top-0 rounded-[10px] bg-refly-modal-mask flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out">
            <div
              className="p-3 rounded-[80px] bg-refly-text-2 text-sm leading-5 font-semibold text-refly-text-flip cursor-pointer select-none"
              onClick={handlePreview}
            >
              {t('common.view')}
            </div>
          </div>
        )}
        <FilePreview file={file} markdownClassName="text-sm min-h-[50px]" source={source} />
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';
