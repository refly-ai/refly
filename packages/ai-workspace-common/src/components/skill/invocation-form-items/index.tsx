import React, { useState } from 'react';
import { Input, Form, FormInstance, Radio } from '@arco-design/web-react';
import { TFunction } from 'i18next';
import { SearchSelect } from '@refly-packages/ai-workspace-common/modules/entity-selector/components';
import { SkillInvocationConfig, SkillInvocationRule, SkillInvocationRuleGroup } from '@refly/openapi-schema';

import './index.scss';

const FormItem = Form.Item;
const TextArea = Input.TextArea;
const RadioGroup = Radio.Group;

const ruleKeyToSearchDomain = {
  resourceIds: 'resource',
  noteIds: 'note',
  collectionIds: 'collection',
} as const;

const InvokeOption = (props: {
  rule: SkillInvocationRule;
  t: TFunction;
  onChange: (val: any) => void;
  disabled?: boolean;
}): React.ReactNode => {
  const { rule, t, disabled, onChange } = props;

  const commonProps = {
    disabled,
    className: 'invocation-form__input',
  };

  if (rule.key === 'query') {
    return (
      <Input
        {...commonProps}
        placeholder={t('skill.instanceInvokeModal.placeholder.query')}
        maxLength={100}
        showWordLimit
        onChange={onChange}
      />
    );
  }

  if (rule.key === 'resourceIds' || rule.key === 'noteIds' || rule.key === 'collectionIds') {
    return (
      <SearchSelect
        {...commonProps}
        {...(rule.limit > 1 ? { mode: 'multiple' } : {})}
        domain={ruleKeyToSearchDomain[rule.key]}
        placeholder={t(`skill.instanceInvokeModal.placeholder.${rule.key}`)}
        onChange={(val) => {
          if (!Array.isArray(val)) {
            onChange([val]);
          } else {
            onChange(val);
          }
        }}
      />
    );
  }

  if (rule.key === 'contentList' || rule.key === 'urls') {
    return (
      <TextArea
        {...commonProps}
        className={`${commonProps.className} invocation-form__input--textarea`}
        placeholder={t(`skill.instanceInvokeModal.placeholder.${rule.key}`)}
        rows={4}
        autoSize={{
          minRows: 4,
          maxRows: 10,
        }}
        onChange={onChange}
      />
    );
  }

  return null;
};

export const InvokeOptionGroup = (props: {
  rg: SkillInvocationRuleGroup;
  form: FormInstance;
  t: TFunction;
  fieldMap?: Object;
}) => {
  const { rg, form, t, fieldMap } = props;
  const { rules, relation } = rg;

  if (rules.length === 0) return null;

  const [selectedKey, setSelectedKey] = useState<string | null>(rules[0].key);

  const [ruleValues, setRuleValues] = useState<Record<string, string>>({});

  if (relation === 'mutuallyExclusive') {
    return (
      <RadioGroup
        className="invocation-form__radio-group"
        defaultValue={rules[0].key}
        onChange={(value) => {
          setSelectedKey(value);
          rules.forEach((rule) => {
            if (rule.key !== value) {
              // clear the value of the unselected item
              form.setFieldValue(fieldMap ? fieldMap[rule.key] : rule.key, undefined);
            } else {
              // restore the value of the selected item
              form.setFieldValue(fieldMap ? fieldMap[rule.key] : rule.key, ruleValues[rule.key]);
            }
          });
        }}
      >
        {rules.map((rule) => (
          <Radio
            key={rule.key}
            value={rule.key}
            checked={rule.key === selectedKey}
            className="invocation-form__radio-option"
          >
            <FormItem
              label={t(`skill.instanceInvokeModal.formLabel.${rule.key}`)}
              key={rule.key}
              required={rule.required}
              field={fieldMap ? fieldMap[rule.key] : rule.key}
            >
              <div style={{ opacity: selectedKey === rule.key ? 1 : 0.5 }}>
                <InvokeOption
                  rule={rule}
                  t={t}
                  disabled={selectedKey !== rule.key}
                  onChange={(val) => {
                    const field = fieldMap ? fieldMap[rule.key] : rule.key;
                    setRuleValues({ ...ruleValues, [field]: val });
                    form.setFieldValue(field, val);
                  }}
                />
              </div>
            </FormItem>
          </Radio>
        ))}
      </RadioGroup>
    );
  }

  return rules.map((rule) => (
    <FormItem
      label={t(`skill.instanceInvokeModal.formLabel.${rule.key}`)}
      key={rule.key}
      required={rule.required}
      field={fieldMap ? fieldMap[rule.key] : rule.key}
      className="invocation-form__input-group"
    >
      <InvokeOption
        rule={rule}
        t={t}
        disabled={selectedKey !== rule.key}
        onChange={(val) => {
          form.setFieldValue(fieldMap ? fieldMap[rule.key] : rule.key, val);
        }}
      />
    </FormItem>
  ));
};

export const InvocationFormItems = (props: {
  invocationConfig: SkillInvocationConfig;
  form: FormInstance;
  t: TFunction;
  fieldMap?: Object;
}) => {
  const { invocationConfig, ...rest } = props;
  const { input, context } = invocationConfig;

  return (
    <div className="invocation-form">
      <InvokeOptionGroup rg={input} {...rest} />
      <InvokeOptionGroup rg={context} {...rest} />
    </div>
  );
};
