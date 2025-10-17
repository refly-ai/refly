import type { WorkflowVariable, WorkflowExecutionStatus } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { Button, Form } from 'antd';
import { Play, Copy } from 'refly-icons';
import { IconShare } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { UploadFile } from 'antd/es/upload/interface';
import { MixedTextEditor } from '@refly-packages/ai-workspace-common/components/workflow-app/mixed-text-editor';
import cn from 'classnames';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
import { useIsLogin } from '@refly-packages/ai-workspace-common/hooks/use-is-login';
import { useNavigate } from 'react-router-dom';

const EmptyContent = () => {
  const { t } = useTranslation();
  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <img src={EmptyImage} alt="no variables" className="w-[120px] h-[120px] -mb-4" />
      <div className="text-sm text-refly-text-2 leading-5">
        {t('canvas.workflow.run.emptyTitle', 'No variables defined')}
      </div>
      <div className="text-sm text-refly-text-2 leading-5">
        {t(
          'canvas.workflow.run.emptyDescription',
          ' the workflow will be executed once if continued.',
        )}
      </div>
    </div>
  );
};

interface WorkflowRunFormProps {
  workflowVariables: WorkflowVariable[];
  onSubmitVariables: (variables: WorkflowVariable[]) => Promise<void>;
  onCopyWorkflow?: () => void;
  onCopyShareLink?: () => void;
  loading: boolean;
  executionId?: string | null;
  workflowStatus?: WorkflowExecutionStatus | null;
  isPolling?: boolean;
  pollingError?: any;
  isRunning?: boolean;
  onRunningChange?: (isRunning: boolean) => void;
  className?: string;
  templateContent?: string;
}

