import { useState, useEffect, useRef } from 'react';
import type { TemplateGenerationStatus, TemplateStatusResponse } from '../utils/templateStatus';
import { client } from '@refly/openapi-schema';

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
      const fetchStatusOnce = async () => {
        try {
          const response = await client.get<{ data: TemplateStatusResponse }, any, false>({
            url: '/workflow-app/template-status',
            query: { appId },
          });

          if (response?.data?.data) {
            const data = response.data.data as TemplateStatusResponse;
            setStatus(data.status);
            setTemplateContent(data.templateContent ?? null);
            setIsInitialized(true);
          }
        } catch (error) {
          console.error('Failed to fetch template status (disabled mode):', error);
          // Even on error, mark as initialized to prevent showing default state
          setIsInitialized(true);
        }
      };

      fetchStatusOnce();
      setIsPolling(false);
      setAttempts(0);
      return;
    }

    cancelledRef.current = false;
    setIsPolling(true);
    setAttempts(0);

    // Initial fetch
    const fetchStatus = async () => {
      try {
        // Use direct API call since the endpoint might not be in generated types yet
        const response = await client.get<{ data: TemplateStatusResponse }, any, false>({
          url: '/workflow-app/template-status',
          query: { appId },
        });

        if (response?.data?.data) {
          const data = response.data.data as TemplateStatusResponse;
          setStatus(data.status);
          setTemplateContent(data.templateContent ?? null);
          setIsInitialized(true);

          // Stop polling if completed or idle (no need to poll)
          if (data.status === 'completed' || data.status === 'idle') {
            setIsPolling(false);
            return;
          }
        }
      } catch (error) {
        console.error('Failed to fetch template status:', error);
        // On error, keep polling to retry
      }
    };

    fetchStatus();

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

        try {
          // Use direct API call since the endpoint might not be in generated types yet
          const response = await client.get<{ data: TemplateStatusResponse }, any, false>({
            url: '/workflow-app/template-status',
            query: { appId },
          });

          if (response?.data?.data) {
            const data = response.data.data as TemplateStatusResponse;
            setStatus(data.status);
            setTemplateContent(data.templateContent ?? null);
            setIsInitialized(true);

            // Stop polling if completed or idle
            if (data.status === 'completed' || data.status === 'idle') {
              setIsPolling(false);
              clearInterval(pollInterval);
            }
            // Also stop polling if failed (no point retrying from client)
            if (data.status === 'failed') {
              setIsPolling(false);
              clearInterval(pollInterval);
            }
          }
        } catch (error) {
          console.error('Polling template status error:', error);
          // Continue polling on network error to retry
        }
      }, pollingInterval);

      pollingRef.current = pollInterval;
    };

    // Start polling after initial fetch
    const timeoutId = setTimeout(poll, pollingInterval);

    return () => {
      cancelledRef.current = true;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      clearTimeout(timeoutId);
      setIsPolling(false);
    };
  }, [appId, pollingInterval, maxAttempts, enabled]);

  const stopPolling = () => {
    cancelledRef.current = true;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    setIsPolling(false);
  };

  return {
    status,
    templateContent,
    isPolling,
    attempts,
    isInitialized,
    stopPolling,
  };
}
