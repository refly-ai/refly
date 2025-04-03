import { useEffect, useState } from 'react';
import { Form, Input, message, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useExportCanvasAsImage } from '@refly-packages/ai-workspace-common/hooks/use-export-canvas-as-image';

interface CreateTemplateModalProps {
  title: string;
  categoryId?: string;
  canvasId: string;
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

export const CreateTemplateModal = ({
  canvasId,
  title,
  categoryId,
  visible,
  setVisible,
}: CreateTemplateModalProps) => {
  const { t, i18n } = useTranslation();
  const [form] = Form.useForm();
  const [confirmLoading, setConfirmLoading] = useState(false);
  const { uploadCanvasCover } = useExportCanvasAsImage();

  const createTemplate = async ({ title, description }: { title: string; description: string }) => {
    if (confirmLoading) return;

    setConfirmLoading(true);
    const { storageKey } = await uploadCanvasCover();
    const { data } = await getClient().createCanvasTemplate({
      body: {
        title,
        description,
        language: i18n.language,
        categoryId,
        canvasId,
        coverStorageKey: storageKey,
      },
    });
    setConfirmLoading(false);
    if (data?.success) {
      setVisible(false);
      message.success(t('template.createSuccess'));
    }
  };

  const onSubmit = () => {
    form.validateFields().then((values) => {
      console.log(values);
      createTemplate(values);
    });
  };

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        title,
        description: '',
      });
    }
  }, [visible]);

  return (
    <Modal
      centered
      open={visible}
      onCancel={() => setVisible(false)}
      onOk={onSubmit}
      confirmLoading={confirmLoading}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      title={t('template.createTemplate')}
    >
      <div className="w-full h-full pt-4 overflow-y-auto">
        <Form form={form} labelCol={{ span: 5 }}>
          <Form.Item
            required
            label={t('template.templateTitle')}
            name="title"
            rules={[{ required: true, message: t('common.required') }]}
          >
            <Input placeholder={t('template.templateTitlePlaceholder')} />
          </Form.Item>
          <Form.Item label={t('template.templateDescription')} name="description">
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 6 }}
              placeholder={t('template.templateDescriptionPlaceholder')}
            />
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
};
