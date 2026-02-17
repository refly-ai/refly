import type {
  RawCanvasData,
  WorkflowVariable,
  WorkflowExecutionStatus,
} from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { Button, Input, Select, Form, Typography, message, Tooltip } from 'antd';
import { StopCircle } from 'refly-icons';
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { UploadFile } from 'antd/es/upload/interface';
import { useAbortWorkflow } from '@refly-packages/ai-workspace-common/hooks/use-abort-workflow';
import cn from 'classnames';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.webp';
import { useIsLogin } from '@refly-packages/ai-workspace-common/hooks/use-is-login';
import { useNavigate } from 'react-router-dom';
import { ResourceUpload } from '@refly-packages/ai-workspace-common/components/canvas/workflow-run/resource-upload';
import { useFileUpload } from '@refly-packages/ai-workspace-common/components/canvas/workflow-variables';
import { getFileType } from '@refly-packages/ai-workspace-common/components/canvas/workflow-variables/utils';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useSubscriptionStoreShallow } from '@refly/stores';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import {
  useGetCanvasData,
  useListUserTools,
} from '@refly-packages/ai-workspace-common/queries/queries';
import type { GenericToolset, UserTool } from '@refly/openapi-schema';
import { extractToolsetsWithNodes, ToolWithNodes } from '@refly/canvas-common';
import GiftIcon from '@refly-packages/ai-workspace-common/assets/gift.png';
import { useFirstSuccessExecutionToday } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useUserMembership } from '@refly-packages/ai-workspace-common/hooks/use-user-membership';
import { subscriptionEnabled } from '@refly/ui-kit';
import { WorkflowInputFormCollapse } from '@refly-packages/ai-workspace-common/components/canvas/workflow-run/workflow-input-form-collapse';
import './user-input-collapse.scss';

/**
 * Check if a toolset is authorized/installed.
 * - MCP servers: installed if the server exists in userTools.
 * - Builtin tools: always available.
 * - OAuth tools: installed only when authorized.
 */
const isToolsetAuthorized = (toolset: GenericToolset, userTools: UserTool[]): boolean => {
  if (toolset.type === 'mcp') {
    return userTools.some((t) => t.toolset?.name === toolset.name);
  }

  if (toolset.builtin) {
    return true;
  }

  const matchingUserTool = userTools.find((t) => t.key === toolset.toolset?.key);
  if (!matchingUserTool) {
    return false;
  }

  return matchingUserTool.authorized ?? false;
};

