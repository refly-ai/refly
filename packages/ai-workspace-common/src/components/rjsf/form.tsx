import type { FormProps } from '@rjsf/core';
import type { RJSFSchema } from '@rjsf/utils';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { ReflyRjsfTheme } from './theme';

type SchemaDefaults = RJSFSchema;

const ThemedForm = ReflyRjsfTheme;

export const ReflyRjsfForm = memo(function ReflyRjsfForm<
  TFormData = Record<string, unknown>,
  TSchema extends SchemaDefaults = SchemaDefaults,
  TContext = unknown,
>(props: FormProps<TFormData, TSchema, TContext>) {
  const {
    className,
    noHtml5Validate = true,
    showErrorList = false,
    liveValidate = true,
    uiSchema = {},
    formContext,
    onChange,
    ...rest
  } = props;

  const [shouldLiveValidate, setShouldLiveValidate] = useState(false);
  const skipNextValidationRef = useRef(false);

  const suppressNextValidation = useCallback(() => {
    skipNextValidationRef.current = true;
  }, []);

  const mergedFormContext = useMemo(() => {
    return {
      ...(formContext ?? {}),
      __reflySuppressNextValidation__: suppressNextValidation,
    };
  }, [formContext, suppressNextValidation]);

  const handleChange = useCallback<
    NonNullable<FormProps<TFormData, TSchema, TContext>['onChange']>
  >(
    (event, idSchema) => {
      if (skipNextValidationRef.current) {
        skipNextValidationRef.current = false;
      } else if (!shouldLiveValidate && liveValidate) {
        setShouldLiveValidate(true);
      }
      onChange?.(event, idSchema);
    },
    [liveValidate, onChange, shouldLiveValidate],
  );

  const resolvedLiveValidate = liveValidate && shouldLiveValidate;

  // Hide default submit button since we handle submission through pagination
  const finalUiSchema = useMemo(() => {
    const submitButtonOptions = uiSchema?.['ui:submitButtonOptions'] ?? {};

    return {
      ...uiSchema,
      'ui:submitButtonOptions': {
        ...submitButtonOptions,
        norender: true,
      },
    };
  }, [uiSchema]);

  const containerClassName = useMemo(() => {
    const segments = ['w-[912px]', 'h-[766px]', 'mt-8'];

    if (className) {
      segments.push(className);
    }

    return segments.join(' ');
  }, [className]);

  return (
    <div className={containerClassName}>
      <ThemedForm
        {...rest}
        uiSchema={finalUiSchema}
        noHtml5Validate={noHtml5Validate}
        showErrorList={showErrorList}
        liveValidate={resolvedLiveValidate}
        onChange={handleChange}
        formContext={mergedFormContext}
      />
    </div>
  );
});

ReflyRjsfForm.displayName = 'ReflyRjsfForm';
