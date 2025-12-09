/**
 * OAuth Popup Hook
 * Handles OAuth flow with popup window for tool authorization
 */

import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  useComposioOAuthAuthorize,
  checkComposioOAuthStatus,
  composioOAuthStatusKeyFn,
} from './use-composio-oauth';
import { useListUserToolsKey } from '@refly-packages/ai-workspace-common/queries/common';

// Cache key for storing pending OAuth toolset
const OAUTH_CACHE_KEY = 'refly_pending_oauth_toolset';

// Cache expiry time (5 minutes)
const OAUTH_CACHE_EXPIRY_MS = 5 * 60 * 1000;

export interface OAuthCacheEntry {
  toolsetKey: string;
  timestamp: number;
}

/**
 * Save pending OAuth toolset key to cache
 */
export const saveOAuthCache = (toolsetKey: string): void => {
  try {
    const entry: OAuthCacheEntry = {
      toolsetKey,
      timestamp: Date.now(),
    };
    localStorage.setItem(OAUTH_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Ignore localStorage errors
  }
};

/**
 * Get pending OAuth toolset key from cache
 * Returns null if expired or not found
 */
export const getOAuthCache = (): string | null => {
  try {
    const cached = localStorage.getItem(OAUTH_CACHE_KEY);
    if (!cached) return null;

    const entry: OAuthCacheEntry = JSON.parse(cached);
    const isExpired = Date.now() - entry.timestamp > OAUTH_CACHE_EXPIRY_MS;

    if (isExpired) {
      clearOAuthCache();
      return null;
    }

    return entry.toolsetKey;
  } catch {
    return null;
  }
};

/**
 * Clear OAuth cache
 */
export const clearOAuthCache = (): void => {
  try {
    localStorage.removeItem(OAUTH_CACHE_KEY);
  } catch {
    // Ignore localStorage errors
  }
};

export type OAuthPopupStatus = 'idle' | 'opening' | 'polling' | 'success' | 'failed' | 'cancelled';

export interface OAuthPopupResult {
  success: boolean;
  toolsetKey?: string;
  error?: string;
}

export interface UseOAuthPopupOptions {
  /**
   * Callback when OAuth succeeds
   */
  onSuccess?: (toolsetKey: string) => void;
  /**
   * Callback when OAuth fails or is cancelled
   */
  onError?: (error: string) => void;
  /**
   * Polling interval in ms (default: 2000)
   */
  pollingInterval?: number;
  /**
   * Max polling attempts (default: 60 = 2 minutes with 2s interval)
   */
  maxPollingAttempts?: number;
}

/**
 * Hook to handle OAuth popup flow for Composio tools
 */
export const useOAuthPopup = (options: UseOAuthPopupOptions = {}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { onSuccess, onError, pollingInterval = 2000, maxPollingAttempts = 60 } = options;

  const [status, setStatus] = useState<OAuthPopupStatus>('idle');
  const [currentToolsetKey, setCurrentToolsetKey] = useState<string | null>(null);

  const popupRef = useRef<Window | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingAttemptsRef = useRef<number>(0);

  const { mutateAsync: authorizeOAuth } = useComposioOAuthAuthorize();

  /**
   * Clean up polling and popup
   */
  const cleanup = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    pollingAttemptsRef.current = 0;
  }, []);

  /**
   * Check if popup is closed
   */
  const isPopupClosed = useCallback(() => {
    return !popupRef.current || popupRef.current.closed;
  }, []);

  /**
   * Poll for OAuth status
   */
  const pollOAuthStatus = useCallback(async (toolsetKey: string): Promise<boolean> => {
    try {
      const result = await checkComposioOAuthStatus(toolsetKey);
      if (result.status === 'active') {
        return true;
      }
    } catch {
      // Ignore polling errors
    }
    return false;
  }, []);

  /**
   * Start polling for OAuth completion
   */
  const startPolling = useCallback(
    (toolsetKey: string) => {
      setStatus('polling');
      pollingAttemptsRef.current = 0;

      pollingTimerRef.current = setInterval(async () => {
        pollingAttemptsRef.current += 1;

        // Check if popup is closed by user
        if (isPopupClosed()) {
          // Check one more time if auth succeeded before popup closed
          const isAuthorized = await pollOAuthStatus(toolsetKey);
          if (isAuthorized) {
            cleanup();
            setStatus('success');
            clearOAuthCache(); // Clear cache on success
            // Refetch queries to refresh tool list immediately (use predicate to match all queries starting with the key)
            await queryClient.refetchQueries({ queryKey: composioOAuthStatusKeyFn(toolsetKey) });
            await queryClient.refetchQueries({
              predicate: (query) =>
                Array.isArray(query.queryKey) && query.queryKey[0] === useListUserToolsKey,
            });
            onSuccess?.(toolsetKey);
          } else {
            cleanup();
            setStatus('cancelled');
            clearOAuthCache(); // Clear cache on cancel
            // User closed popup without completing auth - this is OK, not an error
          }
          return;
        }

        // Check if max attempts reached
        if (pollingAttemptsRef.current >= maxPollingAttempts) {
          cleanup();
          clearOAuthCache(); // Clear cache on timeout
          if (popupRef.current && !popupRef.current.closed) {
            popupRef.current.close();
          }
          setStatus('failed');
          const errorMsg = t('canvas.richChatInput.oauthTimeout');
          onError?.(errorMsg);
          message.error(errorMsg);
          return;
        }

        // Poll for status
        const isAuthorized = await pollOAuthStatus(toolsetKey);
        if (isAuthorized) {
          cleanup();
          clearOAuthCache(); // Clear cache on success
          if (popupRef.current && !popupRef.current.closed) {
            popupRef.current.close();
          }
          setStatus('success');
          // Refetch queries to refresh tool list immediately
          await queryClient.refetchQueries({ queryKey: composioOAuthStatusKeyFn(toolsetKey) });
          await queryClient.refetchQueries({
            predicate: (query) =>
              Array.isArray(query.queryKey) && query.queryKey[0] === useListUserToolsKey,
          });
          onSuccess?.(toolsetKey);
        }
      }, pollingInterval);
    },
    [
      cleanup,
      isPopupClosed,
      maxPollingAttempts,
      onError,
      onSuccess,
      pollOAuthStatus,
      pollingInterval,
      queryClient,
      t,
    ],
  );

  /**
   * Open OAuth popup for a toolset
   */
  const openOAuthPopup = useCallback(
    async (toolsetKey: string): Promise<OAuthPopupResult> => {
      // Clean up any previous state
      cleanup();
      setCurrentToolsetKey(toolsetKey);
      setStatus('opening');

      // Save to cache for recovery after page refresh
      saveOAuthCache(toolsetKey);

      try {
        // Get OAuth redirect URL from API
        const response = await authorizeOAuth(toolsetKey);

        if (!response?.redirectUrl) {
          throw new Error('No redirect URL returned');
        }

        // Calculate popup position (center of screen)
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        // Open popup window
        const popup = window.open(
          response.redirectUrl,
          `oauth_${toolsetKey}`,
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`,
        );

        if (!popup) {
          throw new Error('Popup blocked by browser');
        }

        popupRef.current = popup;

        // Start polling for OAuth completion
        startPolling(toolsetKey);

        return { success: true, toolsetKey };
      } catch (error) {
        cleanup();
        clearOAuthCache(); // Clear cache on error
        setStatus('failed');
        const errorMsg = error instanceof Error ? error.message : 'Failed to initiate OAuth';
        onError?.(errorMsg);
        message.error(t('canvas.richChatInput.oauthFailed'));
        return { success: false, error: errorMsg };
      }
    },
    [authorizeOAuth, cleanup, onError, startPolling, t],
  );

  /**
   * Cancel OAuth flow
   */
  const cancelOAuth = useCallback(() => {
    cleanup();
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    setStatus('cancelled');
  }, [cleanup]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    cleanup();
    setStatus('idle');
    setCurrentToolsetKey(null);
  }, [cleanup]);

  return {
    status,
    currentToolsetKey,
    openOAuthPopup,
    cancelOAuth,
    reset,
    isPolling: status === 'polling',
    isOpening: status === 'opening',
  };
};
