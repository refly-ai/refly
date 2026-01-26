/**
 * Composio OAuth hooks - Encapsulate OAuth related API calls following project standards
 * These hooks use React Query for consistent API management with caching, loading states, and error handling
 */

import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import type {
  AuthorizeComposioConnectionResponse,
  ComposioConnectionStatusResponse,
  ComposioRevokeResponse,
} from '@refly/openapi-schema';

type ComposioOAuthStatusResponse =
  | ComposioConnectionStatusResponse
  | {
      status: 'pending';
      integrationId: string;
      connectedAccountId?: string | null;
      message?: string;
    };

type ComposioOAuthAuthorizeResponse = AuthorizeComposioConnectionResponse;
type ComposioOAuthRevokeResponse = ComposioRevokeResponse;

type ComposioOAuthError = {
  message: string;
  status?: number;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (!error) {
    return fallback;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
      return maybeMessage;
    }

    const errCode = (error as { errCode?: unknown }).errCode;
    if (typeof errCode === 'string' && errCode.trim()) {
      return errCode;
    }
  }

  return fallback;
};

/**
 * Check OAuth connection status for a specific Composio app
 */
export const checkComposioOAuthStatus = async (
  composioApp: string,
): Promise<ComposioOAuthStatusResponse> => {
  const { data, error, response } = await getClient().getComposioConnectionStatus({
    path: { app: composioApp },
  });
  if (response.status === 404) {
    return {
      status: 'pending',
      integrationId: composioApp,
      connectedAccountId: null,
      message: 'Connection not found',
    };
  }

  if (error) {
    throw new Error(getErrorMessage(error, 'Failed to check OAuth status'));
  }

  if (data) {
    return data;
  }

  return {
    status: 'pending',
    integrationId: composioApp,
    connectedAccountId: null,
  };
};

/**
 * Initiate OAuth authorization flow for a specific Composio app
 */
const initiateComposioOAuth = async (
  composioApp: string,
): Promise<ComposioOAuthAuthorizeResponse> => {
  const { data, error } = await getClient().authorizeComposioConnection({
    path: { app: composioApp },
  });

  if (error || !data) {
    throw new Error(getErrorMessage(error, 'Failed to initiate OAuth'));
  }

  return data;
};

/**
 * Revoke OAuth authorization for a specific Composio app
 */
const revokeComposioOAuth = async (composioApp: string): Promise<ComposioOAuthRevokeResponse> => {
  const { data, error, response } = await getClient().revokeComposioConnection({
    path: { app: composioApp },
  });

  if (response.status === 404) {
    throw new Error('Connection not found');
  }

  if (error || !data) {
    throw new Error(getErrorMessage(error, 'Failed to revoke OAuth'));
  }

  return data;
};

// ============================================================================
// Query Key Functions - For cache management
// ============================================================================

export const composioOAuthStatusKey = 'ComposioOAuthStatus';

export const composioOAuthStatusKeyFn = (composioApp: string) => [
  composioOAuthStatusKey,
  composioApp,
];

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook to check OAuth status for a Composio app
 * @param composioApp - The Composio app slug (e.g., 'googledrive', 'gmail')
 * @param options - React Query options
 * @returns Query result with OAuth status
 *
 * @example
 * const { data, isLoading, error } = useComposioOAuthStatus('googledrive', {
 *   enabled: true,
 *   refetchInterval: 5000, // Poll every 5 seconds
 * });
 */
export const useComposioOAuthStatus = <
  TData = ComposioOAuthStatusResponse,
  TError = ComposioOAuthError,
>(
  composioApp: string,
  options?: Omit<
    UseQueryOptions<ComposioOAuthStatusResponse, TError, TData>,
    'queryKey' | 'queryFn'
  >,
) => {
  return useQuery<ComposioOAuthStatusResponse, TError, TData>({
    queryKey: composioOAuthStatusKeyFn(composioApp),
    queryFn: () => checkComposioOAuthStatus(composioApp),
    enabled: !!composioApp, // Only run if composioApp is provided
    ...options,
  });
};

export const useComposioOAuthAuthorize = <TContext = unknown>(
  options?: Omit<
    UseMutationOptions<ComposioOAuthAuthorizeResponse, ComposioOAuthError, string, TContext>,
    'mutationFn'
  >,
) => {
  return useMutation<ComposioOAuthAuthorizeResponse, ComposioOAuthError, string, TContext>({
    mutationFn: (composioApp: string) => initiateComposioOAuth(composioApp),
    ...options,
  });
};

export const useComposioOAuthRevoke = <TContext = unknown>(
  options?: Omit<
    UseMutationOptions<ComposioOAuthRevokeResponse, ComposioOAuthError, string, TContext>,
    'mutationFn'
  >,
) => {
  return useMutation<ComposioOAuthRevokeResponse, ComposioOAuthError, string, TContext>({
    mutationFn: (composioApp: string) => revokeComposioOAuth(composioApp),
    ...options,
  });
};
