import type { WorkflowVariable, WorkflowExecutionStatus } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { Button, Input, Select, Form, Typography, message, Modal } from 'antd';
import { Play, Stop } from 'refly-icons';
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { UploadFile } from 'antd/es/upload/interface';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

import cn from 'classnames';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
import { useIsLogin } from '@refly-packages/ai-workspace-common/hooks/use-is-login';
import { useNavigate } from 'react-router-dom';
import { ToolsDependencyChecker } from '@refly-packages/ai-workspace-common/components/canvas/tools-dependency';
import { MixedTextEditor } from '@refly-packages/ai-workspace-common/components/workflow-app/mixed-text-editor';
import { ResourceUpload } from '@refly-packages/ai-workspace-common/components/canvas/workflow-run/resource-upload';
import { useFileUpload } from '@refly-packages/ai-workspace-common/components/canvas/workflow-variables';
import { getFileType } from '@refly-packages/ai-workspace-common/components/canvas/workflow-variables/utils';

const RequiredTagText = () => {
  const { t } = useTranslation();
  return (
    <div className="flex-shrink-0 text-[10px] text-refly-text-2 leading-[16px] px-1 border-[1px] border-solid border-refly-Card-Border rounded-[4px]">
      {t('canvas.workflow.variables.required') || 'Required'}
    </div>
  );
};

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

const FormItemLabel = ({ name, required }: { name: string; required: boolean }) => {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Typography.Paragraph
        ellipsis={{ rows: 1, tooltip: <div className="max-h-[200px] overflow-y-auto">{name}</div> }}
        className="!m-0 text-xs font-semibold text-refly-text-0 leading-4 max-w-[100px]"
      >
        {name}
      </Typography.Paragraph>

      {required && <RequiredTagText />}
    </div>
  );
};

interface WorkflowRunFormProps {
  workflowVariables: WorkflowVariable[];
  onSubmitVariables: (variables: WorkflowVariable[]) => Promise<void>;
  loading: boolean;
  executionId?: string | null;
  workflowStatus?: WorkflowExecutionStatus | null;
  isPolling?: boolean;
  pollingError?: any;
  isRunning?: boolean;
  onRunningChange?: (isRunning: boolean) => void;
  className?: string;
  templateContent?: string;
  workflowApp?: any;
  creditUsage?: number | null;
}

