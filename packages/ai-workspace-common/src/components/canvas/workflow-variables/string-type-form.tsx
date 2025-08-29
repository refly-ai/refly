import React from 'react';
import { Form, Input } from 'antd';
import { useTranslation } from 'react-i18next';

export const StringTypeForm: React.FC = React.memo(() => {
  const { t } = useTranslation();

  return (
    <Form.Item
      label={t('canvas.workflow.variables.value') || 'Variable Value'}
      name={['value', 0, 'text']}
    >
      <Input
        placeholder={t('canvas.workflow.variables.inputPlaceholder') || 'Please enter'}
        maxLength={200}
        showCount
      />
    </Form.Item>
  );
});

StringTypeForm.displayName = 'StringTypeForm';
