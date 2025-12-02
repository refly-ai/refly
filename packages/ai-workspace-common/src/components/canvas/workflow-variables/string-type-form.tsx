import React from 'react';
import { Form, Input } from 'antd';
import { useTranslation } from 'react-i18next';

export const StringTypeForm: React.FC<{ onBlur: () => void }> = React.memo(({ onBlur }) => {
  const { t } = useTranslation();

  return (
    <Form.Item
      required
      label={t('canvas.workflow.variables.value') || 'Variable Value'}
      name={['value', 0, 'text']}
      rules={[
        {
          required: true,
          message: t('canvas.workflow.variables.valueRequired') || 'Variable value is required',
        },
      ]}
    >
      <Input.TextArea
        variant="filled"
        placeholder={t('canvas.workflow.variables.inputPlaceholder') || 'Please enter'}
        onBlur={onBlur}
        autoSize={{ minRows: 2, maxRows: 5 }}
      />
    </Form.Item>
  );
});

StringTypeForm.displayName = 'StringTypeForm';
