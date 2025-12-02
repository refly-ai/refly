import { useCallback, useEffect, useRef, useState } from 'react';
import { useGetWorkflowDetail } from '@refly-packages/ai-workspace-common/queries';
import { WorkflowExecution, WorkflowExecutionStatus } from '@refly/openapi-schema';
import { useCanvasStoreShallow, useSubscriptionStoreShallow } from '@refly/stores';
import { guessModelProviderError, ModelUsageQuotaExceeded } from '@refly/errors';

// Global poller management per executionId to prevent concurrent polling across components
type WorkflowPollerRecord = {
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: boolean;
  running: boolean;
  refCount: number;
  interval: number;
  refetchFn: (() => Promise<unknown>) | null;
};

const workflowExecutionPollers = new Map<string, WorkflowPollerRecord>();

// Track completed executions to prevent duplicate callback calls
const completedExecutions = new Set<string>();

interface UseWorkflowExecutionPollingOptions {
  executionId: string | null;
  canvasId?: string;
  enabled?: boolean;
  interval?: number;
  onStatusChange?: (status: WorkflowExecutionStatus) => void;
  onComplete?: (status: WorkflowExecutionStatus, data?: any) => void;
  onError?: (error: any) => void;
}

interface UseWorkflowExecutionPollingReturn {
  status: WorkflowExecutionStatus | null;
  data: WorkflowExecution;
  isLoading: boolean;
  error: any;
  isPolling: boolean;
  startPolling: () => void;
  stopPolling: () => void;
}

