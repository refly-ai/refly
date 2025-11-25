import { actionEmitter } from '@refly-packages/ai-workspace-common/events/action';
import { CanvasNodeData, ResponseNodeMeta } from '@refly/canvas-common';
import { ActionResult, ActionStep, SkillEvent } from '@refly/openapi-schema';
import { useActionResultStore, useActionResultStoreShallow } from '@refly/stores';
import { aggregateTokenUsage, mergeActionResults } from '@refly/utils';
import { useReactFlow } from '@xyflow/react';
import { useCallback, useEffect, useRef } from 'react';
import { processContentPreview } from '../../utils/content';
import { useSetNodeDataByEntity } from './use-set-node-data-by-entity';

const FLUSH_INTERVAL_MS = 150; // Debounce interval for heavy flush
const MAX_WAIT_MS = 1500; // Hard cap to prevent starvation under continuous streams

// Memoize token usage calculation to avoid recalculating on every update
const memoizeTokenUsage = (() => {
  const cache = new Map();
  return (steps: ActionStep[]) => {
    const cacheKey = JSON.stringify(steps.map((s) => s?.name));
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }
    const result = aggregateTokenUsage(steps.flatMap((s) => s.tokenUsage).filter((t) => !!t));
    cache.set(cacheKey, result);
    return result;
  };
})();

const generateFullNodeDataUpdates = (
  payload: Partial<ActionResult>,
): Partial<CanvasNodeData<ResponseNodeMeta>> => {
  return {
    entityId: payload.resultId,
    contentPreview: processContentPreview((payload?.steps || []).map((s) => s?.content || '')),
    metadata: {
      status: payload?.status ?? 'finish',
      errorType: payload?.errorType ?? 'systemError',
      errors: payload.errors,
      actionMeta: payload.actionMeta,
      modelInfo: payload.modelInfo,
      version: payload.version,
      artifacts: payload.steps?.flatMap((s) => s.artifacts ?? []) ?? [],
      structuredData: payload.steps?.reduce(
        (acc, step) => Object.assign(acc, step.structuredData),
        {},
      ),
      tokenUsage: memoizeTokenUsage(payload.steps ?? []),
      reasoningContent: processContentPreview(
        payload.steps?.map((s) => s?.reasoningContent || '') ?? [],
      ),
    },
  };
};

