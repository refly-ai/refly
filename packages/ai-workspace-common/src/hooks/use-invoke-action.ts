import {
  ActionResult,
  ActionStep,
  ActionStepMeta,
  BaseResponse,
  InvokeSkillRequest,
  SkillEvent,
} from '@refly/openapi-schema';
import { useUserStore } from '@refly-packages/ai-workspace-common/stores/user';
import { ssePost } from '@refly-packages/ai-workspace-common/utils/sse-post';
import { LOCALE } from '@refly/common-types';
import { getAuthTokenFromCookie } from '@refly-packages/ai-workspace-common/utils/request';
import { getRuntime } from '@refly-packages/ai-workspace-common/utils/env';
import { useCanvasControl } from '@refly-packages/ai-workspace-common/hooks/use-canvas-control';
import { showErrorNotification } from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import {
  useActionResultStore,
  useActionResultStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/action-result';
import { actionEmitter } from '@refly-packages/ai-workspace-common/events/action';
import { aggregateTokenUsage, genActionResultID } from '@refly-packages/utils/index';
import { CanvasNodeData, ResponseNodeMeta } from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { useListModels, useListSkills } from '@refly-packages/ai-workspace-common/queries/queries';

export const useInvokeAction = () => {
  const { addNode, setNodeDataByEntity } = useCanvasControl();
  const { updateActionResult } = useActionResultStoreShallow((state) => ({
    updateActionResult: state.updateActionResult,
  }));

  const globalAbortControllerRef = { current: null as AbortController | null };
  const globalIsAbortedRef = { current: false as boolean };

  const onUpdateResult = (resultId: string, payload: ActionResult, event?: SkillEvent) => {
    actionEmitter.emit('updateResult', { resultId, payload });
    updateActionResult(resultId, payload);

    // Update canvas node data
    if (payload.targetType === 'canvas') {
      const { title, steps = [] } = payload ?? {};
      const nodeData: Partial<CanvasNodeData<ResponseNodeMeta>> = {
        title,
        entityId: resultId,
        metadata: {
          status: payload.status,
          actionMeta: payload.actionMeta,
          modelInfo: payload.modelInfo,
        },
      };

      const { event: eventType, log } = event ?? {};

      if (eventType === 'stream') {
        nodeData.contentPreview = steps
          .map((s) => s.content)
          ?.filter(Boolean)
          ?.join('\n');
      } else if (eventType === 'artifact') {
        nodeData.metadata = {
          status: payload.status,
          artifacts: steps.flatMap((s) => s.artifacts),
        };
      } else if (eventType === 'log') {
        nodeData.metadata = {
          status: payload.status,
          currentLog: log,
        };
      } else if (eventType === 'structured_data') {
        const structuredData = steps.reduce((acc, step) => ({ ...acc, ...step.structuredData }), {});
        nodeData.metadata = {
          status: payload.status,
          structuredData: structuredData,
        };
      } else if (eventType === 'token_usage') {
        nodeData.metadata = {
          status: payload.status,
          tokenUsage: aggregateTokenUsage(steps.flatMap((s) => s.tokenUsage).filter(Boolean)),
        };
      }

      setNodeDataByEntity<ResponseNodeMeta>({ type: 'skillResponse', entityId: resultId }, nodeData);
    }
  };

  const onSkillStart = (skillEvent: SkillEvent) => {};

  const onSkillLog = (skillEvent: SkillEvent) => {
    const { resultId, step, log } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result || !step) {
      return;
    }

    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);
    updatedStep.logs = [...(updatedStep.logs || []), log];

    const updatedResult = {
      ...result,
      status: 'executing' as const,
      steps: getUpdatedSteps(result.steps ?? [], updatedStep),
    };
    onUpdateResult(skillEvent.resultId, updatedResult, skillEvent);
  };

  const onSkillTokenUsage = (skillEvent: SkillEvent) => {
    const { resultId, step, tokenUsage } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result || !step) {
      return;
    }

    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);
    updatedStep.tokenUsage = aggregateTokenUsage([...(updatedStep.tokenUsage ?? []), tokenUsage]);

    onUpdateResult(
      resultId,
      {
        ...result,
        steps: getUpdatedSteps(result.steps ?? [], updatedStep),
      },
      skillEvent,
    );
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

    onUpdateResult(
      resultId,
      {
        ...result,
        status: 'executing' as const,
        steps: getUpdatedSteps(result.steps ?? [], updatedStep),
      },
      skillEvent,
    );
  };

  const onSkillStructedData = (skillEvent: SkillEvent) => {
    const { step, resultId, structuredData = {} } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result || !structuredData || !step) {
      return;
    }

    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);
    updatedStep.structuredData = {
      ...updatedStep.structuredData,
      ...structuredData,
    };

    const updatedResult = {
      ...result,
      status: 'executing' as const,
      steps: getUpdatedSteps(result.steps ?? [], updatedStep),
    };
    onUpdateResult(skillEvent.resultId, updatedResult, skillEvent);
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

    onUpdateResult(skillEvent.resultId, updatedResult, skillEvent);
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
    onUpdateResult(skillEvent.resultId, updatedResult, skillEvent);

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

  const onSkillError = (skillEvent: SkillEvent) => {
    const runtime = getRuntime();
    const { localSettings } = useUserStore.getState();
    const locale = localSettings?.uiLocale as LOCALE;

    const { error, resultId } = skillEvent;
    console.log('error', error);
    showErrorNotification(error, locale);

    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result) {
      return;
    }

    const updatedResult = {
      ...result,
      status: 'failed' as const,
      errors: [error?.errMsg],
    };
    onUpdateResult(skillEvent.resultId, updatedResult, skillEvent);

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

  const { data: skillData } = useListSkills({}, null, { staleTime: Infinity });
  const { data: modelData } = useListModels({}, null, { staleTime: Infinity });

  const invokeAction = (payload: InvokeSkillRequest) => {
    payload.resultId ||= genActionResultID();

    const { resultId, input } = payload;

    const skillName = payload.skillName || 'commonQnA';
    const skill = skillData?.data?.find((s) => s.name === skillName);

    const modelName = payload.modelName;
    const model = modelData?.data?.find((m) => m.name === modelName);

    onUpdateResult(resultId, {
      resultId,
      type: 'skill',
      actionMeta: {
        name: skill?.name,
        icon: skill?.icon,
      },
      modelInfo: model,
      title: input?.query,
      targetId: payload.target?.entityId,
      targetType: payload.target?.entityType,
      context: payload.context,
      history: payload.resultHistory,
      tplConfig: payload.tplConfig,
      status: 'waiting',
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
            metadata: {
              status: 'executing',
            },
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
      onSkillError,
      onSkillTokenUsage,
    });
  };

  return { invokeAction, abortAction };
};
