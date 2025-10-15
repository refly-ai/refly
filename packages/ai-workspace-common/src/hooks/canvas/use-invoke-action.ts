import { useCallback, useRef, useEffect } from 'react';
import {
  ActionStep,
  ActionStepMeta,
  Artifact,
  CodeArtifactType,
  Entity,
  InvokeSkillRequest,
  SkillEvent,
  ActionStatus,
  ActionResult,
} from '@refly/openapi-schema';
import { ssePost } from '@refly-packages/ai-workspace-common/utils/sse-post';
import { getRuntime } from '@refly/utils/env';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { useActionResultStore } from '@refly/stores';
import { aggregateTokenUsage, genActionResultID, detectActualTypeFromType } from '@refly/utils';
import { SkillNodeMeta, convertContextItemsToInvokeParams } from '@refly/canvas-common';
import { useFindThreadHistory } from '@refly-packages/ai-workspace-common/hooks/canvas/use-find-thread-history';
import { useActionPolling } from './use-action-polling';
import { useFindMemo } from '@refly-packages/ai-workspace-common/hooks/canvas/use-find-memo';
import { useUpdateActionResult } from './use-update-action-result';
import { useSubscriptionUsage } from '../use-subscription-usage';
import { useFindImages } from '@refly-packages/ai-workspace-common/hooks/canvas/use-find-images';
import { ARTIFACT_TAG_CLOSED_REGEX, getArtifactContentAndAttributes } from '@refly/utils/artifact';
import { useFindWebsite } from '@refly-packages/ai-workspace-common/hooks/canvas/use-find-website';
import { codeArtifactEmitter } from '@refly-packages/ai-workspace-common/events/codeArtifact';
import { deletedNodesEmitter } from '@refly-packages/ai-workspace-common/events/deleted-nodes';
import { logEvent } from '@refly/telemetry-web';
import {
  useAbortAction,
  globalAbortControllerRef,
  globalIsAbortedRef,
  globalCurrentResultIdRef,
} from './use-abort-action';

