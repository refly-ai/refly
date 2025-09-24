import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, message, Modal, Upload, Select } from 'antd';
import { PlusOutlined, LoadingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { getShareLink } from '@refly-packages/ai-workspace-common/utils/share';
import { Checked } from 'refly-icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';

interface CreateWorkflowAppModalProps {
  title: string;
  canvasId: string;
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

interface SuccessMessageProps {
  shareId: string;
}

// Success message shown inside antd message with share link and copy action
const SuccessMessage = memo(({ shareId }: SuccessMessageProps) => {
  const { t } = useTranslation();
  const shareLink = useMemo(() => getShareLink('workflowApp', shareId), [shareId]);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!shareLink) return;
    try {
      copyToClipboard(shareLink);
      setCopied(true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to copy link:', err);
    }
  }, [shareLink]);

  const handleClose = useCallback(() => {
    message.destroy();
  }, []);

  // Auto copy link when component mounts
  useEffect(() => {
    if (shareLink) {
      handleCopy();
    }
  }, [shareLink, handleCopy]);

  return (
    <div className="flex items-center gap-2">
      <Checked size={20} color="var(--refly-func-success-default)" />
      <span className="text-base font-medium text-refly-text-0">
        {t('workflowApp.publishSuccess')}
      </span>
      <div className="flex items-center gap-2 border border-refly-Card-Border bg-refly-bg-content-z1 rounded-full pl-3 pr-1 py-1 max-w-[500px]">
        <span className="flex-1 text-sm text-refly-text-1 max-w-[260px] overflow-hidden text-ellipsis whitespace-nowrap">
          {shareLink}
        </span>
        <Button
          size="small"
          className="!h-[28px] !px-3 rounded-full text-sm text-refly-text-0"
          onClick={handleCopy}
        >
          {copied ? t('shareContent.linkCopied') : t('shareContent.copyLink')}
        </Button>
        <Button
          size="small"
          className="!h-[28px] !px-2 rounded-full text-sm text-refly-text-2 hover:text-refly-text-0"
          onClick={handleClose}
          type="text"
        >
          ×
        </Button>
      </div>
    </div>
  );
});

SuccessMessage.displayName = 'SuccessMessage';

