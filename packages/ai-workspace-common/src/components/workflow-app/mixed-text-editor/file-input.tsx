import React, { memo, useCallback, useState } from 'react';
import { Upload } from 'antd';
import { Attachment } from 'refly-icons';
import { useTranslation } from 'react-i18next';

interface FileInputProps {
  id: string;
  value?: any;
  placeholder?: string;
  onChange: (value: any) => void;
  disabled?: boolean;
  accept?: string;
  isDefaultValue?: boolean; // Whether this is a default value
  isModified?: boolean; // Whether the value has been modified by user
}

const FileInput: React.FC<FileInputProps> = memo(
  ({
    value,
    placeholder,
    onChange,
    disabled = false,
    accept = '*',
    isDefaultValue = false,
    isModified = false,
  }) => {
    const { t } = useTranslation();
    const [isHovered, setIsHovered] = useState(false);
    const fileName = value?.name || '';
    const isEmpty = !fileName || fileName.trim() === '';

    const handleFileChange = useCallback(
      (file: File) => {
        // Create resource object
        const resource = {
          name: file.name,
          storageKey: '', // This would be set after upload
          fileType: file.type.split('/')[0] as any, // Extract file type
          entityId: '', // This would be set after upload
        };
        onChange(resource);
      },
      [onChange],
    );

    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
    }, []);

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
    }, []);

    return (
      <Upload
        accept={accept}
        showUploadList={false}
        beforeUpload={(file) => {
          handleFileChange(file);
          return false; // Prevent default upload
        }}
        disabled={disabled}
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
          title={fileName || placeholder || t('canvas.workflow.variables.uploadPlaceholder')}
        >
          <Attachment size={16} color="var(--refly-primary-default)" />
          <span className="flex-1 ml-1 truncate max-w-[200px] min-w-0">
            {fileName || placeholder || t('canvas.workflow.variables.uploadPlaceholder')}
          </span>
        </div>
      </Upload>
    );
  },
);

FileInput.displayName = 'FileInput';

export default FileInput;
