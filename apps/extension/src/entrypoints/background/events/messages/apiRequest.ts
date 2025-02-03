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
  error: { errCode: string; success: boolean; traceId?: string };
}

// Helper function to process response before sending through messaging
const processResponse = async (response: Response, data: any): Promise<ProcessedResponse> => {
  // Clone response early to avoid body already read issues

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
    // Use the cloned response for JSON parsing
    parsedBody = data;
  } else {
    parsedBody = { success: true };
  }

  // Return both original response properties and parsed body
  return {
    response: {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    },
    error: parsedBody,
  };
};

export const handleRequestReflect = async (msg: BackgroundMessage) => {
  // @ts-ignore
  const res = await requestModule[msg.name as keyof typeof requestModule]?.call?.(null, {
    ...msg.args?.[0],
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
