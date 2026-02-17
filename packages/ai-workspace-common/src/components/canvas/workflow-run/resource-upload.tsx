import React, { useCallback, useState } from 'react';
import { Button, Upload, Spin, Tooltip } from 'antd';
import { Attachment } from 'refly-icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { useTranslation } from 'react-i18next';
import cn from 'classnames';
import { ImageFileIcon, RepeatIcon, TrashIcon } from './resource-upload-icons';

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
    disabled = false,
    maxCount = 1,
    className,
    'data-field-name': dataFieldName,
    hasError = false,
  }) => {
    const { t } = useTranslation();
    const [uploading, setUploading] = useState(false);

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

    return (
      <div className={`space-y-2 ${className || ''}`} data-field-name={dataFieldName}>
        <Upload
          className="workflow-run-resource-upload w-full [&_.ant-upload-list]:w-full [&_.ant-upload]:!w-full [&_.ant-upload-select]:!w-full [&_.ant-upload-select>span]:!w-full"
          fileList={value}
          beforeUpload={handleFileUpload}
          onRemove={handleFileRemove}
          onChange={() => {}} // Handle change is managed by our custom handlers
          multiple={maxCount > 1}
          listType="text"
          disabled={disabled || uploading}
          maxCount={maxCount}
          itemRender={(_originNode, file) => (
            <Spin className="w-full" spinning={file.status === 'uploading'}>
              <div className="w-full h-[37px] flex items-center justify-between gap-[10px] box-border px-3 border border-solid border-[#E5E5E5] rounded-xl hover:border-[#155EEF] transition-colors">
                <div className="flex items-center gap-1 min-w-0 flex-1">
                  <ImageFileIcon />
                  <div
                    className={cn(
                      'min-w-0 flex-1 text-sm leading-[37px] truncate h-[37px]',
                      disabled ? 'text-[rgba(28,31,35,0.35)]' : 'text-[#1C1F23]',
                    )}
                  >
                    {file.name}
                  </div>
                </div>

                <div className="flex gap-4">
                  {onRefresh && (
                    <Tooltip title={t('canvas.workflow.variables.replaceFile')}>
                      <button
                        type="button"
                        className="p-0 border-0 bg-transparent cursor-pointer hover:opacity-70 transition-opacity flex-shrink-0"
                        onClick={handleRefresh}
                        disabled={uploading}
                      >
                        <RepeatIcon />
                      </button>
                    </Tooltip>
                  )}
                  <button
                    type="button"
                    className="p-0 border-0 bg-transparent cursor-pointer hover:opacity-70 transition-opacity flex-shrink-0"
                    onClick={() => handleFileRemove(file)}
                    disabled={uploading}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            </Spin>
          )}
        >
          {(!value || value.length === 0 || (maxCount > 1 && value.length < maxCount)) && (
            <Button
              className={`w-full h-[37px] !border-[#E5E5E5] !rounded-xl hover:!border-[#155EEF] ${hasError ? '!border-[#F04438]' : ''}`}
              type="default"
              disabled={disabled || uploading}
              loading={uploading}
              icon={<Attachment size={16} color="#1C1F23" />}
              style={{ backgroundColor: 'transparent' }}
            >
              <span className="text-sm text-[rgba(28,31,35,0.35)]">
                {t('canvas.workflow.variables.upload') || 'Upload Files'}
              </span>
            </Button>
          )}
        </Upload>
      </div>
    );
  },
);

ResourceUpload.displayName = 'ResourceUpload';
