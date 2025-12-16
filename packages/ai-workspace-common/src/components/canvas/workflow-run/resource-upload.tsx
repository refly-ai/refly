import React, { useCallback, useMemo, useState } from 'react';
import { Button, Upload, Spin, Tooltip } from 'antd';
import { Attachment, Refresh, Delete } from 'refly-icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { useTranslation } from 'react-i18next';
import {
  FileIcon,
  defaultStyles,
} from '@refly-packages/ai-workspace-common/components/common/resource-icon';
import { getFileExtension } from '../workflow-variables/utils';
import {
  FILE_SIZE_LIMITS,
  IMAGE_FILE_EXTENSIONS,
  DOCUMENT_FILE_EXTENSIONS,
  AUDIO_FILE_EXTENSIONS,
  VIDEO_FILE_EXTENSIONS,
} from '../workflow-variables/constants';

interface ResourceUploadProps {
  value?: UploadFile[];
  onChange?: (fileList: UploadFile[]) => void;
  onUpload: (file: File) => Promise<boolean>;
  onRemove?: (file: UploadFile) => void;
  onRefresh?: () => void;
  resourceTypes?: string[];
  disabled?: boolean;
  maxCount?: number;
  className?: string;
  'data-field-name'?: string;
  hasError?: boolean;
}

export const ResourceUpload: React.FC<ResourceUploadProps> = React.memo(
  ({
    value = [],
    onChange,
    onUpload,
    onRemove,
    onRefresh,
    resourceTypes,
    disabled = false,
    maxCount = 1,
    className,
    'data-field-name': dataFieldName,
    hasError = false,
  }) => {
    const { t } = useTranslation();
    const [uploading, setUploading] = useState(false);

    // Get file icon type for display
    const getFileIconType = useCallback((name: string) => {
      const extension = getFileExtension(name);
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
        return 'image';
      }
      return extension;
    }, []);

    // Handle file upload
    const handleFileUpload = useCallback(
      async (file: File) => {
        setUploading(true);
        try {
          const result = await onUpload(file);
          return result;
        } finally {
          setUploading(false);
        }
      },
      [onUpload],
    );

    // Handle file removal
    const handleFileRemove = useCallback(
      (file: UploadFile) => {
        if (onRemove) {
          onRemove(file);
        } else if (onChange) {
          const newFileList = value.filter((f) => f.uid !== file.uid);
          onChange(newFileList);
        }
      },
      [onRemove, onChange, value],
    );

    // Handle file refresh
    const handleRefresh = useCallback(() => {
      if (onRefresh) {
        onRefresh();
      }
    }, [onRefresh]);

    // Generate accept attribute based on resource types
    const accept = useMemo(() => {
      if (!resourceTypes?.length) {
        return '';
      }

      return resourceTypes
        .map((type) => {
          switch (type) {
            case 'document':
              return DOCUMENT_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',');
            case 'image':
              return IMAGE_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',');
            case 'audio':
              return AUDIO_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',');
            case 'video':
              return VIDEO_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',');
            default:
              return '';
          }
        })
        .filter(Boolean)
        .join(',');
    }, [resourceTypes]);

    return (
      <div className={`space-y-2 ${className || ''}`} data-field-name={dataFieldName}>
        <Upload
          className="workflow-run-resource-upload"
          fileList={value}
          beforeUpload={handleFileUpload}
          onRemove={handleFileRemove}
          onChange={() => {}} // Handle change is managed by our custom handlers
          multiple={false}
          accept={accept}
          listType="text"
          disabled={disabled || uploading}
          maxCount={maxCount}
          itemRender={(_originNode, file) => (
            <Spin className="w-full" spinning={uploading}>
              <div className="w-full h-9 flex items-center justify-between gap-2 box-border px-2 bg-refly-bg-control-z0 rounded-lg hover:bg-refly-tertiary-hover">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileIcon
                    extension={getFileIconType(file.name || '')}
                    width={20}
                    height={20}
                    type="icon"
                    {...defaultStyles[getFileIconType(file.name || '')]}
                  />
                  <div className="min-w-0 flex-1 text-sm text-refly-text-0 leading-5 truncate">
                    {file.name}
                  </div>
                </div>

                <div className="flex gap-1">
                  {onRefresh && (
                    <Tooltip title={t('canvas.workflow.variables.replaceFile')}>
                      <Button
                        size="small"
                        type="text"
                        icon={<Refresh size={16} color="var(--refly-text-1)" />}
                        onClick={handleRefresh}
                        disabled={uploading}
                      />
                    </Tooltip>
                  )}
                  <Button
                    size="small"
                    type="text"
                    icon={<Delete size={16} color="var(--refly-text-1)" />}
                    onClick={() => handleFileRemove(file)}
                    disabled={uploading}
                  />
                </div>
              </div>
            </Spin>
          )}
        >
          {(!value || value.length === 0) && (
            <Button
              className={`w-full bg-refly-bg-control-z0 ${hasError ? 'border-red-500 border-solid' : 'border-none'}`}
              type="default"
              disabled={disabled || uploading}
              loading={uploading}
              icon={<Attachment size={18} color="var(--refly-text-0)" />}
            >
              {t('canvas.workflow.variables.upload') || 'Upload Files'}
            </Button>
          )}
        </Upload>

        {resourceTypes && resourceTypes.length > 0 && (
          <div className="text-xs text-refly-text-2">
            {t('canvas.workflow.variables.acceptResourceTypes') || 'Accept Resource Types: '}
            {resourceTypes.map((type, index) => (
              <span key={type}>
                {index > 0 && '、'}
                {t('canvas.workflow.variables.fileSizeLimit', {
                  type: t(`canvas.workflow.variables.resourceType.${type}`),
                  size: FILE_SIZE_LIMITS[type],
                })}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  },
);

ResourceUpload.displayName = 'ResourceUpload';
