import { useState, useEffect } from 'react';

// components
import { useTranslation } from 'react-i18next';
// store
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

import { SkillInstance, SkillTemplate } from '@refly/openapi-schema';

import { Collapse, Modal, Form, Input, Message } from '@arco-design/web-react';
import { TemplateConfigFormItems } from '@refly-packages/ai-workspace-common/components/skill/template-config-form-items';

const CollapseItem = Collapse.Item;
const FormItem = Form.Item;
const TextArea = Input.TextArea;

type modalType = 'new' | 'update';

interface NewSkillInstanceModalProps {
  type: modalType;
  instance?: SkillInstance;
  template?: SkillTemplate;
  visible: boolean;
  setVisible: (val: boolean) => void;
  postConfirmCallback?: () => void;
}

export const NewSkillInstanceModal = (props: NewSkillInstanceModalProps) => {
  const { type, visible, instance, template, setVisible, postConfirmCallback } = props;
  const { t } = useTranslation();
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [form] = Form.useForm();

  const onOk = () => {
    form.validate().then(async (res) => {
      setConfirmLoading(true);
      let resultError: unknown;
      try {
        if (type === 'new' && template) {
          const { error } = await getClient().createSkillInstance({
            body: { instanceList: [{ ...res, tplName: template.name }] },
          });
          resultError = error;
        }
        if (type === 'update' && instance) {
          const { error } = await getClient().updateSkillInstance({
            body: { ...res, skillId: instance.skillId },
          });
          resultError = error;
        }
      } catch (error) {
        console.log(error);
      }
      setConfirmLoading(false);
      setVisible(false);
      if (resultError) {
        console.error(resultError);
        Message.error({ content: t('common.putErr') });
      } else {
        Message.success({ content: t('common.putSuccess') });
      }
      if (postConfirmCallback) {
        postConfirmCallback();
      }
    });
  };

  useEffect(() => {
    if (visible) {
      const { displayName, description } = type === 'new' ? template : instance;
      form.setFieldsValue({ displayName, description });
    }
  }, [visible]);

  const formItemLayout = {
    labelCol: {
      span: 4,
    },
    wrapperCol: {
      span: 20,
    },
  };

  const configSchema = type === 'new' ? template?.configSchema : instance?.tplConfigSchema;

  return (
    <Modal
      title={t(`skill.newSkillModal.${type}Title`)}
      style={{ width: 800 }}
      visible={visible}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      onOk={onOk}
      confirmLoading={confirmLoading}
      onCancel={() => setVisible(false)}
    >
      <Form {...formItemLayout} form={form}>
        <Collapse bordered={false} defaultActiveKey={['basicInfo', 'templateConfig']}>
          <CollapseItem name="basicInfo" header={t('skill.newSkillModal.basicInfo')}>
            <FormItem
              label={t('skill.newSkillModal.name')}
              required
              field="displayName"
              rules={[{ required: true, message: t('skill.newSkillModal.namePlaceholder') }]}
            >
              <Input placeholder={t('skill.newSkillModal.namePlaceholder')} maxLength={50} showWordLimit />
            </FormItem>
            <FormItem
              label={t('skill.newSkillModal.description')}
              required
              field="description"
              rules={[{ required: true, message: t('skill.newSkillModal.descriptionPlaceholder') }]}
            >
              <TextArea
                placeholder={t('skill.newSkillModal.descriptionPlaceholder')}
                autoSize
                maxLength={500}
                showWordLimit
                style={{ minHeight: 84 }}
              />
            </FormItem>
          </CollapseItem>

          {configSchema?.items?.length > 0 && (
            <CollapseItem name="templateConfig" header={t('skill.newSkillModal.templateConfig')}>
              <TemplateConfigFormItems
                schema={configSchema}
                form={form}
                fieldPrefix="tplConfig"
                tplConfig={instance?.tplConfig}
              />
            </CollapseItem>
          )}
        </Collapse>
      </Form>
    </Modal>
  );
};
