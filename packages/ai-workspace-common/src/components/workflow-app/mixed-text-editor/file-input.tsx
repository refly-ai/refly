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
            inline-flex items-center justify-between min-w-[60px] cursor-pointer
            border border-dashed rounded-lg
            transition-all duration-200 ease-in-out
            ${
              isHovered
                ? 'border-[rgba(14,159,119,0.4)] bg-[#F0FFF8]'
                : 'border-[rgba(14,159,119,0.3)] bg-[#EBFFF9]'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            hover:border-[rgba(14,159,119,0.4)]
            hover:bg-[#F0FFF8]
            text-[#0E9F77]
          `}
          style={{
            borderWidth: '0.5px',
            borderStyle: 'dashed',
            borderColor: isHovered
              ? 'rgba(14,159,119,0.4)'
              : isEmpty
                ? 'rgba(14,159,119,0.15)' // Empty value: lightest border
                : isDefaultValue
                  ? 'rgba(14,159,119,0.3)' // Default value: medium border
                  : isModified
                    ? 'rgba(14,159,119,0.5)' // Modified value: darkest border
                    : 'rgba(14,159,119,0.3)',
            backgroundColor: isHovered
              ? '#F0FFF8'
              : isEmpty
                ? '#F0F9F7' // Empty value: lightest background
                : isDefaultValue
                  ? '#E8F5F2' // Default value: medium background
                  : isModified
                    ? '#EBFFF9' // Modified value: darkest background
                    : '#EBFFF9',
            borderRadius: '8px',
            padding: '4px 8px',
            height: '26px',
            fontFamily:
              'PingFang SC, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '16px',
            lineHeight: '1.625em',
            color: isEmpty
              ? '#7FB3A3' // Empty value: light green font
              : isDefaultValue
                ? '#0E9F77' // Default value: normal green font
                : isModified
                  ? '#0E9F77' // Modified value: normal green font
                  : '#0E9F77', // Green font
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <Attachment size={16} color="#0E9F77" />
          <span className="flex-1 ml-1">
            {fileName || placeholder || t('canvas.workflow.variables.uploadPlaceholder')}
          </span>
        </div>
      </Upload>
    );
  },
);

FileInput.displayName = 'FileInput';

export default FileInput;
