import { QueryClient } from '@tanstack/react-query';
import { broadcastQueryClient } from '@tanstack/query-broadcast-client-experimental';
import { client } from '@refly/openapi-schema';
import { responseInterceptorWithTokenRefresh } from '@refly-packages/ai-workspace-common/utils/auth';
import { isDesktop, serverOrigin } from '@refly/ui-kit';

client.setConfig({
  baseUrl: `${serverOrigin}/v1`,
  credentials: isDesktop() ? 'omit' : 'include',
  throwOnError: false, // If you want to handle errors on `onError` callback of `useQuery` and `useMutation`, set this to `true`
});

client.interceptors.response.use(async (response, request) => {
  return responseInterceptorWithTokenRefresh(response, request);
});

export const queryClient = new QueryClient();

// Enable cross-tab synchronization using official TanStack Query broadcast client
// This allows multiple tabs to share the same query cache automatically
// When one tab updates data, other tabs will receive the update without making duplicate requests
broadcastQueryClient({
  queryClient,
  broadcastChannel: 'refly-query-cache',
});
