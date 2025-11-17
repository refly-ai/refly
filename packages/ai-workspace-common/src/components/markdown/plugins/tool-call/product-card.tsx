import React, { memo, useCallback, useMemo } from 'react';
import { Typography, Button } from 'antd';
import { View, Share, Download } from 'refly-icons';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { FilePreview } from '@refly-packages/ai-workspace-common/components/canvas/canvas-resources/file-preview';
import { DriveFile, ResourceType } from '@refly/openapi-schema';

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
  onClick: () => void;
};

const ActionButton = memo<ActionButtonProps>(({ label, icon, onClick }) => (
  <Button type="text" size="small" icon={icon} onClick={onClick} aria-label={label} />
));

ActionButton.displayName = 'ActionButton';

export const ProductCard = memo(({ file }: { file: DriveFile }) => {
  const title = file?.name ?? 'Untitled file';

  const handlePreview = useCallback(() => {
    console.info('Preview requested for drive file', file?.fileId ?? '');
  }, [file?.fileId]);

  const handleDownload = useCallback(() => {
    console.info('Download requested for drive file', file?.fileId ?? '');
  }, [file?.fileId]);

  const handleShare = useCallback(() => {
    console.info('Share requested for drive file', file?.fileId ?? '');
  }, [file?.fileId]);

  const actions = useMemo<ActionButtonProps[]>(
    () => [
      { label: 'Preview', icon: <View size={16} />, onClick: handlePreview },
      { label: 'Download', icon: <Download size={16} />, onClick: handleDownload },
      { label: 'Share', icon: <Share size={16} />, onClick: handleShare },
    ],
    [handleDownload, handlePreview, handleShare],
  );

  return (
    <div className="overflow-hidden rounded-lg border border-solid border-refly-Card-Border">
      <div className="flex flex-col justify-between px-3 py-2">
        <div className="flex justify-between">
          <div className="flex items-center gap-2">
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
            {actions.map((action) => (
              <ActionButton
                key={action.label}
                icon={action.icon}
                label={action.label}
                onClick={action.onClick}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="relative max-h-[240px] w-full overflow-hidden bg-gray-100 dark:bg-gray-900">
        <FilePreview file={file} markdownClassName="text-sm" />
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';
