import { withTheme } from '@rjsf/core';
import { Button, Checkbox, Input, Radio, message } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useSubmitForm } from '@refly-packages/ai-workspace-common/queries';
import { useUserStoreShallow } from '@refly/stores';
import { useTranslation } from 'react-i18next';

interface RjsfFieldTemplateProps {
  id?: string;
  classNames?: string;
  style?: CSSProperties;
  label?: ReactNode;
  required?: boolean;
  description?: ReactNode;
  errors?: ReactNode;
  help?: ReactNode;
  children: ReactNode;
  displayLabel?: boolean;
  rawErrors?: string[];
}

interface RjsfObjectFieldTemplateProperty {
  content: ReactNode;
  name: string;
  hidden?: boolean;
}

interface RjsfObjectFieldTemplateProps {
  description?: ReactNode;
  formData?: Record<string, unknown>;
  properties: RjsfObjectFieldTemplateProperty[];
  schema?: {
    properties?: Record<string, unknown>;
  };
  title?: ReactNode;
  uiSchema?: Record<string, unknown>;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
}

interface RjsfArrayFieldTemplateItem {
  key: string;
  children: ReactNode;
  hasToolbar?: boolean;
  toolbar?: ReactNode;
}

interface RjsfArrayFieldTemplateProps {
  canAdd?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  items?: RjsfArrayFieldTemplateItem[];
  onAddClick: (event?: React.MouseEvent | React.KeyboardEvent) => void;
  schema: {
    title?: string;
    description?: string;
  };
  title?: ReactNode;
  uiSchema?: Record<string, unknown>;
}

interface EnumOption {
  value: unknown;
  label?: ReactNode;
}

interface ReflyFormContext extends Record<string, unknown> {
  __reflySuppressNextValidation__?: () => void;
}

interface RjsfWidgetProps {
  id?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  value?: unknown;
  label?: ReactNode;
  onChange: (value: unknown) => void;
  schema?: Record<string, unknown>;
  options?: Record<string, unknown>;
  autofocus?: boolean;
  formContext?: ReflyFormContext;
}

const mergeClassNames = (...classes: Array<string | false | undefined>): string => {
  return classes.filter(Boolean).join(' ');
};

const hasValue = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'string') {
    return value.trim() !== '';
  }
  if (typeof value === 'number') {
    return !Number.isNaN(value);
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return false;
};

const buildOptionLabel = (label: ReactNode, value: unknown): ReactNode => {
  if (label === undefined || label === null || label === '') {
    return String(value ?? '');
  }
  return label;
};

const getEnumOptions = (options?: Record<string, unknown>): EnumOption[] => {
  const rawOptions = options?.enumOptions;
  if (Array.isArray(rawOptions)) {
    return rawOptions as EnumOption[];
  }
  return [];
};

const getSchemaEnumValues = (
  schema: RjsfObjectFieldTemplateProps['schema'],
  key?: string,
): string[] => {
  if (!schema || !key) {
    return [];
  }

  const propertyDefinition = schema.properties?.[key];
  if (!propertyDefinition || typeof propertyDefinition !== 'object') {
    return [];
  }

  const extractFromAnyOf = (target: Record<string, unknown>): string[] => {
    if (!('anyOf' in target)) {
      return [];
    }

    const anyOf = (target as { anyOf?: unknown }).anyOf;
    if (!Array.isArray(anyOf)) {
      return [];
    }

    const values: string[] = [];
    for (const item of anyOf) {
      if (item && typeof item === 'object' && 'const' in (item as Record<string, unknown>)) {
        const constValue = (item as { const?: unknown }).const;
        if (typeof constValue === 'string') {
          values.push(constValue);
        }
      }
    }

    return values;
  };

  const propertyObject = propertyDefinition as Record<string, unknown>;
  const fromTopLevel = extractFromAnyOf(propertyObject);
  if (fromTopLevel.length > 0) {
    return fromTopLevel;
  }

  if ('items' in propertyObject) {
    const items = propertyObject.items;
    if (items && typeof items === 'object') {
      return extractFromAnyOf(items as Record<string, unknown>);
    }
  }

  return [];
};