// Predefined categories
const CATEGORY_OPTIONS = [
  { label: '🎓 教育', value: 'education' },
  { label: '💼 商业', value: 'business' },
  { label: '🎨 创意', value: 'creative' },
  { label: '💰 销售', value: 'sales' },
  { label: '🏠 生活', value: 'life' },
];

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export const CreateWorkflowAppModal = ({
  canvasId,
  title,
  visible,
  setVisible,
}: CreateWorkflowAppModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Cover image upload state
  const [coverFileList, setCoverFileList] = useState<UploadFile[]>([]);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverStorageKey, setCoverStorageKey] = useState<string>('');

  // Category tags state
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['education']);

  const { workflow } = useCanvasContext();
  const { workflowVariables } = workflow ?? {};

  // Handle cover image upload
  const uploadCoverImage = async (file: File): Promise<string> => {
    try {
      const { data } = await getClient().upload({
        body: {
          file,
          entityType: 'workflowApp',
          visibility: 'public',
        },
      });

      if (data?.success && data?.data?.storageKey) {
        return data.data.storageKey;
      }
      throw new Error('Upload failed');
    } catch (error) {
      console.error('Error uploading cover image:', error);
      throw error;
    }
  };

  // Handle cover upload change
  const handleCoverUploadChange: UploadProps['onChange'] = (info) => {
    setCoverFileList(info.fileList);
  };

  // Custom upload request for cover image
  const customUploadRequest: UploadProps['customRequest'] = async ({
    file,
    onSuccess,
    onError,
  }) => {
    setCoverUploading(true);
    try {
      const storageKey = await uploadCoverImage(file as File);
      setCoverStorageKey(storageKey);
      onSuccess?.(storageKey);
      message.success(t('common.uploadSuccess'));
    } catch (error) {
      onError?.(error as Error);
      message.error(t('common.uploadFailed'));
    } finally {
      setCoverUploading(false);
    }
  };

  // Before upload validation
  const beforeUpload = (file: File) => {
    const isAllowedType = ALLOWED_IMAGE_TYPES.includes(file.type);
    if (!isAllowedType) {
      message.error(t('workflowApp.invalidImageType'));
      return false;
    }

    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error(t('workflowApp.imageTooLarge'));
      return false;
    }

    return true;
  };

  const createWorkflowApp = async ({
    title,
    description,
  }: { title: string; description: string }) => {
    if (confirmLoading) return;

    setConfirmLoading(true);

    try {
      // Validate cover image is uploaded
      if (!coverStorageKey) {
        message.error(t('workflowApp.coverImageRequired'));
        return;
      }

      const { data } = await getClient().createWorkflowApp({
        body: {
          title,
          description,
          canvasId,
          query: '', // TODO: support query edit
          variables: workflowVariables ?? [],
          coverStorageKey,
          categoryTags: selectedCategories,
        } as any,
      });

      const shareId = data?.data?.shareId ?? '';

      if (data?.success && shareId) {
        setVisible(false);
        messageApi.open({ content: <SuccessMessage shareId={shareId} />, duration: 5 });
      } else if (!data?.success) {
        message.error(t('common.operationFailed'));
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error creating workflow app', error);
      message.error(t('common.operationFailed'));
    } finally {
      setConfirmLoading(false);
    }
  };

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      await createWorkflowApp(values);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error validating form fields', error);
    }
  };

  // Reset form state when modal opens
  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        title,
        description: '',
      });
      setCoverFileList([]);
      setCoverStorageKey('');
      setSelectedCategories(['education']);
    }
  }, [visible, title]);

  // Upload button component
  const uploadButton = (
    <div>
      {coverUploading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8 }}>{t('workflowApp.uploadCover')}</div>
    </div>
  );

  return (
    <Modal
      centered
      open={visible}
      onCancel={() => setVisible(false)}
      onOk={onSubmit}
      confirmLoading={confirmLoading}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      title={t('workflowApp.publish')}
    >
      {contextHolder}
      <div className="w-full h-full pt-4 overflow-y-auto">
        <Form form={form}>
          <div className="flex flex-col gap-2">
            {/* Title Field */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="title-input"
                className="text-xs font-semibold text-refly-text-0 leading-[1.33]"
              >
                {t('workflowApp.title')}
                <span className="text-refly-func-danger-default ml-1">*</span>
              </label>
              <Form.Item
                name="title"
                rules={[{ required: true, message: t('common.required') }]}
                className="mb-0"
              >
                <Input
                  id="title-input"
                  placeholder={t('workflowApp.titlePlaceholder')}
                  className="h-8 rounded-lg border-0 bg-refly-bg-control-z0 px-3 text-sm font-normal text-refly-text-0 placeholder:text-refly-text-3 focus:bg-refly-bg-control-z0 focus:shadow-sm"
                />
              </Form.Item>
            </div>

            {/* Description Field */}
            <div className="flex flex-col gap-2 mt-5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="description-input"
                  className="text-xs font-semibold text-refly-text-0 leading-[1.33]"
                >
                  {t('workflowApp.description')}
                </label>
              </div>
              <Form.Item name="description" className="mb-0">
                <Input.TextArea
                  id="description-input"
                  placeholder={t('workflowApp.descriptionPlaceholder')}
                  className="min-h-[80px] rounded-lg border-0 bg-refly-bg-control-z0 px-3 py-2 text-sm font-normal text-refly-text-0 placeholder:text-refly-text-3 focus:bg-refly-bg-control-z0 focus:shadow-sm"
                  autoSize={{ minRows: 3, maxRows: 6 }}
                />
              </Form.Item>
            </div>

            {/* Cover Image Upload */}
            <div className="flex flex-col gap-2 mt-5">
              <div className="text-xs font-semibold text-refly-text-0 leading-[1.33]">
                {t('workflowApp.coverImage')}
                <span className="text-refly-func-danger-default ml-1">*</span>
              </div>
              <div className="w-full">
                <Upload
                  customRequest={customUploadRequest}
                  listType="picture-card"
                  fileList={coverFileList}
                  onChange={handleCoverUploadChange}
                  beforeUpload={beforeUpload}
                  accept={ALLOWED_IMAGE_TYPES.join(',')}
                  maxCount={1}
                  className="cover-upload"
                  style={
                    {
                      // Custom styles for cover upload
                      '--upload-card-width': '100px',
                      '--upload-card-height': '100px',
                    } as React.CSSProperties
                  }
                >
                  {coverFileList.length >= 1 ? null : uploadButton}
                </Upload>
                <div className="text-xs text-refly-text-2 mt-1">
                  {t('workflowApp.coverImageHint')}
                </div>
              </div>
            </div>

            {/* Category Tags */}
            <div className="flex flex-col gap-2 mt-5">
              <div className="text-xs font-semibold text-refly-text-0 leading-[1.33]">
                {t('workflowApp.categoryTags')}
              </div>
              <Select
                mode="multiple"
                placeholder={t('workflowApp.selectCategories')}
                value={selectedCategories}
                onChange={setSelectedCategories}
                options={CATEGORY_OPTIONS}
                maxTagCount={3}
                className="h-8 rounded-lg border-0 bg-refly-bg-control-z0"
                size="middle"
                style={{
                  // Custom styles for category select
                  backgroundColor: 'var(--refly-bg-control-z0)',
                  borderRadius: '8px',
                }}
              />
              <div className="text-xs text-refly-text-2">{t('workflowApp.categoryTagsHint')}</div>
            </div>
          </div>
        </Form>
      </div>
    </Modal>
  );
};
