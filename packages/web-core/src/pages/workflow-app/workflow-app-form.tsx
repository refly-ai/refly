import type { WorkflowVariable, WorkflowExecutionStatus } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { Button, Input, Select, Form, Typography, message, Tooltip, Avatar } from 'antd';
import { IconShare } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { UploadFile } from 'antd/es/upload/interface';

import cn from 'classnames';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
import defaultAvatar from '@refly-packages/ai-workspace-common/assets/refly_default_avatar.png';
import { useUserStoreShallow } from '@refly/stores';
import { useAuthStoreShallow } from '@refly/stores';
import { ToolsDependencyChecker } from '@refly-packages/ai-workspace-common/components/canvas/tools-dependency';
import { MixedTextEditor } from '@refly-packages/ai-workspace-common/components/workflow-app/mixed-text-editor';
import { ResourceUpload } from '@refly-packages/ai-workspace-common/components/canvas/workflow-run/resource-upload';
import { useFileUpload } from '@refly-packages/ai-workspace-common/components/canvas/workflow-variables';
import { getFileType } from '@refly-packages/ai-workspace-common/components/canvas/workflow-variables/utils';
import { Question } from 'refly-icons';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useTemplateGenerationStatus } from '../../hooks/useTemplateGenerationStatus';
import { TemplateStatusBadge } from './template-status-badge';
import { TemplateEditorSkeleton } from './template-editor-skeleton';
import { shouldShowStatusBadge } from '../../utils/templateStatus';

const EmptyContent = () => {
  const { t } = useTranslation();
  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <img src={EmptyImage} alt="no variables" className="w-[120px] h-[120px] -mb-4" />
      <div className="text-sm text-refly-text-2 leading-5">
        {t('canvas.workflow.run.emptyTitle')}
      </div>
      <div className="text-sm text-refly-text-2 leading-5">
        {t('canvas.workflow.run.emptyDescription')}
      </div>
    </div>
  );
};