const getSchemaPropertyTitle = (
  schema: RjsfObjectFieldTemplateProps['schema'],
  key: string,
): string => {
  const propertyDefinition = schema?.properties?.[key];
  if (propertyDefinition && typeof propertyDefinition === 'object') {
    const maybeTitle = (propertyDefinition as { title?: unknown }).title;
    if (typeof maybeTitle === 'string') {
      return maybeTitle;
    }
  }
  return '';
};

const FieldTemplate = (props: RjsfFieldTemplateProps) => {
  const { id, classNames, style, label, required, help, children, displayLabel } = props;

  return (
    <div className={mergeClassNames('flex flex-col gap-2', classNames ?? '')} style={style} id={id}>
      {displayLabel && (
        <label
          htmlFor={id}
          className="text-sm font-semibold text-refly-text-0 flex items-center gap-1"
        >
          <span>{label}</span>
          {required ? <span className="text-refly-func-danger-default">*</span> : null}
        </label>
      )}
      <div className="bg-transparent rounded-3xl">{children}</div>
      {help}
    </div>
  );
};

const ObjectFieldTemplate = (props: RjsfObjectFieldTemplateProps) => {
  const {
    description,
    formData,
    properties,
    schema,
    title,
    uiSchema,
    required,
    disabled,
    readonly,
  } = props;

  const { t } = useTranslation();
  const submitFormMutation = useSubmitForm();
  const userStore = useUserStoreShallow((state) => ({
    setShowOnboardingFormModal: state.setShowOnboardingFormModal,
    setShowOnboardingSuccessAnimation: state.setShowOnboardingSuccessAnimation,
  }));

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const uiOptions = (uiSchema?.['ui:options'] ?? {}) as Record<string, unknown>;
  const showHeader = uiOptions.hideHeader !== true;
  const subtitleNode = (uiOptions.subtitle as ReactNode) ?? description ?? null;
  const emoji = (uiOptions.emoji as string) ?? '🎉';
  const variant = (uiOptions.variant as string) ?? 'card';
  const wrapSections = variant !== 'flat';
  const progressSteps = Array.isArray(uiOptions.progressSteps)
    ? (uiOptions.progressSteps as Array<{ key: string; title?: string }>)
    : [];
  const showSelectionSummary = uiOptions.showSelectionSummary === true;
  const requiredHint =
    typeof uiOptions.requiredHint === 'string' ? uiOptions.requiredHint : '标有 * 的问题为必填项';

  const effectiveFormData = (formData ?? {}) as Record<string, unknown>;

  // Pagination logic
  const totalPages = progressSteps.length;
  const isPaginated = totalPages > 1;

  // Get current page field
  const currentStep = progressSteps[currentPage];
  const currentFieldName = currentStep?.key;
  const currentProperty = properties.find((prop) => prop.name === currentFieldName);

  // Navigation functions
  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const isLastPage = currentPage === totalPages - 1;

  const renderProgress = () => {
    if (progressSteps.length <= 1) {
      return null;
    }

    return (
      <div className="flex items-center justify-center gap-2">
        {progressSteps.map((step, index) => {
          const stepValue = step?.key ? effectiveFormData[step.key] : undefined;
          const completed = hasValue(stepValue);
          const isActive = index === currentPage;

          const indicatorClass = mergeClassNames(
            'transition-all duration-200 ease-out rounded-full',
            isActive
              ? 'bg-refly-primary-default w-8 h-2'
              : completed
                ? 'bg-[#87cfbb] w-2 h-2'
                : 'bg-[#E4E7EC] w-2 h-2',
          );

          return <span key={step?.key ?? index} className={indicatorClass} />;
        })}
      </div>
    );
  };

  const renderSummary = () => {
    if (!showSelectionSummary) {
      return null;
    }

    const summaryEntries: Array<{ title: string | undefined; value: string }> = [];

    for (const [key, value] of Object.entries(effectiveFormData)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && item.trim() !== '') {
            summaryEntries.push({
              title: getSchemaPropertyTitle(schema, key),
              value: item.trim(),
            });
          }
        }
      } else if (typeof value === 'string' && value.trim() !== '') {
        summaryEntries.push({
          title: getSchemaPropertyTitle(schema, key),
          value: value.trim(),
        });
      }
    }

    if (summaryEntries.length === 0) {
      return null;
    }

    return null;
  };

  const renderNavigation = () => {
    if (!isPaginated) {
      return null;
    }

    // Check if current page has a value
    const currentFieldEnumValues = currentFieldName
      ? getSchemaEnumValues(schema, currentFieldName)
      : [];
    const currentFieldValue = currentFieldName ? effectiveFormData[currentFieldName] : undefined;
    const hasCurrentValue = hasValue(currentFieldValue);

    // Check if "other" option is selected but no text input provided
    let hasValidOtherInput = true;
    if (hasCurrentValue && currentFieldValue) {
      if (typeof currentFieldValue === 'string' && currentFieldValue === 'other') {
        // For single select, if "other" is selected, it should have been replaced with the input text
        hasValidOtherInput = hasValue(currentFieldValue) && currentFieldValue !== 'other';
      } else if (Array.isArray(currentFieldValue)) {
        // For multi-select, check if "other" is selected and there's a corresponding text input
        const hasOtherSelected = currentFieldValue.includes('other');
        if (hasOtherSelected) {
          // Look for a custom text value that is not part of the predefined enum options
          const hasOtherText = currentFieldValue.some(
            (item) =>
              typeof item === 'string' &&
              item.trim() !== '' &&
              item !== 'other' &&
              !currentFieldEnumValues.includes(item),
          );
          hasValidOtherInput = hasOtherText;
        }
      }
    }

    const canProceed = hasCurrentValue && hasValidOtherInput;

    return (
      <div className="flex items-center justify-center gap-6">
        {currentPage > 0 && (
          <Button
            type="default"
            onClick={goToPrevPage}
            className="w-[180px] h-14 -mt-8 rounded-full !bg-transparent"
          >
            {t('form.previous')}
          </Button>
        )}

        {isLastPage ? (
          <Button
            type="primary"
            htmlType="submit"
            disabled={!canProceed || submitFormMutation.isPending}
            className="w-[180px] h-14 -mt-8 rounded-full"
            onClick={() => {
              const formId = (schema as { formId?: string })?.formId;
              const uid = (schema as { uid?: string })?.uid;

              if (formId && uid) {
                submitFormMutation.mutate(
                  {
                    body: {
                      formSubmission: {
                        formId,
                        uid,
                        answers: JSON.stringify(effectiveFormData),
                        status: 'submitted',
                      } as any,
                    },
                  },
                  {
                    onSuccess: () => {
                      message.success(t('form.submitSuccess'));
                      userStore.setShowOnboardingSuccessAnimation(true);
                      userStore.setShowOnboardingFormModal(false);
                    },
                  },
                );
              }
            }}
          >
            {submitFormMutation.isPending ? t('form.submitting') : t('form.submit')}
          </Button>
        ) : (
          <Button
            type="primary"
            onClick={goToNextPage}
            disabled={!canProceed}
            className="w-[180px] h-14 -mt-8 rounded-full"
          >
            {t('form.next')}
          </Button>
        )}
      </div>
    );
  };

  return (
    <section
      className={mergeClassNames(
        'p-6 sm:p-10 space-y-8',
        disabled ? 'opacity-60' : undefined,
        readonly ? 'pointer-events-none' : undefined,
      )}
    >
      {showHeader ? (
        <header className="flex flex-col items-center gap-4 text-center min-h-[90px]">
          <div className="flex flex-col items-center gap-1">
            <h2 className="text-2xl font-semibold text-refly-text-0">
              {emoji}
              {title}
            </h2>
          </div>
          {subtitleNode ? (
            <p className="text-sm text-refly-text-1 max-w-xl leading-relaxed">{subtitleNode}</p>
          ) : null}
          <div className="w-full max-w-3xl flex justify-center">{renderProgress()}</div>
        </header>
      ) : null}

      <div className="space-y-6">
        {isPaginated && currentProperty ? (
          <div
            key={currentProperty.name}
            className={wrapSections ? 'rounded-3xl border border-transparent p-5' : ''}
          >
            {currentProperty.content}
          </div>
        ) : (
          properties
            .filter((property) => !property.hidden)
            .map((property) => (
              <div
                key={property.name}
                className={wrapSections ? 'rounded-3xl border border-transparent p-5' : ''}
              >
                {property.content}
              </div>
            ))
        )}
      </div>

      {renderSummary()}

      {renderNavigation()}

      {required && !isPaginated ? (
        <div className="text-xs text-refly-text-2 text-center">{requiredHint}</div>
      ) : null}
    </section>
  );
};