// Note: Partial per-event node updates were removed to avoid frequent heavy renders.

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
  const { updateActionResult } = useActionResultStoreShallow((state) => ({
    updateActionResult: state.updateActionResult,
  }));
  const { getNodes } = useReactFlow();
  const setNodeDataByEntity = useSetNodeDataByEntity();
  const contentCacheRef = useRef<Record<string, { version?: number; preview: string }>>({});

  const buildNodeUpdates = useCallback(
    (resultId: string, payload: Partial<ActionResult>) => {
      if (!payload) {
        return {};
      }
      const updates = generateFullNodeDataUpdates(payload);
      const nextPreview = updates.contentPreview ?? '';
      const normalizedPreview = nextPreview.trim();
      const status = payload.status;
      const version = payload.version;
      const cacheEntry = contentCacheRef.current[resultId];
      const isStreamingStatus = status === 'executing' || status === 'waiting';

      if (normalizedPreview) {
        contentCacheRef.current[resultId] = {
          version,
          preview: nextPreview,
        };
        return updates;
      }

      const canReuseCachedPreview =
        isStreamingStatus &&
        cacheEntry &&
        cacheEntry.preview &&
        (version === undefined ||
          cacheEntry.version === undefined ||
          cacheEntry.version === version);

      if (canReuseCachedPreview) {
        updates.contentPreview = cacheEntry.preview;
      } else if (!isStreamingStatus || (version !== undefined && cacheEntry?.version !== version)) {
        delete contentCacheRef.current[resultId];
      }

      if (!isStreamingStatus && !normalizedPreview) {
        delete contentCacheRef.current[resultId];
      }

      return updates;
    },
    [contentCacheRef],
  );

  // Accumulator for heavy updates per resultId
  const accumRef = useRef<
    Record<
      string,
      {
        updates: Partial<ActionResult>[];
        timeoutId: number | null;
        lastScheduledAt: number;
        firstPendingAt?: number;
      }
    >
  >({});

  const clearAccumulator = useCallback((resultId?: string) => {
    if (!resultId) {
      // Clear all
      for (const key of Object.keys(accumRef.current)) {
        const entry = accumRef.current[key];
        if (entry?.timeoutId) {
          window.clearTimeout(entry.timeoutId);
        }
      }
      accumRef.current = {};
      return;
    }
    const entry = accumRef.current[resultId];
    if (entry?.timeoutId) {
      window.clearTimeout(entry.timeoutId);
    }
    delete accumRef.current[resultId];
  }, []);

  const flushUpdates = useCallback(
    (resultId: string) => {
      const entry = accumRef.current[resultId];
      if (!entry || !entry.updates?.length) return;

      const storeState = useActionResultStore.getState();
      const oldResult = storeState?.resultMap?.[resultId];

      let merged: ActionResult | undefined = oldResult as ActionResult | undefined;
      for (const u of entry.updates) {
        merged = mergeActionResults(merged, u);
      }

      if (!merged) {
        // Nothing to apply
        clearAccumulator(resultId);
        return;
      }

      // Apply to store in one heavy update
      updateActionResult(resultId, merged);

      // Update node data once with full payload
      const nodes = getNodes();
      const currentNode = nodes.find(
        (n) => n.type === 'skillResponse' && n.data?.entityId === resultId,
      );

      if (currentNode) {
        const nodeVersion = (currentNode?.data?.metadata as ResponseNodeMeta)?.version;
        const resultVersion = merged?.version;
        if (
          !(nodeVersion !== undefined && resultVersion !== undefined && nodeVersion > resultVersion)
        ) {
          const nodeUpdates = JSON.parse(
            JSON.stringify(buildNodeUpdates(resultId, merged as Partial<ActionResult>)),
          );

          if (
            !currentNode?.data ||
            !isNodeDataEqual(currentNode.data as CanvasNodeData<ResponseNodeMeta>, nodeUpdates)
          ) {
            requestAnimationFrame(() => {
              setNodeDataByEntity({ type: 'skillResponse', entityId: resultId }, nodeUpdates);
            });
          }
        }
      }

      // Clear the accumulator for this resultId
      clearAccumulator(resultId);
    },
    [clearAccumulator, getNodes, setNodeDataByEntity, updateActionResult],
  );

  const scheduleFlush = useCallback(
    (resultId: string, immediate?: boolean) => {
      let entry = accumRef.current[resultId];
      const now = performance.now();
      if (!entry) {
        entry = {
          updates: [],
          timeoutId: null,
          lastScheduledAt: now,
          firstPendingAt: now,
        };
        accumRef.current[resultId] = entry;
      }

      if (immediate) {
        if (entry.timeoutId) {
          window.clearTimeout(entry.timeoutId);
          entry.timeoutId = null;
        }
        flushUpdates(resultId);
        return;
      }

      // Initialize firstPendingAt if missing
      if (!entry.firstPendingAt) {
        entry.firstPendingAt = now;
      }

      // Clear and reschedule trailing timer (debounce)
      if (entry.timeoutId) {
        window.clearTimeout(entry.timeoutId);
        entry.timeoutId = null;
      }

      // Starvation guard: if pending too long, force flush now
      if (now - (entry.firstPendingAt ?? now) > MAX_WAIT_MS) {
        flushUpdates(resultId);
        return;
      }

      entry.lastScheduledAt = now;
      entry.timeoutId = window.setTimeout(() => {
        entry.timeoutId = null;
        flushUpdates(resultId);
      }, FLUSH_INTERVAL_MS);
    },
    [flushUpdates],
  );

  // Ensure pending updates are not lost when the hook unmounts
  useEffect(() => {
    return () => {
      const keys = Object.keys(accumRef.current);
      for (const k of keys) {
        try {
          flushUpdates(k);
        } catch {
          // Ignore errors on unmount flush
        }
      }
    };
  }, [flushUpdates]);

  return useCallback(
    (resultId: string, payload: Partial<ActionResult>, event?: SkillEvent) => {
      actionEmitter.emit('updateResult', { resultId, payload });

      // If event is empty, reset accumulation and perform initial update immediately
      if (!event) {
        clearAccumulator(resultId);
        updateActionResult(resultId, { resultId, ...payload } as ActionResult);

        const nodes = getNodes();
        const currentNode = nodes.find(
          (n) => n.type === 'skillResponse' && n.data?.entityId === resultId,
        );
        if (!currentNode) return;

        const nodeVersion = (currentNode?.data?.metadata as ResponseNodeMeta)?.version;
        const resultVersion = payload?.version;
        if (
          nodeVersion !== undefined &&
          resultVersion !== undefined &&
          nodeVersion > resultVersion
        ) {
          return;
        }

        const nodeUpdates = JSON.parse(
          JSON.stringify(buildNodeUpdates(resultId, payload as Partial<ActionResult>)),
        );

        if (
          !currentNode?.data ||
          !isNodeDataEqual(currentNode.data as CanvasNodeData<ResponseNodeMeta>, nodeUpdates)
        ) {
          requestAnimationFrame(() => {
            setNodeDataByEntity({ type: 'skillResponse', entityId: resultId }, nodeUpdates);
          });
        }
        return;
      }

      // Accumulate updates for this resultId
      let entry = accumRef.current[resultId];
      if (!entry) {
        entry = {
          updates: [],
          timeoutId: null,
          lastScheduledAt: 0,
        };
        accumRef.current[resultId] = entry;
      }
      entry.updates.push({ resultId, ...payload });

      // Determine if we should flush immediately
      const isCriticalUpdate =
        event?.event === 'end' || event?.event === 'error' || payload?.status === 'failed';

      if (isCriticalUpdate) {
        scheduleFlush(resultId, true);
      } else {
        scheduleFlush(resultId, false);
      }
    },
    [
      buildNodeUpdates,
      clearAccumulator,
      getNodes,
      scheduleFlush,
      setNodeDataByEntity,
      updateActionResult,
    ],
  );
};
