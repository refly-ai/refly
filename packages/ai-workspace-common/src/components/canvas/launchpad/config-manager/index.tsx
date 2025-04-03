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
  FormInstance,
  Switch,
  Space,
} from '@arco-design/web-react';
import { IconRefresh, IconUp, IconDown } from '@arco-design/web-react/icon';
import { GrDocumentConfig } from 'react-icons/gr';

import {
  DynamicConfigItem,
  DynamicConfigValue,
  SkillTemplateConfig,
  SkillTemplateConfigDefinition,
} from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { useContextPanelStore } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

const TextArea = Input.TextArea;

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
          onChange={(val) => {
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
          onChange={(val) => {
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
          mode="button"
          value={initialValue !== null ? Number(initialValue) : undefined}
          className="w-full bg-transparent hover:bg-transparent focus:bg-transparent border-none hover:border-none focus:border-none"
          {...(item?.inputProps || {})}
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
          onChange={(checkedValue) => {
            onValueChange(checkedValue, optionValToDisplay.get(checkedValue));
          }}
          disabled={readonly}
        >
          {item.options.map((option) => (
            <Radio key={option.value} value={option.value}>
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
          type="round"
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
      setFormErrors,
      onFormValuesChange,
      onExpandChange,
    } = props;
    const [resetCounter, setResetCounter] = useState<number>(0);
    const [formValues, setFormValues] = useState<Record<string, DynamicConfigValue>>({});
    const [isExpanded, setIsExpanded] = useState<boolean>(true);
    const { readonly } = useCanvasContext();

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

    console.log('tplConfig', tplConfig);

    // Handle initial setup - only run on mount and when tplConfig changes significantly
    useEffect(() => {
      // Skip if already initialized with this config
      if (initializedRef.current) {
        return;
      }

      console.log('Initializing ConfigManager with tplConfig:', tplConfig);

      // Track this initialization
      initializedRef.current = true;
      prevTplConfigRef.current = tplConfig ? { ...tplConfig } : undefined;

      // Create a map for form updates
      const formUpdates = {};

      // Create new form values to update state
      const newFormValues: Record<string, DynamicConfigValue> = {};

      if (!tplConfig || Object.keys(tplConfig).length === 0) {
        // Setup default values from schema
        for (const item of schema.items || []) {
          if (item.defaultValue !== undefined && item.key) {
            const field = getFormField(fieldPrefix, item.key);
            const value = {
              value: item.defaultValue,
              label: getDictValue(item.labelDict, locale),
              displayValue: String(item.defaultValue),
            };

            formUpdates[field] = value;
            newFormValues[item.key] = value;
          }
        }
      } else {
        // Use provided tplConfig
        for (const [key, value] of Object.entries(tplConfig)) {
          if (value !== undefined) {
            const field = getFormField(fieldPrefix, key);
            formUpdates[field] = value;
            newFormValues[key] = value as DynamicConfigValue;
          }
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
    }, [tplConfig, schema.items, fieldPrefix, locale, form, validateTplConfig, setFormErrors]);

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

      // Only update reset counter when explicitly resetting to avoid unnecessary re-renders
      setResetCounter((prev) => prev + 1);
    };

    // Optimize value change to prevent losing focus
    const handleValueChange = useCallback(
      (field?: string) => {
        // When value changes, update local state
        if (field) {
          const key = field.split('.').pop();
          if (key) {
            const value = form.getFieldValue(field);
            setFormValues((prev) => ({
              ...prev,
              [key]: value,
            }));
          }
        }
      },
      [form],
    );

    return (
      <div className="config-manager">
        <div className="config-manager__header">
          <div className="config-manager__header-left">
            <GrDocumentConfig className="config-manager__header-icon" />
            <span className="config-manager__header-title">{t('copilot.configManager.title')}</span>
          </div>
          <Button
            type="text"
            size="mini"
            className="config-manager__toggle-button"
            icon={isExpanded ? <IconUp /> : <IconDown />}
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
          <Form
            form={form}
            className="config-manager__form"
            onValuesChange={(changedValues, allValues) => {
              // Validate any changed fields
              for (const field of Object.keys(changedValues)) {
                validateField(field, changedValues[field]);
              }

              // Handle config updates
              if (allValues.tplConfig && onFormValuesChange) {
                const newConfig = allValues.tplConfig;

                // Deep comparison with current tplConfig
                const currentConfigStr = JSON.stringify(tplConfig || {});
                const newConfigStr = JSON.stringify(newConfig);

                if (currentConfigStr !== newConfigStr) {
                  onFormValuesChange(changedValues, allValues);
                }
              }
            }}
          >
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
                      layout="vertical"
                      field={field}
                      label={
                        <div className="config-manager__item-label">
                          {item.required?.value &&
                            item.required?.configScope.includes(configScope) && (
                              <span style={{ color: 'red' }}>* </span>
                            )}
                          {getDictValue(item.labelDict, locale)}
                          <Button
                            type="text"
                            size="mini"
                            className="config-manager__reset-button"
                            icon={<IconRefresh />}
                            onClick={() => !readonly && handleReset(item.key)}
                            disabled={readonly}
                          >
                            {t('common.reset')}
                          </Button>
                        </div>
                      }
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