export const WorkflowRunForm = ({
  workflowVariables,
  onSubmitVariables,
  onCopyWorkflow,
  onCopyShareLink,
  loading,
  isPolling,
  isRunning: externalIsRunning,
  onRunningChange,
  className,
  templateContent,
}: WorkflowRunFormProps) => {
  const { t } = useTranslation();
  const { isLoggedRef } = useIsLogin();
  const navigate = useNavigate();

  const [internalIsRunning, setInternalIsRunning] = useState(false);

  // Use external isRunning if provided, otherwise use internal state
  const isRunning = externalIsRunning ?? internalIsRunning;
  const [form] = Form.useForm();
  const [variableValues, setVariableValues] = useState<Record<string, any>>({});
  const [templateVariables, setTemplateVariables] = useState<WorkflowVariable[]>([]);

  // Check if form should be disabled
  const isFormDisabled = loading || isRunning || isPolling;

  // Check if all required fields are filled
  const isFormValid = useMemo(() => {
    return workflowVariables.every((variable) => {
      if (!variable.required) {
        return true;
      }

      const value = variableValues[variable.name];

      if (variable.variableType === 'string') {
        return value && value.trim() !== '';
      }

      if (variable.variableType === 'option') {
        return value && (Array.isArray(value) ? value.length > 0 : value);
      }

      if (variable.variableType === 'resource') {
        return value && Array.isArray(value) && value.length > 0;
      }

      return false;
    });
  }, [workflowVariables, variableValues]);

  const convertVariableToFormValue = useCallback(() => {
    const formValues: Record<string, any> = {};

    for (const variable of workflowVariables) {
      if (variable.variableType === 'string') {
        formValues[variable.name] = variable.value?.[0]?.text ?? '';
      } else if (variable.variableType === 'option') {
        // Handle both array and single value cases
        const valueArray = Array.isArray(variable.value)
          ? variable.value
          : variable.value
            ? [variable.value]
            : [];
        formValues[variable.name] = valueArray.map((v) => v.text);
      } else if (variable.variableType === 'resource') {
        // Convert resource values to UploadFile format
        const fileList: UploadFile[] =
          variable.value?.map((v, index) => ({
            uid: `file-${index}`,
            name: v.resource?.name || '',
            status: 'done',
            url: v.resource?.storageKey || '',
          })) || [];
        formValues[variable.name] = fileList;
      }
    }

    return formValues;
  }, [workflowVariables]);

  // Handle template variable changes
  const handleTemplateVariableChange = useCallback((variables: WorkflowVariable[]) => {
    setTemplateVariables(variables);
  }, []);

  // Update form values when workflowVariables change
  useEffect(() => {
    const newValues = convertVariableToFormValue();
    setVariableValues(newValues);
    form.setFieldsValue(newValues);
  }, [workflowVariables, form]);

  // Initialize template variables when templateContent changes
  useEffect(() => {
    if (templateContent) {
      // Extract variables from template content
      const variableRegex = /\{\{([^}]+)\}\}/g;
      const templateVariableNames = new Set<string>();
      let match: RegExpExecArray | null;

      match = variableRegex.exec(templateContent);
      while (match !== null) {
        templateVariableNames.add(match[1].trim());
        match = variableRegex.exec(templateContent);
      }

      // Filter workflowVariables to only include those mentioned in template
      const relevantVariables = workflowVariables.filter((variable) =>
        templateVariableNames.has(variable.name),
      );

      setTemplateVariables(relevantVariables);
    }
  }, [templateContent, workflowVariables]);

  const handleRun = async () => {
    if (loading || isRunning) {
      return;
    }

    // Check if user is logged in
    if (!isLoggedRef.current) {
      // Redirect to login with return URL
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      navigate(`/?autoLogin=true&returnUrl=${returnUrl}`);
      return;
    }

    try {
      // Validate form before running
      // Validate templateVariables values
      const hasInvalidValues = templateVariables.some((variable) => {
        if (!variable.value || variable.value.length === 0) {
          return true;
        }

        return variable.value.every((val) => {
          if (variable.variableType === 'string') {
            return !val.text || val.text.trim() === '';
          }
          if (variable.variableType === 'option') {
            return !val.text || val.text.trim() === '';
          }
          if (variable.variableType === 'resource') {
            return !val.resource || !val.resource.storageKey;
          }
          return true;
        });
      });

      if (hasInvalidValues) {
        return;
      }

      // If validation passes, proceed with running
      const newVariables = templateVariables;

      // Set running state - use external callback if provided, otherwise use internal state
      if (onRunningChange) {
        onRunningChange(true);
      } else {
        setInternalIsRunning(true);
      }

      await onSubmitVariables(newVariables);

      // Reset running state on validation error
      if (onRunningChange) {
        onRunningChange(false);
      } else {
        setInternalIsRunning(false);
      }
    } catch (error) {
      // Form validation failed, scroll to first error
      if (error?.errorFields && error.errorFields.length > 0) {
        const firstErrorField = error.errorFields[0];
        const fieldName = firstErrorField.name;
        if (Array.isArray(fieldName) && fieldName.length > 0) {
          const fieldNameStr = fieldName[0];

          // Try to find the form item container first
          let element = document.querySelector(`[name="${fieldNameStr}"]`) as HTMLElement;

          if (!element) {
            // If direct input not found, try to find the form item container
            element = document.querySelector(`[data-field-name="${fieldNameStr}"]`) as HTMLElement;
          }

          if (element) {
            // Find the scrollable container
            const scrollContainer = document.querySelector(
              '.p-4.flex-1.overflow-y-auto',
            ) as HTMLElement;

            if (scrollContainer) {
              // Calculate the scroll position
              const containerRect = scrollContainer.getBoundingClientRect();
              const elementRect = element.getBoundingClientRect();
              const currentScrollTop = scrollContainer.scrollTop;
              const targetScrollTop = currentScrollTop + elementRect.top - containerRect.top - 40;

              // Smooth scroll to the target position
              scrollContainer.scrollTo({
                top: targetScrollTop,
                behavior: 'smooth',
              });
            } else {
              // Fallback to default scrollIntoView
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            // Focus on the first error field with delay
            setTimeout(() => {
              // Try to focus on the input element if it exists
              const inputElement = element.querySelector('input, select') as HTMLElement;
              if (inputElement?.focus) {
                inputElement.focus();
              } else if (element?.focus) {
                element.focus();
              }
            }, 400);
          }
        }
      }

      // Reset running state on validation error
      if (onRunningChange) {
        onRunningChange(false);
      } else {
        setInternalIsRunning(false);
      }
    }
  };

  return (
    <div className={cn('w-full h-full gap-3 flex flex-col', className)}>
      {
        <>
          <div className="p-3 sm:p-4 flex-1 overflow-y-auto">
            {/* Show loading state when loading */}
            {templateContent ? (
              <div className="space-y-4">
                <div className="bg-white rounded-lg border border-refly-Card-Border shadow-sm p-4">
                  <MixedTextEditor
                    templateContent={templateContent}
                    variables={templateVariables.length > 0 ? templateVariables : workflowVariables}
                    onVariablesChange={handleTemplateVariableChange}
                    disabled={isFormDisabled}
                    originalVariables={workflowVariables}
                  />
                </div>
              </div>
            ) : loading ? null : (
              <EmptyContent />
            )}
          </div>
          <div className="p-3 sm:p-4 border-t border-refly-Card-Border bg-refly-bg-control-z0 rounded-b-lg">
            <div className="flex gap-2">
              <Button
                className={cn(
                  'flex-1 h-9 sm:h-10 text-sm sm:text-base',
                  (!isFormValid || isPolling) &&
                    'bg-refly-bg-control-z1 hover:!bg-refly-tertiary-hover !text-refly-text-3 font-semibold',
                )}
                type="primary"
                icon={<Play size={14} className="sm:w-4 sm:h-4" />}
                onClick={handleRun}
                loading={loading || isRunning || isPolling}
                disabled={loading || isRunning || isPolling}
              >
                {isPolling
                  ? t('canvas.workflow.run.executing') || 'Executing...'
                  : t('canvas.workflow.run.run') || 'Run'}
              </Button>

              {onCopyWorkflow && (
                <Button
                  className="h-9 sm:h-10 text-sm sm:text-base"
                  type="default"
                  icon={<Copy size={14} className="sm:w-4 sm:h-4" />}
                  onClick={onCopyWorkflow}
                >
                  {t('canvas.workflow.run.copyWorkflow') || 'Copy Workflow'}
                </Button>
              )}

              {onCopyShareLink && (
                <Button
                  className="h-9 sm:h-10 text-sm sm:text-base"
                  type="default"
                  icon={<IconShare size={14} className="sm:w-4 sm:h-4" />}
                  onClick={onCopyShareLink}
                >
                  {t('canvas.workflow.run.copyShareLink') || 'Copy Share Link'}
                </Button>
              )}
            </div>
          </div>
        </>
      }
    </div>
  );
};