// Format date to YYYY.MM.DD format
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) {
    return '';
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}.${month}.${day}`;
};

const FormItemLabel = ({ name }: { name: string; required: boolean }) => {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Typography.Paragraph
        ellipsis={{ rows: 1, tooltip: true }}
        className="!m-0 text-xs font-semibold text-refly-text-0 leading-4"
      >
        {name}
      </Typography.Paragraph>
    </div>
  );
};

interface WorkflowAPPFormProps {
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
  canvasId?: string | null;
  className?: string;
  templateContent?: string;
  workflowApp?: any;
  executionCreditUsage?: number | null;
}

export const WorkflowAPPForm = ({
  workflowVariables,
  onSubmitVariables,
  onCopyWorkflow,
  onCopyShareLink,
  loading,
  isPolling,
  isRunning: externalIsRunning,
  onRunningChange,
  canvasId,
  className,
  templateContent,
  workflowApp,
}: WorkflowAPPFormProps) => {
  const showRemix = false;
  const { t } = useTranslation();
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));
  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));

  const [internalIsRunning, setInternalIsRunning] = useState(false);

  // Use external isRunning if provided, otherwise use internal state
  const isRunning = externalIsRunning ?? internalIsRunning;
  const [form] = Form.useForm();
  const [variableValues, setVariableValues] = useState<Record<string, any>>({});
  const [templateVariables, setTemplateVariables] = useState<WorkflowVariable[]>([]);

  // Poll template generation status
  // Initial polling condition: no templateContent
  const [pollingEnabled, setPollingEnabled] = useState(
    () => !templateContent && !!workflowApp?.appId,
  );

  const {
    status: templateStatus,
    templateContent: polledTemplateContent,
    isInitialized: isStatusInitialized,
  } = useTemplateGenerationStatus({
    appId: workflowApp?.appId ?? null,
    enabled: pollingEnabled,
    pollingInterval: 2000,
    maxAttempts: 30,
  });

  // Update polling state based on templateContent and status
  useEffect(() => {
    if (!workflowApp?.appId) {
      setPollingEnabled(false);
      return;
    }

    // Poll if no templateContent or status is pending/generating (regeneration in progress)
    const shouldPoll =
      !templateContent ||
      (isStatusInitialized && (templateStatus === 'pending' || templateStatus === 'generating'));

    setPollingEnabled(shouldPoll);
  }, [templateContent, workflowApp?.appId, templateStatus, isStatusInitialized]);

  // Determine effective template content
  // Priority: polled content (if available and status is completed) > prop content > polled content
  // This ensures newly generated content from polling is used even if prop hasn't updated yet
  const effectiveTemplateContent =
    polledTemplateContent && templateStatus === 'completed'
      ? polledTemplateContent
      : (templateContent ?? polledTemplateContent);

  // Determine if status badge should be shown
  // Show badge when generating (pending/generating) or failed, and hide when content is available
  const shouldShowBadge =
    isStatusInitialized && shouldShowStatusBadge(templateStatus) && !effectiveTemplateContent;

  // Show editor when template content is available and status is completed or idle
  const shouldShowEditor =
    !!effectiveTemplateContent && (templateStatus === 'completed' || templateStatus === 'idle');

  // Show form when:
  // 1. Failed and no content (explicit failure)
  // 2. Completed but no content (abnormal case, allow user to interact)
  // 3. Idle and no content and initialized (no generation needed, show form for user input)
  const shouldShowForm =
    !shouldShowEditor &&
    isStatusInitialized &&
    !effectiveTemplateContent &&
    (templateStatus === 'failed' || templateStatus === 'completed' || templateStatus === 'idle');

  // Show skeleton screen by default (during initialization, pending, generating, or uninitialized idle)
  // This covers: uninitialized state, pending, generating, and idle without initialization
  const shouldShowSkeleton = !shouldShowEditor && !shouldShowForm;

  // Track previous status to show toast only when entering pending/generating state
  const previousStatusRef = useRef<string | null>(null);
  const hasShownToastRef = useRef(false);

  // Reset refs when appId changes
  useEffect(() => {
    previousStatusRef.current = null;
    hasShownToastRef.current = false;
  }, [workflowApp?.appId]);

  // Show toast when entering pending/generating state and showing skeleton
  useEffect(() => {
    const isGeneratingState =
      isStatusInitialized &&
      (templateStatus === 'pending' || templateStatus === 'generating') &&
      shouldShowSkeleton;

    // Show toast when entering generating state (from other states or initial load)
    if (isGeneratingState) {
      const prevStatus = previousStatusRef.current;
      const isEnteringGenerating =
        prevStatus === null || (prevStatus !== 'pending' && prevStatus !== 'generating');

      if (isEnteringGenerating && !hasShownToastRef.current) {
        message.info(t('canvas.workflow.template.updating'));
        hasShownToastRef.current = true;
      }
    } else {
      // Reset toast flag when leaving generating state
      if (previousStatusRef.current === 'pending' || previousStatusRef.current === 'generating') {
        hasShownToastRef.current = false;
      }
    }

    // Update previous status
    if (isStatusInitialized) {
      previousStatusRef.current = templateStatus;
    }
  }, [templateStatus, isStatusInitialized, shouldShowSkeleton, t]);

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
          variable.value?.map((v, index) => {
            const fileId = v.resource?.fileId;
            const entityId = v.resource?.entityId;

            return {
              uid: fileId || entityId || `file-${index}`, // Use fileId/entityId as uid if available
              name: v.resource?.name || '',
              status: 'done' as const,
              url: v.resource?.storageKey || '',
              // Store fileId in response for later retrieval
              ...(fileId && { response: { fileId } }),
            };
          }) || [];
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
        const existingFileId = variable?.value?.[0]?.resource?.fileId;

        if (v) {
          // Extract fileId from upload response if available
          const uploadedFileId = v.response?.fileId || v.uid;
          // Use uploaded fileId if it looks like a fileId (starts with 'df-'),
          // otherwise use existing fileId from variable
          const fileId = uploadedFileId?.startsWith?.('df-') ? uploadedFileId : existingFileId;

          newVariables.push({
            ...variable,
            value: [
              {
                type: 'resource',
                resource: {
                  name: v.name,
                  storageKey: v.url,
                  fileType: getFileType(v.name, v.type),
                  ...(fileId && { fileId }),
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
        let fileId: string | undefined;

        // Create DriveFile if canvasId is available
        if (canvasId) {
          const variable = workflowVariables.find((v) => v.name === variableName);
          if (variable?.variableId) {
            try {
              const { data: driveFileResponse, error } = await getClient().createDriveFile({
                body: {
                  canvasId,
                  name: file.name,
                  type: file.type,
                  storageKey: result.storageKey,
                  source: 'variable',
                  variableId: variable.variableId,
                },
              });

              if (!error && driveFileResponse?.data?.fileId) {
                fileId = driveFileResponse.data.fileId;
              }
            } catch (error) {
              console.error('Failed to create DriveFile:', error);
              // Continue without fileId if creation fails
            }
          }
        }

        // Create new file with storageKey and optional fileId
        const newFile: UploadFile = {
          uid: fileId || result.uid,
          name: file.name,
          status: 'done',
          url: result.storageKey, // Store storageKey in url field
          ...(fileId && { response: { fileId } }), // Store fileId in response for later retrieval
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
    [uploadFile, variableValues, canvasId, workflowVariables],
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
      const oldFileId = variable?.value?.[0]?.resource?.fileId;
      const variableId = variable?.variableId;

      refreshFile(
        currentFileList,
        (newFileList: UploadFile[]) => {
          handleValueChange(variableName, newFileList);
          form.setFieldsValue({
            [variableName]: newFileList,
          });
        },
        resourceTypes,
        oldFileId,
        canvasId,
        variableId,
      );
    },
    [refreshFile, variableValues, handleValueChange, form, workflowVariables, canvasId],
  );

  // Initialize template variables when effectiveTemplateContent changes
  useEffect(() => {
    if (effectiveTemplateContent) {
      setTemplateVariables(workflowVariables);
    }
  }, [effectiveTemplateContent, workflowVariables]);

  // Update form values when workflowVariables change
  useEffect(() => {
    const newValues = convertVariableToFormValue();
    setVariableValues(newValues);
    form.setFieldsValue(newValues);
  }, [workflowVariables, form]);

  const handleRun = async () => {
    if (loading || isRunning) {
      return;
    }

    // Check if user is logged in
    if (!isLogin) {
      setLoginModalOpen(true);
      return;
    }

    try {
      let newVariables: WorkflowVariable[] = [];

      if (effectiveTemplateContent) {
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
          message.warning(t('canvas.workflow.run.validationError'));
          return;
        }

        newVariables = templateVariables;
      } else {
        // Validate form before running
        await form.validateFields();

        // If validation passes, proceed with running
        newVariables = convertFormValueToVariable();
      }

      // Create DriveFile for variables without fileId
      if (canvasId) {
        for (const variable of newVariables) {
          // Skip if not a resource variable or has no value
          if (variable.variableType !== 'resource' || !variable.value) {
            continue;
          }

          for (const val of variable.value) {
            // Skip if not a resource type or has no resource data
            if (val.type !== 'resource' || !val.resource) {
              continue;
            }

            const { fileId, storageKey, name, mimeType } = val.resource as any;

            // Skip if already has fileId or missing required data
            if (fileId || !storageKey || !variable.variableId) {
              continue;
            }

            try {
              const { data: driveFileResponse, error } = await getClient().createDriveFile({
                body: {
                  canvasId,
                  name: name,
                  type: mimeType || 'application/octet-stream',
                  storageKey: storageKey,
                  source: 'variable',
                  variableId: variable.variableId,
                },
              });

              if (!error && driveFileResponse?.data?.fileId) {
                val.resource.fileId = driveFileResponse.data.fileId;
              }
            } catch (error) {
              console.error('Failed to create DriveFile:', error);
              // Continue without fileId if creation fails
            }
          }
        }
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
    } catch (error: any) {
      // Form validation failed, scroll to first error
      if (error?.errorFields && error?.errorFields?.length > 0) {
        const firstErrorField = error?.errorFields?.[0];
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

  const handleRemix = () => {
    // Check if user is logged in
    if (!isLogin) {
      setLoginModalOpen(true);
      return;
    }

    // Call the original onCopyWorkflow function
    onCopyWorkflow?.();
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
          label={<FormItemLabel name={name} required={required ?? false} />}
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
          label={<FormItemLabel name={name} required={required ?? false} />}
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
          label={<FormItemLabel name={name} required={required ?? false} />}
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

  const isRunButtonDisabled = loading || isRunning;

  return (
    <div>
      {
        <>
          {/* Show skeleton during generation */}
          {shouldShowSkeleton ? (
            <>
              <div
                className={cn('w-full h-full gap-3 flex flex-col rounded-2xl relative', className)}
              >
                {/* Status badge in top-right corner */}
                {shouldShowBadge && <TemplateStatusBadge status={templateStatus} />}
                <TemplateEditorSkeleton />
                {/* Tools Dependency Form */}
                {workflowApp?.canvasData && (
                  <div className="mt-3 flex items-center justify-between">
                    <ToolsDependencyChecker canvasData={workflowApp?.canvasData} />

                    <Tooltip title={t('canvas.workflow.run.toolsGuide') || 'Tools Guide'}>
                      <Button
                        className="flex items-center justify-center !h-7 !w-7 rounded-2xl hover:bg-refly-tertiary-hover bg-transparent border-none shadow-none"
                        type="text"
                        size="small"
                        icon={
                          <Question
                            size={16}
                            color="var(--refly-text-2)"
                            className="flex items-center"
                          />
                        }
                      />
                    </Tooltip>
                  </div>
                )}
              </div>

              {/* owner */}
              {workflowApp?.canvasData?.owner && (
                <div className="mt-2 flex items-center gap-1.5 cursor-pointer">
                  <Avatar
                    size={16}
                    src={workflowApp.canvasData.owner?.avatar || defaultAvatar}
                    className="flex-shrink-0"
                  />
                  <span className="text-[11px] leading-[1.4545em] text-[rgba(28,31,35,0.35)] dark:text-refly-text-3">
                    {workflowApp.canvasData.owner.nickname ||
                      workflowApp.canvasData.owner?.name ||
                      ''}
                  </span>
                  <div className="w-[1px] h-[10px] bg-[#E7E7E7] dark:bg-refly-Card-Border rounded-[3px] flex-shrink-0" />
                  <span className="text-[11px] leading-[1.4545em] text-[rgba(28,31,35,0.35)] dark:text-refly-text-3">
                    {formatDate(workflowApp?.updatedAt)}
                  </span>
                </div>
              )}

              <div className="pt-4 border-t border-refly-Card-Border rounded-b-lg">
                <div className="w-full flex flex-row justify-end items-center gap-3">
                  {/* Credit Info Block */}
                  {
                    <Tooltip title={t('subscription.creditBilling.description.canvasTotal')}>
                      <div className="flex items-center bg-[#F6F6F6] dark:bg-[#232323] rounded-tl-[12px] rounded-bl-[12px] rounded-tr-[-12px] rounded-br-[-12px] px-4 pr-6 h-10 min-w-[94px] gap-1 border border-transparent select-none font-roboto mr-[-24px]">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="22"
                          height="22"
                          viewBox="0 0 22 22"
                          fill="none"
                        >
                          <path
                            d="M10.9992 2.19922C11.3806 2.19922 11.7186 2.44489 11.8363 2.80766C12.9673 6.29581 15.7026 9.03109 19.1908 10.1622C19.5535 10.2799 19.7992 10.6178 19.7992 10.9992C19.7992 11.3806 19.5535 11.7186 19.1908 11.8363C15.7026 12.9673 12.9673 15.7026 11.8363 19.1908C11.7186 19.5535 11.3806 19.7992 10.9992 19.7992C10.6178 19.7992 10.2799 19.5535 10.1622 19.1908C9.03109 15.7026 6.29581 12.9673 2.80766 11.8363C2.44489 11.7186 2.19922 11.3806 2.19922 10.9992C2.19922 10.6178 2.44489 10.2799 2.80766 10.1622C6.29581 9.03109 9.03109 6.29581 10.1622 2.80766L10.2163 2.67703C10.3651 2.38714 10.6656 2.19922 10.9992 2.19922Z"
                            fill="url(#paint0_linear_1586_21457)"
                          />
                          <defs>
                            <linearGradient
                              id="paint0_linear_1586_21457"
                              x1="10"
                              y1="3.49902"
                              x2="16.5"
                              y2="19.999"
                              gradientUnits="userSpaceOnUse"
                            >
                              <stop stop-color="#32E2BB" />
                              <stop offset="1" stop-color="#0E9F77" />
                            </linearGradient>
                          </defs>
                        </svg>

                        <span className="font-semibold text-[20px] leading-[1.25em] font-roboto text-[#1C1F23] dark:text-white inline-flex items-center gap-[3px]">
                          {workflowApp?.creditUsage ?? 0}
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="15"
                            height="5"
                            viewBox="0 0 15 5"
                            fill="none"
                            className="fill-[#1C1F23] dark:fill-white"
                          >
                            <path d="M14.4697 0.915887C14.6995 1.06906 14.7639 1.38042 14.6121 1.61108C14.1144 2.36723 13.2896 3.54082 12.123 4.25476C11.3679 4.71688 10.4467 5.00886 9.37402 4.91199C8.3174 4.81654 7.2266 4.3538 6.09668 3.50867C5.53542 3.08897 5.09464 2.96119 4.76562 2.94421C4.43374 2.92718 4.1032 3.01782 3.75781 3.2157C3.15311 3.56226 2.61452 4.17132 2.17089 4.78259C2.00869 5.00607 1.69948 5.06906 1.46972 4.91589L0.22169 4.08387C-0.00807451 3.93069 -0.0713753 3.61969 0.0889509 3.39486C0.625529 2.64239 1.44023 1.6619 2.51562 1.04578C3.18379 0.663049 3.98585 0.401539 4.89355 0.44812C5.8041 0.49491 6.71106 0.845772 7.59473 1.50671C8.46471 2.15741 9.12402 2.37983 9.59863 2.42273C10.0571 2.46414 10.4486 2.34826 10.8184 2.12195C11.5184 1.69342 12.0448 0.950943 12.5293 0.223192C12.6824 -0.00666726 12.9919 -0.0693076 13.2217 0.0838687L14.4697 0.915887Z" />
                          </svg>
                        </span>
                        <span className="inline text-xs font-roboto font-normal text-[#1C1F23] dark:text-white opacity-60 ml-0.5">
                          / {t('canvas.workflow.run.run') || 'run'}
                        </span>
                      </div>
                    </Tooltip>
                  }
                  {/* RUN Button - disabled during generation */}
                  <Button
                    className={cn(
                      'h-10 flex items-center justify-center',
                      'w-[120px] sm:w-[200px] min-w-[109px]',
                      'px-4 sm:px-[46px] gap-2',
                      'text-white dark:text-[var(--text-icon-refly-text-flip,#1C1F23)] dark:hover:text-[var(--text-icon-refly-text-flip,#1C1F23)] font-roboto font-semibold text-[16px] leading-[1.25em]',
                      'border-none shadow-none rounded-[12px]',
                      'transition-colors duration-150 ease-in-out',
                      'bg-refly-bg-control-z1 hover:!bg-refly-tertiary-hover dark:bg-[var(--bg---refly-bg-dark,#ECECEC)] dark:hover:!bg-[var(--bg---refly-bg-dark,#ECECEC)]',
                    )}
                    type="primary"
                    disabled
                  >
                    <span className="inline-flex items-center gap-[2px]">
                      {t('canvas.workflow.run.executing')}
                    </span>
                  </Button>
                  {/* Share Icon Button */}
                  {onCopyShareLink && (
                    <Button
                      className="flex items-center justify-center rounded-[12px] bg-[#fff] dark:bg-[#232323] border-[0.5px] border-solid border-[rgba(28,31,35,0.30)] text-[#1C1F23] dark:text-white hover:bg-[#eaeaea] shadow-none font-roboto h-10 !w-10"
                      type="default"
                      icon={<IconShare size={16} className="" />}
                      onClick={onCopyShareLink}
                      title={t('canvas.workflow.run.copyShareLink') || 'Copy Share Link'}
                    />
                  )}
                </div>
              </div>
            </>
          ) : shouldShowEditor ? (
            <>
              <div
                className={cn('w-full h-full gap-3 flex flex-col rounded-2xl relative', className)}
              >
                <MixedTextEditor
                  templateContent={effectiveTemplateContent ?? ''}
                  variables={templateVariables.length > 0 ? templateVariables : workflowVariables}
                  onVariablesChange={handleTemplateVariableChange}
                  disabled={isFormDisabled}
                  originalVariables={workflowVariables}
                />
                {/* Tools Dependency Form */}
                {workflowApp?.canvasData && (
                  <div className="mt-3 flex items-center justify-between">
                    <ToolsDependencyChecker canvasData={workflowApp?.canvasData} />

                    <Tooltip title={t('canvas.workflow.run.toolsGuide') || 'Tools Guide'}>
                      <Button
                        className="flex items-center justify-center !h-7 !w-7 rounded-2xl hover:bg-refly-tertiary-hover bg-transparent border-none shadow-none"
                        type="text"
                        size="small"
                        icon={
                          <Question
                            size={16}
                            color="var(--refly-text-2)"
                            className="flex items-center"
                          />
                        }
                      />
                    </Tooltip>
                  </div>
                )}
              </div>

              {/* owner */}
              {workflowApp?.canvasData?.owner && (
                <div className="mt-2 flex items-center gap-1.5 cursor-pointer">
                  <Avatar
                    size={16}
                    src={workflowApp.canvasData.owner?.avatar || defaultAvatar}
                    className="flex-shrink-0"
                  />
                  <span className="text-[11px] leading-[1.4545em] text-[rgba(28,31,35,0.35)] dark:text-refly-text-3">
                    {workflowApp.canvasData.owner.nickname ||
                      workflowApp.canvasData.owner?.name ||
                      ''}
                  </span>
                  <div className="w-[1px] h-[10px] bg-[#E7E7E7] dark:bg-refly-Card-Border rounded-[3px] flex-shrink-0" />
                  <span className="text-[11px] leading-[1.4545em] text-[rgba(28,31,35,0.35)] dark:text-refly-text-3">
                    {formatDate(workflowApp?.updatedAt)}
                  </span>
                </div>
              )}

              <div className="pt-4 border-t border-refly-Card-Border rounded-b-lg">
                <div className="w-full flex flex-row justify-end items-center gap-3">
                  {/* Credit Info Block */}
                  {
                    <Tooltip title={t('subscription.creditBilling.description.canvasTotal')}>
                      <div className="flex items-center bg-[#F6F6F6] dark:bg-[#232323] rounded-tl-[12px] rounded-bl-[12px] rounded-tr-[-12px] rounded-br-[-12px] px-4 pr-6 h-10 min-w-[94px] gap-1 border border-transparent select-none font-roboto mr-[-24px]">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="22"
                          height="22"
                          viewBox="0 0 22 22"
                          fill="none"
                        >
                          <path
                            d="M10.9992 2.19922C11.3806 2.19922 11.7186 2.44489 11.8363 2.80766C12.9673 6.29581 15.7026 9.03109 19.1908 10.1622C19.5535 10.2799 19.7992 10.6178 19.7992 10.9992C19.7992 11.3806 19.5535 11.7186 19.1908 11.8363C15.7026 12.9673 12.9673 15.7026 11.8363 19.1908C11.7186 19.5535 11.3806 19.7992 10.9992 19.7992C10.6178 19.7992 10.2799 19.5535 10.1622 19.1908C9.03109 15.7026 6.29581 12.9673 2.80766 11.8363C2.44489 11.7186 2.19922 11.3806 2.19922 10.9992C2.19922 10.6178 2.44489 10.2799 2.80766 10.1622C6.29581 9.03109 9.03109 6.29581 10.1622 2.80766L10.2163 2.67703C10.3651 2.38714 10.6656 2.19922 10.9992 2.19922Z"
                            fill="url(#paint0_linear_1586_21457)"
                          />
                          <defs>
                            <linearGradient
                              id="paint0_linear_1586_21457"
                              x1="10"
                              y1="3.49902"
                              x2="16.5"
                              y2="19.999"
                              gradientUnits="userSpaceOnUse"
                            >
                              <stop stop-color="#32E2BB" />
                              <stop offset="1" stop-color="#0E9F77" />
                            </linearGradient>
                          </defs>
                        </svg>

                        <span className="font-semibold text-[20px] leading-[1.25em] font-roboto text-[#1C1F23] dark:text-white inline-flex items-center gap-[3px]">
                          {workflowApp?.creditUsage ?? 0}
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="15"
                            height="5"
                            viewBox="0 0 15 5"
                            fill="none"
                            className="fill-[#1C1F23] dark:fill-white"
                          >
                            <path d="M14.4697 0.915887C14.6995 1.06906 14.7639 1.38042 14.6121 1.61108C14.1144 2.36723 13.2896 3.54082 12.123 4.25476C11.3679 4.71688 10.4467 5.00886 9.37402 4.91199C8.3174 4.81654 7.2266 4.3538 6.09668 3.50867C5.53542 3.08897 5.09464 2.96119 4.76562 2.94421C4.43374 2.92718 4.1032 3.01782 3.75781 3.2157C3.15311 3.56226 2.61452 4.17132 2.17089 4.78259C2.00869 5.00607 1.69948 5.06906 1.46972 4.91589L0.22169 4.08387C-0.00807451 3.93069 -0.0713753 3.61969 0.0889509 3.39486C0.625529 2.64239 1.44023 1.6619 2.51562 1.04578C3.18379 0.663049 3.98585 0.401539 4.89355 0.44812C5.8041 0.49491 6.71106 0.845772 7.59473 1.50671C8.46471 2.15741 9.12402 2.37983 9.59863 2.42273C10.0571 2.46414 10.4486 2.34826 10.8184 2.12195C11.5184 1.69342 12.0448 0.950943 12.5293 0.223192C12.6824 -0.00666726 12.9919 -0.0693076 13.2217 0.0838687L14.4697 0.915887Z" />
                          </svg>
                        </span>
                        <span className="inline text-xs font-roboto font-normal text-[#1C1F23] dark:text-white opacity-60 ml-0.5">
                          / {t('canvas.workflow.run.run') || 'run'}
                        </span>
                      </div>
                    </Tooltip>
                  }
                  {/* RUN Button */}
                  <Button
                    className={cn(
                      'h-10 flex items-center justify-center',
                      'w-[120px] sm:w-[200px] min-w-[109px]',
                      'px-4 sm:px-[46px] gap-2',
                      'text-white dark:text-[var(--text-icon-refly-text-flip,#1C1F23)] dark:hover:text-[var(--text-icon-refly-text-flip,#1C1F23)] font-roboto font-semibold text-[16px] leading-[1.25em]',
                      'border-none shadow-none rounded-[12px]',
                      'transition-colors duration-150 ease-in-out',
                      isFormValid && !isRunButtonDisabled
                        ? 'bg-[#1C1F23] hover:!bg-[rgba(28,31,35,0.90)] dark:bg-[var(--bg---refly-bg-dark,#ECECEC)] dark:hover:!bg-[var(--bg---refly-bg-dark,#ECECEC)]'
                        : 'bg-refly-bg-control-z1 hover:!bg-refly-tertiary-hover dark:bg-[var(--bg---refly-bg-dark,#ECECEC)] dark:hover:!bg-[var(--bg---refly-bg-dark,#ECECEC)]',
                    )}
                    type="primary"
                    onClick={handleRun}
                    loading={isRunButtonDisabled}
                    disabled={isRunButtonDisabled}
                  >
                    <span className="inline-flex items-center gap-[2px]">
                      {isRunButtonDisabled
                        ? t('canvas.workflow.run.executing')
                        : t('canvas.workflow.run.run')}
                      {!isRunButtonDisabled && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 18 18"
                          fill="none"
                        >
                          <path
                            d="M1.80059 9.00078H15M15 9.00078L10.8 13.2008M15 9.00078L10.8 4.80078"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="stroke-white stroke-opacity-50 dark:stroke-[var(--text-icon-refly-text-flip,#1C1F23)] dark:stroke-opacity-100"
                          />
                        </svg>
                      )}
                    </span>
                  </Button>
                  {/* Remix Button */}
                  {/* hide for temporary */}
                  {/* {onCopyWorkflow && workflowApp?.remixEnabled && (
                    <Button
                      className="h-10 w-[94px] flex items-center justify-center px-0 rounded-[12px] bg-[#fff] dark:bg-[#232323] border-[0.5px] border-solid border-[rgba(28,31,35,0.3)] text-[#1C1F23] dark:text-white hover:bg-[#eaeaea] shadow-none font-semibold font-roboto text-[16px] leading-[1.25em] gap-0"
                      type="default"
                      onClick={handleRemix}
                      title={t('canvas.workflow.run.remix')}
                    >
                      <span className="">{t('canvas.workflow.run.remix')}</span>
                    </Button>
                  )} */}
                  {/* Share Icon Button */}
                  {onCopyShareLink && (
                    <Button
                      className="flex items-center justify-center rounded-[12px] bg-[#fff] dark:bg-[#232323] border-[0.5px] border-solid border-[rgba(28,31,35,0.30)] text-[#1C1F23] dark:text-white hover:bg-[#eaeaea] shadow-none font-roboto h-10 !w-10"
                      type="default"
                      icon={<IconShare size={16} className="" />}
                      onClick={onCopyShareLink}
                      title={t('canvas.workflow.run.copyShareLink') || 'Copy Share Link'}
                    />
                  )}
                </div>
              </div>
            </>
          ) : shouldShowForm ? (
            <div
              className={cn('w-full h-full gap-3 flex flex-col rounded-2xl relative', className)}
            >
              {/* Status badge in top-right corner */}
              {shouldShowBadge && <TemplateStatusBadge status={templateStatus} />}
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

              <div className="p-3 sm:p-4 border-t border-refly-Card-Border bg-refly-bg-control-z0 rounded-b-lg">
                <div className="w-full flex flex-row justify-end items-center gap-3">
                  {/* Credit Info Block */}
                  {
                    <Tooltip title={t('subscription.creditBilling.description.canvasTotal')}>
                      <div className="flex items-center bg-[#F6F6F6] dark:bg-[#232323] rounded-[12px] px-4 h-10 min-w-[94px] gap-1 border border-transparent select-none font-roboto">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="22"
                          height="22"
                          viewBox="0 0 22 22"
                          fill="none"
                        >
                          <path
                            d="M10.9992 2.19922C11.3806 2.19922 11.7186 2.44489 11.8363 2.80766C12.9673 6.29581 15.7026 9.03109 19.1908 10.1622C19.5535 10.2799 19.7992 10.6178 19.7992 10.9992C19.7992 11.3806 19.5535 11.7186 19.1908 11.8363C15.7026 12.9673 12.9673 15.7026 11.8363 19.1908C11.7186 19.5535 11.3806 19.7992 10.9992 19.7992C10.6178 19.7992 10.2799 19.5535 10.1622 19.1908C9.03109 15.7026 6.29581 12.9673 2.80766 11.8363C2.44489 11.7186 2.19922 11.3806 2.19922 10.9992C2.19922 10.6178 2.44489 10.2799 2.80766 10.1622C6.29581 9.03109 9.03109 6.29581 10.1622 2.80766L10.2163 2.67703C10.3651 2.38714 10.6656 2.19922 10.9992 2.19922Z"
                            fill="url(#paint0_linear_1586_21457)"
                          />
                          <defs>
                            <linearGradient
                              id="paint0_linear_1586_21457"
                              x1="10"
                              y1="3.49902"
                              x2="16.5"
                              y2="19.999"
                              gradientUnits="userSpaceOnUse"
                            >
                              <stop stop-color="#32E2BB" />
                              <stop offset="1" stop-color="#0E9F77" />
                            </linearGradient>
                          </defs>
                        </svg>

                        <span className="font-semibold text-[20px] leading-[1.25em] font-roboto text-[#1C1F23] dark:text-white inline-flex items-center gap-[3px]">
                          {workflowApp?.creditUsage ?? 0}
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="15"
                            height="5"
                            viewBox="0 0 15 5"
                            fill="none"
                            className="fill-[#1C1F23] dark:fill-white"
                          >
                            <path d="M14.4697 0.915887C14.6995 1.06906 14.7639 1.38042 14.6121 1.61108C14.1144 2.36723 13.2896 3.54082 12.123 4.25476C11.3679 4.71688 10.4467 5.00886 9.37402 4.91199C8.3174 4.81654 7.2266 4.3538 6.09668 3.50867C5.53542 3.08897 5.09464 2.96119 4.76562 2.94421C4.43374 2.92718 4.1032 3.01782 3.75781 3.2157C3.15311 3.56226 2.61452 4.17132 2.17089 4.78259C2.00869 5.00607 1.69948 5.06906 1.46972 4.91589L0.22169 4.08387C-0.00807451 3.93069 -0.0713753 3.61969 0.0889509 3.39486C0.625529 2.64239 1.44023 1.6619 2.51562 1.04578C3.18379 0.663049 3.98585 0.401539 4.89355 0.44812C5.8041 0.49491 6.71106 0.845772 7.59473 1.50671C8.46471 2.15741 9.12402 2.37983 9.59863 2.42273C10.0571 2.46414 10.4486 2.34826 10.8184 2.12195C11.5184 1.69342 12.0448 0.950943 12.5293 0.223192C12.6824 -0.00666726 12.9919 -0.0693076 13.2217 0.0838687L14.4697 0.915887Z" />
                          </svg>
                        </span>
                        <span className="hidden sm:inline text-xs font-roboto font-normal text-[#1C1F23] dark:text-white opacity-60 ml-0.5">
                          / {t('canvas.workflow.run.run') || 'run'}
                        </span>
                      </div>
                    </Tooltip>
                  }
                  {/* RUN Button */}
                  <Button
                    className={cn(
                      'h-10 flex items-center justify-center',
                      'w-[120px] sm:w-[200px] min-w-[109px]',
                      'px-4 sm:px-[46px] gap-2',
                      '!text-white dark:text-[var(--text-icon-refly-text-flip,#1C1F23)] dark:hover:text-[var(--text-icon-refly-text-flip,#1C1F23)] font-roboto font-semibold text-[16px] leading-[1.25em]',
                      'border-none shadow-none rounded-[12px]',
                      'transition-colors duration-150 ease-in-out',
                      isFormValid && !isRunButtonDisabled
                        ? 'bg-[#1C1F23] hover:!bg-[rgba(28,31,35,0.90)] dark:bg-[var(--bg---refly-bg-dark,#ECECEC)] dark:hover:!bg-[var(--bg---refly-bg-dark,#ECECEC)]'
                        : 'bg-[#1C1F23] hover:!bg-[rgba(28,31,35,0.90)] dark:bg-[var(--bg---refly-bg-dark,#ECECEC)] dark:hover:!bg-[var(--bg---refly-bg-dark,#ECECEC)]',
                    )}
                    type="primary"
                    onClick={handleRun}
                    loading={isRunButtonDisabled}
                    disabled={isRunButtonDisabled || !isFormValid}
                  >
                    <span className="inline-flex items-center gap-[2px]">
                      {isRunButtonDisabled
                        ? t('canvas.workflow.run.executing')
                        : t('canvas.workflow.run.run')}
                      {!isRunButtonDisabled && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 18 18"
                          fill="none"
                        >
                          <path
                            d="M1.80059 9.00078H15M15 9.00078L10.8 13.2008M15 9.00078L10.8 4.80078"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="stroke-white  stroke-opacity-50 dark:stroke-[var(--text-icon-refly-text-flip,#1C1F23)] dark:stroke-opacity-100"
                          />
                        </svg>
                      )}
                    </span>
                  </Button>
                  {/* Remix Button */}
                  {showRemix && onCopyWorkflow && workflowApp?.remixEnabled && (
                    <Button
                      className="h-10 w-[94px] flex items-center justify-center px-0 rounded-[12px] bg-[#F6F6F6] dark:bg-[#232323] border-[0.5px] border-solid border-[rgba(28,31,35,0.3)] text-[#1C1F23] dark:text-white hover:bg-[#eaeaea] shadow-none font-semibold font-roboto text-[16px] leading-[1.25em] gap-0"
                      type="default"
                      onClick={handleRemix}
                      title={t('canvas.workflow.run.remix')}
                    >
                      <span className="">{t('canvas.workflow.run.remix')}</span>
                    </Button>
                  )}
                  {/* Share Icon Button */}
                  {onCopyShareLink && (
                    <Button
                      className="flex items-center justify-center rounded-[12px] bg-[#F6F6F6] dark:bg-[#232323] border-[0.5px] border-solid border-[rgba(28,31,35,0.30)] text-[#1C1F23] dark:text-white hover:bg-[#eaeaea] shadow-none font-roboto h-10 !w-10"
                      type="default"
                      icon={<IconShare size={16} className="" />}
                      onClick={onCopyShareLink}
                      title={t('canvas.workflow.run.copyShareLink') || 'Copy Share Link'}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </>
      }
    </div>
  );
};
