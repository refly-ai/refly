import { memo, useCallback, useEffect, useMemo } from 'react';
import { Modal, Button, Divider } from 'antd';
import { useListTools } from '@refly-packages/ai-workspace-common/queries';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { ActionResult, WorkflowVariable } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { safeParseJSON } from '@refly/utils';
import { generateCanvasDataFromWorkflowPlan, WorkflowPlan } from '@refly/canvas-common';
import { useReactFlow } from '@xyflow/react';
import { MessageList } from '@refly-packages/ai-workspace-common/components/result-message';
import { useFetchActionResult } from '@refly-packages/ai-workspace-common/hooks/canvas/use-fetch-action-result';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';
import { useFetchProviderItems } from '@refly-packages/ai-workspace-common/hooks/use-fetch-provider-items';
import { useCanvasLayout } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-layout';
import { CanvasNode } from '@refly/openapi-schema';
import { logEvent } from '@refly/telemetry-web';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

interface CopilotMessageProps {
  result: ActionResult;
  isFinal: boolean;
}

export const CopilotMessage = memo(({ result, isFinal }: CopilotMessageProps) => {
  const { resultId, input, steps, status } = result;

  const workflowPlan = useMemo(() => {
    const toolCalls = steps?.[0]?.toolCalls ?? [];
    const workflowPlanToolCall = toolCalls.find((call) => call.toolName === 'generate_workflow');
    const output = workflowPlanToolCall?.output;

    if (!output) {
      return null;
    }

    // Handle different input formats
    if (typeof output === 'string') {
      return safeParseJSON(output);
    }

    // If input is already the parsed object
    return (output as { data: WorkflowPlan })?.data;
  }, [steps]);

  const { fetchActionResult } = useFetchActionResult();

  useEffect(() => {
    if (status === 'finish' && resultId) {
      fetchActionResult(resultId, { silent: true });
    }
  }, [status, resultId, fetchActionResult]);

  const { canvasId } = useCanvasContext();
  const { t } = useTranslation();
  const [modal, contextHolder] = Modal.useModal();

  const { data: tools } = useListTools({ query: { enabled: true } }, undefined, {
    enabled: !!canvasId,
  });

  const { getNodes, setNodes, setEdges } = useReactFlow();
  const { setVariables } = useVariablesManagement(canvasId);
  const { onLayout } = useCanvasLayout();
  const { setShowWorkflowRun } = useCanvasResourcesPanelStoreShallow((state) => ({
    setShowWorkflowRun: state.setShowWorkflowRun,
  }));
  const { defaultAgentModel } = useFetchProviderItems({
    category: 'llm',
    enabled: true,
  });

  const handleApprove = useCallback(async () => {
    logEvent('copilot_approve_clicked');
    if (!workflowPlan) {
      return;
    }

    // Check current canvas nodes
    const currentNodes = getNodes() as CanvasNode[];
    const startNodes = currentNodes.filter((node) => node.type === 'start');
    const skillNodes = currentNodes.filter((node) => node.type === 'skillResponse');

    // Check if canvas only contains one start node or one start node + one skill node with empty contentPreview
    const shouldSkipConfirmation =
      (currentNodes.length === 1 && startNodes.length === 1) ||
      (currentNodes.length === 2 &&
        startNodes.length === 1 &&
        skillNodes.length === 1 &&
        !skillNodes[0]?.data?.metadata?.query);

    if (!shouldSkipConfirmation) {
      // Show confirmation modal
      const confirmed = await new Promise<boolean>((resolve) => {
        modal.confirm({
          title: t('copilot.sessionDetail.confirmClearCanvas.title'),
          content: t('copilot.sessionDetail.confirmClearCanvas.content'),
          okText: t('copilot.sessionDetail.confirmClearCanvas.confirm'),
          cancelText: t('copilot.sessionDetail.confirmClearCanvas.cancel'),
          centered: true,
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });

      if (!confirmed) {
        return;
      }
    }

    const { nodes, edges, variables } = generateCanvasDataFromWorkflowPlan(
      workflowPlan,
      tools?.data ?? [],
      {
        autoLayout: true,
        defaultModel: defaultAgentModel,
        startNodes,
      },
    );

    // Process resource variables: create default files for empty resource variables
    const processedVariables: WorkflowVariable[] = [];
    for (const variable of variables ?? []) {
      if (
        variable.variableType === 'resource' &&
        (!variable.value || variable.value.length === 0)
      ) {
        // Call API to create default resource file
        const { data: response } = await getClient().createDefaultResourceFile({
          body: { canvasId, variableId: variable.variableId },
        });
        if (response?.data) {
          processedVariables.push({
            ...variable,
            value: [response.data],
          });
        } else {
          // If failed, keep the variable as is
          processedVariables.push(variable);
        }
      } else {
        processedVariables.push(variable);
      }
    }

    setNodes(nodes);
    setEdges(edges);
    setVariables(processedVariables);
    setShowWorkflowRun(true);

    for (const node of nodes) {
      if (node.type === 'skillResponse') {
        logEvent('create_agent_node', Date.now(), {
          canvasId,
          nodeId: node.id,
          source: 'copilot_generate',
        });
      }
    }

    setTimeout(() => {
      onLayout('LR');
    }, 200);
  }, [
    canvasId,
    workflowPlan,
    tools?.data,
    getNodes,
    setNodes,
    setEdges,
    setVariables,
    t,
    modal,
    setShowWorkflowRun,
    defaultAgentModel,
    onLayout,
  ]);

  return (
    <div className="flex flex-col gap-2">
      {/* User query - right aligned blue bubble */}
      <div className="flex justify-end pl-5">
        <div className="rounded-xl bg-[#F2FDFF] dark:bg-[#327576] text-refly-text-0 px-4 py-3 text-[15px] break-all">
          {input?.query}
        </div>
      </div>
      {/* AI response - left aligned */}
      <MessageList result={result} stepStatus="finish" />
      {workflowPlan && (
        <div className="mt-1">
          <Button type="primary" onClick={handleApprove}>
            {t('copilot.sessionDetail.approve')}
          </Button>
        </div>
      )}
      {!isFinal && <Divider type="horizontal" className="my-[10px] bg-refly-Card-Border h-[1px]" />}
      {contextHolder}
    </div>
  );
});

CopilotMessage.displayName = 'CopilotMessage';