const ArrayFieldTemplate = (props: RjsfArrayFieldTemplateProps) => {
  const { canAdd, disabled, readonly, items, onAddClick, schema, title, uiSchema } = props;
  const uiOptions = (uiSchema?.['ui:options'] ?? {}) as Record<string, unknown>;
  const addButtonLabel = (uiOptions.addButtonLabel as string) ?? '添加选项';
  const description = schema?.description;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-semibold text-refly-text-0">{title ?? schema?.title}</div>
        {description ? <div className="text-xs text-refly-text-2 mt-1">{description}</div> : null}
      </div>
      <div className="space-y-3">
        {items?.map((element) => (
          <div
            key={element.key}
            className="border border-refly-border-primary rounded-2xl p-4 space-y-3"
          >
            {element.children}
            <div className="flex justify-end gap-2">
              {element.hasToolbar ? element.toolbar : null}
            </div>
          </div>
        ))}
      </div>
      {canAdd ? (
        <Button
          type="dashed"
          className="w-full h-11 rounded-2xl border-dashed border-refly-border-primary text-refly-text-0"
          disabled={disabled || readonly}
          onClick={(event) => onAddClick(event)}
        >
          {addButtonLabel}
        </Button>
      ) : null}
    </div>
  );
};

const resolvePlaceholder = (
  schema?: Record<string, unknown>,
  options?: Record<string, unknown>,
) => {
  if (options && typeof options.placeholder === 'string') {
    return options.placeholder;
  }
  if (schema && typeof schema.description === 'string') {
    return schema.description;
  }
  if (schema && typeof schema.title === 'string') {
    return schema.title;
  }
  return '';
};

