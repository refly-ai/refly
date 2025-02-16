import { client, BaseResponse } from '@refly/openapi-schema';
import * as requestModule from '@refly/openapi-schema';

import { serverOrigin } from '@refly-packages/ai-workspace-common/utils/env';
import { getRuntime } from '@refly/utils/env';
import {
  AuthenticationExpiredError,
  ConnectionError,
  OperationTooFrequent,
  UnknownError,
} from '@refly/errors';
import { sendToBackground } from '@refly-packages/ai-workspace-common/utils/extension/messaging';
import { MessageName } from '@refly/common-types';
import { safeStringifyJSON } from '@refly-packages/utils/parse';
import { responseInterceptorWithTokenRefresh } from '@refly-packages/ai-workspace-common/utils/auth';
import { getLocale } from '@refly-packages/ai-workspace-common/utils/locale';
import { showErrorNotification } from '@refly-packages/ai-workspace-common/utils/notification';

// Create a WeakMap to store cloned requests
const requestCache = new WeakMap<Request, Request>();

// Function to cache a cloned request
export const cacheClonedRequest = (originalRequest: Request, clonedRequest: Request) => {
  requestCache.set(originalRequest, clonedRequest);
};

// Function to get and clear cached request
export const getAndClearCachedRequest = (originalRequest: Request): Request | undefined => {
  const cachedRequest = requestCache.get(originalRequest);
  if (cachedRequest) {
    requestCache.delete(originalRequest);
  }
  return cachedRequest;
};

client.setConfig({ baseUrl: `${serverOrigin}/v1`, credentials: 'include' });

export interface CheckResponseResult {
  isError: boolean;
  baseResponse?: BaseResponse;
}

export const extractBaseResp = async (response: Response, data: any): Promise<BaseResponse> => {
  if (!response.ok) {
    switch (response.status) {
      case 429:
        return {
          success: false,
          errCode: new OperationTooFrequent().code,
        };

      case 401:
        return {
          success: false,
          errCode: new AuthenticationExpiredError().code,
        };

      default:
        return {
          success: false,
          errCode: new UnknownError().code,
        };
    }
  }

  if (response.headers.get('Content-Type')?.includes('application/json')) {
    return data;
  }

  return { success: true };
};

client.interceptors.request.use(async (request) => {
  // Clone and cache the request before processing
  // Since we may resend the request after refreshing access tokens
  const clonedRequest = request.clone();
  cacheClonedRequest(request, clonedRequest);

  return request;
});

client.interceptors.response.use(async (response, request) => {
  // Get the cached request and clear it from cache
  const cachedRequest = getAndClearCachedRequest(request);
  return await responseInterceptorWithTokenRefresh(response, cachedRequest ?? request);
});

// Helper function to serialize File object
const serializeFile = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer();
  return {
    type: 'File',
    name: file.name,
    content: Array.from(new Uint8Array(arrayBuffer)),
    contentType: file.type,
    lastModified: file.lastModified,
  };
};

// Helper function to serialize FormData
const serializeFormData = async (formData: FormData) => {
  const serialized: Record<string, any> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      serialized[key] = await serializeFile(value);
    } else {
      serialized[key] = value;
    }
  }
  return {
    type: 'FormData',
    data: serialized,
  };
};

// Helper function to check if object contains File or FormData
const hasFileOrFormData = (obj: any): boolean => {
  if (!obj) return false;
  if (obj instanceof File || obj instanceof FormData) return true;
  if (typeof obj === 'object') {
    return Object.values(obj).some((value) => hasFileOrFormData(value));
  }
  return false;
};

interface RequestArg {
  body?: FormData | File | Record<string, any>;
  [key: string]: any;
}

const wrapFunctions = (module: any) => {
  const wrappedModule: any = {};

  for (const key of Reflect.ownKeys(module)) {
    const origMethod = module[key];

    const runtime = getRuntime() || '';
    if (runtime.includes('extension') && typeof origMethod === 'function') {
      wrappedModule[key] = async (...args: unknown[]) => {
        console.log(`Calling function ${String(key)} with arguments: ${safeStringifyJSON(args)}`);

        try {
          const hasFileData = args.some((arg) => hasFileOrFormData(arg));

          let serializedArgs = args;
          if (hasFileData) {
            serializedArgs = await Promise.all(
              args.map(async (arg) => {
                if (!arg || typeof arg !== 'object') return arg;
                const serialized = { ...arg } as RequestArg;
                if (serialized.body instanceof FormData) {
                  serialized.body = await serializeFormData(serialized.body);
                } else if (serialized.body instanceof File) {
                  serialized.body = await serializeFile(serialized.body);
                } else if (typeof serialized.body === 'object') {
                  for (const [key, value] of Object.entries(serialized.body)) {
                    if (value instanceof File) {
                      serialized.body[key] = await serializeFile(value);
                    }
                  }
                }
                return serialized;
              }),
            );
          }

          const res = (await sendToBackground({
            name: String(key) as MessageName,
            type: 'apiRequest',
            source: getRuntime(),
            target: module,
            args: serializedArgs,
            hasFileData,
          })) as { response: Response; data: any; error: { errCode: string; success: boolean } };

          if (res?.response && runtime !== 'extension-csui') {
            const error = res?.error;
            if (!error.success) {
              showErrorNotification(error, getLocale());
            }
          }

          return res;
        } catch (err) {
          const errResp = {
            success: false,
            errCode: new ConnectionError(err).code,
          };
          showErrorNotification(errResp, getLocale());
          return {
            error: errResp,
          };
        }
      };
    } else {
      wrappedModule[key] = async (...args: unknown[]) => {
        try {
          const response = await origMethod(...args);

          if (response) {
            const error = await extractBaseResp(response?.response as Response, response?.data);
            if (!error.success) {
              showErrorNotification(error, getLocale());
            }
          }

          return response;
        } catch (err) {
          const errResp = {
            success: false,
            errCode: new ConnectionError(err).code,
          };
          showErrorNotification(errResp, getLocale());
          return {
            error: errResp,
          };
        }
      };
    }
  }

  return wrappedModule as typeof requestModule;
};

const wrappedRequestModule = () => {
  return wrapFunctions(requestModule);
};

export default wrappedRequestModule;
