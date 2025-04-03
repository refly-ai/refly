import { memo, useEffect, useState } from 'react';
import { Checkbox, Form, Input, Modal, message } from 'antd';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useNavigate } from 'react-router-dom';
import { useHandleSiderData } from '@refly-packages/ai-workspace-common/hooks/use-handle-sider-data';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';

type FieldType = {
  title: string;
  duplicateEntities?: boolean;
};

interface DuplicateCanvasModalProps {
  canvasId: string;
  canvasName?: string;
  visible: boolean;
  setVisible: (visible: boolean) => void;
}

export const DuplicateCanvasModal = memo(
  ({ canvasId, canvasName, visible, setVisible }: DuplicateCanvasModalProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const { getCanvasList } = useHandleSiderData();
    const { projectId } = useGetProjectCanvasId();

    const onSubmit = async () => {
      form.validateFields().then(async (values) => {
        if (loading) return;
        setLoading(true);
        const { title, duplicateEntities } = values;
        const { data } = await getClient().duplicateCanvas({
          body: {
            projectId,
            canvasId,
            title,
            duplicateEntities,
          },
        });
        setLoading(false);

        if (data?.success && data?.data?.canvasId) {
          message.success(t('canvas.action.duplicateSuccess'));
          setVisible(false);
          getCanvasList();
          const newCanvasId = data.data.canvasId;
          const url = projectId
            ? `/project/${projectId}?canvasId=${newCanvasId}`
            : `/canvas/${newCanvasId}`;
          navigate(url);
        }
      });
    };

    useEffect(() => {
      if (visible) {
        form.resetFields();
        form.setFieldValue('duplicateEntities', false);
        form.setFieldValue('title', canvasName);
      }
    }, [visible]);

    return (
      <Modal
        centered
        open={visible}
        onCancel={() => setVisible(false)}
        onOk={onSubmit}
        confirmLoading={loading}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        title={t('template.duplicateCanvas')}
      >
        <div className="w-full h-full overflow-y-auto mt-3">
          <Form form={form} autoComplete="off">
            <Form.Item<FieldType>
              required
              label={t('template.canvasTitle')}
              name="title"
              className="mb-3"
              rules={[{ required: true, message: t('common.required') }]}
            >
              <Input placeholder={t('template.duplicateCanvasTitlePlaceholder')} />
            </Form.Item>

            <Form.Item className="ml-2.5" name="duplicateEntities" valuePropName="checked">
              <Checkbox>
                <span className="text-sm">{t('template.duplicateCanvasEntities')}</span>
              </Checkbox>
            </Form.Item>
          </Form>
        </div>
      </Modal>
    );
  },
);

DuplicateCanvasModal.displayName = 'DuplicateCanvasModal';