const toInputValue = (input: unknown): string => {
  if (typeof input === 'string') {
    return input;
  }
  if (typeof input === 'number') {
    return String(input);
  }
  if (input === undefined || input === null) {
    return '';
  }
  return String(input);
};

const TextWidget = (props: RjsfWidgetProps) => {
  const { id, required, disabled, readonly, value, onChange, schema, options, autofocus } = props;
  const placeholder = resolvePlaceholder(schema, options);
  return (
    <Input
      id={id}
      value={toInputValue(value)}
      placeholder={placeholder}
      disabled={disabled || readonly}
      autoFocus={autofocus}
      required={required}
      onChange={(event) => onChange(event.target.value ?? '')}
      className="h-11 rounded-2xl bg-refly-bg-control-z1 border-none focus:shadow focus:shadow-refly-primary/20"
    />
  );
};

const TextAreaWidget = (props: RjsfWidgetProps) => {
  const { id, required, disabled, readonly, value, onChange, schema, options } = props;
  const placeholder = resolvePlaceholder(schema, options);
  const rows = options && typeof options.rows === 'number' && options.rows > 0 ? options.rows : 3;
  return (
    <Input.TextArea
      id={id}
      value={toInputValue(value)}
      placeholder={placeholder}
      disabled={disabled || readonly}
      required={required}
      onChange={(event) => onChange(event.target.value ?? '')}
      className="rounded-2xl bg-refly-bg-control-z1 border-none focus:shadow focus:shadow-refly-primary/20"
      rows={rows}
    />
  );
};