const RequiredTagText = () => {
  return <span className="text-refly-text-3 flex-shrink-0 mr-0.5">*</span>;
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
    <div className="flex items-center min-w-0">
      {required && <RequiredTagText />}
      <Typography.Paragraph
        ellipsis={{ rows: 1, tooltip: <div className="max-h-[200px] overflow-y-auto">{name}</div> }}
        className="!m-0 text-sm font-medium text-[#D26700] leading-[1.5em] max-w-[150px]"
      >
        {name}
      </Typography.Paragraph>
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
  canvasId?: string;
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
  canvasId,
  className,
  templateContent,
  workflowApp,
  creditUsage,
}: WorkflowRunFormProps) => {
  const { t } = useTranslation();
  const { isLoggedRef, userProfile } = useIsLogin();
  const isLogin = !!userProfile?.uid;
  const navigate = useNavigate();
  const { setCreditInsufficientModalVisible } = useSubscriptionStoreShallow((state) => ({
    setCreditInsufficientModalVisible: state.setCreditInsufficientModalVisible,
  }));
  const { creditBalance, isBalanceSuccess } = useSubscriptionUsage();

  useFirstSuccessExecutionToday();

  const { setToolsDependencyOpen, setToolsDependencyHighlight, hasFirstSuccessExecutionToday } =
    useCanvasResourcesPanelStoreShallow((state) => ({
      setToolsDependencyOpen: state.setToolsDependencyOpen,
      setToolsDependencyHighlight: state.setToolsDependencyHighlight,
      hasFirstSuccessExecutionToday: state.hasFirstExecutionToday,
    }));

  const { planType } = useUserMembership();

  const [internalIsRunning, setInternalIsRunning] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const [fallbackToolsCanvasData, setFallbackToolsCanvasData] = useState<RawCanvasData | undefined>(
    undefined,
  );

  // Use external isRunning if provided, otherwise use internal state
  const isRunning = externalIsRunning ?? internalIsRunning;

  const { data: userToolsData } = useListUserTools({}, [], {
    enabled: isLogin,
    refetchOnWindowFocus: false,
  });
  const userTools = userToolsData?.data ?? [];

  const { data: canvasResponse, refetch: refetchCanvasData } = useGetCanvasData(
    { query: { canvasId: canvasId ?? '' } },
    [],
    {
      enabled: !!canvasId && isLogin,
      refetchOnWindowFocus: false,
    },
  );

  const nodesFromWorkflowApp = workflowApp?.canvasData?.nodes || [];
  const nodesFromCanvas = canvasResponse?.data?.nodes || [];
  const nodes = nodesFromWorkflowApp.length > 0 ? nodesFromWorkflowApp : nodesFromCanvas;

  const toolsDependencyCanvasData: RawCanvasData | undefined =
    workflowApp?.canvasData ?? canvasResponse?.data ?? fallbackToolsCanvasData;

  // Abort workflow with optimistic UI update (immediately marks nodes as 'failed')
  const { handleAbort } = useAbortWorkflow({
    executionId,
    canvasId,
    onSuccess: () => {
      // Reset running state after successful abort
      if (onRunningChange) {
        onRunningChange(false);
      } else {
        setInternalIsRunning(false);
      }
    },
  });
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
  } = useFileUpload(10); // Support up to 10 files

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

  // Get list of invalid required fields
  const getInvalidFields = useCallback(() => {
    const invalidFields: string[] = [];
    for (const variable of workflowVariables) {
      if (!variable.required) continue;

      const value = variableValues[variable.name];
      let isValid = false;

      if (variable.variableType === 'string') {
        isValid = value && value.trim() !== '';
      } else if (variable.variableType === 'option') {
        isValid = value && (Array.isArray(value) ? value.length > 0 : !!value);
      } else if (variable.variableType === 'resource') {
        isValid = value && Array.isArray(value) && value.length > 0;
      }

      if (!isValid) {
        invalidFields.push(variable.name);
      }
    }
    return invalidFields;
  }, [workflowVariables, variableValues]);

  // Check if a specific field is invalid (for showing error state)
  const isFieldInvalid = useCallback(
    (variableName: string) => {
      return attemptedSubmit && getInvalidFields().includes(variableName);
    },
    [attemptedSubmit, getInvalidFields],
  );

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
        // Convert all files in the value array
        const fileValues = Array.isArray(value) ? value : value ? [value] : [];

        if (fileValues.length > 0) {
          const resourceValues = fileValues.map((v) => {
            // Extract fileId from upload response if available
            const uploadedFileId = v.response?.fileId || v.uid;

            // Match by uploadedFileId first, then storageKey, then name as fallback
            const matchedResource = variable?.value?.find((val) => {
              // First try to match by fileId
              if (uploadedFileId && val.resource?.fileId === uploadedFileId) {
                return true;
              }
              // Then try to match by entityId (uid)
              if (v.uid && val.resource?.entityId === v.uid) {
                return true;
              }
              // Then try to match by storageKey (url)
              if (v.url && val.resource?.storageKey === v.url) {
                return true;
              }
              // Finally fall back to name matching
              return val.resource?.name === v.name;
            });

            const entityId = matchedResource?.resource?.entityId;
            const existingFileId = matchedResource?.resource?.fileId;

            // Use uploaded fileId if it looks like a fileId (starts with 'df-'),
            // otherwise use existing fileId from variable
            const fileId = uploadedFileId?.startsWith?.('df-') ? uploadedFileId : existingFileId;

            return {
              type: 'resource' as const,
              resource: {
                name: v.name,
                storageKey: v.url,
                fileType: getFileType(v.name, v.type),
                ...(fileId && { fileId }),
                ...(entityId && { entityId }),
              },
            };
          });

          newVariables.push({
            ...variable,
            value: resourceValues,
          });
        } else {
          // Keep the variable even if no file is uploaded (with empty value)
          newVariables.push({
            ...variable,
            value: [],
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
      const variable = workflowVariables.find((v) => v.name === variableName);
      const maxCount = variable?.isSingle === true ? 1 : 10;

      // Check if we've reached the limit
      if (currentFileList.length >= maxCount) {
        message.error({
          content:
            t('canvas.workflow.variables.tooManyFiles', { max: maxCount }) ||
            `Maximum ${maxCount} files allowed`,
          key: 'too-many-files-error',
        });
        return false;
      }

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

        setVariableValues((prev) => {
          const prevFileList = prev[variableName] || [];
          // For single file mode, replace the file list; for multi-file mode, append
          const nextFileList = variable?.isSingle === true ? [newFile] : [...prevFileList, newFile];
          form.setFieldsValue({
            [variableName]: nextFileList,
          });
          return {
            ...prev,
            [variableName]: nextFileList,
          };
        });
        return false; // Prevent default upload behavior
      }
      return false;
    },
    [uploadFile, variableValues, canvasId, workflowVariables, form, t],
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
  }, [workflowVariables, convertVariableToFormValue]);

  const handleRun = async () => {
    // Mark that user has attempted to submit (for showing validation errors)
    setAttemptedSubmit(true);

    // Check if form is valid - if not, return early (errors will be shown due to attemptedSubmit)
    if (!isFormValid) {
      return;
    }

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

    // Ensure we have canvas nodes to calculate tool dependencies.
    let effectiveNodes = nodes;
    if (!effectiveNodes.length && canvasId && isLogin) {
      try {
        const result = await refetchCanvasData();
        effectiveNodes = (result as any)?.data?.data?.nodes ?? [];
      } catch {
        effectiveNodes = [];
      }
    }

    const effectiveUninstalledCount = (() => {
      if (!effectiveNodes.length) return 0;
      const toolsetsWithNodes = extractToolsetsWithNodes(effectiveNodes);
      return toolsetsWithNodes.filter((tool: ToolWithNodes) => {
        return !isToolsetAuthorized(tool.toolset, userTools);
      }).length;
    })();

    // Check if there are uninstalled tools
    if (effectiveUninstalledCount > 0) {
      if (!toolsDependencyCanvasData) {
        setFallbackToolsCanvasData({
          nodes: effectiveNodes,
          edges: [],
        });
      }

      message.warning(t('canvas.workflow.run.installToolsBeforeRunning'));
      if (canvasId) {
        setToolsDependencyOpen(canvasId, true);
        setToolsDependencyHighlight(canvasId, true);
      }
      return;
    }

    // Frontend pre-check: if current credit balance is insufficient, open the modal and stop.
    // This is best-effort and only runs when balance data is available, to avoid false negatives.
    const requiredCredits = Number(creditUsage ?? 0);
    const isRequiredCreditsValid = Number.isFinite(requiredCredits) && requiredCredits > 0;
    if (isBalanceSuccess && isRequiredCreditsValid && creditBalance < requiredCredits) {
      setCreditInsufficientModalVisible(true, undefined, 'canvas');
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
      const hasError = isFieldInvalid(name);
      return (
        <Form.Item
          key={name}
          label={<FormItemLabel name={name} required={required} />}
          name={name}
          required={false}
          rules={
            required
              ? [{ required: true, message: t('canvas.workflow.variables.inputPlaceholder') }]
              : []
          }
          data-field-name={name}
          className={cn('!mb-0 [&_.ant-form-item-label]:!pb-3 [&_.ant-form-item-label]:!mb-0', {
            'has-validation-error': hasError,
          })}
          validateStatus={hasError ? 'error' : undefined}
          help={
            hasError
              ? t('canvas.workflow.variables.thisFieldIsRequired') || 'This field is required'
              : undefined
          }
        >
          <Input
            placeholder={t('canvas.workflow.variables.inputPlaceholder')}
            value={value}
            onChange={(e) => handleValueChange(name, e.target.value)}
            data-field-name={name}
            disabled={isFormDisabled}
            status={hasError ? 'error' : undefined}
            className={cn(
              '!h-[37px] !border-[#E5E5E5] !rounded-xl !px-3',
              '!text-sm !leading-[1.5em]',
              isFormDisabled ? '!text-[rgba(28,31,35,0.35)]' : '!text-[#1C1F23]',
              'placeholder:!text-[rgba(28,31,35,0.35)]',
              'hover:!border-[#E5E5E5] focus:!border-[#155EEF] focus:!shadow-none',
              'overflow-hidden text-ellipsis whitespace-nowrap',
              hasError && '!border-[#F04438]',
            )}
            style={{
              backgroundColor: 'transparent',
            }}
          />
        </Form.Item>
      );
    }

    if (variableType === 'option') {
      const hasError = isFieldInvalid(name);
      return (
        <Form.Item
          key={name}
          label={<FormItemLabel name={name} required={required} />}
          name={name}
          required={false}
          rules={
            required
              ? [{ required: true, message: t('canvas.workflow.variables.selectPlaceholder') }]
              : []
          }
          className={cn('!mb-0 [&_.ant-form-item-label]:!pb-3 [&_.ant-form-item-label]:!mb-0', {
            'has-validation-error': hasError,
          })}
          validateStatus={hasError ? 'error' : undefined}
          help={
            hasError
              ? t('canvas.workflow.variables.thisFieldIsRequired') || 'This field is required'
              : undefined
          }
        >
          <Select
            placeholder={t('canvas.workflow.variables.selectPlaceholder')}
            mode={isSingle ? undefined : 'multiple'}
            value={value}
            onChange={(val) => handleValueChange(name, val)}
            options={options?.map((opt) => ({ label: opt, value: opt })) ?? []}
            data-field-name={name}
            disabled={isFormDisabled}
            status={hasError ? 'error' : undefined}
            showSearch={false}
            maxTagCount="responsive"
            className={cn(
              '[&_.ant-select-selector]:!border-[#E5E5E5] [&_.ant-select-selector]:!rounded-xl',
              '[&_.ant-select-selector]:!px-3 [&_.ant-select-selector]:!min-h-[37px]',
              isSingle
                ? '[&_.ant-select-selector]:!py-0 [&_.ant-select-selector]:!leading-[35px]'
                : '[&_.ant-select-selector]:!py-1',
              '[&_.ant-select-selector]:!text-sm [&_.ant-select-selector]:!text-[rgba(28,31,35,0.35)]',
              '[&_.ant-select-selection-placeholder]:!text-[rgba(28,31,35,0.35)]',
              isSingle && '[&_.ant-select-selection-item]:!leading-[35px]',
              isFormDisabled
                ? '[&_.ant-select-selection-item]:!text-[rgba(28,31,35,0.35)]'
                : '[&_.ant-select-selection-item]:!text-[#1C1F23]',
              '[&_.ant-select-selector]:hover:!border-[#E5E5E5]',
              '[&_.ant-select-focused_.ant-select-selector]:!border-[#155EEF]',
              '[&_.ant-select-focused_.ant-select-selector]:!shadow-none',
              '[&_.ant-select-selector]:!bg-transparent',
              hasError && '[&_.ant-select-selector]:!border-[#F04438]',
            )}
            style={{
              width: '100%',
            }}
          />
        </Form.Item>
      );
    }

    if (variableType === 'resource') {
      const hasError = isFieldInvalid(name);
      return (
        <Form.Item
          key={name}
          label={<FormItemLabel name={name} required={required} />}
          name={name}
          required={false}
          rules={
            required
              ? [{ required: true, message: t('canvas.workflow.variables.uploadPlaceholder') }]
              : []
          }
          className={cn('!mb-0 [&_.ant-form-item-label]:!pb-3 [&_.ant-form-item-label]:!mb-0', {
            'has-validation-error': hasError,
          })}
          validateStatus={hasError ? 'error' : undefined}
          help={
            hasError
              ? t('canvas.workflow.variables.thisFieldIsRequired') || 'This field is required'
              : undefined
          }
        >
          <ResourceUpload
            value={value || []}
            onUpload={(file) => handleFileUpload(file, name)}
            onRemove={(file) => handleFileRemove(file, name)}
            onRefresh={isSingle === true ? () => handleRefreshFile(name) : undefined}
            resourceTypes={resourceTypes}
            disabled={uploading || isFormDisabled}
            maxCount={isSingle === true ? 1 : 10}
            data-field-name={name}
            hasError={hasError}
          />
        </Form.Item>
      );
    }

    return null;
  };

  const workflowIsRunning = isRunning || isPolling;

  return (
    <div className={cn('w-full h-full gap-3 flex flex-col rounded-2xl', className)}>
      {
        <>
          {/* default show Form */}
          {
            <div className="px-4 flex-1 overflow-y-auto">
              {/* Show loading state when loading */}
              {workflowVariables.length > 0 ? (
                <WorkflowInputFormCollapse
                  form={form}
                  workflowVariables={workflowVariables}
                  variableValues={variableValues}
                  renderFormField={renderFormField}
                />
              ) : loading ? null : (
                <EmptyContent />
              )}
            </div>
          }

          <div className="p-3 border-t-[1px] border-x-0 border-b-0 border-solid border-refly-Card-Border bg-refly-bg-body-z0 rounded-b-lg flex flex-col gap-2">
            {creditUsage !== null && creditUsage !== undefined && (
              <div className="text-xs leading-4 text-refly-primary-default text-center">
                {t('canvas.workflow.run.creditUsage', { count: creditUsage })}
              </div>
            )}
            <Tooltip
              title={
                subscriptionEnabled && !workflowIsRunning && !hasFirstSuccessExecutionToday
                  ? t('canvas.workflow.run.runTooltip')
                  : undefined
              }
              placement="top"
              arrow={false}
              overlayStyle={{ maxWidth: 300 }}
            >
              <Button
                className={cn(
                  'w-full h-8 text-sm group',
                  !workflowIsRunning
                    ? 'bg-refly-text-0 text-refly-bg-body-z0 hover:!bg-refly-text-0 hover:!text-refly-bg-body-z0 hover:opacity-80'
                    : '',
                )}
                {...(workflowIsRunning ? { color: 'primary' } : { type: 'default' })}
                icon={
                  workflowIsRunning ? <StopCircle size={16} className="translate-y-[1px]" /> : null
                }
                onClick={workflowIsRunning ? handleAbort : handleRun}
                loading={loading}
                disabled={loading || (workflowIsRunning && !executionId)}
              >
                {workflowIsRunning
                  ? t('canvas.workflow.run.abort.abortButton') || 'Abort'
                  : t('canvas.workflow.run.run') || 'Run'}

                {subscriptionEnabled &&
                  !workflowIsRunning &&
                  !hasFirstSuccessExecutionToday &&
                  planType === 'free' && (
                    <img
                      src={GiftIcon}
                      alt="gift"
                      className="w-[18px] h-[18px] group-hover:animate-shake"
                    />
                  )}
              </Button>
            </Tooltip>
          </div>
        </>
      }
    </div>
  );
};
