import React, { memo, useCallback, useState } from 'react';
import { Upload } from 'antd';
import { Attachment } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import { useFileUpload } from '../../canvas/workflow-variables';
import { getFileType } from '../../canvas/workflow-variables/utils';

import { FileInputProps } from './types';

// Loading dots animation component
const LoadingDots: React.FC = () => {
  const dotStyle: React.CSSProperties = {
    width: '4px',
    height: '4px',
    backgroundColor: '#0E9F77',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'bounce 1.4s infinite ease-in-out both',
  };

  return (
    <>
      <style>
        {`
          @keyframes bounce {
            0%, 80%, 100% {
              transform: scale(0.75);
              opacity: 0.7;
            }
            40% {
              transform: scale(1.5);
              opacity: 1;
            }
          }
        `}
      </style>
      <div
        style={{
          width: '24px',
          height: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginLeft: '8px',
          marginRight: '8px',
        }}
      >
        <div style={{ ...dotStyle, animationDelay: '-0.32s' }} />
        <div style={{ ...dotStyle, animationDelay: '-0.16s' }} />
        <div style={{ ...dotStyle, animationDelay: '0s' }} />
      </div>
    </>
  );
};

const FileInput: React.FC<FileInputProps> = memo(
  ({
    value,
    placeholder,
    onChange,
    disabled = false,
    accept = '*',
    isDefaultValue = false,
    isModified = false,
    onUploadingChange,
    onBeforeUpload,
  }) => {
    const { t } = useTranslation();
    const [isHovered, setIsHovered] = useState(false);
    const [uploading, setUploading] = useState(false);
    const { handleFileUpload: uploadFile } = useFileUpload();
    const fileName = value?.name || '';
    const isEmpty = !fileName || fileName.trim() === '';

    const handleFileChange = useCallback(
      async (file: File) => {
        // Check if upload should be prevented
        if (onBeforeUpload && !onBeforeUpload()) {
          return;
        }

        try {
          setUploading(true);
          onUploadingChange?.(true);
          // Upload file and get storageKey
          const result = await uploadFile(file, []);

          if (result && typeof result === 'object' && 'storageKey' in result) {
            // Create resource object with actual storageKey
            const resource = {
              name: file.name,
              storageKey: result.storageKey,
              fileType: getFileType(file.name, file.type),
            };
            onChange(resource);
          }
        } catch (error) {
          console.error('File upload failed:', error);
        } finally {
          setUploading(false);
          onUploadingChange?.(false);
        }
      },
      [onChange, uploadFile, onUploadingChange],
    );

    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
    }, []);

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
    }, []);

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        // Check if upload should be prevented on click
        if (onBeforeUpload && !onBeforeUpload()) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      },
      [onBeforeUpload],
    );

    return (
      <Upload
        accept={accept}
        showUploadList={false}
        beforeUpload={(file) => {
          handleFileChange(file);
          return false; // Prevent default upload
        }}
        disabled={disabled || uploading}
      >
        <div
          className={`
            inline-flex items-center justify-between min-w-[30px] cursor-pointer
            border-b border-dashed border-refly-Card-Border rounded-none
            transition-all duration-200 ease-in-out
            ${isHovered ? 'border-refly-primary-hover' : 'border-refly-Card-Border'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            hover:border-refly-primary-hover
            text-refly-primary-default
          `}
          style={{
            borderWidth: '0 0 1.5px 0',
            borderStyle: 'dashed',
            borderColor: 'var(--refly-primary-default)',
            backgroundColor: 'transparent',
            borderRadius: '0',
            margin: '0 8px',
            height: '26px',
            fontFamily: 'PingFang SC',
            fontSize: '16px',
            fontStyle: 'normal',
            fontWeight: isEmpty ? '400' : '500',
            lineHeight: '26px',
            color: isEmpty
              ? 'var(--refly-text-2)'
              : isDefaultValue
                ? 'var(--refly-primary-default)'
                : isModified
                  ? 'var(--refly-primary-default)'
                  : 'var(--refly-primary-default)',
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          title={
            uploading
              ? t('common.upload.notification.uploading', { count: 1 })
              : fileName || placeholder || t('canvas.workflow.variables.uploadPlaceholder')
          }
        >
          <Attachment size={16} color="var(--refly-primary-default)" />
          {uploading ? (
            <div className="flex-1 flex items-center">
              <LoadingDots />
            </div>
          ) : (
            <span className="flex-1 ml-1 truncate max-w-[200px] min-w-0">
              {fileName || placeholder || t('canvas.workflow.variables.uploadPlaceholder')}
            </span>
          )}
        </div>
      </Upload>
    );
  },
);

FileInput.displayName = 'FileInput';

export default FileInput;
