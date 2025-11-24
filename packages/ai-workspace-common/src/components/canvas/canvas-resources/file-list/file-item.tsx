import { memo } from 'react';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { cn } from '@refly/utils/cn';
import { FileItemAction } from '../share/file-item-action';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import type { DriveFile } from '@refly/openapi-schema';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

const { Text } = Typography;

export interface FileItemProps {
  file: DriveFile;
  isActive: boolean;
  onSelect: (resource: DriveFile, beforeParsed: boolean) => void;
}

/**
 * Render a single file item.
 */
export const FileItem = memo(({ file, isActive, onSelect }: FileItemProps) => {
  const { t } = useTranslation();
  const { readonly } = useCanvasContext();

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
        <NodeIcon type="file" filename={file.name} filled={false} small />

        <Text
          ellipsis={{ tooltip: { placement: 'left' } }}
          className={cn('block flex-1 min-w-0 truncate', {
            'font-semibold': isActive,
          })}
        >
          {file?.name ?? t('common.untitled')}
        </Text>
      </div>
      {!readonly && (
        <div className="flex items-center gap-2">
          <FileItemAction file={file} />
        </div>
      )}
    </div>
  );
});

FileItem.displayName = 'MyUploadItem';
