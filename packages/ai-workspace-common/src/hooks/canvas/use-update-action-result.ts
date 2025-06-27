import { useCallback, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { ActionResult, SkillEvent } from '@refly/openapi-schema';
import { actionEmitter } from '@refly-packages/ai-workspace-common/events/action';
import { useActionResultStoreShallow } from '@refly-packages/ai-workspace-common/stores/action-result';
import { CanvasNodeData, ResponseNodeMeta } from '@refly/canvas-common';
import { aggregateTokenUsage } from '@refly/utils/models';
import { useSetNodeDataByEntity } from './use-set-node-data-by-entity';
import { processContentPreview } from '../../utils/content';

// Memoize token usage calculation to avoid recalculating on every update
const memoizeTokenUsage = (() => {
  const cache = new Map();
  return (steps) => {
    const cacheKey = JSON.stringify(steps.map((s) => s?.name));
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }
    const result = aggregateTokenUsage(steps.flatMap((s) => s.tokenUsage).filter(Boolean));
    cache.set(cacheKey, result);
    return result;
  };
})();

const generateFullNodeDataUpdates = (
  payload: ActionResult,
): Partial<CanvasNodeData<ResponseNodeMeta>> => {
  return {
    title: payload.title,
    entityId: payload.resultId,
    contentPreview: processContentPreview((payload?.steps || []).map((s) => s?.content || '')),
    metadata: {
      status: payload?.status,
      errors: payload.errors,
      actionMeta: payload.actionMeta,
      modelInfo: payload.modelInfo,
      version: payload.version,
      artifacts: payload.steps.flatMap((s) => s.artifacts),
      structuredData: payload.steps.reduce(
        (acc, step) => Object.assign(acc, step.structuredData),
        {},
      ),
      tokenUsage: memoizeTokenUsage(payload.steps),
      reasoningContent: processContentPreview(payload.steps.map((s) => s?.reasoningContent || '')),
    },
  };
};

const generatePartialNodeDataUpdates = (payload: ActionResult, event?: SkillEvent) => {
  const { resultId, title, steps = [] } = payload ?? {};
  const nodeData: Partial<CanvasNodeData<ResponseNodeMeta>> = {
    title,
    entityId: resultId,
    metadata: {
      status: payload?.status,
      actionMeta: payload.actionMeta,
      modelInfo: payload.modelInfo,
      version: event?.version ?? payload.version,
    },
  };

  const { event: eventType, log } = event ?? {};

  // Optimize event-specific updates
  switch (eventType) {
    case 'stream':
      nodeData.contentPreview = processContentPreview(steps.map((s) => s?.content || ''));
      nodeData.metadata = {
        ...nodeData.metadata,
        reasoningContent: processContentPreview(steps.map((s) => s?.reasoningContent || '')),
      };
      break;

    case 'artifact':
      nodeData.metadata = {
        ...nodeData.metadata,
        status: payload?.status,
        artifacts: steps.flatMap((s) => s.artifacts),
      };
      break;

    case 'log':
      nodeData.metadata = {
        ...nodeData.metadata,
        status: payload?.status,
        currentLog: log,
      };
      break;

    case 'structured_data':
      nodeData.metadata = {
        ...nodeData.metadata,
        status: payload?.status,
        structuredData: steps.reduce((acc, step) => Object.assign(acc, step.structuredData), {}),
      };
      break;

    case 'token_usage':
      nodeData.metadata = {
        ...nodeData.metadata,
        status: payload?.status,
        tokenUsage: memoizeTokenUsage(steps),
      };
      break;

    case 'error':
      nodeData.metadata = {
        ...nodeData.metadata,
        status: payload?.status,
        errors: payload.errors,
      };
      break;
  }

  return nodeData;
};

// Optimized comparison that focuses on the most relevant properties
const isNodeDataEqual = (
  oldData: CanvasNodeData<ResponseNodeMeta>,
  newData: Partial<CanvasNodeData<ResponseNodeMeta>>,
): boolean => {
  // Compare basic properties
  if (oldData.title !== newData.title || oldData.entityId !== newData.entityId) {
    return false;
  }

  // For contentPreview, only check if they're different when newData has it
  if (newData.contentPreview !== undefined && oldData.contentPreview !== newData.contentPreview) {
    return false;
  }

  // Compare metadata selectively based on what's present in newData
  const oldMetadata = oldData.metadata ?? {};
  const newMetadata = newData.metadata ?? {};

  // Only compare properties that exist in newMetadata
  for (const key in newMetadata) {
    // Quick equality check for simple values
    if (typeof newMetadata[key] !== 'object') {
      if (oldMetadata[key] !== newMetadata[key]) {
        return false;
      }
    }
    // Simple length check for arrays
    else if (Array.isArray(newMetadata[key])) {
      const oldArray = oldMetadata[key] || [];
      const newArray = newMetadata[key] || [];
      if (oldArray.length !== newArray.length) {
        return false;
      }
    }
    // Simple check for objects to avoid deep comparison
    else if (JSON.stringify(oldMetadata[key]) !== JSON.stringify(newMetadata[key])) {
      return false;
    }
  }

  return true;
};

