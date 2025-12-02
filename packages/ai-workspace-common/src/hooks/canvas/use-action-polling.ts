import { useCallback, useRef, useEffect } from 'react';
import {
  useActionResultStore,
  useActionResultStoreShallow,
  useSubscriptionStoreShallow,
} from '@refly/stores';
import {
  ActionResultNotFoundError,
  ModelUsageQuotaExceeded,
  guessModelProviderError,
} from '@refly/errors';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useUpdateActionResult } from './use-update-action-result';

const POLLING_INTERVAL = 3000;
const TIMEOUT_DURATION = 5000;
const MAX_NOT_FOUND_RETRIES = 3;

// Track globally failed result IDs to prevent auto-restarting polling for failed actions
const failedResultIds = new Set<string>();

export const useActionPolling = () => {
  const {
    startPolling: startPollingState,
    stopPolling: stopPollingState,
    incrementErrorCount,
    resetErrorCount,
    updateLastPollTime,
    startTimeout,
    updateLastEventTime,
    clearTimeout: clearTimeoutState,
  } = useActionResultStoreShallow((state) => ({
    startPolling: state.startPolling,
    stopPolling: state.stopPolling,
    incrementErrorCount: state.incrementErrorCount,
    resetErrorCount: state.resetErrorCount,
    updateLastPollTime: state.updateLastPollTime,
    startTimeout: state.startTimeout,
    updateLastEventTime: state.updateLastEventTime,
    clearTimeout: state.clearTimeout,
  }));

  const { setCreditInsufficientModalVisible } = useSubscriptionStoreShallow((state) => ({
    setCreditInsufficientModalVisible: state.setCreditInsufficientModalVisible,
  }));

  const onUpdateResult = useUpdateActionResult();
  const pollingTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});

  const stopPolling = useCallback(
    (resultId: string) => {
      stopPollingState(resultId);
      if (pollingTimeoutsRef.current[resultId]) {
        clearTimeout(pollingTimeoutsRef.current[resultId]);
        delete pollingTimeoutsRef.current[resultId];
      }
    },
    [stopPollingState],
  );

  const pollActionResult = useCallback(
    async (resultId: string, version: number) => {
      const { pollingStateMap, resultMap } = useActionResultStore.getState();
      const pollingState = pollingStateMap[resultId];

      if (!pollingState?.isPolling) {
        return;
      }

      try {
        // Since backend always returns latest version, don't send version parameter
        // This ensures we get the newest ActionResult data after recovery
        const { data: result } = await getClient().getActionResult({
          query: { resultId },
        });

        if (!result?.success) {
          if (result?.errCode === new ActionResultNotFoundError().code) {
            incrementErrorCount(resultId);
            const newErrorCount = (pollingStateMap[resultId]?.notFoundErrorCount ?? 0) + 1;

            if (newErrorCount >= MAX_NOT_FOUND_RETRIES) {
              stopPolling(resultId);
              const currentResult = resultMap[resultId];
              failedResultIds.add(resultId);
              onUpdateResult(resultId, {
                ...currentResult,
                status: 'failed',
                errors: ['Action result not found after 3 retries'],
              });
              return;
            }
          } else {
            stopPolling(resultId);
            return;
          }
        } else {
          resetErrorCount(resultId);

          const status = result.data?.status;

          if (status === 'finish' && result.data) {
            onUpdateResult(resultId, result.data);
            stopPolling(resultId);
            return;
          }

          if (status === 'failed' && result.data) {
            // Check if this is a credit insufficient error
            const errors = result.data?.errors;
            if (errors && Array.isArray(errors)) {
              const hasCreditError = errors.some((error) => {
                const guessedError = guessModelProviderError(error);
                return guessedError instanceof ModelUsageQuotaExceeded;
              });
              if (hasCreditError) {
                console.log('credit insufficient error');
                setCreditInsufficientModalVisible(true);
              }
            }

            onUpdateResult(resultId, result.data);
            stopPolling(resultId);
            failedResultIds.add(resultId);
            return;
          }
        }
        onUpdateResult(resultId, result.data);
        updateLastPollTime(resultId);
      } catch (error) {
        console.error('Polling error:', error);
        // Don't stop polling on network errors, let it retry
      }

      // Schedule next poll if still polling
      if (pollingStateMap[resultId]?.isPolling) {
        pollingTimeoutsRef.current[resultId] = setTimeout(() => {
          pollActionResult(resultId, version);
        }, POLLING_INTERVAL);
      }
    },
    [incrementErrorCount, resetErrorCount, stopPolling, onUpdateResult, updateLastPollTime],
  );

  const startPolling = useCallback(
    async (resultId: string, version: number) => {
      const { pollingStateMap, resultMap, streamResults } = useActionResultStore.getState();
      const isStreaming = !!streamResults[resultId];

      if (isStreaming) {
        return;
      }

      const pollingState = pollingStateMap[resultId];
      const currentResult = resultMap[resultId];

      // Don't restart polling for results that are already marked as failed
      if (failedResultIds.has(resultId) || currentResult?.status === 'failed') {
        return;
      }

      if (pollingState?.isPolling) {
        return;
      }

      clearTimeoutState(resultId);
      startPollingState(resultId, version);

      // Start the polling cycle
      await pollActionResult(resultId, version);
    },
    [clearTimeoutState, startPollingState, pollActionResult],
  );

  const resetFailedState = useCallback((resultId: string) => {
    failedResultIds.delete(resultId);
  }, []);

  // Cleanup all polling on unmount
  useEffect(() => {
    return () => {
      Object.keys(pollingTimeoutsRef.current).forEach(stopPolling);
    };
  }, [stopPolling]);

  const createTimeoutHandler = useCallback(
    (resultId: string, version: number) => {
      let timeoutId: NodeJS.Timeout;

      const resetTimeout = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        updateLastEventTime(resultId);

        timeoutId = setTimeout(() => {
          const result = useActionResultStore.getState().resultMap[resultId];

          // Don't restart polling for failed results via timeout
          if (failedResultIds.has(resultId) || result?.status === 'failed') {
            return;
          }

          if (result?.status !== 'finish') {
            startPolling(resultId, version);
          }
        }, TIMEOUT_DURATION);
      };

      // Initialize timeout tracking
      startTimeout(resultId);
      resetTimeout();

      return {
        resetTimeout,
        cleanup: () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          clearTimeoutState(resultId);
          stopPolling(resultId);
        },
      };
    },
    [startTimeout, updateLastEventTime, startPolling, clearTimeoutState, stopPolling],
  );

  return {
    startPolling,
    stopPolling,
    createTimeoutHandler,
    resetFailedState,
  };
};
