import React, { useEffect, useState } from 'react';
import { Input, Form, FormInstance, InputNumber, Select } from 'antd';
import {
  DynamicConfigItem,
  DynamicConfigValue,
  SkillTemplateConfig,
  SkillTemplateConfigDefinition,
} from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { FormHeader } from '@refly-packages/ai-workspace-common/components/skill/form-header';

const FormItem = Form.Item;
const TextArea = Input.TextArea;

const getFormField = (fieldPrefix: string, key: string) => {
  return `${fieldPrefix ? `${fieldPrefix}.` : ''}${key}`;
};

const getDictValue = (dict: { [key: string]: string }, locale: string) => {
  return dict?.[locale] || dict?.en;
};

const ConfigItem = (props: {
  item: DynamicConfigItem;
  form: FormInstance;
  field: string;
  locale: string;
  configValue?: DynamicConfigValue;
}): React.ReactNode => {
  const { item, form, field, locale, configValue } = props;

  useEffect(() => {
    if (typeof item.defaultValue === 'string' || item?.defaultValue) {
      form.setFieldValue(field, {
        value: item.defaultValue,
        label: getDictValue(item.labelDict, locale),
        displayValue: String(item.defaultValue),
      });
    }
  }, [item?.defaultValue]);

  if (!item) {
    return null;
  }

  const label = getDictValue(item.labelDict, locale);
  const placeholder = getDictValue(item.descriptionDict, locale);

  if (item.inputMode === 'input') {
    return (
      <Input
        placeholder={placeholder}
        type={(item.inputProps?.passwordType ? 'password' : 'text') as 'text' | 'password'}
        defaultValue={(item?.defaultValue as string) || String(configValue?.value || '') || ''}
        onChange={(e) =>
          form.setFieldValue(field, {
            value: e.target.value,
            label,
            displayValue: String(e.target.value),
          } as DynamicConfigValue)
        }
      />
    );
  }

  if (item.inputMode === 'inputTextArea') {
    console.log('item.defaultValue', item.defaultValue, configValue?.value);
    return (
      <TextArea
        placeholder={placeholder}
        defaultValue={
          (typeof item?.defaultValue === 'string'
            ? item?.defaultValue
            : String(configValue?.value || '')) || ''
        }
        rows={4}
        autoSize={{
          minRows: 4,
          maxRows: 10,
        }}
        onChange={(e) =>
          form.setFieldValue(field, {
            value: e.target.value,
            label,
            displayValue: String(e.target.value),
          } as DynamicConfigValue)
        }
      />
    );
  }

  if (item.inputMode === 'inputNumber') {
    return (
      <InputNumber
        defaultValue={(item?.defaultValue as number) || Number(configValue?.value) || 1}
        onChange={(val) =>
          form.setFieldValue(field, {
            value: val,
            label,
            displayValue: String(val),
          } as DynamicConfigValue)
        }
      />
    );
  }

  if (item.inputMode === 'select' || item.inputMode === 'multiSelect') {
    const optionValToDisplay = new Map(
      item.options.map((option) => [option.value, getDictValue(option.labelDict, locale)]),
    );

    return (
      <Select
        {...(item.inputMode === 'multiSelect' ? { mode: 'multiple' } : {})}
        options={item.options.map((option) => ({
          label: getDictValue(option.labelDict, locale),
          value: option.value,
        }))}
        defaultValue={
          (item?.defaultValue ||
            configValue?.value ||
            (item.inputMode === 'multiSelect' ? [] : '')) as string | string[]
        }
        placeholder={placeholder}
        onChange={(val) =>
          form.setFieldValue(field, {
            value: val,
            label,
            displayValue: Array.isArray(val)
              ? val.map((v) => optionValToDisplay.get(v)).join(',')
              : optionValToDisplay.get(val),
          } as DynamicConfigValue)
        }
      />
    );
  }

  return null;
};

export const TemplateConfigFormItems = (props: {
  schema: SkillTemplateConfigDefinition;
  form: FormInstance;
  tplConfig?: SkillTemplateConfig;
  fieldPrefix?: string;
  headerTitle?: string;
  headerIcon?: React.ReactNode;
  configScope: 'runtime' | 'template';
}) => {
  const { i18n, t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const locale = i18n.languages?.[0] || 'en';

  const { schema, form, fieldPrefix = '', tplConfig, headerTitle, headerIcon, configScope } = props;
  const { items } = schema;

  if (!items?.length) {
    return null;
  }

  // useEffect(() => {
  //   if (tplConfig) {
  //     Object.entries(tplConfig).forEach(([key, value]) => {
  //       const field = getFormField(fieldPrefix, key);

  //       if (value) {
  //         form.setFieldValue(field, value);
  //       }
  //     });
  //   }
  // }, [form, tplConfig, fieldPrefix]);

  return (
    <div style={{ marginTop: 16 }}>
      <FormHeader
        title={headerTitle}
        icon={headerIcon}
        enableCollapse
        collapsed={collapsed}
        onCollapseChange={setCollapsed}
      />
      {items?.length > 0 && !collapsed ? (
        <div className="template-config-form-items">
          {items.map((item, index) => {
            const field = getFormField(fieldPrefix, item.key);
            return (
              <FormItem
                layout="vertical"
                label={item.labelDict[locale]}
                key={item.key}
                name={field}
                required={item.required?.value}
                rules={[
                  {
                    validator(_, value) {
                      if (
                        !value?.value &&
                        item?.required?.value &&
                        item?.required?.configScope.includes(configScope)
                      ) {
                        return Promise.reject(t('common.emptyInput'));
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <ConfigItem
                  key={index}
                  item={item}
                  form={form}
                  field={field}
                  locale={locale}
                  configValue={tplConfig?.[item.key]}
                />
              </FormItem>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
