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
import { useCallback, useEffect, useRef } from 'react';
import {
  mergeToolCallById,
  parseToolCallFromChunk,
} from '../../components/markdown/plugins/tool-call/toolProcessor';
import { useSubscriptionUsage } from '../use-subscription-usage';
import {
  cleanupAbortController,
  globalAbortControllersRef,
  globalAbortedResultsRef,
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
  workflowVariables?: any[]; // WorkflowVariable[] - for resolving resource variables
}

export const useInvokeAction = (params?: { source?: string }) => {
  const latestStepsRef = useRef(new Map<string, ActionStep[]>());
  // Message cache for real-time updates (similar to steps cache)
  const latestMessagesRef = useRef(new Map<string, ActionMessage[]>());
  const actionResultStatusRef = useRef(new Map<string, ActionStatus>());

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
    const status = getActionStatus(resultId);

    if (!status) {
      return;
    }

    // Get result info from store for logging (this is acceptable for logging)
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    logEvent('model::invoke_start', Date.now(), {
      resultId,
      source,
      model: result?.modelInfo?.name,
      skill: result?.actionMeta?.name,
    });

    stopPolling(resultId);
  };

  const onSkillLog = (skillEvent: SkillEvent) => {
    const { resultId, step, log } = skillEvent;
    const status = getActionStatus(resultId);

    if (!status || !step) {
      return;
    }

    // Get result from store for steps access
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result) {
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
    const status = getActionStatus(resultId);

    if (!status || !step) {
      return;
    }

    // Get result from store for steps access
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];
    if (!result) return;

    const updatedStep: ActionStep = findOrCreateStep(result.steps ?? [], step);
    if (tokenUsage) {
      updatedStep.tokenUsage = aggregateTokenUsage([...(updatedStep.tokenUsage ?? []), tokenUsage]);
    }

    onUpdateResult(
      resultId,
      {
        steps: getUpdatedSteps(result.steps ?? [], updatedStep),
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
      latestMessagesRef.current.clear();
    } else {
      latestStepsRef.current.delete(resultId);
      latestMessagesRef.current.delete(resultId);
    }
  };

  const getActionStatus = (resultId: string): ActionStatus | null => {
    const cachedStatus = actionResultStatusRef.current.get(resultId);
    if (cachedStatus) return cachedStatus;

    const storeResult = useActionResultStore.getState().resultMap[resultId];
    return storeResult?.status ?? null;
  };

  const setActionStatus = (resultId: string, status: ActionStatus) => {
    actionResultStatusRef.current.set(resultId, status);
  };

  const getLatestMessages = (resultId: string): ActionMessage[] => {
    const cached = latestMessagesRef.current.get(resultId);
    if (cached && cached.length > 0) return cached;

    const storeMessages = useActionResultStore.getState().resultMap[resultId]?.messages ?? [];
    return storeMessages;
  };

  const setLatestMessages = (resultId: string, messages: ActionMessage[]) => {
    latestMessagesRef.current.set(resultId, messages);
  };

  const onSkillStream = (skillEvent: SkillEvent) => {
    const { resultId, content = '', reasoningContent = '', step, artifact, messageId } = skillEvent;
    const status = getActionStatus(resultId);

    if (!status || !step) {
      return;
    }

    // Get result from store for steps access
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result) {
      return;
    }

    // Use cached steps for real-time updates (same pattern as onToolCallStream)
    const currentSteps = getLatestSteps(resultId);

    // Update steps (for backward compatibility)
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
    updatedStep.reasoningContent = (updatedStep.reasoningContent ?? '') + (reasoningContent ?? '');

    const mergedSteps = getUpdatedSteps(currentSteps, updatedStep);
    setLatestSteps(resultId, mergedSteps);

    const payload: Partial<ActionResult> = {
      status,
      steps: mergedSteps,
    };

    // Update messages if messageId is provided (also use cache for real-time updates)
    if (messageId) {
      const currentMessages = getLatestMessages(resultId);
      const existingMessage = currentMessages.find((m) => m.messageId === messageId);
      const updatedMessage: ActionMessage = existingMessage
        ? { ...existingMessage }
        : {
            messageId,
            type: 'ai',
            content: '',
            reasoningContent: '',
            createdAt: new Date().toISOString(),
          };

      updatedMessage.content = (updatedMessage.content ?? '') + (content ?? '');
      updatedMessage.reasoningContent =
        (updatedMessage.reasoningContent ?? '') + (reasoningContent ?? '');
      updatedMessage.updatedAt = new Date().toISOString();

      const mergedMessages = getUpdatedMessages(currentMessages, updatedMessage);
      setLatestMessages(resultId, mergedMessages);
      payload.messages = mergedMessages;
    }

    if (artifact) {
      onSkillStreamArtifact(resultId, artifact, updatedStep.content ?? '');
    }

    onUpdateResult(resultId, payload, skillEvent);
  };

  const onSkillStructedData = (skillEvent: SkillEvent) => {
    const { step, resultId, structuredData = {} } = skillEvent;
    const status = getActionStatus(resultId);

    if (!status || !structuredData || !step) {
      return;
    }

    // Get result from store for steps access
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result) {
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
      status,
      steps: getUpdatedSteps(result.steps ?? [], updatedStep),
    };
    onUpdateResult(skillEvent.resultId, payload, skillEvent);
  };

  const onSkillArtifact = (skillEvent: SkillEvent) => {
    const { resultId, artifact, step } = skillEvent;
    const status = getActionStatus(resultId);

    if (!status || !step || !artifact) {
      return;
    }

    // Get result from store for steps access
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result) {
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
      status,
      steps: getUpdatedSteps(result.steps ?? [], updatedStep),
    };

    onUpdateResult(skillEvent.resultId, payload, skillEvent);
  };

  const onSkillCreateNode = (_skillEvent: SkillEvent) => {
    // This event is deprecated, we don't need to handle it
  };

  const onSkillEnd = (skillEvent: SkillEvent) => {
    clearLatestSteps(skillEvent.resultId);

    // Get result from store for logging
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

    setActionStatus(skillEvent.resultId, 'finish');
    const payload = {
      status: 'finish' as const,
    };
    onUpdateResult(skillEvent.resultId, payload, skillEvent);

    refetchUsage();
  };

  const onSkillError = (skillEvent: SkillEvent) => {
    clearLatestSteps(skillEvent.resultId);
    const { originError, resultId } = skillEvent;

    // Get result from store for logging and setTraceId
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

    setActionStatus(skillEvent.resultId, 'failed');
    const payload = {
      status: 'failed' as const,
      errors: originError ? [originError] : [],
    };
    onUpdateResult(skillEvent.resultId, payload, skillEvent);

    // if it is aborted, do nothing
    if (globalAbortedResultsRef.current.has(resultId)) {
      return;
    }
  };

  // Handle tool_call_start event - create a new tool message
  const onToolCallStart = (skillEvent: SkillEvent) => {
    const {
      resultId,
      messageId,
      toolCallMeta,
      toolCallResult,
      step,
      content = '',
      reasoningContent = '',
    } = skillEvent;
    const status = getActionStatus(resultId);

    if (!status) return;

    // Get result from store for other properties if needed
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result) return;

    const payload: Partial<ActionResult> = {
      status,
    };

    // Update messages with tool message if messageId is provided
    if (messageId && toolCallMeta) {
      const currentMessages = getLatestMessages(resultId);
      const updatedMessage = findOrCreateMessage(currentMessages, messageId, 'tool');
      updatedMessage.toolCallMeta = toolCallMeta;
      updatedMessage.toolCallId = toolCallMeta.toolCallId;
      updatedMessage.toolCallResult = toolCallResult;
      updatedMessage.updatedAt = new Date().toISOString();

      const mergedMessages = getUpdatedMessages(currentMessages, updatedMessage);
      setLatestMessages(resultId, mergedMessages);
      payload.messages = mergedMessages;
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
    const {
      resultId,
      messageId,
      toolCallMeta,
      toolCallResult,
      step,
      content = '',
      artifact,
    } = skillEvent;
    const status = getActionStatus(resultId);

    if (!status) return;

    // Get result from store for other properties if needed
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result) return;

    const payload: Partial<ActionResult> = {
      status,
    };

    // Update messages with completed status
    if (messageId && toolCallMeta) {
      const currentMessages = getLatestMessages(resultId);
      const updatedMessage = findOrCreateMessage(currentMessages, messageId, 'tool');
      updatedMessage.toolCallMeta = {
        ...updatedMessage.toolCallMeta,
        ...toolCallMeta,
        status: 'completed',
      };
      updatedMessage.toolCallId = toolCallMeta.toolCallId;
      updatedMessage.toolCallResult = toolCallResult;
      updatedMessage.updatedAt = new Date().toISOString();

      const mergedMessages = getUpdatedMessages(currentMessages, updatedMessage);
      setLatestMessages(resultId, mergedMessages);
      payload.messages = mergedMessages;
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
    const { resultId, messageId, toolCallMeta, toolCallResult, step, content = '' } = skillEvent;
    const status = getActionStatus(resultId);

    if (!status) return;

    // Get result from store for other properties if needed
    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[resultId];

    if (!result) return;

    const payload: Partial<ActionResult> = {
      status,
    };

    // Update messages with failed status
    if (messageId && toolCallMeta) {
      const currentMessages = getLatestMessages(resultId);
      const updatedMessage = findOrCreateMessage(currentMessages, messageId, 'tool');
      updatedMessage.toolCallMeta = {
        ...updatedMessage.toolCallMeta,
        ...toolCallMeta,
        status: 'failed',
      };
      updatedMessage.toolCallId = toolCallMeta.toolCallId;
      updatedMessage.toolCallResult = toolCallResult;
      updatedMessage.updatedAt = new Date().toISOString();

      const mergedMessages = getUpdatedMessages(currentMessages, updatedMessage);
      setLatestMessages(resultId, mergedMessages);
      payload.messages = mergedMessages;
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
        workflowVariables,
      } = payload;

      logEvent('model::invoke_trigger', Date.now(), {
        source,
        resultId,
        model: modelInfo?.name,
        target: target?.entityType,
      });

      const controller = new AbortController();
      globalAbortControllersRef.current.set(resultId, controller);
      globalAbortedResultsRef.current.delete(resultId);

      const upstreamAgentNodes = nodeId ? getUpstreamAgentNodes(nodeId) : [];
      const context = convertContextItemsToInvokeParams(
        contextItems ?? [],
        upstreamAgentNodes.map((node) => node.data?.entityId) ?? [],
        workflowVariables, // Pass workflow variables for resolving resource variables
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
        status: 'executing' as ActionStatus,
        steps: [],
        errors: [],
      };

      setActionStatus(resultId, 'executing');
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

      try {
        await ssePost({
          controller,
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
      } finally {
        cleanupAbortController(resultId);
      }
    },
    [source, abortAction, onUpdateResult, getUpstreamAgentNodes, refetchUsage],
  );

  return { invokeAction, abortAction };
};
