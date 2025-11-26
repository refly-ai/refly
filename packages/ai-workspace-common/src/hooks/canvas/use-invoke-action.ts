import { codeArtifactEmitter } from '@refly-packages/ai-workspace-common/events/codeArtifact';
import { deletedNodesEmitter } from '@refly-packages/ai-workspace-common/events/deleted-nodes';
import { ssePost } from '@refly-packages/ai-workspace-common/utils/sse-post';
import { convertContextItemsToInvokeParams } from '@refly/canvas-common';
import {
  ActionMessage,
  ActionResult,
  ActionStatus,
  ActionStep,
  ActionStepMeta,
  AgentMode,
  Artifact,
  CodeArtifactType,
  Entity,
  GenericToolset,
  InvokeSkillRequest,
  ModelInfo,
  SkillEvent,
} from '@refly/openapi-schema';
import { useActionResultStore } from '@refly/stores';
import { logEvent } from '@refly/telemetry-web';
import { aggregateTokenUsage, detectActualTypeFromType, genActionResultID } from '@refly/utils';
import { ARTIFACT_TAG_CLOSED_REGEX, getArtifactContentAndAttributes } from '@refly/utils/artifact';
import { getRuntime } from '@refly/utils/env';
import { useCallback, useEffect, useRef } from 'react';
import {
  mergeToolCallById,
  parseToolCallFromChunk,
} from '../../components/markdown/plugins/tool-call/toolProcessor';
import { useSubscriptionUsage } from '../use-subscription-usage';
import {
  globalAbortControllerRef,
  globalCurrentResultIdRef,
  globalIsAbortedRef,
  useAbortAction,
} from './use-abort-action';
import { useActionPolling } from './use-action-polling';
import { IContextItem } from '@refly/common-types';
import { useUpdateActionResult } from './use-update-action-result';
import { useAgentConnections } from '@refly-packages/ai-workspace-common/hooks/canvas/use-agent-connections';

export interface InvokeActionPayload {
  title?: string;
  nodeId?: string;
  query?: string;
  resultId?: string;
  version?: number;
  modelInfo?: ModelInfo | null;
  contextItems?: IContextItem[];
  selectedToolsets?: GenericToolset[];
  agentMode?: AgentMode;
  copilotSessionId?: string;
}