export const useInvokeAction = (params?: { source?: string }) => {
  const { source } = params || {};

  const setNodeDataByEntity = useSetNodeDataByEntity();
  const { abortAction } = useAbortAction(params);

  const deletedNodeIdsRef = useRef<Set<string>>(new Set());

  const { refetchUsage } = useSubscriptionUsage();

  useEffect(() => {
    const handleNodeDeleted = (entityId: string) => {
      if (entityId) {
        deletedNodeIdsRef.current.add(entityId);
      }
    };

    deletedNodesEmitter.on('nodeDeleted', handleNodeDeleted);

    return () => {
      deletedNodesEmitter.off('nodeDeleted', handleNodeDeleted);
    };
  }, []);

  const { createTimeoutHandler, stopPolling } = useActionPolling();
  const onUpdateResult = useUpdateActionResult();

  const onSkillStart = (skillEvent: SkillEvent) => {
    const { resultId } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result) {
      return;
    }

    logEvent('model::invoke_start', Date.now(), {
      resultId,
      source,
      model: result.modelInfo?.name,
      skill: result.actionMeta?.name,
    });

    stopPolling(resultId);
  };

  const onSkillLog = (skillEvent: SkillEvent) => {
    const { resultId, step, log } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result || !step) {
      return;
    }

    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);

    if (log) {
      updatedStep.logs = [...(updatedStep.logs || []), log];
    }

    const payload = {
      steps: getUpdatedSteps(result.steps ?? [], updatedStep),
    };
    onUpdateResult(resultId, payload, skillEvent);
  };

  const onSkillTokenUsage = (skillEvent: SkillEvent) => {
    const { resultId, step, tokenUsage } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result || !step) {
      return;
    }

    const currentResult = useActionResultStore.getState().resultMap[resultId];
    if (!currentResult) return;

    const updatedStep: ActionStep = findOrCreateStep(currentResult.steps ?? [], step);
    if (tokenUsage) {
      updatedStep.tokenUsage = aggregateTokenUsage([...(updatedStep.tokenUsage ?? []), tokenUsage]);
    }

    onUpdateResult(
      resultId,
      {
        steps: getUpdatedSteps(currentResult.steps ?? [], updatedStep),
      },
      skillEvent,
    );
  };

  const findOrCreateStep = (steps: ActionStep[], stepMeta: ActionStepMeta) => {
    const existingStep = steps.find((s) => s.name === stepMeta.name);
    return existingStep
      ? { ...existingStep }
      : {
          ...stepMeta,
          content: '',
          reasoningContent: '',
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

  const onSkillStreamArtifact = (_resultId: string, artifact: Artifact, content: string) => {
    // Handle code artifact content if this is a code artifact stream
    if (artifact && artifact.type === 'codeArtifact') {
      // Get the code content and attributes as an object
      const { content: codeContent, type } = getArtifactContentAndAttributes(content);

      // Check if the node exists and create it if not
      const actualType = detectActualTypeFromType(type as CodeArtifactType);

      // Check if artifact is closed using the ARTIFACT_TAG_CLOSED_REGEX
      const isArtifactClosed = ARTIFACT_TAG_CLOSED_REGEX.test(content);
      if (isArtifactClosed) {
        codeArtifactEmitter.emit('statusUpdate', {
          artifactId: artifact.entityId,
          status: 'finish',
          type: actualType || 'text/markdown',
        });
      }

      codeArtifactEmitter.emit('contentUpdate', {
        artifactId: artifact.entityId,
        content: codeContent,
      });
    }
  };

  const onSkillStream = (skillEvent: SkillEvent) => {
    const { resultId, content = '', reasoningContent = '', step, artifact } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result || !step) {
      return;
    }
    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);
    updatedStep.content = (updatedStep.content ?? '') + (content ?? '');
    if (!updatedStep.reasoningContent) {
      updatedStep.reasoningContent = reasoningContent ?? '';
    } else {
      updatedStep.reasoningContent =
        (updatedStep.reasoningContent ?? '') + (reasoningContent ?? '');
    }

    const payload = {
      steps: getUpdatedSteps(result.steps ?? [], updatedStep),
    };

    if (artifact) {
      onSkillStreamArtifact(resultId, artifact, updatedStep.content ?? '');
    }

    onUpdateResult(resultId, payload, skillEvent);
  };

  const onSkillStructedData = (skillEvent: SkillEvent) => {
    const { step, resultId, structuredData = {} } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result || !structuredData || !step) {
      return;
    }

    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);

    // Handle chunked sources data
    if (structuredData.sources && Array.isArray(structuredData.sources)) {
      const existingData = updatedStep.structuredData || {};
      const existingSources = (existingData.sources || []) as any[];

      // If this is a chunk of sources, merge it with existing sources
      if (structuredData.isPartial !== undefined) {
        updatedStep.structuredData = {
          ...existingData,
          sources: [...existingSources, ...structuredData.sources],
          isPartial: structuredData.isPartial,
          chunkIndex: structuredData.chunkIndex,
          totalChunks: structuredData.totalChunks,
        };
      } else {
        // Handle non-chunked data as before
        updatedStep.structuredData = {
          ...existingData,
          ...structuredData,
        };
      }
    } else {
      // Handle non-sources structured data
      updatedStep.structuredData = {
        ...updatedStep.structuredData,
        ...structuredData,
      };
    }

    const payload = {
      steps: getUpdatedSteps(result.steps ?? [], updatedStep),
    };
    onUpdateResult(skillEvent.resultId, payload, skillEvent);
  };

  const onSkillArtifact = (skillEvent: SkillEvent) => {
    const { resultId, artifact, step } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result || !step || !artifact) {
      return;
    }

    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);
    const existingArtifacts = Array.isArray(updatedStep.artifacts)
      ? [...updatedStep.artifacts]
      : [];
    const artifactIndex = existingArtifacts.findIndex(
      (item) => item?.entityId === artifact.entityId,
    );

    updatedStep.artifacts =
      artifactIndex !== -1
        ? existingArtifacts.map((item, index) => (index === artifactIndex ? artifact : item))
        : [...existingArtifacts, artifact];

    const payload = {
      steps: getUpdatedSteps(result.steps ?? [], updatedStep),
    };

    onUpdateResult(skillEvent.resultId, payload, skillEvent);
  };

  const onSkillCreateNode = (_skillEvent: SkillEvent) => {
    // This event is deprecated, we don't need to handle it
  };

  const onSkillEnd = (skillEvent: SkillEvent) => {
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[skillEvent.resultId];

    if (!result) {
      return;
    }

    logEvent('model::invoke_end', Date.now(), {
      resultId: result.resultId,
      source,
      model: result.modelInfo?.name,
      skill: result.actionMeta?.name,
    });

    stopPolling(skillEvent.resultId);

    const payload = {
      status: 'finish' as const,
    };
    onUpdateResult(skillEvent.resultId, payload, skillEvent);

    // Clear current resultId when conversation ends
    if (globalCurrentResultIdRef.current === skillEvent.resultId) {
      globalCurrentResultIdRef.current = '';
    }

    const artifacts = result.steps?.flatMap((s) => s.artifacts ?? []);
    if (artifacts?.length) {
      for (const artifact of artifacts) {
        if (deletedNodeIdsRef.current.has(artifact.entityId)) {
          continue;
        }

        if (artifact.type === 'codeArtifact') {
          setNodeDataByEntity(
            {
              type: artifact.type,
              entityId: artifact.entityId,
            },
            {
              metadata: {
                status: 'finish',
                activeTab: 'preview', // Set to preview when skill finishes
              },
            },
          );
        } else {
          // For other artifact types, just update status
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
        }
      }
    }

    refetchUsage();
  };

  const onSkillError = (skillEvent: SkillEvent) => {
    const runtime = getRuntime();
    const { originError, resultId } = skillEvent;

    const { resultMap, setTraceId } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result) {
      return;
    }

    logEvent('model::invoke_error', Date.now(), {
      resultId,
      source,
      model: result.modelInfo?.name,
      skill: result.actionMeta?.name,
      error: originError,
    });

    stopPolling(resultId);

    // Set traceId if available (check for traceId in different possible locations)
    const traceId = skillEvent?.error?.traceId;

    if (traceId) {
      setTraceId(resultId, traceId);
    }

    const payload = {
      status: 'failed' as const,
      errors: originError ? [originError] : [],
    };
    onUpdateResult(skillEvent.resultId, payload, skillEvent);

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
  };

  const onCompleted = () => {};
  const onStart = () => {};
  const findThreadHistory = useFindThreadHistory();
  const findMemo = useFindMemo();
  const findWebsite = useFindWebsite();
  const findImages = useFindImages();

  const invokeAction = useCallback(
    async (payload: SkillNodeMeta, target: Entity) => {
      deletedNodeIdsRef.current = new Set();

      payload.resultId ||= genActionResultID();
      payload.selectedSkill ||= { name: 'commonQnA' };

      const {
        query,
        modelInfo,
        contextItems,
        selectedSkill,
        resultId,
        version = 0,
        tplConfig = {},
        runtimeConfig = {},
        projectId,
        selectedToolsets = [],
      } = payload;

      const originalQuery = payload.structuredData?.query as string;

      logEvent('model::invoke_trigger', Date.now(), {
        source,
        resultId,
        model: modelInfo?.name,
        target: target?.entityType,
        skill: selectedSkill?.name,
      });

      globalAbortControllerRef.current = new AbortController();
      globalCurrentResultIdRef.current = resultId; // Track current active resultId

      const { context, resultHistory, images } = convertContextItemsToInvokeParams(
        contextItems ?? [],
        (item) =>
          findThreadHistory({ resultId: item.entityId }).map((node) => ({
            title: node.data?.title,
            resultId: node.data?.entityId,
          })),
        (item) => {
          if (item.type === 'memo') {
            return findMemo({ resultId: item.entityId }).map((node) => ({
              content: node.data?.contentPreview ?? '',
              title: node.data?.title ?? 'Memo',
            }));
          }
          return [];
        },
        (item) => {
          if (item.type === 'image') {
            return findImages({ resultId: item.entityId });
          }
          return [];
        },
        (item) => {
          if (item.type === 'website') {
            return findWebsite({ resultId: item.entityId }).map((node) => ({
              url: node.data?.metadata?.url ?? '',
              title: node.data?.title ?? 'Website',
            }));
          }
          return [];
        },
      );

      const param: InvokeSkillRequest = {
        resultId,
        input: {
          query,
          originalQuery,
          images,
        },
        target,
        modelName: modelInfo?.name,
        modelItemId: modelInfo?.providerItemId,
        context,
        resultHistory,
        skillName: selectedSkill?.name,
        toolsets: selectedToolsets,
        tplConfig,
        runtimeConfig,
        projectId,
      };

      const initialResult: ActionResult = {
        resultId,
        version,
        type: 'skill',
        actionMeta: selectedSkill,
        modelInfo,
        title: query,
        targetId: target?.entityId,
        targetType: target?.entityType,
        context,
        history: resultHistory,
        tplConfig,
        runtimeConfig,
        status: 'waiting' as ActionStatus,
        steps: [],
        errors: [],
      };

      onUpdateResult(resultId, initialResult);
      useActionResultStore.getState().addStreamResult(resultId, initialResult);

      // Create timeout handler for this action
      const { resetTimeout, cleanup: timeoutCleanup } = createTimeoutHandler(resultId, version);

      // Wrap event handlers to reset timeout
      const wrapEventHandler =
        (handler: (...args: any[]) => void) =>
        (...args: any[]) => {
          resetTimeout();
          handler(...args);
        };

      resetTimeout();

      await ssePost({
        controller: globalAbortControllerRef.current,
        payload: param,
        onStart: wrapEventHandler(onStart),
        onSkillStart: wrapEventHandler(onSkillStart),
        onSkillStream: wrapEventHandler(onSkillStream),
        onSkillLog: wrapEventHandler(onSkillLog),
        onSkillArtifact: wrapEventHandler(onSkillArtifact),
        onSkillStructedData: wrapEventHandler(onSkillStructedData),
        onSkillCreateNode: wrapEventHandler(onSkillCreateNode),
        onSkillEnd: wrapEventHandler(onSkillEnd),
        onCompleted: wrapEventHandler(onCompleted),
        onSkillError: wrapEventHandler(onSkillError),
        onSkillTokenUsage: wrapEventHandler(onSkillTokenUsage),
      });

      return () => {
        timeoutCleanup();
      };
    },
    [setNodeDataByEntity, onUpdateResult, createTimeoutHandler],
  );

  return { invokeAction, abortAction };
};