export const useUpdateActionResult = () => {
  const { queueActionResultUpdate, updateActionResult } = useActionResultStoreShallow((state) => ({
    updateActionResult: state.updateActionResult,
    queueActionResultUpdate: state.queueActionResultUpdate,
  }));
  const { getNodes } = useReactFlow();
  const setNodeDataByEntity = useSetNodeDataByEntity();

  // Use a ref to track throttling
  const throttleRef = useRef({
    lastUpdateTime: 0,
    pendingUpdate: null as null | {
      resultId: string;
      data: Partial<CanvasNodeData<ResponseNodeMeta>>;
    },
    timeoutId: null as null | number,
  });

  // Throttled node update function
  const throttledNodeUpdate = useCallback(
    (resultId: string, nodeData: Partial<CanvasNodeData<ResponseNodeMeta>>) => {
      const now = performance.now();
      const throttleTime = 200; // Increased from 100ms to 200ms for better performance

      // Clear any pending timeout
      if (throttleRef.current.timeoutId) {
        window.clearTimeout(throttleRef.current.timeoutId);
        throttleRef.current.timeoutId = null;
      }

      // Store the latest pending update
      throttleRef.current.pendingUpdate = { resultId, data: nodeData };

      // If enough time has passed since last update, apply immediately
      if (now - throttleRef.current.lastUpdateTime > throttleTime) {
        // Use requestAnimationFrame to align with browser's render cycle
        requestAnimationFrame(() => {
          setNodeDataByEntity({ type: 'skillResponse', entityId: resultId }, nodeData);
          throttleRef.current.lastUpdateTime = now;
          throttleRef.current.pendingUpdate = null;
        });
      } else {
        // Otherwise schedule update for later
        throttleRef.current.timeoutId = window.setTimeout(
          () => {
            requestAnimationFrame(() => {
              if (throttleRef.current.pendingUpdate) {
                const { resultId, data } = throttleRef.current.pendingUpdate;
                setNodeDataByEntity({ type: 'skillResponse', entityId: resultId }, data);
                throttleRef.current.lastUpdateTime = performance.now();
                throttleRef.current.pendingUpdate = null;
                throttleRef.current.timeoutId = null;
              }
            });
          },
          throttleTime - (now - throttleRef.current.lastUpdateTime),
        );
      }
    },
    [setNodeDataByEntity],
  );

  return useCallback(
    (resultId: string, payload: ActionResult, event?: SkillEvent) => {
      // Determine if this is a critical update that needs immediate processing
      const isCriticalUpdate =
        event?.event === 'error' ||
        event?.event === 'end' ||
        payload?.status === 'failed' ||
        payload?.status === 'finish';

      // Use different update strategies based on update type
      if (isCriticalUpdate) {
        // Critical updates go directly to the store
        actionEmitter.emit('updateResult', { resultId, payload });
        updateActionResult(resultId, payload);
      } else {
        // Non-critical updates use batched queue
        actionEmitter.emit('updateResult', { resultId, payload });
        queueActionResultUpdate(resultId, payload);
      }

      // Update canvas node data when the target is canvas
      if (payload.targetType === 'canvas') {
        // Optimize node data generation for different event types
        const nodeData =
          event && event.event === 'stream'
            ? {
                // For stream events, just update content-related fields
                contentPreview: processContentPreview(
                  payload.steps?.map((s) => s?.content || '') || [],
                ),
                metadata: {
                  status: payload?.status,
                  reasoningContent: processContentPreview(
                    payload.steps?.map((s) => s?.reasoningContent || '') || [],
                  ),
                },
              }
            : event
              ? generatePartialNodeDataUpdates(payload, event)
              : generateFullNodeDataUpdates(payload);

        // Only get current node data if we need to compare
        const nodes = getNodes();
        const currentNode = nodes.find(
          (n) => n.type === 'skillResponse' && n.data?.entityId === resultId,
        );

        // Only update if the data has changed (avoids unnecessary rerenders)
        if (
          !currentNode?.data ||
          !isNodeDataEqual(currentNode.data as CanvasNodeData<ResponseNodeMeta>, nodeData)
        ) {
          throttledNodeUpdate(resultId, nodeData);
        }
      }
    },
    [updateActionResult, queueActionResultUpdate, getNodes, throttledNodeUpdate],
  );
};