const CheckboxWidget = (props: RjsfWidgetProps) => {
  const { id, value, disabled, readonly, label, onChange } = props;
  return (
    <Checkbox
      id={id}
      checked={Boolean(value)}
      disabled={disabled || readonly}
      onChange={(event) => onChange(event.target.checked)}
    >
      {label}
    </Checkbox>
  );
};

const RadioWidget = (props: RjsfWidgetProps) => {
  const { id, value, disabled, readonly, onChange, options, schema, formContext } = props;
  const enumOptions = useMemo(() => {
    return getEnumOptions(options);
  }, [options]);
  const hasClearedInitialValueRef = useRef(false);

  useEffect(() => {
    if (hasClearedInitialValueRef.current) {
      return;
    }
    const firstOptionValue = enumOptions.length > 0 ? enumOptions[0]?.value : undefined;
    const shouldResetValue = schema?.default === '' && value === firstOptionValue;
    if (shouldResetValue) {
      formContext?.__reflySuppressNextValidation__?.();
      onChange(undefined);
      hasClearedInitialValueRef.current = true;
    }
  }, [enumOptions, formContext, onChange, schema, value]);

  // Handle "other" option with input field
  const isOtherSelected =
    value === 'other' ||
    (typeof value === 'string' && !enumOptions.some((opt) => opt.value === value));
  const [otherValue, setOtherValue] = useState(
    isOtherSelected && value !== 'other' ? (value as string) : '',
  );

  // Update otherValue when value changes from external source
  useEffect(() => {
    if (isOtherSelected && value !== 'other') {
      setOtherValue(value as string);
    }
  }, [isOtherSelected, value]);

  return (
    <div className="grid grid-cols-2 gap-2">
      {enumOptions.map((option, index) => {
        const checked = value === option.value || (option.value === 'other' && isOtherSelected);
        const optionId = id ? `${id}-${index}` : undefined;
        return (
          <button
            type="button"
            key={String(option.value)}
            className={mergeClassNames(
              'w-full h-[52px] flex items-center gap-3 border rounded-2xl px-4 text-left transition-colors',
              'border-refly-Card-Border bg-transparent',
              disabled || readonly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
            )}
            aria-pressed={checked}
            onClick={() => {
              if (disabled || readonly) {
                return;
              }
              if (checked) {
                // Allow deselection by clicking on selected option
                onChange(undefined);
                setOtherValue('');
              } else {
                if (option.value === 'other') {
                  // When selecting "other", set to empty string initially
                  onChange('');
                  setOtherValue('');
                } else {
                  onChange(option.value);
                }
              }
            }}
          >
            <Radio
              id={optionId}
              checked={checked}
              disabled={disabled || readonly}
              onChange={(event) => {
                event.stopPropagation();
                if (checked) {
                  // Allow deselection when clicking on selected radio
                  onChange(undefined);
                  setOtherValue('');
                } else {
                  if (option.value === 'other') {
                    onChange('');
                    setOtherValue('');
                  } else {
                    onChange(option.value);
                  }
                }
              }}
            />
            <span className="text-sm font-medium text-refly-text-0">
              {buildOptionLabel(option.label, option.value)}
            </span>
          </button>
        );
      })}
      {isOtherSelected && (
        <div className="col-span-2 mt-1">
          <Input
            placeholder="请输入其他选项"
            value={otherValue}
            disabled={disabled || readonly}
            onChange={(e) => {
              const newValue = e.target.value;
              setOtherValue(newValue);
              onChange(newValue);
            }}
            className="w-full h-[56px]"
          />
        </div>
      )}
    </div>
  );
};

