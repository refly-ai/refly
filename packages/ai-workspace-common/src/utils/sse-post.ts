import { InvokeSkillRequest, SkillEvent } from '@refly/openapi-schema';
import { scrollToBottom } from '@refly-packages/ai-workspace-common/utils/ui';
import { extractBaseResp } from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { ConnectionError, AuthenticationExpiredError } from '@refly/errors';
import { refreshToken } from './auth';
import { isDesktop, serverOrigin } from './env';

const makeSSERequest = async (
  payload: InvokeSkillRequest,
  controller: AbortController,
  isRetry = false,
): Promise<Response> => {
  const response = await fetch(`${serverOrigin}/v1/skill/streamInvoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: isDesktop ? 'omit' : 'include',
    signal: controller.signal,
    body: JSON.stringify(payload),
  });

  if (response.status === 401 && !isRetry) {
    try {
      await refreshToken();
      return makeSSERequest(payload, controller, true);
    } catch (error) {
      if (error instanceof AuthenticationExpiredError) {
        throw error;
      }
      throw new ConnectionError(error);
    }
  }

  return response;
};

export const ssePost = async ({
  controller,
  payload,
  onSkillLog,
  onSkillStart,
  onSkillStream,
  onSkillEnd,
  onSkillArtifact,
  onSkillStructedData,
  onSkillCreateNode,
  onSkillTokenUsage,
  onSkillError,
  onCompleted,
}: {
  controller: AbortController;
  payload: InvokeSkillRequest;
  onStart: () => void;
  onSkillLog: (event: SkillEvent) => void;
  onSkillStart: (event: SkillEvent) => void;
  onSkillStream: (event: SkillEvent) => void;
  onSkillEnd: (event: SkillEvent) => void;
  onSkillStructedData: (event: SkillEvent) => void;
  onSkillCreateNode: (event: SkillEvent) => void;
  onSkillArtifact: (event: SkillEvent) => void;
  onSkillTokenUsage?: (event: SkillEvent) => void;
  onSkillError?: (event: SkillEvent) => void;
  onCompleted?: (val?: boolean) => void;
}) => {
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  try {
    const response = await makeSSERequest(payload, controller);

    const baseResp = await extractBaseResp(response, { success: true });
    if (!baseResp.success) {
      onSkillError?.({ error: baseResp, event: 'error' });
      return;
    }

    reader = response.body?.getReader();
    const decoder = new TextDecoder('utf-8');
    let isSkillFirstMessage = true;
    let bufferStr = '';

    const read = async () => {
      let hasError = false;
      try {
        if (!reader) {
          throw new Error('Reader is not initialized');
        }
        const { done, value } = await reader.read();

        if (done) {
          onCompleted?.();

          return;
        }

        bufferStr += decoder.decode(value, { stream: true });
        const lines = bufferStr.split('\n');
        let skillEvent: SkillEvent;

        try {
          for (const message of lines ?? []) {
            if (message.startsWith('data: ')) {
              try {
                skillEvent = JSON.parse(message.substring(6)) as SkillEvent;
              } catch (err) {
                console.log('Parse error:', {
                  message: message.substring(6),
                  error: err,
                });
                // return;
              }

              if (skillEvent?.event === 'start') {
                if (isSkillFirstMessage) {
                  onSkillStart(skillEvent);
                }
              } else if (skillEvent?.event === 'log') {
                onSkillLog(skillEvent);
              } else if (skillEvent?.event === 'end') {
                onSkillEnd(skillEvent);
                isSkillFirstMessage = true;
              } else if (skillEvent?.event === 'stream') {
                onSkillStream(skillEvent);
              } else if (skillEvent?.event === 'artifact') {
                onSkillArtifact(skillEvent);
              } else if (skillEvent?.event === 'structured_data') {
                onSkillStructedData(skillEvent);
              } else if (skillEvent?.event === 'create_node') {
                onSkillCreateNode(skillEvent);
              } else if (skillEvent?.event === 'token_usage') {
                onSkillTokenUsage?.(skillEvent);
              } else if (skillEvent?.event === 'error') {
                onSkillError?.(skillEvent);
              }
              setTimeout(() => {
                // 滑动到底部
                scrollToBottom();
              });
            }
          }

          bufferStr = lines[lines.length - 1];
        } catch (err) {
          onSkillError(err);
          onCompleted?.(true);
          hasError = true;

          return;
        }

        if (!hasError) {
          await read();
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('Read operation aborted');
          return;
        }
      }
    };

    await read();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Fetch aborted');
    } else {
      console.error('Fetch error:', error);
      onSkillError?.({
        error: {
          success: false,
          errCode: new ConnectionError(error).code,
        },
        event: 'error',
      });
    }
  } finally {
    // 清理资源
    if (reader) {
      try {
        await reader.cancel();
      } catch (cancelError) {
        console.error('Error cancelling reader:', cancelError);
      }
      reader.releaseLock();
    }
  }
};
