import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, message, Modal, Upload, Image, Switch, Spin } from 'antd';
import { PlusOutlined, LoadingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { getShareLink } from '@refly-packages/ai-workspace-common/utils/share';
import { Checked } from 'refly-icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { logEvent } from '@refly/telemetry-web';

interface CreateWorkflowAppModalProps {
  title: string;
  canvasId: string;
  visible: boolean;
  setVisible: (visible: boolean) => void;
  onPublishSuccess?: () => void;
  appId?: string; // Optional app ID to load existing app data
}

interface SuccessMessageProps {
  shareId: string;
  onClose?: () => void;
}

// Success message shown inside antd message with share link and copy action
const SuccessMessage = memo(({ shareId, onClose }: SuccessMessageProps) => {
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
    onClose?.();
  }, [onClose]);

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

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export const CreateWorkflowAppModal = ({
  canvasId,
  title,
  visible,
  setVisible,
  onPublishSuccess,
  appId,
}: CreateWorkflowAppModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Cover image upload state
  const [coverFileList, setCoverFileList] = useState<UploadFile[]>([]);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverStorageKey, setCoverStorageKey] = useState<string>('');

  // Preview state
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState<string>('');
  const [previewTitle, setPreviewTitle] = useState<string>('');

  // App data loading state
  const [appData, setAppData] = useState<any>(null);
  const [loadingAppData, setLoadingAppData] = useState(false);

  const { workflow, syncCanvasData } = useCanvasContext();
  const { workflowVariables } = workflow ?? {};

  // Load existing app data
  const loadAppData = useCallback(async (appId: string) => {
    if (!appId) return;

    setLoadingAppData(true);
    try {
      const { data } = await getClient().getWorkflowAppDetail({
        query: { appId },
      });

      if (data?.success && data?.data) {
        setAppData(data.data);
      }
    } catch (error) {
      console.error('Failed to load app data:', error);
    } finally {
      setLoadingAppData(false);
    }
  }, []);

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

  // Custom preview handler
  const handlePreview = useCallback(async (file: UploadFile) => {
    if (!file.url && !file.preview) {
      // Generate preview for local file
      file.preview = await getBase64(file.originFileObj as File);
    }

    setPreviewImage(file.url ?? file.preview ?? '');
    setPreviewTitle(file.name ?? file.fileName ?? 'Cover Image');
    setPreviewVisible(true);
  }, []);

  // Helper function to convert file to base64
  const getBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  // Handle preview modal close
  const handlePreviewCancel = useCallback(() => {
    setPreviewVisible(false);
  }, []);

  const createWorkflowApp = async ({
    title,
    description,
    remixEnabled,
  }: { title: string; description: string; remixEnabled: boolean }) => {
    if (confirmLoading) return;

    setConfirmLoading(true);

    try {
      const { data } = await getClient().createWorkflowApp({
        body: {
          title,
          description,
          canvasId,
          query: '', // TODO: support query edit
          variables: workflowVariables ?? [],
          coverStorageKey,
          remixEnabled,
        } as any,
      });

      const shareId = data?.data?.shareId ?? '';

      if (data?.success && shareId) {
        const workflowAppLink = getShareLink('workflowApp', shareId);

        // Copy to clipboard with error handling
        const copyToClipboard = async () => {
          try {
            await navigator.clipboard.writeText(workflowAppLink);
          } catch (error) {
            // Fallback for when document is not focused or clipboard API fails
            console.warn('Clipboard API failed, using fallback:', error);
            // Create a temporary textarea element for fallback copy
            const textarea = document.createElement('textarea');
            textarea.value = workflowAppLink;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
              document.execCommand('copy');
            } catch (fallbackError) {
              console.error('Fallback copy failed:', fallbackError);
              message.error('Failed to copy link to clipboard');
            }
            document.body.removeChild(textarea);
          }
        };

        // Copy to clipboard immediately after creation
        await copyToClipboard();

        setVisible(false);

        const messageInstance = messageApi.open({
          content: <SuccessMessage shareId={shareId} onClose={() => messageInstance()} />,
          duration: 0, // Set to 0 to prevent auto-close
        });

        onPublishSuccess?.();
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
    logEvent('publish_template', Date.now(), {
      canvas_id: canvasId,
    });

    try {
      // Make sure the canvas data is synced to the remote
      await syncCanvasData({ syncRemote: true });

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
      // Load existing app data if appId is provided
      if (appId) {
        loadAppData(appId);
      } else {
        // Reset to default values when creating new app
        form.setFieldsValue({
          title,
          description: '',
          remixEnabled: false, // Default to false (remix disabled)
        });
        setCoverFileList([]);
        setCoverStorageKey('');
        setAppData(null);
      }

      // Reset preview state
      setPreviewVisible(false);
      setPreviewImage('');
      setPreviewTitle('');
    }
  }, [visible, title, appId, loadAppData]);

  // Populate form with loaded app data
  useEffect(() => {
    if (appData && visible) {
      form.setFieldsValue({
        title: appData.title ?? title,
        description: appData.description ?? '',
        remixEnabled: appData.remixEnabled ?? false,
      });

      // Set cover image if exists
      if (appData.coverUrl) {
        setCoverFileList([
          {
            uid: '1',
            name: 'cover.jpg',
            status: 'done',
            url: appData.coverUrl,
          },
        ]);
        setCoverStorageKey(appData.coverUrl);
      } else {
        setCoverFileList([]);
        setCoverStorageKey('');
      }
    }
  }, [appData, visible, title, form]);

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
        {loadingAppData ? (
          <div className="flex items-center justify-center py-8">
            <Spin size="large" />
          </div>
        ) : (
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

              {/* Remix Settings */}
              <div className="flex flex-col gap-2 mt-5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="remix-enabled-switch"
                    className="text-xs font-semibold text-refly-text-0 leading-[1.33]"
                  >
                    {t('workflowApp.enableRemix')}
                  </label>
                  <Form.Item name="remixEnabled" valuePropName="checked" className="mb-0">
                    <Switch id="remix-enabled-switch" size="small" className="" />
                  </Form.Item>
                </div>
                <div className="text-xs text-refly-text-2">{t('workflowApp.remixHint')}</div>
              </div>

              {/* Cover Image Upload */}
              <div className="flex flex-col gap-2 mt-5">
                <div className="text-xs font-semibold text-refly-text-0 leading-[1.33]">
                  {t('workflowApp.coverImage')}
                </div>
                <div className="w-full">
                  <Upload
                    customRequest={customUploadRequest}
                    listType="picture-card"
                    fileList={coverFileList}
                    onChange={handleCoverUploadChange}
                    beforeUpload={beforeUpload}
                    onPreview={handlePreview}
                    accept={ALLOWED_IMAGE_TYPES.join(',')}
                    maxCount={1}
                    showUploadList={{
                      showPreviewIcon: true,
                      showRemoveIcon: true,
                      showDownloadIcon: false,
                    }}
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
            </div>
          </Form>
        )}
      </div>

      {/* Preview Modal */}
      <Modal
        open={previewVisible}
        title={previewTitle}
        footer={null}
        onCancel={handlePreviewCancel}
        centered
        width="auto"
        style={{ maxWidth: '90vw' }}
      >
        <Image
          alt="Cover Preview"
          style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain' }}
          src={previewImage}
          preview={false}
        />
      </Modal>
    </Modal>
  );
};
