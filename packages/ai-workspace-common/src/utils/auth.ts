import { AuthenticationExpiredError, ConnectionError } from '@refly/errors';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { logout } from '@refly-packages/ai-workspace-common/hooks/use-logout';

interface RefreshResult {
  isRefreshed: boolean;
  error?: unknown;
}

let isRefreshing = false;
let refreshPromise: Promise<RefreshResult> | null = null;
const requestQueue: Array<{
  resolve: (value: Response) => void;
  reject: (error: unknown) => void;
  failedRequest: Request;
}> = [];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_RETRIES = 3;
const RETRY_DELAY = 100;

export const refreshToken = async (): Promise<RefreshResult> => {
  if (isRefreshing) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    let retryCount = 0;

    while (retryCount <= MAX_RETRIES) {
      try {
        const { response, error } = await getClient().refreshToken();

        // Don't retry on 401 status
        if (response?.status === 401) {
          return { isRefreshed: false };
        }

        if (error) {
          throw error;
        }

        return { isRefreshed: true };
      } catch (error) {
        console.error('Error refreshing token:', error);

        // If we have retries left, retry with fixed delay
        if (retryCount < MAX_RETRIES) {
          console.warn(
            `Refresh token attempt ${retryCount + 1} failed, retrying in ${RETRY_DELAY}ms`,
          );
          await delay(RETRY_DELAY);
          retryCount++;
          continue;
        }

        return { isRefreshed: false, error };
      }
    }

    return { isRefreshed: false };
  })();

  try {
    const result = await refreshPromise;
    return result;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
};

export const refreshTokenAndRetry = async (failedRequest: Request): Promise<Response> => {
  if (requestQueue.length > 0) {
    return new Promise<Response>((resolve, reject) => {
      requestQueue.push({ resolve, reject, failedRequest });
    });
  }

  const { isRefreshed, error } = await refreshToken();
  if (!isRefreshed || error) {
    // Clear queue and reject all pending requests
    while (requestQueue.length > 0) {
      const { reject } = requestQueue.shift();
      reject(new AuthenticationExpiredError());
    }

    if (!isRefreshed) {
      throw new AuthenticationExpiredError();
    }
    if (error) {
      console.error('Error refreshing token:', error);
      throw new ConnectionError();
    }
  }

  // Process the current request
  const retryResponse = await fetch(failedRequest);

  // Retry all queued requests
  while (requestQueue.length > 0) {
    const {
      resolve,
      reject,
      failedRequest: queuedRequest,
    } = requestQueue.shift() ?? {
      resolve: () => {},
      reject: () => {},
      failedRequest: new Request(''),
    };
    try {
      const retriedResponse = await fetch(queuedRequest);
      resolve(retriedResponse);
    } catch (error) {
      reject(error);
    }
  }

  return retryResponse;
};

export const responseInterceptorWithTokenRefresh = async (response: Response, request: Request) => {
  if (request.url.includes('/v1/auth/refreshToken')) {
    return response;
  }

  if (response.status === 401) {
    try {
      const retryResponse = await refreshTokenAndRetry(request);
      return retryResponse;
    } catch (error) {
      if (error instanceof AuthenticationExpiredError) {
        await logout();
      }
      return response;
    }
  }

  return response;
};
