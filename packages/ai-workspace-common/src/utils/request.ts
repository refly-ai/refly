import { QueryClient } from '@tanstack/react-query';
import { client } from '@refly-packages/ai-workspace-common/requests';
import { responseInterceptorWithTokenRefresh } from '@refly-packages/ai-workspace-common/utils/auth';
import { isDesktop, serverOrigin } from '@refly-packages/ai-workspace-common/utils/env';

client.setConfig({
  baseUrl: `${serverOrigin}/v1`,
  credentials: isDesktop() ? 'omit' : 'include',
  throwOnError: false, // If you want to handle errors on `onError` callback of `useQuery` and `useMutation`, set this to `true`
});

client.interceptors.response.use(async (response, request) => {
  return responseInterceptorWithTokenRefresh(response, request);
});

export const queryClient = new QueryClient();
