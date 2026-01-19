import type {
  RawCanvasData,
  WorkflowVariable,
  WorkflowExecutionStatus,
} from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { Button, Form, message, Tooltip } from 'antd';
import { StopCircle } from 'refly-icons';
import { useState, useEffect, useCallback } from 'react';
import type { UploadFile } from 'antd/es/upload/interface';
import { useAbortWorkflow } from '@refly-packages/ai-workspace-common/hooks/use-abort-workflow';
import cn from 'classnames';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.webp';
import { useIsLogin } from '@refly-packages/ai-workspace-common/hooks/use-is-login';
import { useNavigate } from 'react-router-dom';
import { ToolsDependencyChecker } from '@refly-packages/ai-workspace-common/components/canvas/tools-dependency';
import { useCheckEmptyPrompts } from '@refly-packages/ai-workspace-common/hooks/canvas/use-check-empty-prompts';
import { useSubscriptionStoreShallow, useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import {
  useGetCanvasData,
  useListUserTools,
} from '@refly-packages/ai-workspace-common/queries/queries';
import type { GenericToolset, UserTool } from '@refly/openapi-schema';
import { extractToolsetsWithNodes, ToolWithNodes } from '@refly/canvas-common';
import GiftIcon from '@refly-packages/ai-workspace-common/assets/gift.png';
import { useFirstSuccessExecutionToday } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { UserInputCollapse } from '@refly-packages/ai-workspace-common/components/canvas/workflow-run/user-input-collapse';

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

const EmptyContent = () => {
  const { t } = useTranslation();
  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <img src={EmptyImage} alt="no variables" className="w-[120px] h-[120px] -mb-4" />
      <div className="text-sm text-refly-text-2 leading-5 text-center">
        {t('canvas.workflow.run.emptyTitle', 'No variables defined')}
      </div>
      <div className="text-sm text-refly-text-2 leading-5 text-center mt-5">
        {t(
          'canvas.workflow.run.emptyDescription',
          ' the workflow will be executed once if continued.',
        )}
      </div>
    </div>
  );
};

// FormItemLabel is no longer used after switching to VariableTypeSection layout.
// It is kept here only for reference and can be safely removed if not needed.

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
  const { checkEmptyPrompts } = useCheckEmptyPrompts();
  useFirstSuccessExecutionToday();

  const { setToolsDependencyOpen, setToolsDependencyHighlight, hasFirstSuccessExecutionToday } =
    useCanvasResourcesPanelStoreShallow((state) => ({
      setToolsDependencyOpen: state.setToolsDependencyOpen,
      setToolsDependencyHighlight: state.setToolsDependencyHighlight,
      hasFirstSuccessExecutionToday: state.hasFirstExecutionToday,
    }));

  const [internalIsRunning, setInternalIsRunning] = useState(false);
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
  const [templateVariables, setTemplateVariables] = useState<WorkflowVariable[]>([]);

  // File upload hook (removed in VariableTypeSection layout).

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
    // Legacy conversion kept for potential future form-based variables UI.
    return workflowVariables;
  }, [workflowVariables]);

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

  // Update form values when workflowVariables change (kept for backward compatibility with form logic).
  useEffect(() => {
    const newValues = convertVariableToFormValue();
    form.setFieldsValue(newValues);
  }, [workflowVariables, form]);

  const handleRun = async () => {
    // Basic validation for required fields is handled at variable definition level.
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

    // Check for empty prompts in the workflow
    const emptyPromptNodeIds = checkEmptyPrompts();
    if (emptyPromptNodeIds.length > 0) {
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

  // Render form field function is no longer used after switching to VariableTypeSection.

  const workflowIsRunning = isRunning || isPolling;

  return (
    <div className={cn('w-full h-full gap-3 flex flex-col rounded-2xl', className)}>
      {
        <>
          <div className="px-4 flex-1 overflow-y-auto">
            {workflowVariables.length > 0 ? (
              <UserInputCollapse
                workflowVariables={workflowVariables}
                canvasId={canvasId}
                defaultActiveKey={['input']}
                showToolsDependency={true}
                workflowApp={workflowApp}
                ToolsDependencyChecker={ToolsDependencyChecker}
              />
            ) : loading ? null : (
              <EmptyContent />
            )}
          </div>

          <div className="p-3 border-t-[1px] border-x-0 border-b-0 border-solid border-refly-Card-Border bg-refly-bg-body-z0 rounded-b-lg flex flex-col gap-2">
            {creditUsage !== null && creditUsage !== undefined && (
              <div className="text-xs leading-4 text-refly-primary-default text-center">
                {t('canvas.workflow.run.creditUsage', { count: creditUsage })}
              </div>
            )}
            <Tooltip
              title={
                !workflowIsRunning && !hasFirstSuccessExecutionToday
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

                {!workflowIsRunning && !hasFirstSuccessExecutionToday && (
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
