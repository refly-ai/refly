import React, { useEffect, useState, useCallback, useRef } from 'react';
// 自定义样式
import './index.scss';

import {
  Button,
  Checkbox,
  Radio,
  InputNumber,
  Input,
  Form,
  Switch,
  Space,
  FormInstance,
} from 'antd';
import { ReloadOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
import { GrDocumentConfig } from 'react-icons/gr';

import {
  DynamicConfigItem,
  DynamicConfigValue,
  SkillTemplateConfig,
  SkillTemplateConfigDefinition,
} from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { useContextPanelStore } from '@refly-packages/ai-workspace-common/stores/context-panel';

const { TextArea } = Input;

const getFormField = (fieldPrefix: string, key: string) => {
  return `${fieldPrefix ? `${fieldPrefix}.` : ''}${key}`;
};

const getDictValue = (dict: { [key: string]: string }, locale: string) => {
  return dict?.[locale] || dict?.en;
};

// Memoize the ConfigItem component to prevent unnecessary re-renders
const ConfigItem = React.memo(
  (props: {
    item: DynamicConfigItem;
    form: FormInstance;
    field: string;
    locale: string;
    configValue?: DynamicConfigValue;
    onValueChange: (field?: string, val?: any, displayValue?: string) => void;
    readonly?: boolean;
  }): React.ReactNode => {
    const { item, form, field, locale, configValue, readonly } = props;
    // Use refs to store input values to maintain state across renders
    const inputRef = useRef<any>(null);
    const [initialValue, setInitialValue] = useState<any>(null);

    // Handle initial value setup
    useEffect(() => {
      if (!initialValue) {
        // Priority 1: Use existing configValue if available
        if (configValue?.value !== undefined) {
          setInitialValue(configValue.value);
        }
        // Priority 2: Use form value if available
        else {
          const formValue = form.getFieldValue(field);
          if (formValue?.value !== undefined) {
            setInitialValue(formValue.value);
          }
          // Priority 3: Use default value from schema
          else if (item?.defaultValue !== undefined) {
            const defaultConfigValue = {
              value: item.defaultValue,
              label: getDictValue(item.labelDict, locale),
              displayValue: String(item.defaultValue),
            };
            form.setFieldValue(field, defaultConfigValue);
            setInitialValue(item.defaultValue);
          }
        }
      }
    }, [configValue, item, field, form, locale, initialValue]);

    if (!item) {
      return null;
    }

    const label = getDictValue(item.labelDict, locale);
    const placeholder = getDictValue(item.descriptionDict, locale);

    const onValueChange = (val: any, displayValue: string) => {
      const newValue = {
        value: val,
        label,
        displayValue,
      } as DynamicConfigValue;

      form.setFieldValue(field, newValue);
      props.onValueChange(field, val, displayValue);
    };

    if (item.inputMode === 'input') {
      return (
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={initialValue !== null ? String(initialValue) : undefined}
          className="bg-transparent hover:bg-transparent focus:bg-transparent"
          type={item.inputProps?.passwordType ? 'password' : 'text'}
          onChange={(e) => {
            const val = e.target.value;
            setInitialValue(val);
            onValueChange(val, String(val));
          }}
          disabled={readonly}
        />
      );
    }

    if (item.inputMode === 'inputTextArea') {
      return (
        <TextArea
          ref={inputRef}
          placeholder={placeholder}
          value={initialValue !== null ? String(initialValue) : undefined}
          rows={4}
          className="bg-transparent hover:bg-transparent focus:bg-transparent"
          autoSize={{
            minRows: 4,
            maxRows: 10,
          }}
          onChange={(e) => {
            const val = e.target.value;
            setInitialValue(val);
            onValueChange(val, String(val));
          }}
          disabled={readonly}
        />
      );
    }

    if (item.inputMode === 'inputNumber') {
      return (
        <InputNumber
          ref={inputRef}
          controls
          value={initialValue !== null ? Number(initialValue) : undefined}
          className="w-full bg-transparent hover:bg-transparent focus:bg-transparent"
          onChange={(val) => {
            setInitialValue(val);
            onValueChange(val, val || val === 0 ? String(val) : '');
          }}
          disabled={readonly}
        />
      );
    }

    if (item.inputMode === 'select' || item.inputMode === 'multiSelect') {
      const optionValToDisplay = new Map(
        item.options.map((option) => [option.value, getDictValue(option.labelDict, locale)]),
      );

      const defaultValue =
        configValue?.value ||
        (item.inputMode === 'multiSelect' ? [item.options[0]?.value] : item.options[0]?.value);

      if (item.inputMode === 'multiSelect') {
        return (
          <Checkbox.Group
            options={item.options.map((option) => ({
              label: getDictValue(option.labelDict, locale),
              value: option.value,
            }))}
            style={{ fontSize: '10px' }}
            value={(configValue?.value as string[]) || (defaultValue as string[])}
            onChange={(val) => {
              onValueChange(
                val,
                Array.isArray(val)
                  ? val.map((v) => optionValToDisplay.get(v)).join(',')
                  : optionValToDisplay.get(val),
              );
            }}
            disabled={readonly}
          />
        );
      }

      return (
        <Radio.Group
          value={configValue?.value || defaultValue}
          onChange={(e) => {
            const checkedValue = e.target.value;
            onValueChange(checkedValue, optionValToDisplay.get(checkedValue));
          }}
          disabled={readonly}
        >
          {item.options.map((option) => (
            <Radio key={option.value} value={option.value} className="config-radio text-[10px]">
              {getDictValue(option.labelDict, locale)}
            </Radio>
          ))}
        </Radio.Group>
      );
    }

    if (item.inputMode === 'switch') {
      return (
        <Switch
          size="small"
          checked={Boolean(configValue?.value)}
          onChange={(checked) => {
            onValueChange(checked, String(checked));
          }}
          disabled={readonly}
        />
      );
    }

    return null;
  },
);

interface ConfigManagerProps {
  schema: SkillTemplateConfigDefinition;
  form: FormInstance;
  tplConfig?: SkillTemplateConfig;
  fieldPrefix?: string;
  headerTitle?: string;
  headerIcon?: React.ReactNode;
  configScope?: 'runtime' | 'template';
  formErrors: Record<string, string>;
  readonly: boolean;
  resetConfig?: () => void;
  setFormErrors: (errors: any) => void;
  onFormValuesChange?: (changedValues: any, allValues: any) => void;
  onExpandChange?: (expanded: boolean) => void;
}

// Add a utility function for safe form updates outside of React's render cycle
const safeFormUpdate = (form: FormInstance, updates: Record<string, any>) => {
  // Create a queue of updates to process outside of React's render cycle
  const queuedUpdates = Object.entries(updates);

  if (queuedUpdates.length === 0) return;

  // Process queue outside of React's render cycle
  setTimeout(() => {
    for (const [field, value] of queuedUpdates) {
      form.setFieldValue(field, value);
    }
  }, 0);
};

export const ConfigManager = React.memo(
  (props: ConfigManagerProps) => {
    const { i18n, t } = useTranslation();
    const locale = i18n.languages?.[0] || 'en';

    const {
      schema,
      fieldPrefix,
      form,
      tplConfig,
      configScope,
      formErrors,
      readonly,
      setFormErrors,
      onFormValuesChange,
      onExpandChange,
    } = props;
    const [resetCounter, setResetCounter] = useState<number>(0);
    const [formValues, setFormValues] = useState<Record<string, DynamicConfigValue>>({});
    const [isExpanded, setIsExpanded] = useState<boolean>(true);

    // Use refs to track initialization state
    const initializedRef = useRef(false);
    const prevTplConfigRef = useRef<SkillTemplateConfig | undefined>();

    const isConfigItemRequired = useCallback(
      (schemaItem: DynamicConfigItem) => {
        return (
          schemaItem?.required?.value && schemaItem?.required?.configScope.includes(configScope)
        );
      },
      [configScope],
    );

    // Memoize the validateTplConfig function to prevent recreation on each render
    const validateTplConfig = useCallback(
      (tplConfig: SkillTemplateConfig) => {
        const errors = {};
        for (const key of Object.keys(tplConfig)) {
          const schemaItem = (schema.items || []).find((item) => item.key === key);
          if (isConfigItemRequired(schemaItem)) {
            const value_ = tplConfig[key].value;
            if ((!value_ && value_ !== 0) || (Array.isArray(value_) && !value_.length)) {
              errors[getFormField(fieldPrefix, key)] = t('common.emptyInput');
            }
          }
        }
        return errors;
      },
      [fieldPrefix, t, schema.items, isConfigItemRequired],
    );

    const validateField = (field: string, value: any) => {
      const { formErrors: prevFormErrors } = useContextPanelStore.getState();
      const schemaItem = schema.items?.find(
        (item) => getFormField(fieldPrefix, item.key) === field,
      );
      if (isConfigItemRequired(schemaItem)) {
        const value_ = value?.value;
        if ((!value_ && value_ !== 0) || (Array.isArray(value_) && !value_.length)) {
          setFormErrors({ ...prevFormErrors, [field]: t('common.emptyInput') });
        } else {
          const newErrors = { ...prevFormErrors };
          delete newErrors[field];
          setFormErrors(newErrors);
        }
      }
    };

    const getItemError = (key: string) => {
      const field = getFormField(fieldPrefix, key);
      return formErrors?.[field];
    };

    // Handle initial setup - only run on mount and when tplConfig changes significantly
    useEffect(() => {
      // Skip if already initialized with this config
      if (initializedRef.current) {
        return;
      }

      // Track this initialization
      initializedRef.current = true;
      prevTplConfigRef.current = tplConfig ? { ...tplConfig } : undefined;

      // Create a map for form updates
      const formUpdates = {};

      // Create new form values to update state
      const newFormValues: Record<string, DynamicConfigValue> = {};

      if (tplConfig) {
        for (const [key, value] of Object.entries(tplConfig)) {
          if (value !== undefined) {
            const field = getFormField(fieldPrefix, key);
            formUpdates[field] = value;
            newFormValues[key] = value as DynamicConfigValue;
          }
        }
      }

      for (const item of schema.items || []) {
        const field = getFormField(fieldPrefix, item.key);
        if (tplConfig?.[item.key] === undefined) {
          formUpdates[field] = item.defaultValue;
          newFormValues[item.key] = {
            value: item.defaultValue,
            label: getDictValue(item.labelDict, locale),
            displayValue: String(item.defaultValue),
          } as DynamicConfigValue;
        }
      }

      // Only update if we have changes to make
      if (Object.keys(formUpdates).length > 0) {
        // Update form state outside of React's rendering cycle
        safeFormUpdate(form, formUpdates);

        // Update component state
        setFormValues(newFormValues);
      }

      // Validate if needed
      if (tplConfig && Object.keys(tplConfig).length > 0) {
        const errors = validateTplConfig(tplConfig);
        if (Object.keys(errors).length > 0) {
          setFormErrors(errors);
        }
      }

      onFormValuesChange?.({ ...formUpdates }, { tplConfig: { ...newFormValues } });
    }, [
      tplConfig,
      schema.items,
      fieldPrefix,
      locale,
      form,
      validateTplConfig,
      setFormErrors,
      onFormValuesChange,
    ]);

    const handleReset = (key: string) => {
      const schemaItem = schema.items?.find((item) => item.key === key);
      const defaultValue = schemaItem?.defaultValue;

      const resetValue =
        defaultValue !== undefined
          ? {
              value: defaultValue,
              label: getDictValue(schemaItem.labelDict, locale),
              displayValue: String(defaultValue),
            }
          : undefined;

      // Use safe form update to avoid render cycles
      safeFormUpdate(form, { [getFormField(fieldPrefix, key)]: resetValue });

      // Update local state
      setFormValues((prev) => ({
        ...prev,
        [key]: resetValue,
      }));

      // Manually trigger form change to ensure parent components are updated
      const newTplConfig = { ...(tplConfig || {}) };
      newTplConfig[key] = resetValue;
      onFormValuesChange?.({ [key]: resetValue }, { tplConfig: newTplConfig });

      // Only update reset counter when explicitly resetting to avoid unnecessary re-renders
      setResetCounter((prev) => prev + 1);
    };

    // Optimize value change to prevent losing focus
    const handleValueChange = useCallback(
      (field?: string, val?: any, displayValue?: string) => {
        // When value changes, update local state
        if (field) {
          validateField(field, val);
          const key = field.split('.').pop();
          if (key) {
            if (val !== undefined && displayValue !== undefined) {
              const schemaItem = schema.items?.find((item) => item.key === key);
              const label = getDictValue(schemaItem?.labelDict || {}, locale);

              const newValue = {
                value: val,
                label,
                displayValue,
              };

              // Update local state
              setFormValues((prev) => ({
                ...prev,
                [key]: newValue,
              }));

              const newTplConfig = { ...(tplConfig || {}) };
              newTplConfig[key] = newValue;

              const currentConfigStr = JSON.stringify(tplConfig || {});
              const newConfigStr = JSON.stringify(newTplConfig);

              if (currentConfigStr !== newConfigStr) {
                onFormValuesChange?.({ [key]: newValue }, { tplConfig: newTplConfig });
              }
            } else {
              const value = form.getFieldValue(field);
              setFormValues((prev) => ({
                ...prev,
                [key]: value,
              }));
            }
          }
        }
      },
      [form, schema.items, locale, onFormValuesChange, validateField, tplConfig],
    );

    return (
      <div className="config-manager border-t border-b-0 border-l-0 border-r-0 border-dashed border-gray-200 dark:border-[rgba(255,255,255,0.3)]">
        <div className="config-manager__header">
          <div className="config-manager__header-left">
            <GrDocumentConfig className="config-manager__header-icon text-gray-600 dark:text-gray-300" />
            <span className="config-manager__header-title text-gray-600 dark:text-gray-300">
              {t('copilot.configManager.title')}
            </span>
          </div>
          <Button
            type="text"
            size="small"
            className="config-manager__toggle-button"
            icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
            onClick={() => {
              if (!readonly) {
                setIsExpanded(!isExpanded);
                onExpandChange?.(!isExpanded);
              }
            }}
            disabled={readonly}
            aria-label={isExpanded ? t('common.collapse') : t('common.expand')}
          />
        </div>

        {isExpanded && (
          <Form form={form} className="config-manager__form" layout="vertical">
            <Space direction="vertical" style={{ width: '100%' }}>
              {(schema.items || []).map((item) => {
                const field = getFormField(fieldPrefix, item.key);
                const configValue = formValues[item.key] || form.getFieldValue(field);

                return (
                  <div
                    key={item.key}
                    className={`config-manager__item-row ${getItemError(item.key) ? 'error' : ''}`}
                  >
                    <Form.Item
                      className="config-item"
                      label={
                        <div className="config-manager__item-label">
                          <div>
                            {item.required?.value &&
                              item.required?.configScope.includes(configScope) && (
                                <span style={{ color: 'red' }}>* </span>
                              )}
                            {getDictValue(item.labelDict, locale)}
                          </div>
                          <Button
                            type="text"
                            size="small"
                            className="config-manager__reset-button text-green-500"
                            icon={<ReloadOutlined />}
                            onClick={() => !readonly && handleReset(item.key)}
                            disabled={readonly}
                          >
                            {t('common.reset')}
                          </Button>
                        </div>
                      }
                      name={field}
                      required={
                        item.required?.value && item.required?.configScope.includes(configScope)
                      }
                      validateStatus={formErrors[field] ? 'error' : undefined}
                      help={formErrors[field]}
                    >
                      <ConfigItem
                        key={`${item.key}-${resetCounter}`}
                        item={item}
                        form={form}
                        field={field}
                        locale={locale}
                        configValue={configValue}
                        onValueChange={handleValueChange}
                        readonly={readonly}
                      />
                    </Form.Item>
                  </div>
                );
              })}
            </Space>
          </Form>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if these props change
    return (
      prevProps.schema === nextProps.schema &&
      prevProps.tplConfig === nextProps.tplConfig &&
      prevProps.formErrors === nextProps.formErrors &&
      prevProps.fieldPrefix === nextProps.fieldPrefix
    );
  },
);

ConfigManager.displayName = 'ConfigManager';
