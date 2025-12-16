import React, { useCallback, useMemo, useEffect } from 'react';
import { Form, Upload, Button, message, Select, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { Refresh, Delete, Close } from 'refly-icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import {
  FileIcon,
  defaultStyles,
} from '@refly-packages/ai-workspace-common/components/common/resource-icon';
import {
  RESOURCE_TYPE,
  ACCEPT_FILE_EXTENSIONS,
  IMAGE_FILE_EXTENSIONS,
  DOCUMENT_FILE_EXTENSIONS,
  AUDIO_FILE_EXTENSIONS,
  VIDEO_FILE_EXTENSIONS,
} from './constants';
import { getFileExtension } from './utils';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';

const { useWatch } = Form;

interface ResourceTypeFormProps {
  fileList: UploadFile[];
  uploading: boolean;
  onFileUpload: (file: File) => Promise<boolean>;
  onFileRemove: (file: UploadFile) => void;
  onRefreshFile: () => void;
  form?: any;
  showError?: boolean;
  isRequired?: boolean;
}

export const ResourceTypeForm: React.FC<ResourceTypeFormProps> = React.memo(
  ({
    fileList,
    uploading,
    onFileUpload,
    onFileRemove,
    onRefreshFile,
    form,
    showError,
    isRequired = true,
  }) => {
    const { t } = useTranslation();

    const selectedResourceTypes = useWatch('resourceTypes', form);

    const acceptedFileExtensions = useMemo(() => {
      try {
        if (!selectedResourceTypes || selectedResourceTypes.length === 0) {
          return ACCEPT_FILE_EXTENSIONS;
        }

        const extensions: string[] = [];
        for (const type of selectedResourceTypes) {
          switch (type) {
            case 'document':
              extensions.push(...DOCUMENT_FILE_EXTENSIONS);
              break;
            case 'image':
              extensions.push(...IMAGE_FILE_EXTENSIONS);
              break;
            case 'audio':
              extensions.push(...AUDIO_FILE_EXTENSIONS);
              break;
            case 'video':
              extensions.push(...VIDEO_FILE_EXTENSIONS);
              break;
            default:
              extensions.push(...ACCEPT_FILE_EXTENSIONS);
              break;
          }
        }

        return extensions.length > 0 ? extensions : ACCEPT_FILE_EXTENSIONS;
      } catch (error) {
        console.error('Error calculating accepted file extensions:', error);
        return ACCEPT_FILE_EXTENSIONS;
      }
    }, [selectedResourceTypes]);

    const options = useMemo(() => {
      return RESOURCE_TYPE.map((type) => ({
        label: t(`canvas.workflow.variables.resourceType.${type}`),
        value: type,
      }));
    }, [t]);

    useEffect(() => {
      if (!fileList?.length) {
        return;
      }

      const incompatibleFiles = fileList.filter((file) => {
        if (!file.name) return false;
        const fileExtension = getFileExtension(file.name);
        return !acceptedFileExtensions.includes(fileExtension);
      });

      if (incompatibleFiles.length > 0) {
        for (const file of incompatibleFiles) {
          onFileRemove(file);
        }
      }
    }, [acceptedFileExtensions, fileList, onFileRemove]);

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

    const getFileIconType = useCallback(
      (name: string) => {
        const extension = getFileExtension(name);
        if (IMAGE_FILE_EXTENSIONS.includes(extension)) {
          return 'image';
        }
        return extension;
      },
      [getFileExtension],
    );

    const tagRender = (props: any) => {
      const { label, value, closable, onClose } = props;
      const onPreventMouseDown = (event: React.MouseEvent<HTMLSpanElement>) => {
        event.preventDefault();
        event.stopPropagation();
      };
      return (
        <div
          className="h-5 box-border flex items-center px-1 py-0.5 border-[1px] border-solid border-refly-Card-Border rounded-[4px] text-xs leading-4 bg-refly-tertiary-default cursor-pointer mr-1"
          onMouseDown={onPreventMouseDown}
        >
          <NodeIcon type={value} filled={false} iconSize={16} small className="w-4 h-4" />
          <span className="text-refly-text-1">{label}</span>
          {closable && (
            <Close
              onClick={onClose}
              size={12}
              color="var(--refly-text-1)"
              className="ml-1 hover:bg-refly-tertiary-hover rounded-full"
            />
          )}
        </div>
      );
    };

    return (
      <>
        <Form.Item
          label={t('canvas.workflow.variables.resourceAcceptType') || 'Accept Types'}
          name="resourceTypes"
          initialValue={RESOURCE_TYPE}
          rules={[
            {
              required: true,
              message:
                t('canvas.workflow.variables.resourceTypesRequired') ||
                'Resource types are required',
            },
          ]}
        >
          <Select
            showSearch={false}
            mode="multiple"
            placeholder={
              t('canvas.workflow.variables.selectResourceTypes') || 'Select resource types'
            }
            className="w-full resource-type-select"
            options={options}
            tagRender={tagRender}
          />
        </Form.Item>
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
            multiple={false}
            accept={acceptedFileExtensions.map((ext) => `.${ext}`).join(',')}
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
        {showError && (
          <div className="text-red-500 text-xs -mt-4 mb-4">
            {t('canvas.workflow.variables.uploadBeforeRunning') ||
              'Upload a file before running Agent.'}
          </div>
        )}
      </>
    );
  },
);

ResourceTypeForm.displayName = 'ResourceTypeForm';