const CheckboxesWidget = (props: RjsfWidgetProps) => {
  const { value, disabled, readonly, onChange, options } = props;
  const enumOptions = getEnumOptions(options);
  const selectedValues = Array.isArray(value) ? value : [];

  // Handle "other" option with input field
  const hasCustomText = selectedValues.some(
    (item) =>
      typeof item === 'string' &&
      !enumOptions.some((opt) => opt.value === item) &&
      item !== 'other',
  );
  const otherTextValue =
    (selectedValues.find(
      (item) =>
        typeof item === 'string' &&
        !enumOptions.some((opt) => opt.value === item) &&
        item !== 'other',
    ) as string) || '';
  const [otherValue, setOtherValue] = useState(otherTextValue);

  // Update otherValue when selectedValues change
  useEffect(() => {
    const newOtherText =
      (selectedValues.find(
        (item) =>
          typeof item === 'string' &&
          !enumOptions.some((opt) => opt.value === item) &&
          item !== 'other',
      ) as string) || '';
    setOtherValue(newOtherText);
  }, [selectedValues, enumOptions]);

  const toggleValue = (optionValue: unknown) => {
    const exists = selectedValues.some((item) => item === optionValue);
    if (exists) {
      if (optionValue === 'other') {
        // When unchecking "other", remove "other" and any custom text (not in enumOptions)
        const filtered = selectedValues.filter(
          (item) => enumOptions.some((opt) => opt.value === item) && item !== 'other',
        );
        onChange(filtered);
        setOtherValue('');
      } else {
        onChange(selectedValues.filter((item) => item !== optionValue));
      }
    } else {
      onChange([...selectedValues, optionValue]);
    }
  };

  const handleOtherInputChange = (newValue: string) => {
    setOtherValue(newValue);

    // Remove any existing custom text values and all "other" from selectedValues
    const filteredValues = selectedValues.filter(
      (item) => enumOptions.some((opt) => opt.value === item) && item !== 'other',
    );

    // Remove any existing custom text values (those not in enumOptions)
    const finalFilteredValues = filteredValues.filter((item) =>
      enumOptions.some((opt) => opt.value === item),
    );

    if (newValue.trim()) {
      // Add only the custom text value (don't include "other")
      onChange([...finalFilteredValues, newValue.trim()]);
    } else {
      // Don't add anything if no text (user needs to explicitly check "other" if they want it)
      onChange(finalFilteredValues);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {enumOptions.map((option) => {
        const isOtherOption = option.value === 'other';
        const checked =
          selectedValues.some((item) => item === option.value) || (isOtherOption && hasCustomText);
        const shouldShowInput =
          isOtherOption && (selectedValues.includes('other') || hasCustomText);
        return (
          <>
            <button
              type="button"
              key={String(option.value)}
              className={mergeClassNames(
                'w-full h-[52px] flex items-center gap-3 border rounded-2xl px-4 text-left transition-colors',
                'border-refly-Card-Border bg-transparent',
                disabled || readonly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
              )}
              onClick={() => {
                if (disabled || readonly) {
                  return;
                }
                toggleValue(option.value);
              }}
            >
              <Checkbox
                checked={checked}
                disabled={disabled || readonly}
                onChange={(event) => {
                  event.stopPropagation();
                  toggleValue(option.value);
                }}
              />
              <span className="text-sm font-medium text-refly-text-0">
                {buildOptionLabel(option.label, option.value)}
              </span>
            </button>
            {shouldShowInput && (
              <div className="col-span-2 mt-3">
                <Input
                  placeholder="Please enter other options"
                  value={otherValue}
                  disabled={disabled || readonly}
                  onChange={(e) => handleOtherInputChange(e.target.value)}
                  className="w-full h-[56px] bg-transparent"
                />
              </div>
            )}
          </>
        );
      })}
    </div>
  );
};

const widgets = {
  CheckboxWidget,
  CheckboxesWidget,
  RadioWidget,
  SelectWidget: CheckboxesWidget,
  TextareaWidget: TextAreaWidget,
  TextWidget,
};

const templates = {
  ArrayFieldTemplate,
  FieldTemplate,
  ObjectFieldTemplate,
};

export const ReflyRjsfTheme = withTheme({
  widgets: widgets as any,
  templates: templates as any,
});
