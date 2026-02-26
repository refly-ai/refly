import React, { useCallback } from 'react';
import { Form, Upload, Button, message, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { Refresh, Delete } from 'refly-icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import {
  FileIcon,
  defaultStyles,
} from '@refly-packages/ai-workspace-common/components/common/resource-icon';
import { IMAGE_FILE_EXTENSIONS } from './constants';
import { getFileExtension } from './utils';

interface ResourceTypeFormProps {
  fileList: UploadFile[];
  uploading: boolean;
  onFileUpload: (file: File) => Promise<boolean>;
  onFileRemove: (file: UploadFile) => void;
  onRefreshFile: () => void;
  form?: any;
  showError?: boolean;
  isRequired?: boolean;
  isSingle?: boolean;
}

const MAX_FILES = 10;

export const ResourceTypeForm: React.FC<ResourceTypeFormProps> = React.memo(
  ({
    fileList,
    uploading,
    onFileUpload,
    onFileRemove,
    onRefreshFile,
    showError,
    isRequired = true,
    isSingle = false,
  }) => {
    const { t } = useTranslation();

    const handleUpload = useCallback(
      async (file: File, batchFileList: File[]) => {
        if (!isSingle) {
          const remainingSlots = MAX_FILES - fileList.length;
          if (remainingSlots <= 0) {
            if (batchFileList?.[0] === file) {
              message.error({
                content: t('canvas.workflow.variables.tooManyFiles', { max: MAX_FILES }),
                key: 'too-many-files-error',
              });
            }
            return Upload.LIST_IGNORE;
          }

          const batchIndex = Array.isArray(batchFileList) ? batchFileList.indexOf(file) : -1;
          if (batchIndex >= remainingSlots) {
            if (batchIndex === remainingSlots) {
              message.error({
                content: t('canvas.workflow.variables.tooManyFiles', { max: MAX_FILES }),
                key: 'too-many-files-error',
              });
            }
            return Upload.LIST_IGNORE;
          }
        }

        return await onFileUpload(file);
      },
      [onFileUpload, fileList, isSingle, t],
    );

    const handleRemove = useCallback(
      (file: UploadFile) => {
        onFileRemove(file);
      },
      [onFileRemove],
    );

    const handleChange = useCallback((info: any) => {
      // Handle file status changes
      if (info.file.status === 'uploading') {
        // Uploading state is handled by parent
      } else if (info.file.status === 'done') {
        // Done state is handled by parent
      } else if (info.file.status === 'error') {
        message.error({
          content: `${info.file.name} upload failed`,
          key: 'upload-failed-error',
        });
      }
    }, []);

    const getFileIconType = useCallback((name: string) => {
      const extension = getFileExtension(name);
      if (IMAGE_FILE_EXTENSIONS.includes(extension)) {
        return 'image';
      }
      return extension;
    }, []);

    return (
      <>
        <Form.Item
          required={isRequired}
          label={t('canvas.workflow.variables.value') || 'Variable Value'}
          name="value"
          rules={
            isRequired
              ? [
                  {
                    required: true,
                    message:
                      t('canvas.workflow.variables.fileRequired') ||
                      'Please upload at least one file',
                  },
                ]
              : []
          }
        >
          <Upload
            className="file-upload-container"
            fileList={fileList}
            beforeUpload={handleUpload}
            onRemove={handleRemove}
            onChange={handleChange}
            multiple={!isSingle}
            listType="text"
            disabled={uploading}
            itemRender={(_originNode, file) => (
              <Spin className="w-full" spinning={file.status === 'uploading'}>
                <div className="w-full h-10 flex items-center justify-between gap-3 box-border px-3 bg-refly-bg-control-z0 rounded-lg hover:bg-refly-tertiary-hover transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileIcon
                      extension={getFileIconType(file.name || '')}
                      width={24}
                      height={24}
                      type="icon"
                      {...defaultStyles[getFileIconType(file.name || '')]}
                    />
                    <div className="min-w-0 flex-1 text-sm text-refly-text-0 leading-5 truncate">
                      {file.name}
                    </div>
                  </div>

                  <div className="fl">
                    {isSingle && (
                      <Tooltip title={t('canvas.workflow.variables.replaceFile')}>
                        <Button
                          size="small"
                          type="text"
                          icon={<Refresh size={16} color="var(--refly-text-1)" />}
                          onClick={onRefreshFile}
                        />
                      </Tooltip>
                    )}

                    <Button
                      size="small"
                      type="text"
                      icon={<Delete size={16} color="var(--refly-text-1)" />}
                      onClick={() => handleRemove(file)}
                    />
                  </div>
                </div>
              </Spin>
            )}
          >
            {(fileList.length === 0 || (!isSingle && fileList.length < MAX_FILES)) && (
              <Button
                className="w-full bg-refly-bg-control-z0 border-none"
                type="default"
                disabled={uploading}
                loading={uploading}
              >
                {t('canvas.workflow.variables.upload') || 'Upload Files'}
              </Button>
            )}
          </Upload>
        </Form.Item>
        {showError && (
          <div className="text-red-500 text-xs mt-1 mb-2">
            {t('canvas.workflow.variables.uploadBeforeRunning') ||
              'Upload a file before running Agent.'}
          </div>
        )}
      </>
    );
  },
);

ResourceTypeForm.displayName = 'ResourceTypeForm';
