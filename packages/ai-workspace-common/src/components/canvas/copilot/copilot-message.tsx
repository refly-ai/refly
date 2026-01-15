import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Button, Divider } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { useListTools, useUpdateSettings } from '@refly-packages/ai-workspace-common/queries';
import { useCanvasResourcesPanelStoreShallow, useUserStoreShallow } from '@refly/stores';
import { ActionResult, WorkflowPlanRecord } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { safeParseJSON } from '@refly/utils';
import { generateCanvasDataFromWorkflowPlan } from '@refly/canvas-common';
import { useReactFlow } from '@xyflow/react';
import { MessageList } from '@refly-packages/ai-workspace-common/components/result-message';
import { useFetchActionResult } from '@refly-packages/ai-workspace-common/hooks/canvas/use-fetch-action-result';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';
import { useFetchProviderItems } from '@refly-packages/ai-workspace-common/hooks/use-fetch-provider-items';
import { useCanvasLayout } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-layout';
import { useUpdateCanvasTitle } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { CanvasNode } from '@refly/openapi-schema';
import { logEvent } from '@refly/telemetry-web';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useCanvasStoreShallow } from '@refly/stores';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';

interface CopilotMessageProps {
  result: ActionResult;
  isFinal: boolean;
  sessionId: string;
}

export const CopilotMessage = memo(({ result, isFinal, sessionId }: CopilotMessageProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const source = useMemo(() => searchParams.get('source'), [searchParams]);

  const { resultId, input, steps, status } = result;
  const query = useMemo(() => input?.query ?? '', [input]);

  const [loading, setLoading] = useState(false);

  const workflowPlan = useMemo<WorkflowPlanRecord>(() => {
    const allToolCalls = steps?.flatMap((step) => step.toolCalls ?? []) ?? [];
    const workflowPlanToolCall = [...allToolCalls]
      .reverse()
      .find((call) => call.toolName === 'generate_workflow' || call.toolName === 'patch_workflow');
    const output = workflowPlanToolCall?.output;

    if (!output) {
      return null;
    }

    // Handle different input formats
    if (typeof output === 'string') {
      return safeParseJSON(output);
    }

    // If input is already the parsed object
    return (output as { data: WorkflowPlanRecord })?.data;
  }, [steps]);

  const { fetchActionResult } = useFetchActionResult();

  useEffect(() => {
    if (status === 'finish' && resultId) {
      fetchActionResult(resultId, { silent: true });
    }
  }, [status, resultId, fetchActionResult]);

  const { canvasId } = useCanvasContext();
  const { invokeAction } = useInvokeAction();

  const { canvasTitle } = useCanvasStoreShallow((state) => ({
    canvasTitle: state.canvasTitle[canvasId],
  }));

  const { updateTitle } = useUpdateCanvasTitle(canvasId, canvasTitle ?? '');

  const { userProfile, setUserProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
    setUserProfile: state.setUserProfile,
  }));
  const { mutate: updateUserSettings } = useUpdateSettings();

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

    const isOnboarding = Boolean(userProfile?.preferences?.needOnboarding);

    // Check if canvas only contains one start node or one start node + one skill node with empty contentPreview
    const shouldSkipConfirmation =
      isOnboarding ||
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

    let finalPlan = workflowPlan;
    if (workflowPlan.tasks === undefined) {
      setLoading(true);
      try {
        const { data } = await getClient().getWorkflowPlanDetail({
          query: {
            planId: workflowPlan.planId,
            version: workflowPlan.version,
          },
        });
        if (data?.data) {
          finalPlan = data?.data;
        }
      } finally {
        setLoading(false);
      }
    }

    const { nodes, edges, variables } = generateCanvasDataFromWorkflowPlan(
      finalPlan,
      tools?.data ?? [],
      {
        autoLayout: true,
        defaultModel: defaultAgentModel,
        startNodes,
      },
    );
    setNodes(nodes);
    setEdges(edges);
    setVariables(variables ?? [], { archiveOldFiles: true });
    setShowWorkflowRun(true);

    if (!canvasTitle && finalPlan.title) {
      updateTitle(finalPlan.title);
    }

    for (const node of nodes) {
      if (node.type === 'skillResponse') {
        logEvent('create_agent_node', Date.now(), {
          canvasId,
          nodeId: node.id,
          source: 'copilot_generate',
        });
      }
    }

    if (isOnboarding) {
      setUserProfile({
        ...userProfile,
        preferences: {
          ...userProfile?.preferences,
          needOnboarding: false,
        },
      });
      updateUserSettings({
        body: {
          preferences: {
            ...userProfile?.preferences,
            needOnboarding: false,
          },
        },
      });
    }

    setTimeout(() => {
      onLayout('LR');
    }, 1000);

    if (source === 'onboarding') {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('source');
      setSearchParams(newParams);
    }
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
    logEvent,
    canvasTitle,
    query,
    updateTitle,
    source,
    searchParams,
    setSearchParams,
    userProfile,
  ]);

  const handleRetry = useCallback(() => {
    if (!resultId || !sessionId || !canvasId) {
      return;
    }

    logEvent('copilot_prompt_sent', Date.now(), {
      source: 'retry_button_click',
    });

    invokeAction(
      {
        query,
        resultId,
        modelInfo: null,
        agentMode: 'copilot_agent',
        copilotSessionId: sessionId,
      },
      {
        entityId: canvasId,
        entityType: 'canvas',
      },
    );
  }, [resultId, canvasId, invokeAction, sessionId, query, logEvent]);

  return (
    <div className="flex flex-col gap-2">
      {/* User query - right aligned blue bubble */}
      <div className="flex justify-end pl-5">
        <div className="rounded-xl bg-[#F2FDFF] dark:bg-[#327576] text-refly-text-0 px-4 py-3 text-[15px] break-all">
          {input?.query}
        </div>
      </div>
      {/* AI response - left aligned */}
      <MessageList result={result} stepStatus="finish" handleRetry={handleRetry} />
      {workflowPlan && (
        <div className="w-full mt-1 flex justify-end">
          <Button
            type="primary"
            className="!bg-refly-text-0 hover:!bg-refly-text-0 hover:opacity-80 text-refly-bg-canvas hover:!text-refly-bg-canvas font-bold"
            onClick={handleApprove}
            loading={
              loading
                ? { icon: <Spin size="small" className="!text-refly-bg-canvas" /> }
                : undefined
            }
          >
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