export const WorkflowRunForm = ({
  workflowVariables,
  onSubmitVariables,
  loading,
  executionId,
  isPolling,
  isRunning: externalIsRunning,
  onRunningChange,
  className,
  templateContent,
  workflowApp,
  creditUsage,
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

  // File upload hook
  const {
    uploading,
    handleFileUpload: uploadFile,
    handleRefreshFile: refreshFile,
  } = useFileUpload();

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

  const convertFormValueToVariable = useCallback(() => {
    const newVariables: WorkflowVariable[] = [];
    for (const variable of workflowVariables) {
      const value = variableValues[variable.name];
      if (variable.variableType === 'string') {
        newVariables.push({
          ...variable,
          value: [{ type: 'text', text: value }],
        });
      } else if (variable.variableType === 'option') {
        // Handle both array and single value cases
        const valueArray = Array.isArray(value) ? value : value ? [value] : [];
        newVariables.push({
          ...variable,
          value: valueArray.map((v) => ({ type: 'text', text: v })),
        });
      } else if (variable.variableType === 'resource') {
        const v = Array.isArray(value) ? value[0] : undefined;
        const entityId = variable?.value?.[0]?.resource?.entityId;

        if (v) {
          newVariables.push({
            ...variable,
            value: [
              {
                type: 'resource',
                resource: {
                  name: v.name,
                  storageKey: v.url,
                  fileType: getFileType(v.name),
                  ...(entityId && { entityId }),
                },
              },
            ],
          });
        }
      }
    }
    return newVariables;
  }, [workflowVariables, variableValues]);

  // Handle form value changes
  const handleValueChange = (variableName: string, value: any) => {
    setVariableValues((prev) => ({
      ...prev,
      [variableName]: value,
    }));
  };

  // Handle file upload for resource type variables
  const handleFileUpload = useCallback(
    async (file: File, variableName: string) => {
      const currentFileList = variableValues[variableName] || [];
      const result = await uploadFile(file, currentFileList);

      if (result && typeof result === 'object' && 'storageKey' in result) {
        // Create new file with storageKey
        const newFile: UploadFile = {
          uid: result.uid,
          name: file.name,
          status: 'done',
          url: result.storageKey, // Store storageKey in url field
        };

        // Replace the file list with the new file (single file limit)
        const newFileList = [newFile];
        handleValueChange(variableName, newFileList);
        form.setFieldsValue({
          [variableName]: newFileList,
        });
        return false; // Prevent default upload behavior
      }
      return false;
    },
    [uploadFile, variableValues],
  );

  // Handle file removal for resource type variables
  const handleFileRemove = useCallback(
    (file: UploadFile, variableName: string) => {
      const currentFileList = variableValues[variableName] || [];
      const newFileList = currentFileList.filter((f: UploadFile) => f.uid !== file.uid);
      handleValueChange(variableName, newFileList);
      form.setFieldsValue({
        [variableName]: newFileList,
      });
    },
    [variableValues, handleValueChange],
  );

  // Handle file refresh for resource type variables
  const handleRefreshFile = useCallback(
    (variableName: string) => {
      const currentFileList = variableValues[variableName] || [];
      // Find the variable to get its resourceTypes
      const variable = workflowVariables.find((v) => v.name === variableName);
      const resourceTypes = variable?.resourceTypes;

      refreshFile(
        currentFileList,
        (newFileList: UploadFile[]) => {
          handleValueChange(variableName, newFileList);
          form.setFieldsValue({
            [variableName]: newFileList,
          });
        },
        resourceTypes,
      );
    },
    [refreshFile, variableValues, handleValueChange, form, workflowVariables],
  );

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

  // Update form values when workflowVariables change
  useEffect(() => {
    const newValues = convertVariableToFormValue();
    setVariableValues(newValues);
    form.setFieldsValue(newValues);
  }, [workflowVariables, form]);

  const handleAbort = async () => {
    if (!executionId) {
      return;
    }

    Modal.confirm({
      title: t('canvas.workflow.run.abort.confirmTitle'),
      content: t('canvas.workflow.run.abort.confirmContent'),
      okText: t('canvas.workflow.run.abort.confirm'),
      cancelText: t('common.cancel'),
      icon: null,
      okButtonProps: {
        className: '!bg-[#0E9F77] !border-[#0E9F77] hover:!bg-[#0C8A66] hover:!border-[#0C8A66]',
      },
      onOk: async () => {
        try {
          const { error } = await getClient().abortWorkflow({
            body: { executionId },
          });

          if (error) {
            message.error(t('canvas.workflow.run.abort.failed'));
            return;
          }

          message.success(t('canvas.workflow.run.abort.success'));

          // Reset running state
          if (onRunningChange) {
            onRunningChange(false);
          } else {
            setInternalIsRunning(false);
          }
        } catch (error) {
          console.error('Failed to abort workflow:', error);
          message.error(t('canvas.workflow.run.abort.failed'));
        }
      },
    });
  };

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
      let newVariables: WorkflowVariable[] = [];

      if (templateContent) {
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
          // Show validation error message
          message.warning(
            t(
              'canvas.workflow.run.validationError',
              'Please fill in all required fields before running the workflow',
            ),
          );
          return;
        }

        newVariables = templateVariables;
      } else {
        // Validate form before running
        await form.validateFields();

        // If validation passes, proceed with running
        newVariables = convertFormValueToVariable();
      }

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

  // Render form field based on variable type
  const renderFormField = (variable: WorkflowVariable) => {
    if (!variable) {
      return null;
    }
    const { name, required, variableType, options, isSingle, resourceTypes } = variable;
    const value = variableValues[name];

    if (variableType === 'string') {
      return (
        <Form.Item
          key={name}
          label={<FormItemLabel name={name} required={required} />}
          name={name}
          rules={
            required
              ? [{ required: true, message: t('canvas.workflow.variables.inputPlaceholder') }]
              : []
          }
          data-field-name={name}
        >
          <Input
            variant="filled"
            placeholder={t('canvas.workflow.variables.inputPlaceholder')}
            value={value}
            onChange={(e) => handleValueChange(name, e.target.value)}
            data-field-name={name}
            disabled={isFormDisabled}
          />
        </Form.Item>
      );
    }

    if (variableType === 'option') {
      return (
        <Form.Item
          key={name}
          label={<FormItemLabel name={name} required={required} />}
          name={name}
          rules={
            required
              ? [{ required: true, message: t('canvas.workflow.variables.selectPlaceholder') }]
              : []
          }
        >
          <Select
            variant="filled"
            placeholder={t('canvas.workflow.variables.selectPlaceholder')}
            mode={isSingle ? undefined : 'multiple'}
            value={value}
            onChange={(val) => handleValueChange(name, val)}
            options={options?.map((opt) => ({ label: opt, value: opt })) ?? []}
            data-field-name={name}
            disabled={isFormDisabled}
          />
        </Form.Item>
      );
    }

    if (variableType === 'resource') {
      return (
        <Form.Item
          key={name}
          label={<FormItemLabel name={name} required={required} />}
          name={name}
          rules={
            required
              ? [{ required: true, message: t('canvas.workflow.variables.uploadPlaceholder') }]
              : []
          }
        >
          <ResourceUpload
            value={value || []}
            onUpload={(file) => handleFileUpload(file, name)}
            onRemove={(file) => handleFileRemove(file, name)}
            onRefresh={() => handleRefreshFile(name)}
            resourceTypes={resourceTypes}
            disabled={uploading || isFormDisabled}
            maxCount={1}
            data-field-name={name}
          />
        </Form.Item>
      );
    }

    return null;
  };

  // Handle template variable changes
  const handleTemplateVariableChange = useCallback((variables: WorkflowVariable[]) => {
    setTemplateVariables(variables);
  }, []);

  const workflowIsRunning = isRunning || isPolling;

  return (
    <div className={cn('w-full h-full gap-3 flex flex-col rounded-2xl', className)}>
      {
        <>
          {/* default show Form */}
          {/* biome-ignore lint/correctness/noConstantCondition: <explanation> */}
          {false ? (
            <div className="space-y-4">
              <div className="bg-refly-bg-content-z2 rounded-2xl shadow-[0px_2px_20px_4px_rgba(0,0,0,0.04)] p-4">
                <MixedTextEditor
                  templateContent={templateContent}
                  variables={templateVariables.length > 0 ? templateVariables : workflowVariables}
                  onVariablesChange={handleTemplateVariableChange}
                  disabled={isFormDisabled}
                  originalVariables={workflowVariables}
                />

                {/* Tools Dependency Form */}
                {workflowApp?.canvasData && (
                  <div className="mt-3 ">
                    <ToolsDependencyChecker canvasData={workflowApp?.canvasData} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3 sm:p-4 flex-1 overflow-y-auto">
              {/* Show loading state when loading */}
              {workflowVariables.length > 0 ? (
                <>
                  <Form
                    form={form}
                    layout="horizontal"
                    className="space-y-3 sm:space-y-4"
                    initialValues={variableValues}
                  >
                    {workflowVariables.map((variable) => renderFormField(variable))}
                  </Form>

                  {/* Tools Dependency Form */}
                  {workflowApp?.canvasData && (
                    <div className="mt-5 ">
                      <ToolsDependencyChecker canvasData={workflowApp?.canvasData} />
                    </div>
                  )}
                </>
              ) : loading ? null : (
                <EmptyContent />
              )}
            </div>
          )}

          <div className="p-3 border-t-[1px] border-x-0 border-b-0 border-solid border-refly-Card-Border bg-refly-bg-body-z0 rounded-b-lg flex flex-col gap-2">
            {creditUsage !== null && creditUsage !== undefined && (
              <div className="text-xs leading-4 text-refly-primary-default text-center">
                {t('canvas.workflow.run.creditUsage', { count: creditUsage })}
              </div>
            )}
            <Button
              className="w-full h-8 text-sm"
              {...(workflowIsRunning ? { color: 'primary' } : { type: 'primary' })}
              icon={workflowIsRunning ? <Stop size={16} /> : <Play size={16} />}
              onClick={workflowIsRunning ? handleAbort : handleRun}
              loading={loading}
              disabled={
                loading ||
                (workflowIsRunning && !executionId) ||
                (!workflowIsRunning && !isFormValid)
              }
            >
              {workflowIsRunning
                ? t('canvas.workflow.run.abort.abortButton') || 'Abort'
                : t('canvas.workflow.run.run') || 'Run'}
            </Button>
          </div>
        </>
      }
    </div>
  );
};
