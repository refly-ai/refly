import { useState, useEffect } from 'react';

// components
import { useCreateTrigger } from '@refly-packages/ai-workspace-common/hooks/use-create-trigger';
import { useImportNewTriggerModal } from '@refly-packages/ai-workspace-common/stores/import-new-trigger-modal';
import { InvocationFormItems } from '@refly-packages/ai-workspace-common/components/skill/invocation-form-items';
import { useTranslation } from 'react-i18next';

import { SkillInstance } from '@refly/openapi-schema';

import { Modal, Form, Input, Message, Select, DatePicker } from '@arco-design/web-react';
const FormItem = Form.Item;
const Option = Select.Option;

const formItemLayout = {
  labelCol: {
    span: 5,
  },
  wrapperCol: {
    span: 19,
  },
};

const triggerType = ['timer', 'simpleEvent'];
const repeatInterval = ['hour', 'day', 'week', 'month', 'year'];
const fromFieldMap = {
  query: 'input.query',
  resourceIds: 'context.resourceIds',
  noteIds: 'context.noteIds',
  collectionIds: 'context.collectionIds',
  contentList: 'input.contentList',
  urls: 'input.urls',
};

interface NewTriggersModalProps {
  data: SkillInstance;
}

export const NewTriggersModal = (props: NewTriggersModalProps) => {
  const importNewTriggerModal = useImportNewTriggerModal();
  const createTrigger = useCreateTrigger();
  const { data } = props;
  const { t } = useTranslation();
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [form] = Form.useForm();
  const [_triggerType, setTriggerType] = useState('');

  const onOk = () => {
    form.validate().then(async (res) => {
      console.log('res111', res);
      const { contentList, urls } = res?.context || {};
      const qrams = {
        ...res,
        context: {
          ...res?.context,
          contentList: contentList?.split(/\n\s*\n/),
          urls: urls?.split(/\n\s*\n/),
        },
      };
      setConfirmLoading(true);
      let resultError: unknown;
      try {
        if (!importNewTriggerModal.trigger) {
          const error = await createTrigger.createTrigger({ ...qrams, skillId: data.skillId });
          resultError = error;
        } else {
          const error = await createTrigger.updateTrigger({
            ...qrams,
            triggerId: importNewTriggerModal.trigger.triggerId,
          });
          resultError = error;
        }
      } catch (error) {
        console.log(error);
      }
      setConfirmLoading(false);
      importNewTriggerModal.setShowtriggerModall(false);
      if (resultError) {
        console.error(resultError);
        Message.error({ content: t('common.putErr') });
      } else {
        Message.success({ content: t('common.putSuccess') });
        importNewTriggerModal.setReloadTriggerList(true);
      }
    });
  };

  useEffect(() => {
    if (!importNewTriggerModal.showtriggerModal) {
      setTriggerType('');
      importNewTriggerModal.setTrigger(null);
      form.clearFields();
    } else {
      if (importNewTriggerModal.trigger) {
        const trigger = importNewTriggerModal.trigger;
        console.log('importNewTriggerModal.trigger', trigger);
        const { context } = trigger;

        const formValue = {
          ...trigger,
          context: {
            ...context,
            contentList: context?.contentList?.join('\n'),
            urls: context?.urls?.join('\n'),
          },
        };

        // if (!('urls' in context)) {
        //   delete formValue.context.urls;
        // }
        // if (!('contentList' in context)) {
        //   delete formValue.context.contentList;
        // }
        console.log('formValue', formValue);

        form.setFieldsValue(formValue);
        setTriggerType(importNewTriggerModal.trigger.triggerType);
      }
    }
  }, [importNewTriggerModal.showtriggerModal]);

  return (
    <Modal
      title={t(`skill.newTriggerModal.${importNewTriggerModal.trigger ? 'update' : 'new'}Title`)}
      style={{ width: 700 }}
      visible={importNewTriggerModal.showtriggerModal}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      onOk={onOk}
      confirmLoading={confirmLoading}
      onCancel={() => importNewTriggerModal.setShowtriggerModall(false)}
    >
      <Form {...formItemLayout} form={form}>
        <FormItem
          label={t('skill.newTriggerModal.name')}
          required
          field="displayName"
          rules={[{ required: true, message: t('skill.newTriggerModal.namePlaceholder') }]}
        >
          <Input placeholder={t('skill.newTriggerModal.namePlaceholder')} maxLength={50} showWordLimit />
        </FormItem>

        <FormItem
          label={t('skill.newTriggerModal.triggerType')}
          required
          field="triggerType"
          rules={[{ required: true, message: t('skill.newTriggerModal.triggerTypePlaceholder') }]}
        >
          <Select
            size="large"
            placeholder={t('skill.newTriggerModal.triggerTypePlaceholder')}
            onChange={(value) => {
              setTriggerType(value);
            }}
          >
            {triggerType.map((item) => {
              return (
                <Option key={item} value={item}>
                  {t(`skill.newTriggerModal.${item}`)}
                </Option>
              );
            })}
          </Select>
        </FormItem>

        {_triggerType === 'timer' && (
          <>
            <FormItem
              label={t('skill.newTriggerModal.timerConfig')}
              required
              field="timerConfig.datetime"
              rules={[{ required: true, message: t('skill.newTriggerModal.timerConfigPlaceholder') }]}
            >
              <DatePicker
                showTime={{
                  defaultValue: '00:00:00',
                }}
                format="YYYY-MM-DD HH:mm:ss"
                placeholder={t('skill.newTriggerModal.timerConfigPlaceholder')}
              />
            </FormItem>

            <FormItem label={t('skill.newTriggerModal.repeatInterval')} field="timerConfig.repeatInterval">
              <Select allowClear size="large" placeholder={t('skill.newTriggerModal.repeatIntervalPlaceholder')}>
                {repeatInterval.map((item) => {
                  return (
                    <Option key={item} value={item}>
                      {t(`skill.newTriggerModal.${item}`)}
                    </Option>
                  );
                })}
              </Select>
            </FormItem>

            <InvocationFormItems invocationConfig={data.invocationConfig} form={form} t={t} fieldMap={fromFieldMap} />
          </>
        )}

        {_triggerType === 'simpleEvent' && (
          <FormItem
            label={t('skill.newTriggerModal.event')}
            required
            field="simpleEventName"
            rules={[{ required: true, message: t('skill.newTriggerModal.eventPlaceholder') }]}
          >
            <Select size="large" placeholder={t('skill.newTriggerModal.eventPlaceholder')}>
              {['onResourceReady'].map((item) => {
                return (
                  <Option key={item} value={item}>
                    {t(`skill.newTriggerModal.${item}`)}
                  </Option>
                );
              })}
            </Select>
          </FormItem>
        )}
      </Form>
    </Modal>
  );
};