export const useWorkflowExecutionPolling = ({
  executionId,
  canvasId,
  enabled = true,
  interval = 3000,
  onStatusChange,
  onComplete,
  onError,
}: UseWorkflowExecutionPollingOptions): UseWorkflowExecutionPollingReturn => {
  const [isPolling, setIsPolling] = useState(false);
  const [status, setStatus] = useState<WorkflowExecutionStatus | null>(null);
  const isPollingRef = useRef(false);

  // Use refs to store callbacks to avoid creating new references on each render
  const onStatusChangeRef = useRef(onStatusChange);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onStatusChange, onComplete, onError]);

  // Read executionId from canvas store (persisted) and provide a way to clear it when done
  const { storeExecutionId, setCanvasExecutionId, setCanvasNodeExecutions } = useCanvasStoreShallow(
    (state) => ({
      storeExecutionId: state.canvasExecutionId[canvasId] ?? null,
      setCanvasExecutionId: state.setCanvasExecutionId,
      setCanvasNodeExecutions: state.setCanvasNodeExecutions,
    }),
  );

  const { setCreditInsufficientModalVisible } = useSubscriptionStoreShallow((state) => ({
    setCreditInsufficientModalVisible: state.setCreditInsufficientModalVisible,
  }));

  // Prefer store executionId; fallback to provided one
  const currentExecutionId = (storeExecutionId ?? executionId) || null;

  // Use the existing useGetWorkflowDetail hook
  const { data, isLoading, error, refetch } = useGetWorkflowDetail(
    { query: { executionId: currentExecutionId } },
    undefined,
    {
      enabled: false, // We'll manually trigger refetch
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  );
  const pollOnce = useCallback(async (execId: string) => {
    const record = workflowExecutionPollers.get(execId);
    if (!record || !record.running) {
      return;
    }
    if (record.inFlight) {
      // Already fetching, schedule next tick
      record.timer = setTimeout(() => {
        void pollOnce(execId);
      }, record.interval);
      return;
    }
    record.inFlight = true;
    try {
      await (record.refetchFn?.() ?? Promise.resolve());
    } finally {
      record.inFlight = false;
    }
    if (record.running) {
      record.timer = setTimeout(() => {
        void pollOnce(execId);
      }, record.interval);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (!currentExecutionId || isPollingRef.current) {
      return;
    }

    // Clear the completed flag for this execution
    completedExecutions.delete(currentExecutionId);

    setIsPolling(true);
    isPollingRef.current = true;

    const existing = workflowExecutionPollers.get(currentExecutionId);
    const effectiveInterval = Math.min(existing?.interval ?? interval, interval);

    if (existing) {
      existing.refCount += 1;
      existing.interval = effectiveInterval;
      existing.refetchFn = async () => {
        await refetch();
      };
      // Ensure one loop is running
      if (!existing.running) {
        existing.running = true;
        void pollOnce(currentExecutionId);
      }
      return;
    }

    const record: WorkflowPollerRecord = {
      timer: null,
      inFlight: false,
      running: true,
      refCount: 1,
      interval: effectiveInterval,
      refetchFn: async () => {
        await refetch();
      },
    };
    workflowExecutionPollers.set(currentExecutionId, record);
    void pollOnce(currentExecutionId);
  }, [currentExecutionId, interval, refetch, pollOnce]);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
    isPollingRef.current = false;

    if (!currentExecutionId) {
      return;
    }

    const record = workflowExecutionPollers.get(currentExecutionId);
    if (!record) {
      return;
    }
    record.refCount = Math.max(0, (record.refCount ?? 0) - 1);
    if (record.refCount === 0) {
      record.running = false;
      if (record.timer) {
        clearTimeout(record.timer);
        record.timer = null;
      }
      workflowExecutionPollers.delete(currentExecutionId);
    }
  }, [currentExecutionId]);

  // Extract status from the response data
  const currentStatus = data?.data?.status as WorkflowExecutionStatus | undefined;
  const nodeExecutions = data?.data?.nodeExecutions || [];

  // Update nodeExecutions in canvas store when data changes
  useEffect(() => {
    if (nodeExecutions?.length > 0 && canvasId) {
      setCanvasNodeExecutions(canvasId, nodeExecutions);
    }

    // Log error messages from node executions
    if (nodeExecutions?.length > 0 && data?.data?.appId) {
      for (const nodeExecution of nodeExecutions) {
        if (nodeExecution.errorMessage) {
          const error = guessModelProviderError(nodeExecution.errorMessage);
          if (error instanceof ModelUsageQuotaExceeded) {
            setCreditInsufficientModalVisible(true);
          }
        }
      }
    }
  }, [nodeExecutions, canvasId, setCanvasNodeExecutions, data?.data?.appId]);

  // Update status when data changes
  useEffect(() => {
    if (!currentStatus) {
      return;
    }

    if (currentStatus !== status) {
      setStatus(currentStatus);
      onStatusChangeRef.current?.(currentStatus);
    }

    // If finished or failed, stop polling and clear executionId and nodeExecutions from store
    if (currentStatus === 'finish' || currentStatus === 'failed') {
      // Check if this execution has already been completed
      const shouldTriggerCallback =
        currentExecutionId && !completedExecutions.has(currentExecutionId);

      if (shouldTriggerCallback && currentExecutionId) {
        completedExecutions.add(currentExecutionId);
      }

      // Force stop global poller for this executionId
      if (currentExecutionId) {
        const record = workflowExecutionPollers.get(currentExecutionId);
        if (record?.timer) {
          clearTimeout(record.timer);
        }
        workflowExecutionPollers.delete(currentExecutionId);
      }
      stopPolling();
      if (canvasId) {
        setCanvasExecutionId(canvasId, null);
        setCanvasNodeExecutions(canvasId, null);
      }

      // Only trigger callback once per executionId
      if (shouldTriggerCallback) {
        onCompleteRef.current?.(currentStatus, data);
      }
    }
  }, [
    currentStatus,
    status,
    data,
    canvasId,
    currentExecutionId,
    setCanvasExecutionId,
    setCanvasNodeExecutions,
    stopPolling,
  ]);

  // Handle errors
  useEffect(() => {
    if (error && currentExecutionId && !completedExecutions.has(currentExecutionId)) {
      completedExecutions.add(currentExecutionId);
      onErrorRef.current?.(error);
    }
  }, [error, currentExecutionId]);

  // Auto-start polling when executionId is available and enabled
  useEffect(() => {
    if (currentExecutionId && enabled && !isPollingRef.current) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [currentExecutionId, enabled, startPolling, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    status,
    data: data?.data,
    isLoading,
    error,
    isPolling,
    startPolling,
    stopPolling,
  };
};
