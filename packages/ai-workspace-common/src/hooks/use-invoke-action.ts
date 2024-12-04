import {
  ActionResult,
  ActionStep,
  ActionStepMeta,
  BaseResponse,
  CanvasNodeData,
  InvokeSkillRequest,
} from '@refly/openapi-schema';
import { useUserStore } from '@refly-packages/ai-workspace-common/stores/user';
import { ssePost } from '@refly-packages/ai-workspace-common/utils/sse-post';
import { SkillEvent, LOCALE } from '@refly/common-types';
import { getAuthTokenFromCookie } from '@refly-packages/ai-workspace-common/utils/request';
import { safeParseJSON } from '@refly-packages/ai-workspace-common/utils/parse';
import { getRuntime } from '@refly-packages/ai-workspace-common/utils/env';
import { useCanvasControl } from '@refly-packages/ai-workspace-common/hooks/use-canvas-control';
import { showErrorNotification } from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import {
  useActionResultStore,
  useActionResultStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/action-result';
import { actionEmitter } from '@refly-packages/ai-workspace-common/events/action';
import { aggregateTokenUsage } from '@refly-packages/utils/index';
import { ResponseNodeMeta } from '@refly-packages/ai-workspace-common/components/canvas/nodes';

export const useInvokeAction = () => {
  const { addNode, setNodeDataByEntity } = useCanvasControl();
  const updateActionResult = useActionResultStoreShallow((state) => state.updateActionResult);

  const globalAbortControllerRef = { current: null as AbortController | null };
  const globalIsAbortedRef = { current: false as boolean };

  const onUpdateResult = (resultId: string, payload: ActionResult) => {
    actionEmitter.emit('updateResult', { resultId, payload });
    updateActionResult(resultId, payload);

    // Update canvas node data
    if (payload.targetType === 'canvas') {
      const { title, steps = [] } = payload ?? {};
      setNodeDataByEntity<ResponseNodeMeta>(
        { type: 'skillResponse', entityId: resultId },
        {
          title,
          entityId: resultId,
          contentPreview: steps.map((s) => s.content).join('\n'),
          metadata: {
            steps,
            status: payload.status,
          },
        },
      );
    }
  };

  const onSkillStart = (skillEvent: SkillEvent) => {};

  const onSkillLog = (skillEvent: SkillEvent) => {
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[skillEvent.resultId];

    if (!result) {
      return;
    }

    const updatedResult = {
      ...result,
      logs: [...(result.logs || []), skillEvent.content],
    };
    onUpdateResult(skillEvent.resultId, updatedResult);
  };

  const onSkillTokenUsage = (skillEvent: SkillEvent) => {
    const { resultId, step, tokenUsage } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result) {
      return;
    }

    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);
    updatedStep.tokenUsage = aggregateTokenUsage([...(updatedStep.tokenUsage ?? []), tokenUsage]);

    onUpdateResult(resultId, {
      ...result,
      steps: getUpdatedSteps(result.steps ?? [], updatedStep),
    });
  };

  const findOrCreateStep = (steps: ActionStep[], stepMeta: ActionStepMeta) => {
    const existingStep = steps?.find((s) => s.name === stepMeta?.name);
    return existingStep
      ? { ...existingStep }
      : {
          ...stepMeta,
          content: '',
          artifacts: [],
          structuredData: {},
        };
  };

  const getUpdatedSteps = (steps: ActionStep[], updatedStep: ActionStep) => {
    if (!steps?.find((step) => step.name === updatedStep.name)) {
      return [...steps, updatedStep];
    }
    return steps.map((step) => (step.name === updatedStep.name ? updatedStep : step));
  };

  const onSkillStream = (skillEvent: SkillEvent) => {
    const { resultId, content, step } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result || !step) {
      return;
    }

    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);
    updatedStep.content += content;

    onUpdateResult(resultId, {
      ...result,
      status: 'executing' as const,
      steps: getUpdatedSteps(result.steps ?? [], updatedStep),
    });
  };

  const onSkillStructedData = (skillEvent: SkillEvent) => {
    const { step, resultId, content = '', structuredDataKey = '' } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result || !structuredDataKey || !step) {
      return;
    }

    const structuredData = safeParseJSON(content);
    if (!structuredData) {
      return;
    }

    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);
    updatedStep.structuredData = {
      ...updatedStep.structuredData,
      [structuredDataKey]: structuredData,
    };

    const updatedResult = {
      ...result,
      status: 'executing' as const,
      steps: getUpdatedSteps(result.steps ?? [], updatedStep),
    };
    onUpdateResult(skillEvent.resultId, updatedResult);
  };

  const onSkillArtifact = (skillEvent: SkillEvent) => {
    const { resultId, artifact, step } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result || !step) {
      return;
    }

    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);
    const existingArtifacts = Array.isArray(updatedStep.artifacts) ? [...updatedStep.artifacts] : [];
    const artifactIndex = existingArtifacts.findIndex((item) => item?.entityId === artifact?.entityId);

    updatedStep.artifacts =
      artifactIndex !== -1
        ? existingArtifacts.map((item, index) => (index === artifactIndex ? artifact : item))
        : [...existingArtifacts, artifact];

    const updatedResult = {
      ...result,
      status: 'executing' as const,
      steps: getUpdatedSteps(result.steps ?? [], updatedStep),
    };

    onUpdateResult(skillEvent.resultId, updatedResult);
  };

  const onSkillCreateNode = (skillEvent: SkillEvent) => {
    const { node, resultId } = skillEvent;
    addNode(
      {
        type: node.type,
        data: {
          ...node.data,
          metadata: {
            status: 'executing',
            ...node.data?.metadata,
          },
        } as CanvasNodeData,
      },
      [
        {
          type: 'skillResponse',
          entityId: resultId,
        },
      ],
    );
  };

  const onSkillEnd = (skillEvent: SkillEvent) => {
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[skillEvent.resultId];

    if (!result) {
      return;
    }

    const updatedResult = {
      ...result,
      status: 'finish' as const,
    };
    onUpdateResult(skillEvent.resultId, updatedResult);

    const artifacts = result.steps?.flatMap((s) => s.artifacts);
    if (artifacts?.length) {
      artifacts.forEach((artifact) => {
        setNodeDataByEntity(
          {
            type: artifact.type,
            entityId: artifact.entityId,
          },
          {
            metadata: {
              status: 'finish',
            },
          },
        );
      });
    }
  };

  const onError = (error?: BaseResponse) => {
    console.log('onError', error);
    const runtime = getRuntime();
    const { localSettings } = useUserStore.getState();
    const locale = localSettings?.uiLocale as LOCALE;

    error ??= { success: false };
    showErrorNotification(error, locale);

    if (runtime?.includes('extension')) {
      if (globalIsAbortedRef.current) {
        return;
      }
    } else {
      // if it is aborted, do nothing
      if (globalAbortControllerRef.current?.signal?.aborted) {
        return;
      }
    }

    abortAction(error?.errMsg);
  };

  const abortAction = (msg?: string) => {
    try {
      globalAbortControllerRef.current?.abort();
      globalIsAbortedRef.current = true;
    } catch (err) {
      console.log('shutdown error', err);
    }
  };

  const onCompleted = () => {};

  const onStart = () => {};

  const invokeAction = (payload: InvokeSkillRequest) => {
    const { resultId, input } = payload;
    onUpdateResult(resultId, {
      resultId,
      type: 'skill',
      actionMeta: {
        name: payload.skillName || 'commonQnA',
      },
      title: input?.query,
      targetId: payload.target?.entityId,
      targetType: payload.target?.entityType,
      context: payload.context,
      history: payload.resultHistory,
      tplConfig: payload.tplConfig,
      logs: [],
      status: 'executing',
      steps: [],
      errors: [],
    });

    if (payload?.target?.entityType === 'canvas') {
      const connectTo = [
        ...(Array.isArray(payload.context?.documents) ? payload.context.documents : []).map((document) => ({
          type: 'document' as const,
          entityId: document.docId,
        })),
        ...(payload.context?.resources ?? []).map((resource) => ({
          type: 'resource' as const,
          entityId: resource.resourceId,
        })),
        ...(payload.resultHistory ?? []).map((result) => ({
          type: 'skillResponse' as const,
          entityId: result.resultId,
        })),
      ].filter(Boolean);

      addNode(
        {
          type: 'skillResponse',
          data: {
            title: input?.query,
            entityId: resultId,
          },
        },
        connectTo,
      );
    }

    globalAbortControllerRef.current = new AbortController();

    ssePost({
      controller: globalAbortControllerRef.current,
      payload,
      token: getAuthTokenFromCookie(),
      onStart,
      onSkillStart,
      onSkillStream,
      onSkillLog,
      onSkillArtifact,
      onSkillStructedData,
      onSkillCreateNode,
      onSkillEnd,
      onCompleted,
      onError,
      onSkillTokenUsage,
    });
  };

  return { invokeAction, abortAction };
};