export const useInvokeAction = (params?: { source?: string }) => {
  const latestStepsRef = useRef(new Map<string, ActionStep[]>());

  const { source } = params || {};

  const { abortAction } = useAbortAction(params);

  const deletedNodeIdsRef = useRef<Set<string>>(new Set());

  const { refetchUsage } = useSubscriptionUsage();
  const { getUpstreamAgentNodes } = useAgentConnections();

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

  // Message helper functions
  const findOrCreateMessage = (
    messages: ActionMessage[],
    messageId: string,
    type: 'ai' | 'tool',
  ): ActionMessage => {
    const existingMessage = messages?.find((m) => m.messageId === messageId);
    return existingMessage
      ? { ...existingMessage }
      : {
          messageId,
          type,
          content: '',
          reasoningContent: '',
          createdAt: new Date().toISOString(),
        };
  };

  const getUpdatedMessages = (
    messages: ActionMessage[],
    updatedMessage: ActionMessage,
  ): ActionMessage[] => {
    const existingIndex = messages?.findIndex((m) => m.messageId === updatedMessage.messageId);
    if (existingIndex === -1 || existingIndex === undefined) {
      return [...(messages ?? []), updatedMessage];
    }
    return messages.map((msg, index) => (index === existingIndex ? updatedMessage : msg));
  };

  // Update toolCalls on a step by parsing tool_use XML in the current chunk content
  const updateToolCallsFromXml = (
    updatedStep: ActionStep,
    step: ActionStepMeta | undefined,
    content: string,
  ): void => {
    const parsed = parseToolCallFromChunk(content, step?.name);
    if (!parsed) return;
    updatedStep.toolCalls = mergeToolCallById(updatedStep.toolCalls, parsed);
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

  // utils: get latest steps either from cache or store
  const getLatestSteps = (resultId: string): ActionStep[] => {
    const cached = latestStepsRef.current.get(resultId);
    if (cached && cached.length > 0) return cached;

    const storeSteps = useActionResultStore.getState().resultMap[resultId]?.steps ?? [];
    return storeSteps;
  };

  // utils: set latest steps cache
  const setLatestSteps = (resultId: string, steps: ActionStep[]) => {
    latestStepsRef.current.set(resultId, steps);
  };

  const clearLatestSteps = (resultId?: string) => {
    if (!resultId) {
      latestStepsRef.current.clear();
    } else {
      latestStepsRef.current.delete(resultId);
    }
  };

  const onSkillStream = (skillEvent: SkillEvent) => {
    const { resultId, content = '', reasoningContent = '', step, artifact, messageId } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result || !step) {
      return;
    }

    // Update steps (for backward compatibility)
    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);
    updatedStep.content = (updatedStep.content ?? '') + (content ?? '');
    if (!updatedStep.reasoningContent) {
      updatedStep.reasoningContent = reasoningContent ?? '';
    } else {
      updatedStep.reasoningContent =
        (updatedStep.reasoningContent ?? '') + (reasoningContent ?? '');
    }

    const payload: Partial<ActionResult> = {
      steps: getUpdatedSteps(result.steps ?? [], updatedStep),
    };

    // Update messages if messageId is provided
    if (messageId) {
      const updatedMessage = findOrCreateMessage(result.messages ?? [], messageId, 'ai');
      updatedMessage.content = (updatedMessage.content ?? '') + (content ?? '');
      updatedMessage.reasoningContent =
        (updatedMessage.reasoningContent ?? '') + (reasoningContent ?? '');
      updatedMessage.updatedAt = new Date().toISOString();

      payload.messages = getUpdatedMessages(result.messages ?? [], updatedMessage);
    }

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
    clearLatestSteps(skillEvent.resultId);
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

    if (globalCurrentResultIdRef.current === skillEvent.resultId) {
      globalCurrentResultIdRef.current = '';
    }

    refetchUsage();
  };

  const onSkillError = (skillEvent: SkillEvent) => {
    clearLatestSteps(skillEvent.resultId);
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

  // Handle tool_call_start event - create a new tool message
  const onToolCallStart = (skillEvent: SkillEvent) => {
    const {
      resultId,
      messageId,
      toolCallMeta,
      step,
      content = '',
      reasoningContent = '',
    } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result) return;

    const payload: Partial<ActionResult> = {};

    // Update messages with tool message if messageId is provided
    if (messageId && toolCallMeta) {
      const updatedMessage = findOrCreateMessage(result.messages ?? [], messageId, 'tool');
      updatedMessage.toolCallMeta = toolCallMeta;
      updatedMessage.toolCallId = toolCallMeta.toolCallId;
      updatedMessage.updatedAt = new Date().toISOString();

      payload.messages = getUpdatedMessages(result.messages ?? [], updatedMessage);
    }

    // Also update steps for backward compatibility
    if (step) {
      const currentSteps = getLatestSteps(resultId);
      const existingStep = currentSteps.find((s) => s.name === step.name);
      const updatedStep: ActionStep = existingStep
        ? { ...existingStep }
        : {
            ...step,
            content: '',
            reasoningContent: '',
            artifacts: [],
            structuredData: {},
          };

      updatedStep.content = (updatedStep.content ?? '') + (content ?? '');
      updatedStep.reasoningContent =
        (updatedStep.reasoningContent ?? '') + (reasoningContent ?? '');
      updateToolCallsFromXml(updatedStep, step, content);

      const mergedSteps = getUpdatedSteps(currentSteps, updatedStep);
      setLatestSteps(resultId, mergedSteps);
      payload.steps = mergedSteps;
    }

    onUpdateResult(resultId, payload, skillEvent);
  };

  // Handle tool_call_end event - update tool message status to completed
  const onToolCallEnd = (skillEvent: SkillEvent) => {
    const { resultId, messageId, toolCallMeta, step, content = '', artifact } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result) return;

    const payload: Partial<ActionResult> = {};

    // Update messages with completed status
    if (messageId && toolCallMeta) {
      const updatedMessage = findOrCreateMessage(result.messages ?? [], messageId, 'tool');
      updatedMessage.toolCallMeta = {
        ...updatedMessage.toolCallMeta,
        ...toolCallMeta,
        status: 'completed',
      };
      updatedMessage.toolCallId = toolCallMeta.toolCallId;
      updatedMessage.updatedAt = new Date().toISOString();

      payload.messages = getUpdatedMessages(result.messages ?? [], updatedMessage);
    }

    // Also update steps for backward compatibility
    if (step) {
      const currentSteps = getLatestSteps(resultId);
      const existingStep = currentSteps.find((s) => s.name === step.name);
      const updatedStep: ActionStep = existingStep
        ? { ...existingStep }
        : {
            ...step,
            content: '',
            reasoningContent: '',
            artifacts: [],
            structuredData: {},
          };

      updatedStep.content = (updatedStep.content ?? '') + (content ?? '');
      updateToolCallsFromXml(updatedStep, step, content);

      const mergedSteps = getUpdatedSteps(currentSteps, updatedStep);
      setLatestSteps(resultId, mergedSteps);
      if (artifact) {
        onSkillStreamArtifact(resultId, artifact, updatedStep.content ?? '');
      }
      payload.steps = mergedSteps;
    }

    onUpdateResult(resultId, payload, skillEvent);
  };

  // Handle tool_call_error event - update tool message status to failed
  const onToolCallError = (skillEvent: SkillEvent) => {
    const { resultId, messageId, toolCallMeta, step, content = '' } = skillEvent;
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result) return;

    const payload: Partial<ActionResult> = {};

    // Update messages with failed status
    if (messageId && toolCallMeta) {
      const updatedMessage = findOrCreateMessage(result.messages ?? [], messageId, 'tool');
      updatedMessage.toolCallMeta = {
        ...updatedMessage.toolCallMeta,
        ...toolCallMeta,
        status: 'failed',
      };
      updatedMessage.toolCallId = toolCallMeta.toolCallId;
      updatedMessage.updatedAt = new Date().toISOString();

      payload.messages = getUpdatedMessages(result.messages ?? [], updatedMessage);
    }

    // Also update steps for backward compatibility
    if (step) {
      const currentSteps = getLatestSteps(resultId);
      const existingStep = currentSteps.find((s) => s.name === step.name);
      const updatedStep: ActionStep = existingStep
        ? { ...existingStep }
        : {
            ...step,
            content: '',
            reasoningContent: '',
            artifacts: [],
            structuredData: {},
          };

      updatedStep.content = (updatedStep.content ?? '') + (content ?? '');
      updateToolCallsFromXml(updatedStep, step, content);

      const mergedSteps = getUpdatedSteps(currentSteps, updatedStep);
      setLatestSteps(resultId, mergedSteps);
      payload.steps = mergedSteps;
    }

    onUpdateResult(resultId, payload, skillEvent);
  };

  // Handle tool_call_stream event - update tool call XML content in steps
  const onToolCallStream = (skillEvent: SkillEvent) => {
    const { resultId, content = '', reasoningContent = '', step, artifact } = skillEvent;
    if (!resultId || !step) return;

    // get latest steps either from cache or store
    const currentSteps = getLatestSteps(resultId);

    const existingStep = currentSteps.find((s) => s.name === step.name);
    const updatedStep: ActionStep = existingStep
      ? { ...existingStep }
      : {
          ...step,
          content: '',
          reasoningContent: '',
          artifacts: [],
          structuredData: {},
        };

    // merge text
    updatedStep.content = (updatedStep.content ?? '') + (content ?? '');
    updatedStep.reasoningContent = (updatedStep.reasoningContent ?? '') + (reasoningContent ?? '');

    // merge tool calls status
    updateToolCallsFromXml(updatedStep, step, content);

    // update based on latest steps
    const mergedSteps = getUpdatedSteps(currentSteps, updatedStep);
    setLatestSteps(resultId, mergedSteps);
    if (artifact) {
      onSkillStreamArtifact(resultId, artifact, updatedStep.content ?? '');
    }
    onUpdateResult(resultId, { steps: mergedSteps }, skillEvent);
  };

  const onCompleted = () => {};
  const onStart = () => {};

  const invokeAction = useCallback(
    async (payload: InvokeActionPayload, target: Entity) => {
      deletedNodeIdsRef.current = new Set();

      payload.resultId ||= genActionResultID();

      const {
        title,
        nodeId,
        query,
        modelInfo,
        contextItems,
        resultId,
        version = 0,
        selectedToolsets = [],
        agentMode = 'node_agent',
        copilotSessionId,
      } = payload;

      logEvent('model::invoke_trigger', Date.now(), {
        source,
        resultId,
        model: modelInfo?.name,
        target: target?.entityType,
      });

      globalAbortControllerRef.current = new AbortController();
      globalCurrentResultIdRef.current = resultId; // Track current active resultId

      const upstreamAgentNodes = nodeId ? getUpstreamAgentNodes(nodeId) : [];
      const context = convertContextItemsToInvokeParams(
        contextItems ?? [],
        upstreamAgentNodes.map((node) => node.data?.entityId) ?? [],
      );

      const param: InvokeSkillRequest = {
        resultId,
        title: title ?? query,
        input: {
          query,
        },
        target,
        modelName: modelInfo?.name,
        modelItemId: modelInfo?.providerItemId,
        context,
        toolsets: selectedToolsets,
        mode: agentMode,
        copilotSessionId,
      };

      const initialResult: ActionResult = {
        resultId,
        version,
        type: 'skill',
        modelInfo,
        title: query,
        input: param.input,
        targetId: target?.entityId,
        targetType: target?.entityType,
        context,
        status: 'waiting' as ActionStatus,
        steps: [],
        errors: [],
      };

      onUpdateResult(resultId, initialResult);
      useActionResultStore.getState().addStreamResult(resultId, initialResult);
      useActionResultStore.getState().setResultActiveTab(resultId, 'lastRun');

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
        onToolCallStart: wrapEventHandler(onToolCallStart),
        onToolCallEnd: wrapEventHandler(onToolCallEnd),
        onToolCallError: wrapEventHandler(onToolCallError),
        onToolCallStream: wrapEventHandler(onToolCallStream),
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
    [onUpdateResult, createTimeoutHandler],
  );

  return { invokeAction, abortAction };
};
