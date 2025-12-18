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
}

export const ResourceTypeForm: React.FC<ResourceTypeFormProps> = React.memo(
  ({ fileList, uploading, onFileUpload, onFileRemove, onRefreshFile }) => {
    const { t } = useTranslation();

    const handleUpload = useCallback(
      async (file: File) => {
        return await onFileUpload(file);
      },
      [onFileUpload],
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
        message.error(`${info.file.name} upload failed`);
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
          required
          label={t('canvas.workflow.variables.value') || 'Variable Value'}
          name="value"
          rules={[
            {
              required: true,
              message:
                t('canvas.workflow.variables.fileRequired') || 'Please upload at least one file',
            },
          ]}
        >
          <Upload
            className="file-upload-container"
            fileList={fileList}
            beforeUpload={handleUpload}
            onRemove={handleRemove}
            onChange={handleChange}
            multiple={false}
            listType="text"
            disabled={uploading}
            maxCount={1}
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

                  <div className="fl">
                    <Tooltip title={t('canvas.workflow.variables.replaceFile')}>
                      <Button
                        size="small"
                        type="text"
                        icon={<Refresh size={16} color="var(--refly-text-1)" />}
                        onClick={onRefreshFile}
                      />
                    </Tooltip>

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
            {fileList.length === 0 && (
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
      </>
    );
  },
);

ResourceTypeForm.displayName = 'ResourceTypeForm';
