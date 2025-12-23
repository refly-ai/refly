import { useState, useEffect, useRef, useCallback } from 'react';
import type { TemplateGenerationStatus } from '../utils/templateStatus';
import { useGetTemplateGenerationStatus } from '@refly-packages/ai-workspace-common/queries';

interface UseTemplateGenerationStatusOptions {
  appId: string | null;
  pollingInterval?: number; // Default 2000ms
  maxAttempts?: number; // Default 30 attempts
  enabled?: boolean; // Whether to enable polling
}

interface UseTemplateGenerationStatusReturn {
  status: TemplateGenerationStatus;
  templateContent: string | null;
  isPolling: boolean;
  attempts: number;
  isInitialized: boolean; // Whether status has been fetched at least once
  stopPolling: () => void;
}

/**
 * Hook to poll template generation status
 */
export function useTemplateGenerationStatus({
  appId,
  pollingInterval = 2000,
  maxAttempts = 30,
  enabled = true,
}: UseTemplateGenerationStatusOptions): UseTemplateGenerationStatusReturn {
  const [status, setStatus] = useState<TemplateGenerationStatus>('idle');
  const [templateContent, setTemplateContent] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const cancelledRef = useRef(false);

  const stopPolling = useCallback(() => {
    cancelledRef.current = true;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Use the generated hook with manual control
  const { data, refetch, error } = useGetTemplateGenerationStatus(
    {
      query: { appId: appId ?? '' },
    },
    undefined,
    {
      enabled: false, // We'll manually trigger refetch
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  );

  // Update local state when data changes and stop polling if needed
  useEffect(() => {
    const isRequestFailed = Boolean(error) || data?.success === false || !!data?.data?.error;
    if (isRequestFailed) {
      // Stop polling and update local state when the status API request fails.
      setStatus('failed');
      setTemplateContent(null);
      setIsInitialized(true);
      stopPolling();
      return;
    }
    if (data?.data) {
      const responseData = data.data;
      const newStatus = responseData.status as TemplateGenerationStatus;
      setStatus(newStatus);
      setTemplateContent(responseData.templateContent ?? null);
      setIsInitialized(true);

      // Stop polling if status is final (completed, idle, or failed)
      if (
        isPolling &&
        (newStatus === 'completed' || newStatus === 'idle' || newStatus === 'failed')
      ) {
        stopPolling();
      }
    }
  }, [data, error, isPolling, stopPolling]);

  // Polling function
  const pollOnce = useCallback(async () => {
    if (cancelledRef.current || !appId) {
      return;
    }

    try {
      await refetch();
    } catch (error) {
      console.error('Polling template status error:', error);
      // Continue polling on network error to retry
    }
  }, [appId, refetch]);

  useEffect(() => {
    if (!appId) {
      // No appId, reset everything
      setStatus('idle');
      setTemplateContent(null);
      setIsPolling(false);
      setAttempts(0);
      setIsInitialized(false);
      return;
    }

    if (!enabled) {
      // When disabled but appId exists, fetch status once to update state
      // This ensures refresh page can get correct status even if polling is disabled
      const fetchOnce = async () => {
        try {
          await refetch();
        } catch (error) {
          console.error('Failed to fetch template status (disabled mode):', error);
          // Even on error, mark as initialized to prevent showing default state
          setIsInitialized(true);
        }
      };
      void fetchOnce();
      setIsPolling(false);
      setAttempts(0);
      return;
    }

    cancelledRef.current = false;
    setIsPolling(true);
    setAttempts(0);

    // Initial fetch
    void pollOnce();

    const poll = () => {
      const pollInterval = setInterval(async () => {
        if (cancelledRef.current) {
          clearInterval(pollInterval);
          return;
        }

        setAttempts((prev) => {
          const newAttempts = prev + 1;
          if (newAttempts >= maxAttempts) {
            // Max attempts reached, stop polling
            setIsPolling(false);
            clearInterval(pollInterval);
            return newAttempts;
          }
          return newAttempts;
        });

        await pollOnce();
      }, pollingInterval);

      pollingRef.current = pollInterval;
    };

    // Start polling after initial fetch
    const timeoutId = setTimeout(poll, pollingInterval);

    return () => {
      cancelledRef.current = true;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      clearTimeout(timeoutId);
      setIsPolling(false);
    };
  }, [appId, pollingInterval, maxAttempts, enabled, pollOnce, refetch]);

  return {
    status,
    templateContent,
    isPolling,
    attempts,
    isInitialized,
    stopPolling,
  };
}
