import { browser } from 'wxt/browser';
import { getLastActiveTab } from '@refly-packages/ai-workspace-common/utils/extension/tabs';
import * as requestModule from '@refly/openapi-schema';
import { BackgroundMessage } from '@refly/common-types';
import { createClient } from '@hey-api/client-fetch';
import { getExtensionServerOrigin } from '@refly/utils/url';
import { AuthenticationExpiredError, OperationTooFrequent, UnknownError } from '@refly/errors';

const client = createClient({
  baseUrl: `${getExtensionServerOrigin()}/v1`,
  credentials: 'include',
});

interface ProcessedResponse {
  response: {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
  };
  error: { errCode: string; success: boolean; traceId?: string; errMsg: string };
}

interface RequestArg {
  body?: any;
  [key: string]: any;
}

// Helper function to process response before sending through messaging
const processResponse = async (response: Response, data: any): Promise<ProcessedResponse> => {
  let parsedBody: any;

  // Handle non-ok responses
  if (!response.ok) {
    switch (response.status) {
      case 429:
        parsedBody = {
          success: false,
          errCode: new OperationTooFrequent().code,
        };
        break;

      case 401:
        parsedBody = {
          success: false,
          errCode: new AuthenticationExpiredError().code,
        };
        break;

      default:
        parsedBody = {
          success: false,
          errCode: new UnknownError().code,
        };
        break;
    }
  } else if (response.headers.get('Content-Type')?.includes('application/json')) {
    parsedBody = data;
  } else {
    parsedBody = { success: true };
  }

  // Convert headers to object using Array.from
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    response: {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers,
    },
    error: parsedBody,
  };
};

// Helper function to deserialize File object
const deserializeFile = (serializedFile: any) => {
  const uint8Array = new Uint8Array(serializedFile.content);
  return new File([uint8Array], serializedFile.name, {
    type: serializedFile.contentType,
    lastModified: serializedFile.lastModified,
  });
};

// Helper function to deserialize FormData
const deserializeFormData = (serializedFormData: any) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(serializedFormData.data)) {
    if (value && typeof value === 'object' && 'type' in value && value.type === 'File') {
      formData.append(key, deserializeFile(value) as Blob);
    } else {
      formData.append(key, value as string);
    }
  }
  return formData;
};

export const handleRequestReflect = async (msg: BackgroundMessage) => {
  // Deserialize File/FormData if present
  let args = msg.args;
  if (msg.hasFileData) {
    args = args?.map((arg: any) => {
      if (!arg || typeof arg !== 'object') return arg;

      const deserialized = { ...arg } as RequestArg;
      if (deserialized.body && typeof deserialized.body === 'object') {
        if ('type' in deserialized.body) {
          if (deserialized.body.type === 'FormData') {
            deserialized.body = deserializeFormData(deserialized.body);
          } else if (deserialized.body.type === 'File') {
            deserialized.body = deserializeFile(deserialized.body);
          }
        } else {
          for (const [key, value] of Object.entries(deserialized.body)) {
            if (value && typeof value === 'object' && 'type' in value && value.type === 'File') {
              deserialized.body[key] = deserializeFile(value);
            }
          }
        }
      }
      return deserialized;
    });
  }

  // @ts-ignore
  const res = await requestModule[msg.name as keyof typeof requestModule]?.call?.(null, {
    ...args?.[0],
    client,
  });

  // Process the response before sending through messaging
  const processedResponse = await processResponse(res?.response, res?.data);
  const lastActiveTab = await getLastActiveTab();

  const messageBody = {
    url: res?.url,
    redirected: res?.redirected,
    type: res?.type,
    response: processedResponse?.response,
    data: res?.data,
    error: processedResponse?.error,
  };

  console.log('messageBody', messageBody);

  if (msg?.source === 'extension-csui') {
    await browser.tabs.sendMessage(lastActiveTab?.id as number, {
      name: msg?.name,
      body: messageBody,
    });
  } else if (msg?.source === 'extension-sidepanel' || msg?.source === 'extension-popup') {
    try {
      await browser.runtime.sendMessage({
        name: msg?.name,
        body: messageBody,
      });
    } catch (err) {
      console.log('handleRequestReflect send message error', err);
    }
  }
};
