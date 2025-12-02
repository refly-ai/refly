import { useCallback } from 'react';
import { logEvent } from '@refly/telemetry-web';
import { useActionResultStore } from '@refly/stores';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import type { ActionStatus } from '@refly/openapi-schema';

// Global variables shared across all hook instances
export const globalAbortControllersRef = {
  current: new Map<string, AbortController>(),
};
export const globalAbortedResultsRef = {
  current: new Set<string>(),
};
export const globalIsAbortedRef = { current: false };
export const globalCurrentResultIdRef = { current: '' as string };

export const cleanupAbortController = (resultId?: string) => {
  if (!resultId?.trim()) {
    return;
  }
  globalAbortControllersRef.current.delete(resultId);
  globalAbortedResultsRef.current.delete(resultId);
  if (globalCurrentResultIdRef.current === resultId) {
    globalCurrentResultIdRef.current = '';
  }
};

export const useAbortAction = (params?: { source?: string }) => {
  const { source } = params || {};

  const abortAction = useCallback(async (resultId?: string) => {
    // Use current active resultId if none provided
    const activeResultId = resultId || globalCurrentResultIdRef.current;

    const { resultMap } = useActionResultStore.getState();
    const result = resultMap[activeResultId];

    if (!result) {
      return;
    }

    logEvent('model_invoke_abort', Date.now(), {
      resultId: activeResultId,
      source,
      model: result.modelInfo?.name,
      skill: result.actionMeta?.name,
    });

    try {
      // Abort the local controller tied to the active result
      const controllerToAbort = activeResultId?.trim()
        ? globalAbortControllersRef.current.get(activeResultId)
        : null;

      if (controllerToAbort) {
        controllerToAbort.abort();
        globalIsAbortedRef.current = true;
        if (activeResultId?.trim()) {
          globalAbortedResultsRef.current.add(activeResultId);

          // Update result status to 'failed' to reflect the abort in UI
          const { updateActionResult, resultMap } = useActionResultStore.getState();
          const currentResult = resultMap[activeResultId];
          if (currentResult) {
            updateActionResult(activeResultId, {
              ...currentResult,
              status: 'failed' as ActionStatus,
              errorType: 'userAbort',
              errors: [...(currentResult.errors ?? []), 'Action was aborted by user'],
            });
          }
        }
      } else {
        console.warn('No local controller to abort');
      }

      // If resultId is provided and is a valid string, call the backend to clean up server-side resources
      if (activeResultId?.trim()) {
        try {
          await getClient().abortAction({
            body: {
              resultId: result.resultId,
              version: result.version,
            },
          });
        } catch (_error) {
          // Silent fail or minimal logging
          console.warn('Failed to abort action on server');
        }
      }
    } catch (err) {
      console.error('abort error', err);
    }
  }, []);

  return { abortAction };
};
