import { memo } from 'react';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { cn } from '@refly/utils/cn';
import { FileItemAction } from '../share/file-item-action';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import type { DriveFile, ResourceType } from '@refly/openapi-schema';

const { Text } = Typography;

export interface FileItemProps {
  file: DriveFile;
  isActive: boolean;
  onSelect: (resource: DriveFile, beforeParsed: boolean) => void;
}

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

/**
 * Render a single file item.
 */
export const FileItem = memo(({ file, isActive, onSelect }: FileItemProps) => {
  const { t } = useTranslation();

  // For DriveFile, we assume it's always parsed and ready to use
  const beforeParsed = false;

  return (
    <div
      className={cn(
        'h-9 group p-2 cursor-pointer hover:bg-refly-tertiary-hover flex items-center justify-between gap-2 text-refly-text-0 rounded-lg',
        isActive && 'bg-refly-tertiary-hover',
      )}
      onClick={() => onSelect(file, beforeParsed)}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <NodeIcon
          type="resource"
          resourceType={getResourceType(file.type)}
          resourceMeta={{ contentType: file.type }}
          filled={false}
          small
        />

        <Text
          ellipsis={{ tooltip: { placement: 'left' } }}
          className={cn('block flex-1 min-w-0 truncate', {
            'font-semibold': isActive,
          })}
        >
          {file?.name ?? t('common.untitled')}
        </Text>
      </div>
      <div className="flex items-center gap-2">
        <FileItemAction file={file} />
      </div>
    </div>
  );
});

FileItem.displayName = 'MyUploadItem';
