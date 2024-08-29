import { useState } from 'react';

// components
import { InvocationFormItems } from '@refly-packages/ai-workspace-common/components/skill/invocation-form-items';
import { useTranslation } from 'react-i18next';
// store
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

import { SkillInstance } from '@refly/openapi-schema';
import { Modal, Form, Message } from '@arco-design/web-react';

const FormItem = Form.Item;

const formItemLayout = {
  labelCol: {
    span: 4,
  },
  wrapperCol: {
    span: 20,
  },
};

interface InstanceInvokeModalProps {
  data: SkillInstance;
  visible: boolean;
  setVisible: (val: boolean) => void;
  postConfirmCallback?: () => void;
}

export const InstanceInvokeModal = (props: InstanceInvokeModalProps) => {
  const { visible, data, setVisible, postConfirmCallback } = props;
  const { t } = useTranslation();
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [form] = Form.useForm();

  const onOk = () => {
    form.validate().then(async (res) => {
      const { query, resourceIds, noteIds, collectionIds, contentList, urls } = res;
      setConfirmLoading(true);
      try {
        const { error: resultError } = await getClient().invokeSkill({
          body: {
            skillId: data.skillId,
            input: { query },
            context: {
              resourceIds,
              noteIds,
              collectionIds,
              contentList: contentList?.split(/\n\s*\n/),
              urls: urls?.split(/\n\s*\n/),
            },
          },
        });
        if (resultError) {
          Message.error({ content: t('common.putErr') });
        } else {
          Message.success({ content: t('common.putSuccess') });
        }
      } catch (error) {
        console.log(error);
        Message.error({ content: t('common.putErr') });
      }
      setConfirmLoading(false);
      setVisible(false);

      if (postConfirmCallback) {
        postConfirmCallback();
      }
    });
  };

  return (
    <Modal
      title={t('skill.instanceInvokeModal.title')}
      style={{ width: 750 }}
      visible={visible}
      onOk={onOk}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      confirmLoading={confirmLoading}
      onCancel={() => setVisible(false)}
    >
      <Form {...formItemLayout} form={form}>
        <InvocationFormItems invocationConfig={data?.invocationConfig} form={form} t={t} />
      </Form>
    </Modal>
  );
};
