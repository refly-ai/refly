import React, { memo, useCallback, useMemo } from 'react';
import { Typography, Button } from 'antd';
import { Share, Download } from 'refly-icons';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { FilePreview } from '@refly-packages/ai-workspace-common/components/canvas/canvas-resources/file-preview';
import { DriveFile, ResourceType } from '@refly/openapi-schema';
import cn from 'classnames';
import { useActionResultStoreShallow } from '@refly/stores';
import { TbArrowBackUp } from 'react-icons/tb';
import { useDownloadFile } from '@refly-packages/ai-workspace-common/hooks/canvas/use-download-file';
import { useTranslation } from 'react-i18next';
const { Text } = Typography;

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
    console.info('Preview requested for drive file', file?.fileId ?? '');
    setCurrentFile(file);
  }, [file, setCurrentFile]);

  const handleDownloadProduct = useCallback(() => {
    handleDownload({
      currentFile: file,
      contentType: file.type,
    });
  }, [handleDownload, file]);

  const handleShare = useCallback(() => {
    console.info('Share requested for drive file', file?.fileId ?? '');
  }, [file?.fileId]);

  const actions = useMemo<ActionButtonProps[]>(
    () => [
      {
        label: 'Download',
        icon: <Download size={16} />,
        onClick: handleDownloadProduct,
        loading: isDownloading,
      },
      !isMediaFile && { label: 'Share', icon: <Share size={16} />, onClick: handleShare },
    ],
    [handleDownloadProduct, handleShare, isDownloading, isMediaFile],
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
      <div className="flex flex-col justify-between px-3 py-4">
        <div className="flex justify-between">
          <div className="flex items-center gap-2">
            {source === 'preview' && (
              <Button
                type="text"
                size="small"
                icon={<TbArrowBackUp className="text-refly-text-0 w-5 h-5" />}
                onClick={handleClosePreview}
              />
            )}
            <NodeIcon
              type="resource"
              resourceType={getResourceType(file.type)}
              resourceMeta={{ contentType: file.type }}
              filled={false}
              small
            />
            <Text className="text-sm font-semibold">{title}</Text>
          </div>

          <div className="flex items-center gap-1">
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
      </div>
      <div
        className={cn('relative w-full px-3 pb-3 overflow-y-auto group', {
          'max-h-[240px] !overflow-hidden relative': !isMediaFile && source === 'card',
        })}
      >
        {canPreview && source === 'card' && (
          <div className="absolute z-10 bottom-2.5 left-2.5 right-3.5 top-0 rounded-[10px] bg-refly-modal-mask flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out">
            <div
              className="p-3 rounded-[80px] bg-refly-text-2 text-sm leading-5 font-semibold text-refly-text-flip cursor-pointer select-none"
              onClick={handlePreview}
            >
              {t('common.view')}
            </div>
          </div>
        )}
        <FilePreview file={file} markdownClassName="text-sm min-h-[50px]" />
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';
